'use strict';

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const { pool } = require('../lib/db');
const { buildErrorPayload } = require('../lib/apiError');
const { criarMercadoPagoPaymentSyncService } = require('../services/mercadoPagoPaymentSyncService');
const {
  WHATSAPP_AUTO_REPLY_ENABLED, WHATSAPP_AUTO_REPLY_TEXT, WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS,
} = require('../lib/config');

/**
 * Verifica se um webhook já foi processado usando a tabela webhook_events.
 * Retorna true se já existe (duplicata), false caso contrário.
 */
function erroEhDuplicidade(err) {
  const code = String(err?.code || '').trim().toUpperCase();
  const msg = String(err?.message || '').toLowerCase();
  return code === '23505' || code === 'ER_DUP_ENTRY' || code === '1062' || msg.includes('duplicate') || msg.includes('unique');
}

async function registrarInicioWebhook(idempotencyKey, eventType) {
  if (!idempotencyKey) {
    return { acquired: false, duplicate: false, skipped: true };
  }

  try {
    await pool.query(
      'INSERT INTO webhook_events (idempotency_key, event_type) VALUES (?, ?)',
      [idempotencyKey, (eventType || '').slice(0, 100)]
    );
    return { acquired: true, duplicate: false, skipped: false };
  } catch (err) {
    if (erroEhDuplicidade(err)) {
      return { acquired: false, duplicate: true, skipped: false };
    }
    logger.warn('Falha ao registrar lock de idempotencia do webhook; seguindo sem lock.', {
      idempotency_key: idempotencyKey,
      message: err?.message || null
    });
    return { acquired: false, duplicate: false, skipped: false };
  }
}

async function liberarWebhookParaReprocessamento(idempotencyKey) {
  if (!idempotencyKey) return;
  try {
    await pool.query('DELETE FROM webhook_events WHERE idempotency_key = ?', [idempotencyKey]);
  } catch (err) {
    logger.warn('Falha ao liberar lock de idempotencia para reprocessamento.', {
      idempotency_key: idempotencyKey,
      message: err?.message || null
    });
  }
}

function construirIdempotencyKeyWebhook({ payload, action, type, dataId, xRequestId, xSignature }) {
  const notificationId = String(payload?.id || '').trim();
  const requestId = String(xRequestId || '').trim();
  if (notificationId && notificationId !== dataId) {
    return { key: `mp_notif_${notificationId}`, strategy: 'payload.id' };
  }
  if (requestId) {
    return { key: `mp_req_${requestId}`, strategy: 'x-request-id' };
  }
  if (notificationId) {
    return { key: `mp_notif_${notificationId}`, strategy: 'payload.id_fallback' };
  }

  const fallbackHash = crypto.createHash('sha256')
    .update(JSON.stringify({
      type: String(type || '').trim(),
      action: String(action || '').trim(),
      data_id: String(dataId || '').trim(),
      date_created: String(payload?.date_created || '').trim(),
      signature_prefix: String(xSignature || '').slice(0, 80)
    }))
    .digest('hex')
    .slice(0, 32);

  return { key: `mp_fallback_${fallbackHash}`, strategy: 'fallback_hash' };
}

function classificarFalhaConsultaPagamento(err) {
  const status = Number(err?.status || 0);
  const msg = String(err?.message || '').toLowerCase();

  if ([408, 425, 429].includes(status) || status >= 500) {
    return { transient: true, reason: `http_${status || '5xx'}` };
  }
  if (status === 404) {
    return { transient: false, reason: 'not_found' };
  }
  if (status >= 400 && status < 500) {
    return { transient: false, reason: `http_${status}` };
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted') || msg.includes('fetch') || msg.includes('econn') || msg.includes('socket')) {
    return { transient: true, reason: 'network' };
  }
  return { transient: true, reason: 'unknown' };
}

