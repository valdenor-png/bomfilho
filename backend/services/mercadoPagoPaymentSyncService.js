'use strict';

const logger = require('../lib/logger');
const {
  normalizeGatewayStatus,
  mapGatewayStatusToOrderStatus,
  mapGatewayStatusToPixStatus,
  mapGatewayStatusToInternalPaymentStatus,
  buildTransitionDecision
} = require('./mercadoPagoStatusPolicy');

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Number(fallback || 0);
  }
  return Math.trunc(parsed);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function parseDateOrNull(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const shallow = { ...payload };
  if (shallow.card) shallow.card = '[masked]';
  if (shallow.payer?.identification?.number) {
    shallow.payer = {
      ...shallow.payer,
      identification: {
        ...shallow.payer.identification,
        number: '[masked]'
      }
    };
  }
  return shallow;
}

function safeJsonStringify(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ invalid_payload: true });
  }
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' || message.includes('column') && message.includes('does not exist');
}

function isMissingTableError(error) {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('relation') && message.includes('does not exist');
}

async function selectPedidoById(conn, pedidoId) {
  const [rows] = await conn.query(
    `SELECT id,
            status,
            usuario_id,
            mp_payment_id_mp,
            mp_external_reference,
            mp_status,
            mp_status_detail,
            mp_payment_status_internal,
            pix_status
       FROM pedidos
      WHERE id = ?
      LIMIT 1`,
    [pedidoId]
  );
  return rows?.[0] || null;
}

async function selectPedidoByPaymentId(conn, paymentId) {
  const [rows] = await conn.query(
    `SELECT id,
            status,
            usuario_id,
            mp_payment_id_mp,
            mp_external_reference,
            mp_status,
            mp_status_detail,
            mp_payment_status_internal,
            pix_status
       FROM pedidos
      WHERE mp_payment_id_mp = ?
      LIMIT 1`,
    [paymentId]
  );
  return rows?.[0] || null;
}

async function selectPedidoByExternalReference(conn, externalReference) {
  const [rows] = await conn.query(
    `SELECT id,
            status,
            usuario_id,
            mp_payment_id_mp,
            mp_external_reference,
            mp_status,
            mp_status_detail,
            mp_payment_status_internal,
            pix_status
       FROM pedidos
      WHERE mp_external_reference = ?
      LIMIT 1`,
    [externalReference]
  );
  return rows?.[0] || null;
}

async function selectPedidoFallbackById(conn, pedidoId) {
  const [rows] = await conn.query(
    `SELECT id,
            status,
            usuario_id,
            mp_payment_id_mp,
            pix_status
       FROM pedidos
      WHERE id = ?
      LIMIT 1`,
    [pedidoId]
  );

  const row = rows?.[0] || null;
  if (!row) return null;
  return {
    ...row,
    mp_external_reference: null,
    mp_status: null,
    mp_status_detail: null,
    mp_payment_status_internal: null
  };
}

async function selectPedidoFallbackByPaymentId(conn, paymentId) {
  const [rows] = await conn.query(
    `SELECT id,
            status,
            usuario_id,
            mp_payment_id_mp,
            pix_status
       FROM pedidos
      WHERE mp_payment_id_mp = ?
      LIMIT 1`,
    [paymentId]
  );

  const row = rows?.[0] || null;
  if (!row) return null;
  return {
    ...row,
    mp_external_reference: null,
    mp_status: null,
    mp_status_detail: null,
    mp_payment_status_internal: null
  };
}

function montarResumoPedido(pedido) {
  if (!pedido) return null;
  return {
    id: toInt(pedido.id, 0),
    status: normalizeLower(pedido.status || 'pendente'),
    mp_payment_id_mp: normalizeText(pedido.mp_payment_id_mp || ''),
    mp_status: normalizeGatewayStatus(pedido.mp_status || pedido.pix_status || 'unknown'),
    pix_status: normalizeText(pedido.pix_status || '')
  };
}

