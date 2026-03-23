'use strict';

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const { compararTextoSegura } = require('../lib/helpers');

const DELIVERY_STATUS_RANK = Object.freeze({
  pending: 10,
  pickup: 20,
  in_transit: 30,
  near: 40,
  delivered: 50,
  returned: 60,
  canceled: 70
});

function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase();
}

function statusInternoPorEvento(eventTypeRaw) {
  const eventType = toLowerTrim(eventTypeRaw);
  if (eventType.includes('pickup')) return 'pickup';
  if (eventType.includes('in_transit') || eventType.includes('dropoff_started')) return 'in_transit';
  if (eventType.includes('arriving') || eventType.includes('near') || eventType.includes('soon')) return 'near';
  if (eventType.includes('delivered') || eventType.includes('dropoff_completed')) return 'delivered';
  if (eventType.includes('canceled') || eventType.includes('cancelled')) return 'canceled';
  if (eventType.includes('returned')) return 'returned';
  return 'pending';
}

function extrairDeliveryId(payload = {}) {
  return String(
    payload?.delivery_id
    || payload?.id
    || payload?.delivery?.id
    || payload?.resource_id
    || ''
  ).trim();
}

function validarWebhookUber(req, webhookToken) {
  const tokenHeader = String(req.headers['x-uber-webhook-token'] || req.headers['x-webhook-token'] || '').trim();
  const tokenQuery = String(req.query?.token || '').trim();

  if (!webhookToken) {
    return false;
  }

  if (tokenHeader && compararTextoSegura(tokenHeader, webhookToken)) {
    return true;
  }

  if (tokenQuery && compararTextoSegura(tokenQuery, webhookToken)) {
    return true;
  }

  return false;
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return null;
  }

  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ****-${digits.slice(6)}`;
}

function firstTruthy(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }

  return '';
}

async function getPedidosColumns(pool) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'pedidos'`
  );

  return new Set(
    (rows || [])
      .map((row) => String(row?.COLUMN_NAME || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

async function hasTable(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [tableName]
  );

  return Number(rows?.[0]?.total || 0) > 0;
}

module.exports = function createUberWebhookRoutes({ pool, webhookToken, IS_PRODUCTION }) {
  const router = express.Router();

  router.post('/api/webhooks/uber', async (req, res) => {
    try {
      if (!validarWebhookUber(req, webhookToken)) {
        return res.status(401).json({ error: 'Webhook Uber não autorizado.' });
      }

      const payload = req.body || {};
      const eventType = String(payload?.event_type || payload?.status || payload?.event || 'pending').trim();
      const deliveryId = extrairDeliveryId(payload);
      const eventExternalId = String(payload?.event_id || payload?.id || '').trim() || crypto
        .createHash('sha1')
        .update(JSON.stringify(payload))
        .digest('hex');

      if (!deliveryId) {
        return res.status(400).json({ error: 'delivery_id ausente no webhook Uber.' });
      }

      const eventTypeInterno = statusInternoPorEvento(eventType);
      const pedidosColumns = await getPedidosColumns(pool);
      const trackingEventsTableExists = await hasTable(pool, 'delivery_tracking_events');

      await pool.query(
        `INSERT IGNORE INTO uber_delivery_events
          (event_external_id, pedido_id, uber_delivery_id, event_type, payload)
         SELECT ?, p.id, ?, ?, ?
           FROM pedidos p
          WHERE p.uber_delivery_id = ?
          LIMIT 1`,
        [eventExternalId, deliveryId, eventTypeInterno, JSON.stringify(payload), deliveryId]
      );

      const [pedidoRows] = await pool.query(
        `SELECT id,
                ${pedidosColumns.has('delivery_status_internal') ? 'delivery_status_internal' : 'NULL AS delivery_status_internal'}
           FROM pedidos
          WHERE uber_delivery_id = ?
          LIMIT 1`,
        [deliveryId]
      );

      if (!pedidoRows.length) {
        return res.status(202).json({ ok: true, ignored: true, reason: 'pedido_not_found' });
      }

      const pedidoId = Number(pedidoRows[0].id);
      const statusAtualInterno = toLowerTrim(pedidoRows[0]?.delivery_status_internal);
      const statusAtualRank = DELIVERY_STATUS_RANK[statusAtualInterno] || 0;
      const statusNovoRank = DELIVERY_STATUS_RANK[eventTypeInterno] || 0;
      const isTerminalAtual = statusAtualInterno === 'delivered' || statusAtualInterno === 'canceled' || statusAtualInterno === 'returned';
      const isNovoTerminal = eventTypeInterno === 'delivered' || eventTypeInterno === 'canceled' || eventTypeInterno === 'returned';
      const shouldAdvance = isTerminalAtual
        ? (statusAtualInterno === eventTypeInterno || (statusAtualInterno === 'returned' && eventTypeInterno === 'canceled'))
        : (statusNovoRank >= statusAtualRank || statusAtualRank === 0 || isNovoTerminal);

      const etaSeconds = Number(payload?.eta_seconds || payload?.eta || payload?.estimated_delivery_time_seconds || 0) || null;
      const etaCenter = etaSeconds ? Math.max(1, Math.round(etaSeconds / 60)) : null;
      const etaMin = etaCenter ? Math.max(5, etaCenter - 8) : null;
      const etaMax = etaCenter ? etaCenter + 10 : null;
      const vehicleType = firstTruthy(
        payload?.courier?.vehicle_type,
        payload?.courier?.vehicle,
        payload?.vehicle_type,
        payload?.vehicle
      ) || null;
      const trackingUrl = firstTruthy(payload?.tracking_url, payload?.tracking?.url, payload?.order_tracking_url) || null;
      const courierName = firstTruthy(payload?.courier?.name, payload?.courier_name) || null;
      const courierPhoneMasked = maskPhone(firstTruthy(payload?.courier?.phone_number, payload?.courier_phone, payload?.contact_phone));
      const courierLat = Number(payload?.courier?.location?.lat ?? payload?.courier?.lat ?? payload?.location?.lat);
      const courierLng = Number(payload?.courier?.location?.lng ?? payload?.courier?.lng ?? payload?.location?.lng);
      const deliveryPin = firstTruthy(payload?.pincode, payload?.pin_code, payload?.delivery_pin) || null;
      const proofPhotoUrl = firstTruthy(payload?.proof?.photo_url, payload?.proof_photo_url) || null;
      const proofSignatureUrl = firstTruthy(payload?.proof?.signature_url, payload?.proof_signature_url) || null;

      if (trackingEventsTableExists) {
        await pool.query(
          `INSERT INTO delivery_tracking_events
            (pedido_id, source, provider_event_id, event_name, status_internal, status_provider, title, description, occurred_at, payload)
           VALUES (?, 'provider', ?, ?, ?, ?, ?, ?, NOW(), ?)
           ON DUPLICATE KEY UPDATE
            status_internal = VALUES(status_internal),
            status_provider = VALUES(status_provider),
            title = VALUES(title),
            description = VALUES(description),
            payload = VALUES(payload),
            occurred_at = VALUES(occurred_at)`,
          [
            pedidoId,
            eventExternalId,
            toLowerTrim(eventType) || 'uber_event',
            eventTypeInterno,
            toLowerTrim(eventType) || null,
            'Atualização da entrega',
            `Evento de entrega recebido: ${toLowerTrim(eventType) || eventTypeInterno}`,
            JSON.stringify(payload)
          ]
        );
      }

      let statusPedido = null;
      if (eventTypeInterno === 'delivered') {
        statusPedido = 'entregue';
      } else if (eventTypeInterno === 'canceled') {
        statusPedido = 'cancelado';
      } else if (eventTypeInterno === 'in_transit' || eventTypeInterno === 'pickup' || eventTypeInterno === 'near') {
        statusPedido = 'enviado';
      }

      const updateFields = [];
      const updateParams = [];

      const setOptional = (columnName, valueOrSql, raw = false) => {
        if (!pedidosColumns.has(String(columnName || '').trim().toLowerCase())) {
          return;
        }

        if (raw) {
          updateFields.push(`${columnName} = ${valueOrSql}`);
          return;
        }

        updateFields.push(`${columnName} = ?`);
        updateParams.push(valueOrSql);
      };

      setOptional('entrega_status', shouldAdvance ? eventTypeInterno : statusAtualInterno || eventTypeInterno);
      setOptional('delivery_status_internal', shouldAdvance ? eventTypeInterno : statusAtualInterno || eventTypeInterno);
      setOptional('delivery_status_provider', toLowerTrim(eventType) || null);
      setOptional('delivery_provider', 'uber');
      setOptional('delivery_mode', vehicleType ? toLowerTrim(vehicleType) : 'unknown');
      setOptional('uber_eta_seconds', etaSeconds);
      setOptional('delivery_eta_min', etaMin);
      setOptional('delivery_eta_max', etaMax);
      setOptional('uber_vehicle_type', vehicleType);
      setOptional('courier_vehicle', vehicleType);
      setOptional('courier_name', courierName);
      setOptional('courier_phone_masked', courierPhoneMasked);
      if (Number.isFinite(courierLat)) {
        setOptional('courier_lat', Number(courierLat.toFixed(7)));
      }
      if (Number.isFinite(courierLng)) {
        setOptional('courier_lng', Number(courierLng.toFixed(7)));
      }
      setOptional('uber_tracking_url', trackingUrl);
      setOptional('delivery_tracking_url', trackingUrl);
      setOptional('delivery_pin', deliveryPin);
      setOptional('delivery_proof_photo_url', proofPhotoUrl);
      setOptional('delivery_proof_signature_url', proofSignatureUrl);
      setOptional('last_delivery_event_at', 'NOW()', true);
      setOptional('atualizado_em', 'NOW()', true);

      if (statusPedido) {
        setOptional('status', statusPedido);
      }

      if (statusPedido === 'entregue') {
        setOptional('entregue_em', 'COALESCE(entregue_em, NOW())', true);
      }

      if (eventTypeInterno === 'canceled') {
        setOptional('cancelado_em', 'COALESCE(cancelado_em, NOW())', true);
      }

      if (updateFields.length > 0) {
        await pool.query(
          `UPDATE pedidos
              SET ${updateFields.join(', ')}
            WHERE id = ?`,
          [...updateParams, pedidoId]
        );
      }

      return res.json({ ok: true });
    } catch (error) {
      logger.error('webhook.uber erro', {
        message: error?.message,
        stack: IS_PRODUCTION ? undefined : error?.stack
      });
      return res.status(500).json({ error: 'Falha ao processar webhook Uber.' });
    }
  });

  return router;
};
