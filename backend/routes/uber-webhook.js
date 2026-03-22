'use strict';

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const { compararTextoSegura } = require('../lib/helpers');

function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase();
}

function statusInternoPorEvento(eventTypeRaw) {
  const eventType = toLowerTrim(eventTypeRaw);
  if (eventType.includes('pickup')) return 'pickup';
  if (eventType.includes('in_transit') || eventType.includes('dropoff_started')) return 'in_transit';
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
        'SELECT id FROM pedidos WHERE uber_delivery_id = ? LIMIT 1',
        [deliveryId]
      );

      if (!pedidoRows.length) {
        return res.status(202).json({ ok: true, ignored: true, reason: 'pedido_not_found' });
      }

      const pedidoId = Number(pedidoRows[0].id);
      const etaSeconds = Number(payload?.eta_seconds || payload?.eta || 0) || null;
      const vehicleType = String(payload?.courier?.vehicle_type || payload?.vehicle_type || '').trim() || null;

      let statusPedido = null;
      if (eventTypeInterno === 'delivered') {
        statusPedido = 'entregue';
      } else if (eventTypeInterno === 'in_transit' || eventTypeInterno === 'pickup') {
        statusPedido = 'enviado';
      }

      await pool.query(
        `UPDATE pedidos
            SET entrega_status = ?,
                uber_eta_seconds = ?,
                uber_vehicle_type = ?,
                atualizado_em = NOW(),
                status = COALESCE(?, status),
                entregue_em = CASE WHEN ? = 'entregue' THEN COALESCE(entregue_em, NOW()) ELSE entregue_em END,
                cancelado_em = CASE WHEN ? = 'canceled' THEN COALESCE(cancelado_em, NOW()) ELSE cancelado_em END
          WHERE id = ?`,
        [
          eventTypeInterno,
          etaSeconds,
          vehicleType,
          statusPedido,
          statusPedido,
          eventTypeInterno,
          pedidoId
        ]
      );

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