/**
 * @param {object} deps
 * @param {Function} deps.validarWebhookEvolution
 * @param {Function} deps.extrairDadosMensagemEvolution
 * @param {Function} deps.isJidGrupoOuBroadcast
 * @param {Function} deps.formatarTelefoneWhatsapp
 * @param {Function} deps.enviarWhatsappTexto
 * @param {Function} deps.limparCacheEvolution
 * @param {object}   deps.evolutionProcessedMessageIds
 * @param {object}   deps.evolutionLastReplyByNumber
 * @param {object}   [deps.mercadoPagoService]
 * @param {Function} [deps.enviarWhatsappPedido]
 */
module.exports = function createWebhookRoutes(deps) {
  const router = express.Router();
  const {
    validarWebhookEvolution,
    extrairDadosMensagemEvolution, isJidGrupoOuBroadcast,
    formatarTelefoneWhatsapp, enviarWhatsappTexto, limparCacheEvolution,
    evolutionProcessedMessageIds, evolutionLastReplyByNumber,
    mercadoPagoService, enviarWhatsappPedido,
    paymentSyncService: paymentSyncServiceFromDeps
  } = deps;
  const paymentSyncService = mercadoPagoService
    ? (paymentSyncServiceFromDeps || criarMercadoPagoPaymentSyncService({ pool, mercadoPagoService }))
    : null;

  // ============================================
  // WEBHOOK EVOLUTION (WHATSAPP)
  // ============================================
  router.post('/api/webhooks/evolution', async (req, res) => {
    try {
      if (!validarWebhookEvolution(req)) {
        return res.status(401).json(buildErrorPayload('Webhook Evolution nao autorizado'));
      }

      if (!WHATSAPP_AUTO_REPLY_ENABLED || !WHATSAPP_AUTO_REPLY_TEXT) {
        return res.sendStatus(200);
      }

      const payload = req.body || {};
      const evento = String(payload?.event || payload?.type || '').toLowerCase();
      const { remoteJid, fromMe, messageId, temConteudo } = extrairDadosMensagemEvolution(payload);

      if (evento && !evento.includes('message')) {
        return res.sendStatus(200);
      }

      if (!remoteJid || fromMe || isJidGrupoOuBroadcast(remoteJid) || !temConteudo) {
        return res.sendStatus(200);
      }

      limparCacheEvolution();

      if (messageId) {
        if (evolutionProcessedMessageIds.has(messageId)) {
          return res.sendStatus(200);
        }
        evolutionProcessedMessageIds.set(messageId, Date.now());
      }

      const telefone = formatarTelefoneWhatsapp(remoteJid);
      if (!telefone) {
        return res.sendStatus(200);
      }

      const cooldown = Number.isInteger(WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS)
        ? Math.max(0, WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS)
        : 0;
      const agora = Date.now();
      const ultimaResposta = evolutionLastReplyByNumber.get(telefone) || 0;
      if (cooldown > 0 && (agora - ultimaResposta) < cooldown * 1000) {
        return res.sendStatus(200);
      }

      const enviado = await enviarWhatsappTexto({
        telefone,
        mensagem: WHATSAPP_AUTO_REPLY_TEXT
      });

      if (enviado) {
        evolutionLastReplyByNumber.set(telefone, agora);
        logger.info('Auto-resposta WhatsApp enviada para:', telefone);
      }

      return res.sendStatus(200);
    } catch (erro) {
      logger.error('Erro no webhook Evolution:', erro?.message || erro);
      return res.sendStatus(500);
    }
  });

  // ============================================
  // WEBHOOK MERCADO PAGO
  // ============================================

  // Diagnóstico: GET para confirmar que a rota está viva (browser / uptime check)
  router.get('/api/webhooks/mercadopago', (_req, res) => {
    res.json({ ok: true, route: 'mercadopago-webhook', method: 'GET', info: 'Use POST para receber notificações.' });
  });

  router.post('/api/webhooks/mercadopago', async (req, res) => {
    const requestId = String(req.requestId || req.headers['x-request-id'] || '').trim() || null;
    let idempotencyKey = '';
    let idempotencyStrategy = '';
    let lockAdquirido = false;

    logger.info('[MP Webhook] Requisicao recebida', {
      request_id: requestId,
      method: req.method,
      url: req.originalUrl,
      contentType: req.headers['content-type'] || '(vazio)',
      hasSignature: Boolean(req.headers['x-signature']),
      hasRequestId: Boolean(req.headers['x-request-id']),
      bodyKeys: req.body ? Object.keys(req.body).join(',') : '(sem body)'
    });

    try {
      if (!mercadoPagoService) {
        logger.warn('[MP Webhook] Mercado Pago service nao configurado.');
        return res.sendStatus(200);
      }

      const xSignature = req.headers['x-signature'] || '';
      const xRequestId = req.headers['x-request-id'] || '';
      const payload = req.body || {};

      const action = String(payload.action || '').trim();
      const dataId = String(payload.data?.id || payload.id || '').trim();
      const type = String(payload.type || '').trim();

      if (type !== 'payment' && action !== 'payment.updated' && action !== 'payment.created') {
        return res.sendStatus(200);
      }

      if (!dataId) {
        logger.warn('[MP Webhook] Notificacao sem data.id, ignorando.');
        return res.sendStatus(200);
      }

      const assinaturaValida = mercadoPagoService.validarAssinaturaWebhook(xSignature, xRequestId, dataId);
      if (!assinaturaValida) {
        logger.warn('[MP Webhook] Assinatura invalida, rejeitando.', {
          request_id: requestId,
          payment_id: dataId,
          x_request_id: xRequestId || null
        });
        return res.status(401).json(buildErrorPayload('Assinatura inválida.'));
      }

      const dedupe = construirIdempotencyKeyWebhook({
        payload,
        action,
        type,
        dataId,
        xRequestId,
        xSignature
      });
      idempotencyKey = dedupe.key;
      idempotencyStrategy = dedupe.strategy;

      if (idempotencyStrategy === 'fallback_hash') {
        logger.warn('[MP Webhook] Identificador forte ausente; usando fallback de idempotencia.', {
          request_id: requestId,
          payment_id: dataId,
          strategy: idempotencyStrategy
        });
      }

      const lock = await registrarInicioWebhook(idempotencyKey, `mp_${action || type || 'payment'}`);
      lockAdquirido = lock.acquired;
      if (lock.duplicate) {
        logger.info('[MP Webhook] Evento duplicado ignorado.', {
          request_id: requestId,
          payment_id: dataId,
          idempotency_key: idempotencyKey,
          strategy: idempotencyStrategy
        });
        return res.sendStatus(200);
      }

      let pagamento;
      try {
        pagamento = await mercadoPagoService.consultarPagamento(dataId);
      } catch (errConsulta) {
        const classificacao = classificarFalhaConsultaPagamento(errConsulta);
        const contextoErro = {
          request_id: requestId,
          pedido_id: null,
          payment_id: dataId,
          external_reference: null,
          x_request_id: xRequestId || null,
          event_id: String(payload?.id || '').trim() || null,
          idempotency_key: idempotencyKey || null,
          idempotency_strategy: idempotencyStrategy || null,
          motivo: classificacao.reason,
          etapa: 'consultar_pagamento'
        };

        if (classificacao.transient) {
          logger.error('[MP Webhook] Falha transitoria ao consultar pagamento.', contextoErro);
          if (lockAdquirido) {
            await liberarWebhookParaReprocessamento(idempotencyKey);
          }
          return res.status(503).json(buildErrorPayload('Falha transitoria ao confirmar pagamento no gateway.', {
            code: 'MP_WEBHOOK_PAYMENT_LOOKUP_TRANSIENT'
          }));
        }

        logger.warn('[MP Webhook] Falha permanente ao consultar pagamento; evento ignorado.', contextoErro);
        return res.sendStatus(200);
      }

      if (!pagamento || !pagamento.id) {
        logger.error('[MP Webhook] Consulta retornou pagamento vazio; reprocessamento necessario.', {
          request_id: requestId,
          pedido_id: null,
          payment_id: dataId,
          external_reference: null,
          x_request_id: xRequestId || null,
          event_id: String(payload?.id || '').trim() || null,
          idempotency_key: idempotencyKey || null,
          idempotency_strategy: idempotencyStrategy || null,
          motivo: 'gateway_empty_payload',
          etapa: 'consultar_pagamento'
        });
        if (lockAdquirido) {
          await liberarWebhookParaReprocessamento(idempotencyKey);
        }
        return res.status(503).json(buildErrorPayload('Falha transitoria ao confirmar pagamento no gateway.', {
          code: 'MP_WEBHOOK_PAYMENT_LOOKUP_EMPTY'
        }));
      }

      const syncResult = await paymentSyncService.sincronizarPagamentoComPedido({
        payment: pagamento,
        source: 'webhook_mercadopago',
        requestId,
        eventId: String(payload?.id || '').trim() || null,
        idempotencyKey,
        rawPayload: {
          webhook: payload,
          payment: pagamento
        },
        markWebhookReceived: true
      });

      if (!syncResult?.applied) {
        logger.info('[MP Webhook] Evento processado sem transicao de estado.', {
          request_id: requestId,
          pedido_id: Number(syncResult?.pedido?.id || 0) || null,
          payment_id: String(pagamento.id || dataId || ''),
          external_reference: String(pagamento.external_reference || ''),
          x_request_id: xRequestId || null,
          event_id: String(payload?.id || '').trim() || null,
          idempotency_key: idempotencyKey || null,
          idempotency_strategy: idempotencyStrategy || null,
          motivo: String(syncResult?.reason || '').trim() || 'transicao_ignorada'
        });
        return res.sendStatus(200);
      }

      logger.info('[MP Webhook] Pedido atualizado com sucesso.', {
        request_id: requestId,
        pedido_id: Number(syncResult?.pedido?.id || 0) || null,
        payment_id: String(pagamento.id || ''),
        external_reference: String(pagamento.external_reference || ''),
        x_request_id: xRequestId || null,
        event_id: String(payload?.id || '').trim() || null,
        status_anterior: String(syncResult?.pedido?.status_anterior || '').trim().toLowerCase() || null,
        status_novo: String(syncResult?.pedido?.status_novo || '').trim().toLowerCase() || null,
        origem_transicao: 'webhook_mercadopago'
      });

      // SSE — notificar frontend em tempo real
      try {
        const { broadcast } = require('../lib/sseHub');
        const pedidoIdSSE = Number(syncResult?.pedido?.id || 0);
        const statusNovo = String(syncResult?.pedido?.status_novo || '').trim().toLowerCase();
        if (pedidoIdSSE && statusNovo) {
          broadcast(pedidoIdSSE, {
            type: 'status_update',
            pedido_id: pedidoIdSSE,
            status: statusNovo,
            timestamp: new Date().toISOString()
          });
        }
      } catch { /* SSE falha silenciosamente */ }

      if (
        enviarWhatsappPedido
        && String(syncResult?.pedido?.status_novo || '').trim().toLowerCase() === 'pago'
        && String(syncResult?.pedido?.status_anterior || '').trim().toLowerCase() !== 'pago'
      ) {
        try {
          const [dadosNotifica] = await pool.query(
            `SELECT p.total, u.nome, u.telefone, u.whatsapp_opt_in
             FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id
             WHERE p.id = ? LIMIT 1`,
            [syncResult?.pedido?.id]
          );
          if (dadosNotifica.length && dadosNotifica[0].whatsapp_opt_in) {
            await enviarWhatsappPedido({
              telefone: dadosNotifica[0].telefone,
              nome: dadosNotifica[0].nome,
              pedidoId: syncResult?.pedido?.id,
              total: dadosNotifica[0].total,
              mensagemExtra: 'Pagamento confirmado! Seu pedido esta sendo preparado.'
            });
          }
        } catch (errWhats) {
          logger.error('[MP Webhook] Falha ao notificar WhatsApp:', errWhats.message);
        }
      }

      return res.sendStatus(200);
    } catch (erro) {
      if (lockAdquirido && idempotencyKey) {
        await liberarWebhookParaReprocessamento(idempotencyKey);
      }
      logger.error('[MP Webhook] Erro interno no processamento.', {
        request_id: requestId,
        idempotency_key: idempotencyKey || null,
        idempotency_strategy: idempotencyStrategy || null,
        message: erro?.message || null
      });
      return res.sendStatus(500);
    }
  });

  return router;
};
