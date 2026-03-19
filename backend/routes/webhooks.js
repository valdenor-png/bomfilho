'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { BoundedCache } = require('../lib/cache');
const { pool } = require('../lib/db');
const {
  NODE_ENV, IS_PRODUCTION, PAGBANK_TOKEN, PAGBANK_WEBHOOK_TOKEN,
  WHATSAPP_AUTO_REPLY_ENABLED, WHATSAPP_AUTO_REPLY_TEXT, WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS,
} = require('../lib/config');
const {
  extrairStatusPagamentoPagBank,
  extrairPedidoIdReferencePagBank,
  mapearStatusPedido,
  persistirAtualizacaoPedidoWebhookPagBank,
  resolverDadosWebhookPagBank,
} = require('../services/pagbankWebhookService');

const WEBHOOK_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const webhookPagBankProcessado = new BoundedCache({ maxSize: 2000, ttlMs: WEBHOOK_IDEMPOTENCY_TTL_MS, name: 'webhookDedup' });

/**
 * @param {object} deps
 * @param {Function} deps.validarWebhookEvolution
 * @param {Function} deps.validarWebhookPagBank
 * @param {Function} deps.extrairDadosMensagemEvolution
 * @param {Function} deps.isJidGrupoOuBroadcast
 * @param {Function} deps.formatarTelefoneWhatsapp
 * @param {Function} deps.enviarWhatsappTexto
 * @param {Function} deps.limparCacheEvolution
 * @param {object}   deps.evolutionProcessedMessageIds
 * @param {object}   deps.evolutionLastReplyByNumber
 * @param {Function} deps.registrarLogPagBank
 * @param {Function} deps.obterPedidoPagBank
 */
