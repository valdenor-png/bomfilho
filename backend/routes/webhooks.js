'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { pool } = require('../lib/db');
const {
  WHATSAPP_AUTO_REPLY_ENABLED, WHATSAPP_AUTO_REPLY_TEXT, WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS,
} = require('../lib/config');

/**
 * Verifica se um webhook já foi processado usando a tabela webhook_events.
 * Retorna true se já existe (duplicata), false caso contrário.
 */
async function webhookJaProcessado(idempotencyKey) {
  if (!idempotencyKey || idempotencyKey === '__') return false;
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM webhook_events WHERE idempotency_key = ? LIMIT 1',
      [idempotencyKey]
    );
    return rows.length > 0;
  } catch (err) {
    logger.warn('Falha ao verificar idempotencia webhook no DB, permitindo processamento:', err.message);
    return false;
  }
}

/**
 * Registra um webhook como processado na tabela webhook_events.
 */
async function registrarWebhookProcessado(idempotencyKey, eventType) {
  if (!idempotencyKey || idempotencyKey === '__') return;
  try {
    await pool.query(
      'INSERT IGNORE INTO webhook_events (idempotency_key, event_type) VALUES (?, ?)',
      [idempotencyKey, (eventType || '').slice(0, 100)]
    );
  } catch (err) {
    logger.warn('Falha ao registrar idempotencia webhook no DB:', err.message);
  }
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
  } = deps;

  // ============================================
  // WEBHOOK EVOLUTION (WHATSAPP)
  // ============================================
  router.post('/api/webhooks/evolution', async (req, res) => {
    try {
      if (!validarWebhookEvolution(req)) {
        return res.status(401).json({ erro: 'Webhook Evolution nao autorizado' });
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
        logger.info('✅ Auto-resposta WhatsApp enviada para:', telefone);
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
    logger.info('[MP Webhook] Requisição recebida', {
      method: req.method,
      url: req.originalUrl,
      contentType: req.headers['content-type'] || '(vazio)',
      hasSignature: Boolean(req.headers['x-signature']),
      hasRequestId: Boolean(req.headers['x-request-id']),
      bodyKeys: req.body ? Object.keys(req.body).join(',') : '(sem body)',
    });

    try {
      if (!mercadoPagoService) {
        logger.warn('[MP Webhook] Mercado Pago service não configurado.');
        return res.sendStatus(200);
      }

      const xSignature = req.headers['x-signature'] || '';
      const xRequestId = req.headers['x-request-id'] || '';
      const payload = req.body || {};

      // Mercado Pago envia { action, type, data: { id } }
      const action = String(payload.action || '').trim();
      const dataId = String(payload.data?.id || payload.id || '').trim();
      const type = String(payload.type || '').trim();

      // Só processar notificações de pagamento
      if (type !== 'payment' && action !== 'payment.updated' && action !== 'payment.created') {
        return res.sendStatus(200);
      }

      if (!dataId) {
        logger.warn('[MP Webhook] Notificação sem data.id, ignorando.');
        return res.sendStatus(200);
      }

      // Validar assinatura
      const assinaturaValida = mercadoPagoService.validarAssinaturaWebhook(xSignature, xRequestId, dataId);
      if (!assinaturaValida) {
        logger.warn('[MP Webhook] Assinatura inválida, rejeitando.');
        return res.status(401).json({ erro: 'Assinatura inválida.' });
      }

      // Idempotência
      const idempotencyKey = `mp_${dataId}_${action}`;
      if (await webhookJaProcessado(idempotencyKey)) {
        return res.sendStatus(200);
      }

      // Consultar pagamento na API do Mercado Pago
      let pagamento;
      try {
        pagamento = await mercadoPagoService.consultarPagamento(dataId);
      } catch (errConsulta) {
        // Payloads de teste do MP enviam IDs falsos (ex: 123456) que não existem na API
        logger.warn(`[MP Webhook] Não foi possível consultar pagamento ${dataId}: ${errConsulta.message}`);
        return res.sendStatus(200);
      }

      if (!pagamento || !pagamento.id) {
        logger.warn(`[MP Webhook] Pagamento ${dataId} não encontrado na API.`);
        return res.sendStatus(200);
      }

      const pedidoId = Number(pagamento.external_reference);
      if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
        logger.warn(`[MP Webhook] external_reference inválido: "${pagamento.external_reference}"`);
        await registrarWebhookProcessado(idempotencyKey, `mp_${action}`);
        return res.sendStatus(200);
      }

      const statusInterno = mercadoPagoService.mapearStatusPagamento(pagamento.status);

      // Buscar pedido no banco
      const [pedidos] = await pool.query(
        'SELECT id, status, usuario_id FROM pedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );

      if (!pedidos.length) {
        logger.warn(`[MP Webhook] Pedido #${pedidoId} não encontrado no banco.`);
        await registrarWebhookProcessado(idempotencyKey, `mp_${action}`);
        return res.sendStatus(200);
      }

      const pedidoAtual = pedidos[0];

      // Não regredir status: se já está pago/preparando/enviado, não voltar para pendente
      const statusNaoRegredir = ['pago', 'preparando', 'enviado', 'entregue', 'retirado'];
      if (statusNaoRegredir.includes(pedidoAtual.status) && statusInterno === 'pendente') {
        logger.info(`[MP Webhook] Pedido #${pedidoId} já em "${pedidoAtual.status}", ignorando status "${statusInterno}".`);
        await registrarWebhookProcessado(idempotencyKey, `mp_${action}`);
        return res.sendStatus(200);
      }

      // Atualizar status e payment ID
      const updateFields = ['status = ?', 'mp_payment_id_mp = ?'];
      const updateValues = [statusInterno, String(pagamento.id)];

      if (statusInterno === 'pago') {
        updateFields.push('pix_status = ?');
        updateValues.push('PAID');
        updateFields.push('pago_em = COALESCE(pago_em, NOW())');
      } else if (statusInterno === 'cancelado' || statusInterno === 'pagamento_recusado') {
        updateFields.push('pix_status = ?');
        updateValues.push(statusInterno === 'cancelado' ? 'CANCELED' : 'DECLINED');
      }

      updateValues.push(pedidoId);
      await pool.query(
        `UPDATE pedidos SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      logger.info(`[MP Webhook] Pedido #${pedidoId} atualizado: ${pedidoAtual.status} → ${statusInterno} (MP payment ${pagamento.id})`);

      // Notificar cliente via WhatsApp se pagamento foi confirmado
      if (statusInterno === 'pago' && enviarWhatsappPedido) {
        try {
          const [dadosNotifica] = await pool.query(
            `SELECT p.total, u.nome, u.telefone, u.whatsapp_opt_in
             FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id
             WHERE p.id = ? LIMIT 1`,
            [pedidoId]
          );
          if (dadosNotifica.length && dadosNotifica[0].whatsapp_opt_in) {
            await enviarWhatsappPedido({
              telefone: dadosNotifica[0].telefone,
              nome: dadosNotifica[0].nome,
              pedidoId,
              total: dadosNotifica[0].total,
              mensagemExtra: '✅ Pagamento confirmado! Seu pedido está sendo preparado.'
            });
          }
        } catch (errWhats) {
          logger.error('[MP Webhook] Falha ao notificar WhatsApp:', errWhats.message);
        }
      }

      await registrarWebhookProcessado(idempotencyKey, `mp_${action}`);
      return res.sendStatus(200);
    } catch (erro) {
      logger.error('[MP Webhook] Erro:', erro.message);
      return res.sendStatus(500);
    }
  });

  return router;
};
