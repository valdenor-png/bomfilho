'use strict';

const express = require('express');
const logger = require('../lib/logger');
const config = require('../lib/config');
const {
  extrairStatusPagamentoPagBank,
  mapearStatusPedido
} = require('../services/pagbankWebhookService');
const {
  extrairTraceIdPagBank,
  sanitizarPayloadPagBankParaLog
} = require('../services/pagbankLogService');
const {
  normalizarParcelasCartao,
  normalizarTipoCartao,
  normalizarAuthenticationMethodPagBank,
  validarAuthenticationMethodPagBank,
  montarAuthenticationMethodMock3DS,
  validarResultadoAutenticacao3DSPagBank
} = require('../services/pagbankPaymentHelpers');
const {
  gerarLogsHomologacaoPagBank,
  gerarLog3DSAuth
} = require('../services/pagbankHomologacaoLogService');
const {
  extrairTaxIdDigits,
  buscarPedidoDoUsuarioPorId
} = require('../services/pedidoPagamentoHelpers');

const {
  PAGBANK_TOKEN,
  PAGBANK_API_URL,
  PAGBANK_SDK_API_URL,
  PAGBANK_ENV,
  PAGBANK_3DS_SDK_ENV,
  PAGBANK_TIMEOUT_MS,
  PAGBANK_WEBHOOK_TOKEN,
  PAGBANK_DEBUG_LOGS,
  IS_PRODUCTION,
  ALLOW_DEBIT_3DS_MOCK,
  BASE_URL_ENV,
  RECAPTCHA_PAYMENT_PROTECTION_ENABLED
} = config;

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.protegerDiagnostico
 * @param {Function} deps.validarRecaptcha
 * @param {Function} deps.registrarLogPagBank
 * @param {Function} deps.registrarFalhaOperacaoPagBank
 * @param {Function} deps.registrarLogEndpointDiagnostico
 * @param {Function} deps.analisarChavePublicaPagBank
 * @param {Function} deps.traduzirMotivoChavePublicaPagBank
 * @param {Function} deps.montarWebhookPagBankUrl
 * @param {Function} deps.verificarCredencialPagBank
 * @param {Function} deps.criarPagamentoPix
 * @param {Function} deps.criarPagamentoCartao
 * @param {Function} deps.criarSessaoAutenticacao3DSPagBank
 * @param {Function} deps.enviarPostPagBankOrders
 * @param {Function} deps.obterPedidoPagBank
 * @param {Function} deps.getPagbankLastAuthCheck
 * @param {object}   deps.pool
 */