module.exports = function createWebhookRoutes(deps) {
  const router = express.Router();
  const {
    validarWebhookEvolution, validarWebhookPagBank,
    extrairDadosMensagemEvolution, isJidGrupoOuBroadcast,
    formatarTelefoneWhatsapp, enviarWhatsappTexto, limparCacheEvolution,
    evolutionProcessedMessageIds, evolutionLastReplyByNumber,
    registrarLogPagBank, obterPedidoPagBank,
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
  // WEBHOOK PAGBANK (PIX + CARTAO)
  // ============================================
  function limparCacheWebhookIdempotency() {
    webhookPagBankProcessado.purgeExpired();
  }

  async function processarWebhookPagBank(req, res, endpointLog = '/api/webhooks/pagbank') {
    try {
      if (!validarWebhookPagBank(req)) {
        registrarLogPagBank({
          operacao: 'webhook.pagbank.rejeitado',
          endpoint: endpointLog,
          method: 'POST',
          httpStatus: 401,
          requestPayload: req.body,
          responsePayload: { erro: 'Webhook não autorizado' },
          extra: {
            motivo: PAGBANK_WEBHOOK_TOKEN ? 'token_invalido' : 'webhook_token_nao_configurado',
            ambiente: NODE_ENV
          }
        });

        return res.status(401).json({ erro: 'Webhook não autorizado' });
      }

      const notificacao = req.body || {};
      const eventType = String(notificacao?.event || notificacao?.type || '').trim().toUpperCase();

      const idempotencyKey = `${notificacao?.id || ''}_${eventType}_${notificacao?.charges?.[0]?.id || ''}`;
      if (idempotencyKey && idempotencyKey !== '__' && webhookPagBankProcessado.has(idempotencyKey)) {
        return res.sendStatus(200);
      }
      limparCacheWebhookIdempotency();

      const dadosWebhook = await resolverDadosWebhookPagBank({
        notificacao,
        pagbankToken: PAGBANK_TOKEN,
        isProduction: IS_PRODUCTION,
        obterPedidoPagBank,
        eventType
      });

      if (dadosWebhook?.erroResposta) {
        registrarLogPagBank({
          operacao: 'webhook.pagbank.invalido',
          endpoint: endpointLog,
          method: 'POST',
          httpStatus: dadosWebhook.erroResposta.status,
          requestPayload: notificacao,
          responsePayload: { erro: dadosWebhook.erroResposta.mensagem },
          extra: {
            event_type: eventType || null,
            consulta_pagbank_tentou: Boolean(dadosWebhook?.consultaPagBank?.tentou),
            consulta_pagbank_sucesso: Boolean(dadosWebhook?.consultaPagBank?.sucesso),
            consulta_pagbank_erro: dadosWebhook?.consultaPagBank?.erro || null
          }
        });

        return res.status(dadosWebhook.erroResposta.status).json({
          erro: dadosWebhook.erroResposta.mensagem
        });
      }

      const {
        orderId, referenceId, charges, orderStatus, detalhesOrder, consultaPagBank
      } = dadosWebhook;

      const statusInfo = extrairStatusPagamentoPagBank(
        { status: orderStatus, charges },
        eventType
      );
      const statusPagBank = String(statusInfo.statusResolvido || 'WAITING').toUpperCase();
      const chargePrincipal = statusInfo.chargePrincipal || {};
      const chargeId = chargePrincipal?.id || null;
      const statusInterno = mapearStatusPedido(statusPagBank);

      registrarLogPagBank({
        operacao: 'webhook.pagbank.recebido',
        endpoint: endpointLog,
        method: 'POST',
        requestPayload: notificacao,
        extra: {
          event_type: eventType || null,
          order_id: orderId,
          charge_id: chargeId,
          reference_id: referenceId || null,
          status_pagbank: statusPagBank,
          status_fonte: statusInfo.fonteStatus,
          status_order: statusInfo.orderStatus || null,
          status_charge: statusInfo.chargeStatus || null,
          dados_confirmados_pagbank: Boolean(detalhesOrder),
          consulta_pagbank_tentou: Boolean(consultaPagBank?.tentou),
          consulta_pagbank_sucesso: Boolean(consultaPagBank?.sucesso),
          consulta_pagbank_erro: consultaPagBank?.erro || null
        }
      });

      const pedidoId = extrairPedidoIdReferencePagBank(referenceId);
      const resultadoPersistencia = await persistirAtualizacaoPedidoWebhookPagBank({
        pool,
        pedidoId,
        orderId,
        statusInterno,
        statusPagBank,
        chargeId,
        endpointLog,
        registrarLogPagBank
      });

      if (!resultadoPersistencia?.ok) {
        registrarLogPagBank({
          operacao: 'webhook.pagbank.persistencia.falha',
          endpoint: endpointLog,
          method: 'POST',
          httpStatus: Number(resultadoPersistencia?.httpStatus || 503),
          requestPayload: notificacao,
          responsePayload: {
            erro: resultadoPersistencia?.mensagem || 'Evento recebido, mas não foi possível persistir o webhook localmente.',
            status_interno: statusInterno,
            status_pagbank: statusPagBank
          },
          extra: {
            order_id: orderId,
            pedido_id: pedidoId,
            retryable: Boolean(resultadoPersistencia?.retryable),
            lookup: resultadoPersistencia?.lookup || null,
            persist_mode: resultadoPersistencia?.modoPersistencia || null,
            linhas_afetadas: Number(resultadoPersistencia?.linhasAfetadas || 0)
          }
        });

        return res.status(Number(resultadoPersistencia?.httpStatus || 503)).json({
          erro: resultadoPersistencia?.mensagem || 'Evento recebido, mas não foi possível persistir o webhook localmente.'
        });
      }

      if (resultadoPersistencia.parcial) {
        registrarLogPagBank({
          operacao: 'webhook.pagbank.persistencia.parcial',
          endpoint: endpointLog,
          method: 'POST',
          httpStatus: 202,
          responsePayload: {
            mensagem: resultadoPersistencia?.mensagem || 'Webhook persistido parcialmente.'
          },
          extra: {
            order_id: orderId,
            pedido_id: pedidoId,
            lookup: resultadoPersistencia?.lookup || null,
            persist_mode: resultadoPersistencia?.modoPersistencia || null,
            linhas_afetadas: Number(resultadoPersistencia?.linhasAfetadas || 0)
          }
        });

        return res.sendStatus(202);
      }

      webhookPagBankProcessado.set(idempotencyKey, Date.now());
      return res.sendStatus(200);
    } catch (erro) {
      logger.error('Erro no webhook do PagBank:', erro);

      registrarLogPagBank({
        operacao: 'webhook.pagbank.erro',
        endpoint: endpointLog,
        method: 'POST',
        httpStatus: 500,
        requestPayload: req.body,
        responsePayload: {
          erro: erro?.message || 'Erro interno no processamento do webhook PagBank'
        }
      });

      return res.sendStatus(500);
    }
  }

  // Endpoint canônico
  router.post('/api/webhooks/pagbank', (req, res) => {
    return processarWebhookPagBank(req, res, '/api/webhooks/pagbank');
  });

  // Alias temporário para compatibilidade
  router.post('/api/pagbank/webhook', (req, res) => {
    return processarWebhookPagBank(req, res, '/api/pagbank/webhook');
  });

  return router;
};