async function inserirAuditoriaPagamento(conn, payload = {}) {
  try {
    await conn.query(
      `INSERT INTO pedido_pagamento_auditoria (
        pedido_id,
        mp_payment_id,
        mp_external_reference,
        status_gateway_anterior,
        status_gateway_novo,
        status_interno_anterior,
        status_interno_novo,
        origem,
        motivo,
        event_id,
        request_id,
        idempotency_key,
        aplicado,
        payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
      [
        payload.pedidoId || null,
        normalizeText(payload.paymentId || '') || null,
        normalizeText(payload.externalReference || '') || null,
        normalizeText(payload.gatewayStatusBefore || '') || null,
        normalizeText(payload.gatewayStatusAfter || '') || null,
        normalizeText(payload.orderStatusBefore || '') || null,
        normalizeText(payload.orderStatusAfter || '') || null,
        normalizeText(payload.source || 'desconhecido').slice(0, 64) || 'desconhecido',
        normalizeText(payload.reason || 'indefinido').slice(0, 80) || 'indefinido',
        normalizeText(payload.eventId || '') || null,
        normalizeText(payload.requestId || '') || null,
        normalizeText(payload.idempotencyKey || '') || null,
        payload.applied === true,
        safeJsonStringify(payload.payload || {})
      ]
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      logger.warn('[MP Sync] Tabela de auditoria de pagamento ausente. Rode a migration correspondente.');
      return;
    }
    logger.warn('[MP Sync] Falha ao inserir auditoria de pagamento.', {
      message: error?.message || null
    });
  }
}

function criarMercadoPagoPaymentSyncService({ pool, mercadoPagoService }) {
  if (!pool) {
    throw new Error('pool obrigatorio para criar serviço de sincronização de pagamentos Mercado Pago.');
  }

  async function encontrarPedidoPorReferencias({ pedidoId, paymentId, externalReference } = {}, connParam = null) {
    const conn = connParam || await pool.getConnection();
    const managedConnection = !connParam;

    try {
      const pedidoIdNumerico = toInt(pedidoId, 0);
      const externalRef = normalizeText(externalReference || '');
      const paymentRef = normalizeText(paymentId || '');

      if (pedidoIdNumerico > 0) {
        try {
          return await selectPedidoById(conn, pedidoIdNumerico);
        } catch (error) {
          if (!isMissingColumnError(error)) {
            throw error;
          }
          return selectPedidoFallbackById(conn, pedidoIdNumerico);
        }
      }

      if (externalRef) {
        const externalAsOrderId = toInt(externalRef, 0);
        if (externalAsOrderId > 0) {
          try {
            return await selectPedidoById(conn, externalAsOrderId);
          } catch (error) {
            if (!isMissingColumnError(error)) {
              throw error;
            }
            return selectPedidoFallbackById(conn, externalAsOrderId);
          }
        }

        try {
          const byExternalReference = await selectPedidoByExternalReference(conn, externalRef);
          if (byExternalReference) return byExternalReference;
        } catch (error) {
          if (!isMissingColumnError(error)) {
            throw error;
          }
        }
      }

      if (paymentRef) {
        try {
          return await selectPedidoByPaymentId(conn, paymentRef);
        } catch (error) {
          if (!isMissingColumnError(error)) {
            throw error;
          }
          return selectPedidoFallbackByPaymentId(conn, paymentRef);
        }
      }

      return null;
    } finally {
      if (managedConnection) {
        conn.release();
      }
    }
  }

  async function sincronizarPagamentoComPedido({
    payment,
    source = 'desconhecido',
    requestId = null,
    eventId = null,
    idempotencyKey = null,
    rawPayload = null,
    markWebhookReceived = false,
    markReconciled = false
  } = {}) {
    const paymentId = normalizeText(payment?.id || payment?.payment_id || '');
    const externalReference = normalizeText(payment?.external_reference || '');
    const gatewayStatus = normalizeGatewayStatus(payment?.status || payment?.mp_status || 'unknown');
    const statusDetail = normalizeText(payment?.status_detail || '');
    const qrCode = normalizeText(payment?.qr_code || payment?.pix_codigo || '');
    const qrCodeBase64 = normalizeText(payment?.qr_code_base64 || '');
    const ticketUrl = normalizeText(payment?.ticket_url || payment?.pix_qrcode || '');
    const dateCreated = parseDateOrNull(payment?.date_created || payment?.data_criacao_pagamento);
    const dateApproved = parseDateOrNull(payment?.date_approved || payment?.data_aprovacao_pagamento);
    const statusOrderNovo = mapGatewayStatusToOrderStatus(gatewayStatus);
    const pixStatusNovo = mapGatewayStatusToPixStatus(gatewayStatus);
    const paymentStatusInternoNovo = mapGatewayStatusToInternalPaymentStatus(gatewayStatus);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const pedido = await encontrarPedidoPorReferencias(
        {
          externalReference,
          paymentId
        },
        conn
      );

      if (!pedido) {
        await conn.commit();
        return {
          applied: false,
          reason: 'pedido_nao_encontrado',
          paymentId,
          externalReference
        };
      }

      const statusGatewayAtual = normalizeGatewayStatus(pedido.mp_status || pedido.pix_status || 'unknown');
      const statusPedidoAtual = normalizeLower(pedido.status || 'pendente');
      const decision = buildTransitionDecision({
        currentGatewayStatus: statusGatewayAtual,
        nextGatewayStatus: gatewayStatus,
        currentOrderStatus: statusPedidoAtual,
        nextOrderStatus: statusOrderNovo
      });

      if (!decision.shouldApply) {
        try {
          await conn.query(
            `UPDATE pedidos
                SET mp_last_webhook_at = CASE WHEN ? THEN NOW() ELSE mp_last_webhook_at END,
                    mp_last_reconciled_at = CASE WHEN ? THEN NOW() ELSE mp_last_reconciled_at END
              WHERE id = ?`,
            [Boolean(markWebhookReceived), Boolean(markReconciled), pedido.id]
          );
        } catch (errorUpdate) {
          if (!isMissingColumnError(errorUpdate)) {
            throw errorUpdate;
          }
        }

        await inserirAuditoriaPagamento(conn, {
          pedidoId: pedido.id,
          paymentId,
          externalReference,
          gatewayStatusBefore: statusGatewayAtual,
          gatewayStatusAfter: gatewayStatus,
          orderStatusBefore: statusPedidoAtual,
          orderStatusAfter: statusOrderNovo,
          source,
          reason: decision.reason,
          requestId,
          eventId,
          idempotencyKey,
          applied: false,
          payload: sanitizePayload(rawPayload || payment)
        });

        await conn.commit();

        return {
          applied: false,
          reason: decision.reason,
          pedido: montarResumoPedido(pedido),
          transition: decision
        };
      }

      const paymentIdPersistir = paymentId || normalizeText(pedido.mp_payment_id_mp || '');
      const externalReferencePersistir = externalReference || normalizeText(pedido.mp_external_reference || '') || String(pedido.id);
      const statusInternoParaPersistir = statusOrderNovo || statusPedidoAtual || 'pendente';
      const shouldSetPaidAt = statusInternoParaPersistir === 'pago';

      try {
        await conn.query(
          `UPDATE pedidos SET
              status = ?,
              gateway_pagamento = 'mercadopago',
              mp_payment_id_mp = ?,
              mp_external_reference = COALESCE(NULLIF(?, ''), mp_external_reference),
              mp_status = ?,
              mp_status_detail = ?,
              mp_payment_status_internal = ?,
              pix_status = ?,
              pix_codigo = CASE WHEN ? <> '' THEN ? ELSE pix_codigo END,
              pix_qrcode = CASE WHEN ? <> '' THEN ? ELSE pix_qrcode END,
              pix_qr_base64 = CASE WHEN ? <> '' THEN ? ELSE pix_qr_base64 END,
              mp_data_criacao_pagamento = COALESCE(mp_data_criacao_pagamento, ?),
              mp_data_aprovacao_pagamento = CASE
                WHEN ? IS NULL THEN mp_data_aprovacao_pagamento
                ELSE COALESCE(mp_data_aprovacao_pagamento, ?)
              END,
              mp_last_webhook_at = CASE WHEN ? THEN NOW() ELSE mp_last_webhook_at END,
              mp_last_reconciled_at = CASE WHEN ? THEN NOW() ELSE mp_last_reconciled_at END,
              mp_payload_ultimo = ?::jsonb,
              pago_em = CASE WHEN ? THEN COALESCE(pago_em, NOW()) ELSE pago_em END,
              atualizado_em = NOW()
            WHERE id = ?`,
          [
            statusInternoParaPersistir,
            paymentIdPersistir,
            externalReferencePersistir,
            gatewayStatus,
            statusDetail || null,
            paymentStatusInternoNovo,
            pixStatusNovo,
            qrCode,
            qrCode,
            ticketUrl,
            ticketUrl,
            qrCodeBase64,
            qrCodeBase64,
            dateCreated,
            dateApproved,
            dateApproved,
            Boolean(markWebhookReceived),
            Boolean(markReconciled),
            safeJsonStringify(sanitizePayload(rawPayload || payment) || {}),
            shouldSetPaidAt,
            pedido.id
          ]
        );
      } catch (errorUpdate) {
        if (!isMissingColumnError(errorUpdate)) {
          throw errorUpdate;
        }

        await conn.query(
          `UPDATE pedidos SET
              status = ?,
              gateway_pagamento = 'mercadopago',
              mp_payment_id_mp = ?,
              pix_status = ?,
              pago_em = CASE WHEN ? THEN COALESCE(pago_em, NOW()) ELSE pago_em END,
              atualizado_em = NOW()
            WHERE id = ?`,
          [
            statusInternoParaPersistir,
            paymentIdPersistir,
            pixStatusNovo,
            shouldSetPaidAt,
            pedido.id
          ]
        );
      }

      await inserirAuditoriaPagamento(conn, {
        pedidoId: pedido.id,
        paymentId: paymentIdPersistir,
        externalReference: externalReferencePersistir,
        gatewayStatusBefore: statusGatewayAtual,
        gatewayStatusAfter: gatewayStatus,
        orderStatusBefore: statusPedidoAtual,
        orderStatusAfter: statusInternoParaPersistir,
        source,
        reason: 'status_transition_applied',
        requestId,
        eventId,
        idempotencyKey,
        applied: true,
        payload: sanitizePayload(rawPayload || payment)
      });

      await conn.commit();

      return {
        applied: true,
        reason: 'status_transition_applied',
        pedido: {
          id: toInt(pedido.id, 0),
          status_anterior: statusPedidoAtual,
          status_novo: statusInternoParaPersistir,
          mp_status_anterior: statusGatewayAtual,
          mp_status_novo: gatewayStatus,
          pix_status_novo: pixStatusNovo
        },
        transition: decision
      };
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        // rollback best effort
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  async function reconciliarPagamentoPorPedido({
    pedidoId,
    source = 'reconciliacao_manual',
    requestId = null,
    eventId = null,
    idempotencyKey = null
  } = {}) {
    if (!mercadoPagoService || typeof mercadoPagoService.consultarPagamento !== 'function') {
      throw new Error('Serviço Mercado Pago indisponível para reconciliação.');
    }

    const pedidoIdNumerico = toInt(pedidoId, 0);
    if (pedidoIdNumerico <= 0) {
      const error = new Error('pedido_id inválido para reconciliação.');
      error.status = 400;
      throw error;
    }

    const pedido = await encontrarPedidoPorReferencias({ pedidoId: pedidoIdNumerico });
    if (!pedido) {
      const error = new Error('Pedido não encontrado para reconciliação.');
      error.status = 404;
      throw error;
    }

    const paymentId = normalizeText(pedido.mp_payment_id_mp || '');
    if (!paymentId) {
      const error = new Error('Pedido sem mp_payment_id_mp para reconciliação.');
      error.status = 409;
      throw error;
    }

    const pagamentoGateway = await mercadoPagoService.consultarPagamento(paymentId);
    const resultado = await sincronizarPagamentoComPedido({
      payment: pagamentoGateway,
      source,
      requestId,
      eventId,
      idempotencyKey,
      rawPayload: pagamentoGateway,
      markReconciled: true
    });

    return {
      ...resultado,
      gateway: {
        payment_id: normalizeText(pagamentoGateway?.id || paymentId),
        status: normalizeGatewayStatus(pagamentoGateway?.status || 'unknown'),
        status_detail: normalizeText(pagamentoGateway?.status_detail || ''),
        external_reference: normalizeText(pagamentoGateway?.external_reference || '')
      }
    };
  }

  async function reconciliarPagamentoPorPaymentId({
    paymentId,
    source = 'reconciliacao_manual',
    requestId = null,
    eventId = null,
    idempotencyKey = null
  } = {}) {
    if (!mercadoPagoService || typeof mercadoPagoService.consultarPagamento !== 'function') {
      throw new Error('Serviço Mercado Pago indisponível para reconciliação.');
    }

    const paymentIdNormalizado = normalizeText(paymentId || '');
    if (!paymentIdNormalizado) {
      const error = new Error('payment_id inválido para reconciliação.');
      error.status = 400;
      throw error;
    }

    const pagamentoGateway = await mercadoPagoService.consultarPagamento(paymentIdNormalizado);
    const resultado = await sincronizarPagamentoComPedido({
      payment: pagamentoGateway,
      source,
      requestId,
      eventId,
      idempotencyKey,
      rawPayload: pagamentoGateway,
      markReconciled: true
    });

    return {
      ...resultado,
      gateway: {
        payment_id: normalizeText(pagamentoGateway?.id || paymentIdNormalizado),
        status: normalizeGatewayStatus(pagamentoGateway?.status || 'unknown'),
        status_detail: normalizeText(pagamentoGateway?.status_detail || ''),
        external_reference: normalizeText(pagamentoGateway?.external_reference || '')
      }
    };
  }

  return {
    encontrarPedidoPorReferencias,
    sincronizarPagamentoComPedido,
    reconciliarPagamentoPorPedido,
    reconciliarPagamentoPorPaymentId
  };
}

module.exports = {
  criarMercadoPagoPaymentSyncService
};
