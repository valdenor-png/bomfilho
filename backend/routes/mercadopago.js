'use strict';

/**
 * Rotas de pagamento via Mercado Pago.
 *
 * POST /api/mercadopago/criar-pix     - Gera pagamento PIX para pedido já aprovado
 * POST /api/mercadopago/criar-cartao  - Processa pagamento com cartão de crédito
 * GET  /api/mercadopago/status        - Health check do gateway
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const {
  MP_ACCESS_TOKEN,
  MP_ENV,
  MP_NOTIFICATION_URL,
  MP_WEBHOOK_SECRET,
  IS_PRODUCTION,
  RECAPTCHA_PAYMENT_PROTECTION_ENABLED,
  DISTRIBUTED_IDEMPOTENCY_ENABLED
} = require('../lib/config');
const { buildErrorPayload } = require('../lib/apiError');
const { ACTIVE_PAYMENT_GATEWAY, LEGACY_PAYMENT_GATEWAYS } = require('../services/paymentRuntime');
const {
  normalizarIdempotencyKey,
  hashFingerprint,
  iniciarOperacaoDistribuida,
  concluirOperacaoDistribuida,
  falharOperacaoDistribuida
} = require('../services/distributedIdempotencyService');

function extrairCausasMercadoPago(mpResponse = {}) {
  const causas = Array.isArray(mpResponse?.cause) ? mpResponse.cause : [];
  const mensagens = causas
    .map((item) => String(item?.description || item?.message || item?.code || '').trim())
    .filter(Boolean);

  return Array.from(new Set(mensagens));
}

function montarContextoIdempotenciaPagamento({
  req,
  scope,
  pedidoId,
  pedido,
  userId,
  flow,
  paymentMethodId = ''
}) {
  const keyHeader = normalizarIdempotencyKey(req?.headers?.['x-idempotency-key']);
  const fingerprintPayload = {
    scope: String(scope || '').trim().toLowerCase(),
    flow: String(flow || '').trim().toLowerCase(),
    pedido_id: Number(pedidoId) || 0,
    user_id: Number(userId) || 0,
    pedido_status: String(pedido?.status || '').trim().toLowerCase(),
    pedido_total: Number(pedido?.total || 0).toFixed(2),
    pedido_payment_ref: String(pedido?.mp_payment_id_mp || '').trim() || null,
    payment_method_id: String(paymentMethodId || '').trim().toLowerCase() || null
  };
  const fingerprint = hashFingerprint(fingerprintPayload);
  const derivedKey = `${scope}:${Number(pedidoId) || 0}:${fingerprint.slice(0, 32)}`;
  const idempotencyKey = keyHeader || derivedKey;
  const gatewaySuffix = crypto.createHash('sha256')
    .update(idempotencyKey)
    .digest('hex')
    .slice(0, 24);

  return {
    scope,
    fingerprint,
    idempotencyKey,
    gatewayIdempotencyKey: `bf:${scope}:${Number(pedidoId) || 0}:${gatewaySuffix}`,
    headerProvided: Boolean(keyHeader)
  };
}

module.exports = function createMercadoPagoRoutes(deps) {
  const {
    autenticarToken,
    mercadoPagoService,
    pool,
    validarRecaptcha,
    isProduction = IS_PRODUCTION,
    recaptchaPaymentProtectionEnabled = RECAPTCHA_PAYMENT_PROTECTION_ENABLED
  } = deps;

  const router = express.Router();
  let recaptchaRelaxadoAvisado = false;

  if (!recaptchaPaymentProtectionEnabled && !isProduction && !recaptchaRelaxadoAvisado) {
    logger.warn('[MP] Protecao reCAPTCHA de pagamento desabilitada por configuracao em ambiente nao-producao.');
    recaptchaRelaxadoAvisado = true;
  }

  async function exigirRecaptchaPagamento(req, res, { action }) {
    if (!recaptchaPaymentProtectionEnabled) {
      if (!isProduction) {
        return true;
      }

      logger.error('[MP] Protecao reCAPTCHA de pagamento desabilitada em producao.', {
        request_id: String(req.requestId || '').trim() || null,
        action
      });

      res.status(503).json(buildErrorPayload(
        'Protecao de seguranca de pagamento indisponivel. Tente novamente em instantes.',
        { code: 'RECAPTCHA_PAYMENT_DISABLED_IN_PRODUCTION' }
      ));
      return false;
    }

    if (typeof validarRecaptcha !== 'function') {
      logger.error('[MP] validarRecaptcha nao foi injetado nas rotas de pagamento.', {
        request_id: String(req.requestId || '').trim() || null,
        action
      });

      res.status(503).json(buildErrorPayload(
        'Validacao de seguranca indisponivel no momento. Tente novamente em instantes.',
        { code: 'RECAPTCHA_VALIDATOR_UNAVAILABLE' }
      ));
      return false;
    }

    const recaptchaToken = String(req.body?.recaptcha_token || req.body?.recaptchaToken || '').trim();
    if (!recaptchaToken) {
      logger.warn('[MP] Requisicao de pagamento sem token reCAPTCHA.', {
        request_id: String(req.requestId || '').trim() || null,
        action,
        user_id: Number(req?.usuario?.id) || null
      });

      res.status(400).json(buildErrorPayload(
        'Confirme o reCAPTCHA de seguranca antes de continuar o pagamento.',
        { code: 'RECAPTCHA_TOKEN_MISSING' }
      ));
      return false;
    }

    try {
      await validarRecaptcha({
        token: recaptchaToken,
        req,
        action
      });
      return true;
    } catch (erroRecaptcha) {
      const status = Number(erroRecaptcha?.status || 503);
      const mensagem = String(erroRecaptcha?.message || '').trim();
      const requestId = String(req.requestId || '').trim() || null;

      if (status >= 500) {
        logger.error('[MP] Falha ao validar reCAPTCHA no gateway externo.', {
          request_id: requestId,
          action,
          status,
          user_id: Number(req?.usuario?.id) || null
        });

        res.status(503).json(buildErrorPayload(
          'Validacao de seguranca indisponivel no momento. Tente novamente em instantes.',
          { code: 'RECAPTCHA_SERVICE_UNAVAILABLE' }
        ));
        return false;
      }

      const expirado = mensagem.toLowerCase().includes('expirado');

      logger.warn('[MP] Token reCAPTCHA rejeitado para pagamento.', {
        request_id: requestId,
        action,
        status,
        motivo: expirado ? 'token_expirado' : 'token_invalido',
        user_id: Number(req?.usuario?.id) || null
      });

      res.status(status).json(buildErrorPayload(
        mensagem || 'Falha na validacao de seguranca. Confirme o reCAPTCHA e tente novamente.',
        { code: expirado ? 'RECAPTCHA_TOKEN_EXPIRED' : 'RECAPTCHA_TOKEN_INVALID' }
      ));
      return false;
    }
  }

  // ============================================
  // CRIAR PIX via Mercado Pago
  // ============================================
  // Observação estrutural:
  // Este arquivo representa a superfície de pagamento ativa em runtime (Mercado Pago).
  // O legado PagBank permanece no repositório apenas para referência/migração controlada.
  router.post('/api/mercadopago/criar-pix', autenticarToken, async (req, res) => {
    let contextoIdempotencia = null;
    let idempotenciaAdquirida = false;
    let pedidoIdContexto = null;
    try {
      const requestId = String(req.requestId || req.headers['x-request-id'] || '').trim() || null;
      if (!await exigirRecaptchaPagamento(req, res, { action: 'payment_pix' })) {
        return;
      }

      const { pedido_id, tax_id } = req.body || {};
      const pedidoId = Number(pedido_id);
      pedidoIdContexto = pedidoId;
      const taxIdDigits = String(tax_id || '').replace(/\D/g, '');

      if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
        return res.status(400).json(buildErrorPayload('Informe um pedido_id válido.'));
      }

      if (taxIdDigits.length !== 11 && taxIdDigits.length !== 14) {
        return res.status(400).json(buildErrorPayload('Informe um CPF ou CNPJ válido para gerar o PIX.'));
      }

      // Buscar pedido ? só permite gerar PIX para pedido do próprio usuário com status pendente
      const [pedidos] = await pool.query(
        'SELECT id, usuario_id, total, status, gateway_pagamento, mp_payment_id_mp FROM pedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );

      if (!pedidos.length) {
        return res.status(404).json(buildErrorPayload('Pedido não encontrado.'));
      }

      const pedido = pedidos[0];

      if (Number(pedido.usuario_id) !== Number(req.usuario.id)) {
        return res.status(403).json(buildErrorPayload('Acesso negado a este pedido.'));
      }

      const podeGerarPix = ['pendente', 'pagamento_recusado'].includes(String(pedido.status || '').trim().toLowerCase());
      if (!podeGerarPix) {
        return res.status(400).json(buildErrorPayload(`Pedido já se encontra com status "${pedido.status}". Não é possível gerar PIX.`));
      }

      contextoIdempotencia = montarContextoIdempotenciaPagamento({
        req,
        scope: 'pagamento_pix',
        pedidoId,
        pedido,
        userId: req.usuario.id,
        flow: 'pix'
      });

      if (DISTRIBUTED_IDEMPOTENCY_ENABLED) {
        const statusIdempotencia = await iniciarOperacaoDistribuida({
          pool,
          scope: contextoIdempotencia.scope,
          idempotencyKey: contextoIdempotencia.idempotencyKey,
          userId: req.usuario.id,
          pedidoId,
          requestFingerprint: contextoIdempotencia.fingerprint,
          strictFingerprint: true,
          lockTtlSeconds: 30,
          operationTtlSeconds: 180
        });

        if (statusIdempotencia.state === 'replay' && statusIdempotencia.responsePayload) {
          logger.info('[MP][PIX] Resposta reaproveitada por idempotencia.', {
            pedido_id: pedidoId,
            user_id: Number(req?.usuario?.id) || null,
            idempotency_key: contextoIdempotencia.idempotencyKey
          });
          return res.status(Number(statusIdempotencia.httpStatus || 200)).json(statusIdempotencia.responsePayload);
        }

        if (statusIdempotencia.state === 'in_progress') {
          return res.status(409).json(buildErrorPayload('Seu pagamento PIX ja esta em processamento. Aguarde alguns segundos e tente novamente.'));
        }

        if (statusIdempotencia.state === 'fingerprint_mismatch') {
          return res.status(409).json(buildErrorPayload('A chave de idempotencia enviada nao corresponde a esta solicitacao de pagamento PIX.'));
        }

        idempotenciaAdquirida = statusIdempotencia.state === 'acquired';
      }

      logger.info('[MP][PIX] Processando criacao de pagamento.', {
        request_id: requestId,
        pedido_id: pedidoId,
        user_id: Number(req?.usuario?.id) || null,
        gateway: 'mercadopago',
        idempotency_key: contextoIdempotencia?.idempotencyKey || null,
        gateway_idempotency_key: contextoIdempotencia?.gatewayIdempotencyKey || null
      });

      // Se já tem pagamento MP criado, retornar dados existentes
      if (pedido.mp_payment_id_mp) {
        try {
          const pagamento = await mercadoPagoService.consultarPagamento(pedido.mp_payment_id_mp);
          if (pagamento.status === 'pending' || pagamento.status === 'approved') {
            const [pixData] = await pool.query(
              'SELECT pix_codigo, pix_qrcode, pix_qr_base64 FROM pedidos WHERE id = ? LIMIT 1',
              [pedidoId]
            );
            const respostaExistente = {
              payment_id: pedido.mp_payment_id_mp,
              status: pagamento.status,
              pix_codigo: pixData[0]?.pix_codigo || '',
              pix_qrcode: pixData[0]?.pix_qrcode || '',
              qr_code_base64: pixData[0]?.pix_qr_base64 || ''
            };
            if (DISTRIBUTED_IDEMPOTENCY_ENABLED && idempotenciaAdquirida && contextoIdempotencia) {
              await concluirOperacaoDistribuida({
                pool,
                scope: contextoIdempotencia.scope,
                idempotencyKey: contextoIdempotencia.idempotencyKey,
                userId: req.usuario.id,
                pedidoId,
                httpStatus: 200,
                responsePayload: respostaExistente,
                successTtlSeconds: 180
              });
            }
            return res.json(respostaExistente);
          }
        } catch (err) {
          logger.warn(`[MP] Pagamento anterior ${pedido.mp_payment_id_mp} inválido, criando novo:`, err.message);
        }
      }

      // Buscar dados do usuário
      const [usuarios] = await pool.query(
        'SELECT nome, email FROM usuarios WHERE id = ? LIMIT 1',
        [req.usuario.id]
      );
      const usuario = usuarios[0] || {};

      const resultado = await mercadoPagoService.criarPagamentoPix({
        pedidoId,
        valor: Number(pedido.total),
        descricao: `Pedido #${pedidoId} - Mercado BomFilho`,
        email: usuario.email || 'cliente@bomfilho.com.br',
        nome: usuario.nome || 'Cliente',
        cpf: taxIdDigits,
        idempotencyKey: contextoIdempotencia?.gatewayIdempotencyKey || null
      });

      // Salvar dados do PIX no pedido
      await pool.query(
        `UPDATE pedidos SET
          mp_payment_id_mp = ?,
          gateway_pagamento = 'mercadopago',
          pix_status = 'WAITING',
          pix_codigo = ?,
          pix_qrcode = ?,
          pix_qr_base64 = ?
         WHERE id = ?`,
        [
          String(resultado.payment_id),
          resultado.qr_code || '',
          resultado.qr_code || '',
          resultado.qr_code_base64 || '',
          pedidoId
        ]
      );

      logger.info('[MP][PIX] Cobranca registrada no pedido.', {
        request_id: requestId,
        pedido_id: pedidoId,
        payment_id: String(resultado.payment_id || ''),
        external_reference: String(pedidoId),
        x_request_id: requestId,
        event_id: null,
        status_anterior: String(pedido?.status || '').trim().toLowerCase() || null,
        status_novo: String(pedido?.status || '').trim().toLowerCase() || null,
        origem_transicao: 'api_criar_pagamento_pix'
      });

      const respostaPix = {
        payment_id: resultado.payment_id,
        status: resultado.status,
        pix_codigo: resultado.qr_code || '',
        pix_qrcode: resultado.qr_code || '',
        qr_code_base64: resultado.qr_code_base64 || '',
        ticket_url: resultado.ticket_url || ''
      };
      if (DISTRIBUTED_IDEMPOTENCY_ENABLED && idempotenciaAdquirida && contextoIdempotencia) {
        await concluirOperacaoDistribuida({
          pool,
          scope: contextoIdempotencia.scope,
          idempotencyKey: contextoIdempotencia.idempotencyKey,
          userId: req.usuario.id,
          pedidoId,
          httpStatus: 200,
          responsePayload: respostaPix,
          successTtlSeconds: 180
        });
      }
      return res.json(respostaPix);
    } catch (erro) {
      const status = Number(erro?.status || 500);
      const causas = extrairCausasMercadoPago(erro?.mpResponse || {});
      const mensagem =
        erro?.mpResponse?.message
        || erro?.mpResponse?.error
        || erro?.message
        || 'Não foi possível gerar o pagamento PIX. Tente novamente.';
      const mensagemDetalhada = causas.length
        ? `${mensagem} (${causas.join(' | ')})`
        : mensagem;

      if (DISTRIBUTED_IDEMPOTENCY_ENABLED && idempotenciaAdquirida && contextoIdempotencia) {
        await falharOperacaoDistribuida({
          pool,
          scope: contextoIdempotencia.scope,
          idempotencyKey: contextoIdempotencia.idempotencyKey,
          userId: req?.usuario?.id,
          httpStatus: status,
          errorMessage: erro?.message || 'falha_pagamento_pix',
          failureTtlSeconds: 45
        });
      }

      logger.error('[MP] Erro ao criar PIX:', {
        request_id: String(req?.requestId || req?.headers?.['x-request-id'] || '').trim() || null,
        status,
        message: erro?.message,
        pedido_id: pedidoIdContexto,
        idempotency_key: contextoIdempotencia?.idempotencyKey || null,
        causes: causas,
        mpResponse: erro?.mpResponse || null
      });

      res.status(status).json(buildErrorPayload(mensagemDetalhada, {
        message: mensagemDetalhada,
        causes: causas,
        details: erro?.mpResponse || null
      }));
    }
  });

  // ============================================
  // CRIAR PAGAMENTO COM CARTÃƒO via Mercado Pago
  // ============================================
  router.post('/api/mercadopago/criar-cartao', autenticarToken, async (req, res) => {
    let contextoIdempotencia = null;
    let idempotenciaAdquirida = false;
    let pedidoIdContexto = null;
    try {
      const requestId = String(req.requestId || req.headers['x-request-id'] || '').trim() || null;
      if (!await exigirRecaptchaPagamento(req, res, { action: 'payment_card' })) {
        return;
      }

      const { pedido_id, token, parcelas, tax_id, payment_method_id, issuer_id } = req.body || {};
      const pedidoId = Number(pedido_id);
      pedidoIdContexto = pedidoId;

      if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
        return res.status(400).json(buildErrorPayload('Informe um pedido_id válido.'));
      }

      if (!token || typeof token !== 'string') {
        return res.status(400).json(buildErrorPayload('Token do cartão é obrigatório.'));
      }

      const parcelasNum = Number(parcelas) || 1;
      if (parcelasNum < 1 || parcelasNum > 12) {
        return res.status(400).json(buildErrorPayload('Número de parcelas deve ser entre 1 e 12.'));
      }

      const taxIdDigits = String(tax_id || '').replace(/\D/g, '');
      if (taxIdDigits.length !== 11 && taxIdDigits.length !== 14) {
        return res.status(400).json(buildErrorPayload('Informe um CPF ou CNPJ válido para o pagamento com cartão.'));
      }

      // Buscar pedido
      const [pedidos] = await pool.query(
        'SELECT id, usuario_id, total, status, mp_payment_id_mp FROM pedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );

      if (!pedidos.length) {
        return res.status(404).json(buildErrorPayload('Pedido não encontrado.'));
      }

      const pedido = pedidos[0];

      if (Number(pedido.usuario_id) !== Number(req.usuario.id)) {
        return res.status(403).json(buildErrorPayload('Acesso negado a este pedido.'));
      }

      const podeProcessarCartao = ['pendente', 'pagamento_recusado'].includes(String(pedido.status || '').trim().toLowerCase());
      if (!podeProcessarCartao) {
        return res.status(400).json(buildErrorPayload(`Pedido já se encontra com status "${pedido.status}". Não é possível processar pagamento.`));
      }

      contextoIdempotencia = montarContextoIdempotenciaPagamento({
        req,
        scope: 'pagamento_cartao',
        pedidoId,
        pedido,
        userId: req.usuario.id,
        flow: 'cartao',
        paymentMethodId: String(payment_method_id || '').trim()
      });

      if (DISTRIBUTED_IDEMPOTENCY_ENABLED) {
        const statusIdempotencia = await iniciarOperacaoDistribuida({
          pool,
          scope: contextoIdempotencia.scope,
          idempotencyKey: contextoIdempotencia.idempotencyKey,
          userId: req.usuario.id,
          pedidoId,
          requestFingerprint: contextoIdempotencia.fingerprint,
          strictFingerprint: true,
          lockTtlSeconds: 30,
          operationTtlSeconds: 180
        });

        if (statusIdempotencia.state === 'replay' && statusIdempotencia.responsePayload) {
          logger.info('[MP][CARD] Resposta reaproveitada por idempotencia.', {
            pedido_id: pedidoId,
            user_id: Number(req?.usuario?.id) || null,
            idempotency_key: contextoIdempotencia.idempotencyKey
          });
          return res.status(Number(statusIdempotencia.httpStatus || 200)).json(statusIdempotencia.responsePayload);
        }

        if (statusIdempotencia.state === 'in_progress') {
          return res.status(409).json(buildErrorPayload('Seu pagamento com cartao ja esta em processamento. Aguarde alguns segundos e tente novamente.'));
        }

        if (statusIdempotencia.state === 'fingerprint_mismatch') {
          return res.status(409).json(buildErrorPayload('A chave de idempotencia enviada nao corresponde a esta solicitacao de pagamento com cartao.'));
        }

        idempotenciaAdquirida = statusIdempotencia.state === 'acquired';
      }

      logger.info('[MP][CARD] Processando pagamento.', {
        request_id: requestId,
        pedido_id: pedidoId,
        user_id: Number(req?.usuario?.id) || null,
        gateway: 'mercadopago',
        idempotency_key: contextoIdempotencia?.idempotencyKey || null,
        gateway_idempotency_key: contextoIdempotencia?.gatewayIdempotencyKey || null
      });

      // Buscar dados do usuário
      const [usuarios] = await pool.query(
        'SELECT nome, email FROM usuarios WHERE id = ? LIMIT 1',
        [req.usuario.id]
      );
      const usuario = usuarios[0] || {};

      const resultado = await mercadoPagoService.criarPagamentoCartao({
        pedidoId,
        valor: Number(pedido.total),
        descricao: `Pedido #${pedidoId} - Mercado BomFilho`,
        token,
        parcelas: parcelasNum,
        email: usuario.email || 'cliente@bomfilho.com.br',
        nome: usuario.nome || 'Cliente',
        cpf: taxIdDigits,
        paymentMethodId: String(payment_method_id || '').trim(),
        issuerId: Number(issuer_id),
        idempotencyKey: contextoIdempotencia?.gatewayIdempotencyKey || null
      });

      const statusInterno = mercadoPagoService.mapearStatusPagamento(resultado.status);

      // Atualizar pedido com resultado
      await pool.query(
        `UPDATE pedidos SET
          mp_payment_id_mp = ?,
          gateway_pagamento = 'mercadopago',
          pix_status = ?,
          status = ?
         WHERE id = ?`,
        [
          String(resultado.payment_id),
          String(resultado.status).toUpperCase(),
          statusInterno,
          pedidoId
        ]
      );

      logger.info('[MP][CARD] Pedido atualizado apos retorno do gateway.', {
        request_id: requestId,
        pedido_id: pedidoId,
        payment_id: String(resultado.payment_id || ''),
        external_reference: String(pedidoId),
        x_request_id: requestId,
        event_id: null,
        status_anterior: String(pedido?.status || '').trim().toLowerCase() || null,
        status_novo: String(statusInterno || '').trim().toLowerCase() || null,
        origem_transicao: 'api_criar_pagamento_cartao'
      });

      const respostaCartao = {
        payment_id: resultado.payment_id,
        status: resultado.status,
        status_detail: resultado.status_detail,
        status_interno: statusInterno
      };
      if (DISTRIBUTED_IDEMPOTENCY_ENABLED && idempotenciaAdquirida && contextoIdempotencia) {
        await concluirOperacaoDistribuida({
          pool,
          scope: contextoIdempotencia.scope,
          idempotencyKey: contextoIdempotencia.idempotencyKey,
          userId: req.usuario.id,
          pedidoId,
          httpStatus: 200,
          responsePayload: respostaCartao,
          successTtlSeconds: 180
        });
      }
      return res.json(respostaCartao);
    } catch (erro) {
      const status = Number(erro?.status || 500);
      const causas = extrairCausasMercadoPago(erro?.mpResponse || {});
      const mensagem =
        erro?.mpResponse?.message
        || erro?.mpResponse?.error
        || erro?.message
        || 'Não foi possível processar o pagamento com cartão.';
      const mensagemDetalhada = causas.length
        ? `${mensagem} (${causas.join(' | ')})`
        : mensagem;

      if (DISTRIBUTED_IDEMPOTENCY_ENABLED && idempotenciaAdquirida && contextoIdempotencia) {
        await falharOperacaoDistribuida({
          pool,
          scope: contextoIdempotencia.scope,
          idempotencyKey: contextoIdempotencia.idempotencyKey,
          userId: req?.usuario?.id,
          httpStatus: status,
          errorMessage: erro?.message || 'falha_pagamento_cartao',
          failureTtlSeconds: 45
        });
      }

      logger.error('[MP] Erro ao processar cartão:', {
        request_id: String(req?.requestId || req?.headers?.['x-request-id'] || '').trim() || null,
        status,
        message: erro?.message,
        pedido_id: pedidoIdContexto,
        idempotency_key: contextoIdempotencia?.idempotencyKey || null,
        causes: causas,
        mpResponse: erro?.mpResponse || null
      });

      res.status(status).json(buildErrorPayload(mensagemDetalhada, {
        message: mensagemDetalhada,
        causes: causas,
        details: erro?.mpResponse || null
      }));
    }
  });

  // ============================================
  // STATUS / Health Check
  // ============================================
  router.get('/api/mercadopago/status', (req, res) => {
    res.json({
      gateway: ACTIVE_PAYMENT_GATEWAY,
      active_runtime_gateway: ACTIVE_PAYMENT_GATEWAY,
      legados_presentes_no_repositorio: LEGACY_PAYMENT_GATEWAYS,
      configurado: Boolean(MP_ACCESS_TOKEN),
      env: MP_ENV,
      notification_url_configurada: Boolean(MP_NOTIFICATION_URL),
      webhook_secret_configurado: Boolean(MP_WEBHOOK_SECRET)
    });
  });

  return router;
};