module.exports = function createPagBankRoutes(deps) {
  const {
    autenticarToken,
    protegerDiagnostico,
    validarRecaptcha,
    registrarLogPagBank,
    registrarFalhaOperacaoPagBank,
    registrarLogEndpointDiagnostico,
    analisarChavePublicaPagBank,
    traduzirMotivoChavePublicaPagBank,
    montarWebhookPagBankUrl,
    verificarCredencialPagBank,
    criarPagamentoPix,
    criarPagamentoCartao,
    criarSessaoAutenticacao3DSPagBank,
    enviarPostPagBankOrders,
    obterPedidoPagBank,
    getPagbankLastAuthCheck,
    pool
  } = deps;

  const router = express.Router();

  // Chave pública do PagBank para criptografia de cartão no frontend
  router.get('/api/pagbank/public-key', (req, res) => {
    const endpoint = '/api/pagbank/public-key';

    try {
      const chaveInfo = analisarChavePublicaPagBank();
      const publicKey = chaveInfo.valid ? chaveInfo.publicKey : '';

      if (!publicKey) {
        registrarLogEndpointDiagnostico({
          endpoint,
          statusHttp: 500,
          detalhe: traduzirMotivoChavePublicaPagBank(chaveInfo.reason),
          extra: {
            pagbank_env: PAGBANK_ENV,
            public_key_present: Boolean(chaveInfo.publicKey),
            public_key_valid: false,
            validation_reason: chaveInfo.reason
          }
        });

        return res.status(500).json({
          erro: 'PAGBANK_PUBLIC_KEY não configurada no backend',
          detalhe: traduzirMotivoChavePublicaPagBank(chaveInfo.reason),
          public_key: ''
        });
      }

      registrarLogEndpointDiagnostico({
        endpoint,
        statusHttp: 200,
        detalhe: 'Chave pública PagBank retornada com sucesso',
        extra: {
          pagbank_env: PAGBANK_ENV,
          public_key_present: true
        }
      });

      return res.status(200).json({
        public_key: publicKey
      });
    } catch (erro) {
      registrarLogEndpointDiagnostico({
        endpoint,
        statusHttp: 500,
        detalhe: erro?.message || 'Erro inesperado ao obter chave pública PagBank',
        extra: {
          pagbank_env: PAGBANK_ENV
        }
      });

      return res.status(500).json({
        erro: 'Erro ao obter a chave pública do PagBank',
        public_key: ''
      });
    }
  });

  // Diagnóstico PagBank: valida token e mostra URLs configuradas
  router.get('/api/pagbank/status', protegerDiagnostico, async (req, res) => {
    try {
      const baseUrl = String(BASE_URL_ENV || 'http://localhost:3000');
      const webhookUrl = montarWebhookPagBankUrl({ incluirToken: false });
      const token = process.env.PAGBANK_TOKEN || '';
      const chaveInfo = analisarChavePublicaPagBank();

      const lastCheck = getPagbankLastAuthCheck() || {};
      const shouldRefresh = !lastCheck.checkedAt ||
        (Date.now() - Date.parse(lastCheck.checkedAt)) > 60_000;

      if (shouldRefresh) {
        await verificarCredencialPagBank();
      }

      res.json({
        pagbank_env: PAGBANK_ENV,
        pagbank_api_url: PAGBANK_API_URL,
        pagbank_sdk_api_url: PAGBANK_SDK_API_URL,
        pagbank_3ds_sdk_env: PAGBANK_3DS_SDK_ENV,
        pagbank_timeout_ms: PAGBANK_TIMEOUT_MS,
        base_url: baseUrl,
        webhook_url: webhookUrl,
        token_present: !!token,
        public_key_present: Boolean(chaveInfo.publicKey),
        public_key_valid: chaveInfo.valid,
        public_key_validation_reason: chaveInfo.reason,
        webhook_protected: !!PAGBANK_WEBHOOK_TOKEN,
        auth_check: getPagbankLastAuthCheck()
      });
    } catch (e) {
      res.status(500).json({ erro: 'Falha ao verificar PagBank', detalhe: e?.message });
    }
  });

  // Teste de homologação: cria pedido mínimo no sandbox
  router.get('/api/pagbank/test', protegerDiagnostico, async (req, res) => {
    try {
      if (!PAGBANK_TOKEN) {
        return res.status(503).json({ erro: 'PAGBANK_TOKEN não configurado no backend' });
      }

      if (PAGBANK_API_URL !== 'https://sandbox.api.pagseguro.com') {
        return res.status(400).json({
          erro: 'Endpoint de teste disponível apenas no sandbox. Defina PAGBANK_ENV=sandbox.'
        });
      }

      const payload = {
        reference_id: `pedido-homologacao-${Date.now()}`,
        customer: {
          name: 'Cliente Teste',
          email: 'teste@teste.com',
          tax_id: '12345678909'
        },
        items: [
          {
            reference_id: 'produto-1',
            name: 'Produto Teste',
            quantity: 1,
            unit_amount: 500
          }
        ]
      };

      const headers = {
        'Authorization': `Bearer ${PAGBANK_TOKEN}`,
        'Content-Type': 'application/json'
      };

      const { response, responseBodyText } = await enviarPostPagBankOrders({ headers, payload });

      let pagbankResponse = {};
      try {
        pagbankResponse = responseBodyText ? JSON.parse(responseBodyText) : {};
      } catch {
        pagbankResponse = responseBodyText || '';
      }

      if (!response.ok) {
        return res.status(response.status).json({
          message: 'Falha ao enviar pedido de teste para PagBank',
          pagbank_response: pagbankResponse
        });
      }

      return res.json({
        message: 'Pedido de teste enviado para PagBank',
        pagbank_response: pagbankResponse
      });
    } catch (erro) {
      return res.status(500).json({
        erro: erro?.message || 'Falha ao enviar pedido de teste para o PagBank'
      });
    }
  });

  // Teste PIX no PagBank (diagnóstico)
  router.post('/api/pagbank/test-pix', protegerDiagnostico, async (req, res) => {
    try {
      const valueReais = Number(req.body?.valor_reais ?? 1.00);
      const valor = Number.isFinite(valueReais) ? Math.max(0.5, valueReais) : 1.0;

      const taxIdRaw = req.body?.tax_id ?? req.body?.cpf;
      const taxIdDigits = (taxIdRaw || '').toString().replace(/\D/g, '');
      const taxId = taxIdDigits || (PAGBANK_ENV === 'production' ? null : '12345678909');

      if (!taxId) {
        return res.status(400).json({
          ok: false,
          erro: 'tax_id (CPF/CNPJ) é obrigatório para testar PIX no PagBank'
        });
      }

      const resultadoPix = await criarPagamentoPix({
        pedidoId: `teste_${Date.now()}`,
        total: valor,
        descricao: 'Teste PIX PagBank',
        email: 'teste@example.com',
        nome: 'Teste',
        taxId
      });

      const qr0 = resultadoPix?.qr_codes?.[0] || null;
      const pixCodigo = qr0?.text || null;
      const pixQrCode = qr0?.links?.[0]?.href || null;
      const statusInfo = extrairStatusPagamentoPagBank(resultadoPix);
      const statusPagBank = String(statusInfo.statusResolvido || 'WAITING').toUpperCase();
      const chargePrincipal = statusInfo.chargePrincipal || {};
      const chargeId = chargePrincipal?.id || null;

      return res.json({
        ok: true,
        pagbank_env: PAGBANK_ENV,
        notification_url: montarWebhookPagBankUrl({ incluirToken: false }),
        webhook_protected: !!PAGBANK_WEBHOOK_TOKEN,
        pagbank_order_id: resultadoPix?.id || null,
        charge_id: chargeId,
        status: statusPagBank,
        status_interno: mapearStatusPedido(statusPagBank),
        status_order: statusInfo.orderStatus || null,
        status_charge: statusInfo.chargeStatus || null,
        status_fonte: statusInfo.fonteStatus,
        pix_codigo: pixCodigo,
        pix_qrcode: pixQrCode,
        raw: resultadoPix
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        erro: e?.message || 'Falha ao criar PIX PagBank'
      });
    }
  });

  // Criar sessão 3DS para uso no SDK PagBank no checkout
  router.post('/api/pagbank/3ds/session', autenticarToken, async (req, res) => {
    const endpoint = '/api/pagbank/3ds/session';
    const referenceId = String(req.body?.reference_id || req.body?.referenceId || '').trim() || null;

    try {
      if (!PAGBANK_TOKEN) {
        registrarFalhaOperacaoPagBank({
          operacao: 'api.pagbank.3ds.session.error',
          endpoint,
          method: 'POST',
          httpStatus: 503,
          requestPayload: req.body,
          responsePayload: {
            erro: 'PAGBANK_TOKEN ausente para sessao 3DS'
          },
          extra: {
            fluxo: 'debit_3ds_auth',
            reference_id: referenceId,
            usuario_id: req.usuario?.id || null,
            pagbank_env: PAGBANK_ENV
          }
        });

        return res.status(503).json({
          erro: 'Autenticacao de seguranca do cartao indisponivel no momento.'
        });
      }

      const resultadoSessao = await criarSessaoAutenticacao3DSPagBank();
      const payloadResposta = {
        session: resultadoSessao.session,
        env: PAGBANK_3DS_SDK_ENV,
        expires_in_seconds: 1800
      };

      registrarLogPagBank({
        operacao: 'api.pagbank.3ds.session.response',
        endpoint,
        method: 'POST',
        httpStatus: 200,
        responsePayload: payloadResposta,
        extra: {
          fluxo: 'debit_3ds_auth',
          reference_id: referenceId,
          usuario_id: req.usuario?.id || null,
          pagbank_env: PAGBANK_ENV,
          sdk_endpoint: resultadoSessao.endpoint,
          trace_id: resultadoSessao.traceId || undefined
        }
      });

      return res.status(200).json(payloadResposta);
    } catch (erro) {
      const statusBruto = Number(erro?.httpStatus || erro?.status || 502);
      const statusResposta = statusBruto >= 500 || statusBruto < 400
        ? 502
        : statusBruto;
      const traceId = String(
        erro?.traceId
          || erro?.trace_id
          || extrairTraceIdPagBank(erro?.responsePayload)
          || ''
      ).trim();

      registrarFalhaOperacaoPagBank({
        operacao: 'api.pagbank.3ds.session.error',
        endpoint,
        method: 'POST',
        httpStatus: statusResposta,
        requestPayload: req.body,
        responsePayload: erro?.responsePayload || {
          erro: erro?.message || 'Falha ao criar sessao 3DS'
        },
        extra: {
          fluxo: 'debit_3ds_auth',
          reference_id: referenceId,
          usuario_id: req.usuario?.id || null,
          pagbank_env: PAGBANK_ENV,
          sdk_endpoint: erro?.endpoint || `${PAGBANK_SDK_API_URL}/checkout-sdk/sessions`,
          trace_id: traceId || undefined
        }
      });

      return res.status(statusResposta).json({
        erro: 'Nao foi possivel iniciar a autenticacao de seguranca do cartao. Tente novamente em instantes.',
        trace_id: traceId || undefined
      });
    }
  });

  // Gerar QR Code PIX (PagBank) para um pedido existente
  router.post('/api/pagamentos/pix', autenticarToken, async (req, res) => {
    try {
      const payloadRequest = req.body || {};
      const pedidoIdNumerico = Number.parseInt(String(payloadRequest?.pedido_id || ''), 10);
      const taxIdDigits = extrairTaxIdDigits(payloadRequest);
      const taxId = taxIdDigits || (PAGBANK_ENV === 'production' ? null : '12345678909');

      if (RECAPTCHA_PAYMENT_PROTECTION_ENABLED) {
        await validarRecaptcha({
          token: payloadRequest?.recaptcha_token,
          req,
          action: 'checkout_pagamento_pix'
        });
      }

      if (!PAGBANK_TOKEN) {
        return res.status(503).json({ erro: 'Esta forma de pagamento está temporariamente indisponível.' });
      }

      if (!Number.isInteger(pedidoIdNumerico) || pedidoIdNumerico <= 0) {
        return res.status(400).json({ erro: 'Não foi possível identificar o pedido para pagamento.' });
      }

      if (!taxId) {
        return res.status(400).json({ erro: 'Informe CPF ou CNPJ para gerar o PIX.' });
      }

      if (![11, 14].includes(String(taxId).length)) {
        return res.status(400).json({ erro: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
      }

      const pedido = await buscarPedidoDoUsuarioPorId({
        connection: pool,
        pedidoId: pedidoIdNumerico,
        usuarioId: req.usuario.id
      });

      if (!pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado para esta conta.' });
      }

      const statusPedidoAtual = String(pedido.status || '').trim().toLowerCase();
      if (['pago', 'entregue', 'cancelado'].includes(statusPedidoAtual)) {
        return res.status(409).json({ erro: `Este pedido ja esta ${statusPedidoAtual} e nao aceita novo pagamento.` });
      }

      const pagamento = await criarPagamentoPix({
        pedidoId: pedido.id,
        total: pedido.total,
        descricao: `Pedido #${pedido.id}`,
        email: pedido.email,
        nome: pedido.nome,
        taxId
      });

      const qrCodePrincipal = pagamento?.qr_codes?.[0] || {};
      const paymentId = pagamento?.id || null;
      const statusPagBank = String(
        pagamento?.charges?.[0]?.status ||
        pagamento?.status ||
        qrCodePrincipal?.status ||
        'WAITING'
      ).toUpperCase();
      const statusInterno = mapearStatusPedido(statusPagBank);

      const pixCodigo = qrCodePrincipal?.text || null;
      const pixQrCode = qrCodePrincipal?.links?.find((link) => String(link?.media || '').includes('image/png'))?.href
        || qrCodePrincipal?.links?.[0]?.href
        || null;

      try {
        await pool.query(
          `UPDATE pedidos 
           SET pix_id = ?, pix_status = ?, pix_codigo = ?, pix_qrcode = ?
           WHERE id = ?`,
          [paymentId, statusPagBank, pixCodigo, pixQrCode, pedido.id]
        );
      } catch (err) {
        logger.warn('Não foi possível salvar dados do PIX (faltam colunas?):', err.message);
      }

      res.json({
        payment_id: paymentId,
        status: statusPagBank,
        status_interno: statusInterno,
        qr_code: pixCodigo,
        qr_code_base64: null,
        qr_data: pixCodigo,
        pix_codigo: pixCodigo,
        pix_qrcode: pixQrCode
      });
    } catch (erro) {
      if (erro?.httpStatus) {
        return res.status(erro.httpStatus).json({ erro: erro.message });
      }

      logger.error('Erro ao gerar PIX:', erro);
      res.status(500).json({ erro: 'Não foi possível gerar o PIX. Tente novamente.' });
    }
  });

  // Processar pagamento com cartão (PagBank API Orders) para um pedido existente
  router.post('/api/pagamentos/cartao', autenticarToken, async (req, res) => {
    try {
      const payloadRequest = req.body || {};
      const pedidoIdNumerico = Number.parseInt(String(payloadRequest?.pedido_id || ''), 10);
      const taxIdDigits = extrairTaxIdDigits(payloadRequest);
      const tokenCartao = String(payloadRequest?.token_cartao || payloadRequest?.cartao_encriptado || '').trim();
      const authenticationMethodBruto = payloadRequest?.authentication_method;
      let authenticationMethod = normalizarAuthenticationMethodPagBank(authenticationMethodBruto);
      const threeDSResult = payloadRequest?.three_ds_result;
      const tipoCartaoSolicitado = String(payloadRequest?.tipo_cartao || payloadRequest?.forma_pagamento || '').trim();
      const parcelas = normalizarParcelasCartao(payloadRequest?.parcelas);

      if (RECAPTCHA_PAYMENT_PROTECTION_ENABLED) {
        await validarRecaptcha({
          token: payloadRequest?.recaptcha_token,
          req,
          action: 'checkout_pagamento_cartao'
        });
      }

      registrarLogPagBank({
        operacao: 'api.pagamentos.cartao.request',
        endpoint: '/api/pagamentos/cartao',
        method: 'POST',
        requestPayload: payloadRequest,
        extra: {
          usuario_id: req.usuario?.id || null,
          pedido_id: pedidoIdNumerico || null,
          fluxo: 'debit_3ds_auth',
          authentication_method_present: Boolean(authenticationMethod),
          authentication_method_id_present: Boolean(authenticationMethod?.id),
          three_ds_status: String(threeDSResult?.status || '').trim().toUpperCase() || null,
          three_ds_trace_id: String(threeDSResult?.trace_id || threeDSResult?.traceId || '').trim() || null
        }
      });

      if (!PAGBANK_TOKEN) {
        return res.status(503).json({ erro: 'Esta forma de pagamento está temporariamente indisponível.' });
      }

      if (!Number.isInteger(pedidoIdNumerico) || pedidoIdNumerico <= 0) {
        return res.status(400).json({ erro: 'Não foi possível identificar o pedido para pagamento.' });
      }

      if (![11, 14].includes(taxIdDigits.length)) {
        return res.status(400).json({ erro: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
      }

      if (!tokenCartao) {
        return res.status(400).json({ erro: 'Não foi possível validar os dados do cartão.' });
      }

      const pedido = await buscarPedidoDoUsuarioPorId({
        connection: pool,
        pedidoId: pedidoIdNumerico,
        usuarioId: req.usuario.id
      });

      if (!pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado para esta conta.' });
      }

      const statusPedidoAtual = String(pedido.status || '').trim().toLowerCase();
      if (['pago', 'entregue', 'cancelado'].includes(statusPedidoAtual)) {
        return res.status(409).json({ erro: `Este pedido ja esta ${statusPedidoAtual} e nao aceita novo pagamento.` });
      }

      const formaPagamentoPedido = String(pedido.forma_pagamento || '').toLowerCase();
      const tipoEsperadoPedido = normalizarTipoCartao(formaPagamentoPedido);
      const tipoCartao = tipoCartaoSolicitado
        ? normalizarTipoCartao(tipoCartaoSolicitado)
        : tipoEsperadoPedido;
      if (!['cartao', 'credito', 'debito'].includes(formaPagamentoPedido)) {
        return res.status(400).json({ erro: 'Este pedido não está disponível para pagamento com cartão.' });
      }

      if (formaPagamentoPedido === 'debito' && tipoCartao !== 'debito') {
        return res.status(400).json({ erro: 'Este pedido deve ser pago no débito.' });
      }

      if (['cartao', 'credito'].includes(formaPagamentoPedido) && tipoCartao === 'debito') {
        return res.status(400).json({ erro: 'Este pedido deve ser pago no crédito.' });
      }

      const totalPedido = Number(pedido.total || 0);
      const parcelamentoCreditoDisponivel = totalPedido >= 100;
      if (tipoCartao === 'credito' && parcelas > 1 && !parcelamentoCreditoDisponivel) {
        return res.status(400).json({
          erro: 'Parcelamento no crédito disponível apenas para pedidos a partir de R$ 100,00.'
        });
      }

      const parcelasAplicadas = tipoCartao === 'debito'
        ? 1
        : (parcelamentoCreditoDisponivel ? parcelas : 1);

      let validacao3DSDebito = null;

      if (tipoCartao === 'debito') {
        const fallback3dsMockPermitido = PAGBANK_ENV !== 'production' && ALLOW_DEBIT_3DS_MOCK;
        const validacaoAuthDebito = validarAuthenticationMethodPagBank(authenticationMethod);
        const validacaoResultado3DS = validarResultadoAutenticacao3DSPagBank({
          threeDSResult,
          authenticationMethod
        });
        const status3DS = String(validacaoResultado3DS?.status || '').trim() || null;
        const authenticationId3DS = String(validacaoResultado3DS?.authenticationId || '').trim() || null;
        const traceId3DS = String(validacaoResultado3DS?.traceId || '').trim() || null;

        validacao3DSDebito = {
          ...validacaoResultado3DS,
          status: status3DS,
          authenticationId: authenticationId3DS,
          traceId: traceId3DS
        };

        registrarLogPagBank({
          operacao: 'api.pagamentos.cartao.3ds.validation',
          endpoint: '/api/pagamentos/cartao',
          method: 'POST',
          httpStatus: 200,
          responsePayload: {
            ok: validacaoResultado3DS.ok,
            codigo: validacaoResultado3DS.codigo,
            status: status3DS,
            authentication_id_present: Boolean(authenticationId3DS),
            auth_method_present: validacaoAuthDebito.ok,
            fallback_mock_3ds_permitido: fallback3dsMockPermitido,
            trace_id: traceId3DS || undefined
          },
          extra: {
            usuario_id: req.usuario?.id || null,
            pedido_id: pedidoIdNumerico || null,
            fluxo: 'debit_3ds_auth',
            tipo_cartao: 'debito',
            three_ds_status: status3DS,
            three_ds_codigo: validacaoResultado3DS.codigo,
            authentication_method_type: authenticationMethod?.type || null,
            authentication_method_id_present: Boolean(authenticationMethod?.id),
            trace_id: traceId3DS || undefined
          }
        });

        // --- Log de homologação 3DS (LOG 1) ---
        if (PAGBANK_DEBUG_LOGS && !IS_PRODUCTION) {
          try {
            const log1 = gerarLog3DSAuth({
              operacao: '3ds.authenticate',
              referenceId: `pedido_${pedidoIdNumerico}`,
              status3DS: status3DS,
              authenticationId: authenticationId3DS,
              traceId: traceId3DS,
              resultadoFinal: validacaoResultado3DS.ok ? 'APROVADO' : (validacaoResultado3DS.codigo || 'REJEITADO'),
              extra: {
                authentication_method_type: authenticationMethod?.type || null,
                three_ds_result_status: threeDSResult?.status || null,
                fallback_mock: fallback3dsMockPermitido
              }
            });
            logger.info(`\n${log1.texto}\n`);
          } catch (_logErr) {
            // log de homologação nunca deve impedir o fluxo
          }
        }

        if (!validacaoResultado3DS.ok && !fallback3dsMockPermitido) {
          const mensagensErro3DS = {
            MISSING_3DS_STATUS: 'Para concluir no debito, complete a autenticacao 3DS e tente novamente.',
            MISSING_3DS_AUTH_ID: 'Autenticacao 3DS concluida sem id valido. Gere uma nova autenticacao e tente novamente.',
            '3DS_AUTH_ID_MISMATCH': 'Nao foi possivel validar a autenticacao 3DS do debito. Gere uma nova autenticacao e tente novamente.',
            AUTH_NOT_SUPPORTED: 'Seu cartao de debito nao e elegivel para autenticacao 3DS. Escolha outro meio de pagamento.',
            CHANGE_PAYMENT_METHOD: 'A autenticacao 3DS foi negada. Escolha outro meio de pagamento.',
            REQUIRE_CHALLENGE: 'Conclua o desafio 3DS para continuar o pagamento no debito.',
            INVALID_3DS_STATUS: 'Nao foi possivel validar a autenticacao 3DS do debito. Tente novamente.'
          };
          const mensagemErro3DS = mensagensErro3DS[validacaoResultado3DS.codigo]
            || 'Nao foi possivel validar a autenticacao 3DS do debito. Tente novamente.';

          registrarFalhaOperacaoPagBank({
            operacao: 'api.pagamentos.cartao.3ds.error',
            endpoint: '/api/pagamentos/cartao',
            method: 'POST',
            httpStatus: 400,
            requestPayload: {
              pedido_id: pedidoIdNumerico,
              tipo_cartao: 'debito',
              authentication_method: authenticationMethod,
              three_ds_result: threeDSResult
            },
            responsePayload: {
              erro: mensagemErro3DS,
              codigo: validacaoResultado3DS.codigo,
              three_ds_status: status3DS,
              trace_id: traceId3DS || undefined
            },
            extra: {
              usuario_id: req.usuario?.id || null,
              pedido_id: pedidoIdNumerico || null,
              fluxo: 'debit_3ds_auth',
              three_ds_status: status3DS,
              three_ds_codigo: validacaoResultado3DS.codigo,
              authentication_method_type: authenticationMethod?.type || null,
              authentication_method_id_present: Boolean(authenticationMethod?.id),
              trace_id: traceId3DS || undefined
            }
          });

          return res.status(400).json({
            erro: mensagemErro3DS,
            codigo: validacaoResultado3DS.codigo,
            trace_id: traceId3DS || undefined
          });
        }

        if (!validacaoAuthDebito.ok && !fallback3dsMockPermitido) {
          let mensagemErroAuth = 'Para concluir no debito, complete a autenticacao 3DS e tente novamente.';
          if (validacaoAuthDebito.motivo === 'missing_id') {
            mensagemErroAuth = 'Autenticacao 3DS invalida: id da autenticacao nao foi informado.';
          } else if (validacaoAuthDebito.motivo === 'invalid_type') {
            mensagemErroAuth = 'Autenticacao 3DS invalida: authentication_method.type deve ser THREEDS.';
          }

          return res.status(400).json({
            erro: mensagemErroAuth
          });
        }

        if (validacaoResultado3DS.ok) {
          authenticationMethod = {
            type: 'THREEDS',
            id: authenticationId3DS
          };
        } else if (validacaoAuthDebito.ok) {
          authenticationMethod = validacaoAuthDebito.auth;
        } else if (fallback3dsMockPermitido) {
          authenticationMethod = null;
        }
      }

      let pagamento = await criarPagamentoCartao({
        pedidoId: pedido.id,
        total: pedido.total,
        descricao: `Pedido #${pedido.id}`,
        email: pedido.email,
        nome: pedido.nome,
        taxId: taxIdDigits,
        tokenCartao,
        parcelas: parcelasAplicadas,
        tipoCartao,
        authenticationMethod
      });

      const pagbankOrderId = pagamento?.id || null;
      let statusInfo = extrairStatusPagamentoPagBank(pagamento);

      const precisaReconsultaOrder = Boolean(
        pagbankOrderId
        && (!statusInfo.chargeStatus || statusInfo.orderStatus === 'CREATED')
      );

      if (precisaReconsultaOrder) {
        try {
          const detalhesOrder = await obterPedidoPagBank(pagbankOrderId);
          if (detalhesOrder) {
            pagamento = detalhesOrder;
            statusInfo = extrairStatusPagamentoPagBank(detalhesOrder);
          }
        } catch (erroConsultaOrder) {
          logger.warn('⚠️ Não foi possível reconsultar order no PagBank após criação:', erroConsultaOrder?.message || erroConsultaOrder);
        }
      }

      const chargePrincipal = statusInfo.chargePrincipal || {};
      const paymentResponse = chargePrincipal?.payment_response || {};
      const statusPagBank = String(statusInfo.statusResolvido || 'WAITING').toUpperCase();
      const statusChargeThreeDS = String(statusInfo.chargeThreeDSStatus || '').trim().toUpperCase() || null;
      const statusInterno = mapearStatusPedido(statusPagBank);
      const pagbankChargeId = chargePrincipal?.id || null;
      const referenceIdPedido = String(pagamento?.reference_id || `pedido_${pedido.id}`).trim() || `pedido_${pedido.id}`;
      const traceId = String(extrairTraceIdPagBank(pagamento) || '').trim() || null;

      try {
        await pool.query(
          `UPDATE pedidos
           SET status = ?, pix_status = ?, pix_id = ?
           WHERE id = ?`,
          [statusInterno, statusPagBank, pagbankOrderId, pedido.id]
        );
      } catch (err) {
        const mensagemErroPersistencia = String(err?.message || '').trim();
        const faltamColunasPix = /Unknown column 'pix_status'|Unknown column 'pix_id'/i.test(mensagemErroPersistencia);

        if (faltamColunasPix) {
          try {
            await pool.query(
              `UPDATE pedidos
               SET status = ?
               WHERE id = ?`,
              [statusInterno, pedido.id]
            );
            logger.warn('Persistência parcial no pagamento cartão: colunas pix_* ausentes; status do pedido atualizado.');
          } catch (erroFallbackPersistencia) {
            logger.warn('Não foi possível salvar o status do pagamento cartão no fallback:', erroFallbackPersistencia?.message || erroFallbackPersistencia);
          }
        } else {
          logger.warn('Não foi possível salvar dados do pagamento cartão:', mensagemErroPersistencia || err);
        }
      }

      const payloadResposta = {
        payment_id: pagbankChargeId,
        pagbank_order_id: pagbankOrderId,
        reference_id: referenceIdPedido,
        status: statusPagBank,
        status_interno: statusInterno,
        status_order: statusInfo.orderStatus || null,
        status_charge: statusInfo.chargeStatus || null,
        status_charge_threeds: statusChargeThreeDS,
        status_fonte: statusInfo.fonteStatus,
        tipo_cartao: tipoCartao,
        parcelas: tipoCartao === 'debito' ? 1 : parcelasAplicadas,
        authorization_code: paymentResponse?.code || null,
        message: paymentResponse?.message || null,
        payment_response: {
          code: paymentResponse?.code || null,
          message: paymentResponse?.message || null
        },
        three_ds_status: tipoCartao === 'debito' ? (validacao3DSDebito?.status || null) : undefined,
        three_ds_codigo: tipoCartao === 'debito' ? (validacao3DSDebito?.codigo || null) : undefined,
        authentication_id_3ds: tipoCartao === 'debito'
          ? String(authenticationMethod?.id || validacao3DSDebito?.authenticationId || '').trim() || null
          : undefined,
        trace_id: traceId || undefined
      };

      if (PAGBANK_DEBUG_LOGS && !IS_PRODUCTION) {
        payloadResposta.raw = pagamento;
      }

      registrarLogPagBank({
        operacao: 'api.pagamentos.cartao.response',
        endpoint: '/api/pagamentos/cartao',
        method: 'POST',
        httpStatus: 200,
        responsePayload: payloadResposta,
        extra: {
          usuario_id: req.usuario?.id || null,
          pedido_id: pedido.id,
          reference_id: referenceIdPedido,
          pagbank_order_id: pagbankOrderId,
          pagbank_charge_id: pagbankChargeId,
          payment_method_type: tipoCartao === 'debito' ? 'DEBIT_CARD' : 'CREDIT_CARD',
          authentication_method_type: authenticationMethod?.type || null,
          authentication_method_id_present: Boolean(authenticationMethod?.id),
          status_charge: statusInfo.chargeStatus || null,
          status_charge_threeds: statusChargeThreeDS,
          payment_response_code: paymentResponse?.code || null,
          payment_response_message: paymentResponse?.message || null,
          three_ds_status: validacao3DSDebito?.status || null,
          three_ds_codigo: validacao3DSDebito?.codigo || null,
          capture: true,
          trace_id: traceId || undefined
        }
      });

      return res.json(payloadResposta);
    } catch (erro) {
      const statusBruto = Number(erro?.httpStatus || erro?.status || 500);
      const statusResposta = statusBruto >= 500 || statusBruto < 400
        ? 502
        : statusBruto;
      const traceId = String(
        erro?.traceId
          || erro?.trace_id
          || extrairTraceIdPagBank(erro?.responsePayload)
          || ''
      ).trim();
      const mensagemErro = String(erro?.message || '').toLowerCase();
      const erroAuth3ds = mensagemErro.includes('authentication_method')
        || mensagemErro.includes('threeds')
        || mensagemErro.includes('3ds');
      const mensagemUsuario = erroAuth3ds
        ? 'Nao foi possivel validar a autenticacao 3DS do cartao de debito. Tente novamente ou escolha outro meio de pagamento.'
        : 'Nao foi possivel processar o pagamento com cartao.';

      registrarFalhaOperacaoPagBank({
        operacao: 'api.pagamentos.cartao.error',
        endpoint: '/api/pagamentos/cartao',
        method: 'POST',
        httpStatus: statusResposta,
        requestPayload: req.body,
        responsePayload: erro?.responsePayload || {
          erro: erro?.message || 'Nao foi possivel processar o pagamento com cartao'
        },
        extra: {
          usuario_id: req.usuario?.id || null,
          pedido_id: req.body?.pedido_id || null,
          reference_id: req.body?.pedido_id ? `pedido_${req.body.pedido_id}` : null,
          trace_id: traceId || undefined
        }
      });

      logger.error('Erro ao processar pagamento com cartão:', erro);
      return res.status(statusResposta).json({
        erro: mensagemUsuario,
        trace_id: traceId || undefined
      });
    }
  });

  return router;
};
