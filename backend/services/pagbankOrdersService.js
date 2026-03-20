'use strict';

const crypto = require('crypto');
const logger = require('../lib/logger');
const {
  normalizarTipoCartao,
  normalizarParcelasCartao,
  normalizarAuthenticationMethodPagBank,
  validarAuthenticationMethodPagBank,
  montarAuthenticationMethodMock3DS
} = require('./pagbankPaymentHelpers');
const {
  extrairStatusPagamentoPagBank
} = require('./pagbankWebhookService');
const {
  sanitizarPayloadPagBankParaLog
} = require('./pagbankLogService');
const {
  gerarLogsHomologacaoPagBank
} = require('./pagbankHomologacaoLogService');

/**
 * Gera data ISO local com offset para expiração PIX.
 * PagBank exige offset (ex.: -03:00) e rejeita datas passadas.
 */
function formatIsoLocalWithOffset(date) {
  const pad2 = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());

  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const oh = pad2(Math.floor(abs / 60));
  const om = pad2(abs % 60);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.000${sign}${oh}:${om}`;
}

/**
 * Cria pedido PIX na API PagBank Orders.
 *
 * @param {object} deps - Dependências injetadas
 * @param {string} deps.PAGBANK_TOKEN
 * @param {boolean} deps.PAGBANK_DEBUG_LOGS
 * @param {boolean} deps.IS_PRODUCTION
 * @param {Function} deps.enviarPostPagBankOrders
 * @param {Function} deps.montarWebhookPagBankUrl
 * @param {Function} deps.registrarLogPagBank
 * @param {Function} deps.registrarFalhaOperacaoPagBank
 */
function criarPagamentoPixFactory(deps) {
  const {
    PAGBANK_TOKEN,
    PAGBANK_DEBUG_LOGS,
    IS_PRODUCTION,
    enviarPostPagBankOrders,
    montarWebhookPagBankUrl,
    registrarLogPagBank,
    registrarFalhaOperacaoPagBank
  } = deps;

  return async function criarPagamentoPix({ pedidoId, total, descricao, email, nome, taxId }) {
    if (!PAGBANK_TOKEN) {
      throw new Error('PAGBANK_TOKEN ausente');
    }

    const taxIdDigits = (taxId || '').toString().replace(/\D/g, '');
    if (!taxIdDigits) {
      throw new Error('CPF/CNPJ ausente (customer.tax_id) - necessário para gerar PIX PagBank');
    }

    if (![11, 14].includes(taxIdDigits.length)) {
      throw new Error('CPF/CNPJ inválido (customer.tax_id) - informe 11 ou 14 dígitos');
    }

    const expirationDate = formatIsoLocalWithOffset(new Date(Date.now() + 2 * 60 * 60 * 1000));

    const payload = {
      reference_id: `pedido_${pedidoId}`,
      customer: {
        name: nome || 'Cliente',
        email: email || 'cliente@example.com',
        tax_id: taxIdDigits
      },
      items: [
        {
          name: descricao || `Pedido #${pedidoId}`,
          quantity: 1,
          unit_amount: Math.round(Number(total || 0) * 100)
        }
      ],
      qr_codes: [
        {
          amount: {
            value: Math.round(Number(total || 0) * 100)
          },
          expiration_date: expirationDate
        }
      ],
      notification_urls: [
        montarWebhookPagBankUrl()
      ]
    };

    const notificationUrlSeguro = sanitizarPayloadPagBankParaLog({
      notification_url: payload.notification_urls?.[0]
    })?.notification_url;
    logger.info('🔔 PagBank notification URL:', notificationUrlSeguro || '');

    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const { response, responseBodyText: responseText, responsePayload, traceId, endpoint } = await enviarPostPagBankOrders({
      headers: {
        Authorization: `Bearer ${PAGBANK_TOKEN}`,
        'x-idempotency-key': idempotencyKey,
        accept: 'application/json',
        'Content-Type': 'application/json'
      },
      payload
    });

    const statusInfoPix = extrairStatusPagamentoPagBank(responsePayload);
    const chargePrincipalPix = statusInfoPix.chargePrincipal || {};
    const statusPagBankPix = String(statusInfoPix.statusResolvido || responsePayload?.status || '').toUpperCase() || null;

    registrarLogPagBank({
      operacao: 'orders.pix.response',
      endpoint,
      method: 'POST',
      httpStatus: response.status,
      requestPayload: payload,
      responsePayload,
      extra: {
        idempotency_key: idempotencyKey,
        pedido_id: pedidoId,
        order_id: responsePayload?.id || null,
        charge_id: chargePrincipalPix?.id || null,
        status_pagbank: statusPagBankPix,
        status_order: statusInfoPix.orderStatus || null,
        status_charge: statusInfoPix.chargeStatus || null,
        status_fonte: statusInfoPix.fonteStatus,
        trace_id: traceId || undefined
      }
    });

    if (PAGBANK_DEBUG_LOGS && !IS_PRODUCTION) {
      try {
        gerarLogsHomologacaoPagBank({
          orderRequest: {
            endpoint,
            method: 'POST',
            payload,
            headers: {
              Authorization: `Bearer ${PAGBANK_TOKEN}`,
              'x-idempotency-key': idempotencyKey,
              accept: 'application/json',
              'Content-Type': 'application/json'
            },
            idempotencyKey
          },
          orderResponse: {
            httpStatus: response.status,
            responsePayload,
            traceId
          }
        });
      } catch (_logErr) {
        // log de homologação nunca deve impedir o fluxo
      }
    }

    if (!response.ok) {
      registrarFalhaOperacaoPagBank({
        operacao: 'orders.pix.error',
        endpoint,
        method: 'POST',
        httpStatus: response.status,
        requestPayload: payload,
        responsePayload,
        extra: {
          idempotency_key: idempotencyKey,
          pedido_id: pedidoId,
          reference_id: payload.reference_id,
          trace_id: traceId || undefined
        }
      });

      const errorText = responseText
        || (typeof responsePayload?.raw_text === 'string' ? responsePayload.raw_text : JSON.stringify(responsePayload));
      const error = new Error(`Erro PagBank: ${response.status} - ${errorText}`);
      error.httpStatus = response.status;
      error.endpoint = endpoint;
      error.traceId = traceId || undefined;
      error.responsePayload = responsePayload;
      throw error;
    }

    return responsePayload;
  };
}

/**
 * Cria pedido com cartão (crédito/débito) na API PagBank Orders.
 *
 * @param {object} deps - Dependências injetadas
 * @param {string} deps.PAGBANK_TOKEN
 * @param {string} deps.PAGBANK_ENV
 * @param {boolean} deps.IS_PRODUCTION
 * @param {boolean} deps.PAGBANK_DEBUG_LOGS
 * @param {boolean} deps.ALLOW_DEBIT_3DS_MOCK
 * @param {Function} deps.enviarPostPagBankOrders
 * @param {Function} deps.montarWebhookPagBankUrl
 * @param {Function} deps.registrarLogPagBank
 * @param {Function} deps.registrarFalhaOperacaoPagBank
 */
function criarPagamentoCartaoFactory(deps) {
  const {
    PAGBANK_TOKEN,
    PAGBANK_ENV,
    IS_PRODUCTION,
    PAGBANK_DEBUG_LOGS,
    ALLOW_DEBIT_3DS_MOCK,
    enviarPostPagBankOrders,
    montarWebhookPagBankUrl,
    registrarLogPagBank,
    registrarFalhaOperacaoPagBank
  } = deps;

  return async function criarPagamentoCartao({
    pedidoId,
    total,
    descricao,
    email,
    nome,
    taxId,
    tokenCartao,
    parcelas,
    tipoCartao,
    authenticationMethod
  }) {
    if (!PAGBANK_TOKEN) {
      throw new Error('PAGBANK_TOKEN ausente');
    }

    const taxIdDigits = (taxId || '').toString().replace(/\D/g, '');
    if (![11, 14].includes(taxIdDigits.length)) {
      throw new Error('CPF/CNPJ inválido para pagamento com cartão. Informe 11 ou 14 dígitos.');
    }

    const tokenNormalizado = String(tokenCartao || '').trim();
    if (!tokenNormalizado) {
      throw new Error('token_cartao é obrigatório para pagamento com cartão via API Order.');
    }

    const tipoCartaoNormalizado = normalizarTipoCartao(tipoCartao);
    const paymentMethodType = tipoCartaoNormalizado === 'debito' ? 'DEBIT_CARD' : 'CREDIT_CARD';
    const authenticationMethodNormalizado = normalizarAuthenticationMethodPagBank(authenticationMethod);
    const parcelasNormalizadas = normalizarParcelasCartao(parcelas);
    const valorCentavos = Math.max(1, Math.round(Number(total || 0) * 100));
    let authenticationMethodMode = 'none';

    const paymentMethod = {
      type: paymentMethodType,
      capture: true,
      card: {
        encrypted: tokenNormalizado
      },
      holder: {
        name: nome || 'Cliente',
        tax_id: taxIdDigits,
        email: email || 'cliente@example.com'
      }
    };

    if (tipoCartaoNormalizado !== 'debito') {
      paymentMethod.installments = parcelasNormalizadas;
    } else {
      let authParaUso = authenticationMethodNormalizado;
      let origemAuth = 'request';

      if (!authParaUso && PAGBANK_ENV !== 'production' && !IS_PRODUCTION && ALLOW_DEBIT_3DS_MOCK) {
        authParaUso = montarAuthenticationMethodMock3DS();
        origemAuth = 'mock';
      }

      const validacaoAuth = validarAuthenticationMethodPagBank(authParaUso);
      if (!validacaoAuth.ok) {
        throw new Error(
          'authentication_method 3DS é obrigatório para pagamento com débito. '
          + 'Envie payment_method.authentication_method com type=THREEDS e dados válidos.'
        );
      }

      paymentMethod.authentication_method = validacaoAuth.auth;
      authenticationMethodMode = origemAuth === 'mock' ? 'mock_external' : validacaoAuth.modo;
    }

    if (tipoCartaoNormalizado !== 'debito' && authenticationMethodNormalizado) {
      const validacaoAuth = validarAuthenticationMethodPagBank(authenticationMethodNormalizado);
      if (validacaoAuth.ok) {
        paymentMethod.authentication_method = validacaoAuth.auth;
        authenticationMethodMode = validacaoAuth.modo;
      }
    }

    const payload = {
      reference_id: `pedido_${pedidoId}`,
      customer: {
        name: nome || 'Cliente',
        email: email || 'cliente@example.com',
        tax_id: taxIdDigits
      },
      items: [
        {
          name: descricao || `Pedido #${pedidoId}`,
          quantity: 1,
          unit_amount: valorCentavos
        }
      ],
      charges: [
        {
          reference_id: `cobranca_${pedidoId}`,
          description: descricao || `Pagamento pedido #${pedidoId}`,
          amount: {
            value: valorCentavos,
            currency: 'BRL'
          },
          payment_method: paymentMethod
        }
      ],
      notification_urls: [
        montarWebhookPagBankUrl()
      ]
    };

    const hasEncryptedCard = Boolean(payload?.charges?.[0]?.payment_method?.card?.encrypted);
    if (!hasEncryptedCard) {
      throw new Error('payment_method.card.encrypted não foi preenchido para o PagBank.');
    }

    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const { response, responseBodyText: responseText, responsePayload, traceId, endpoint } = await enviarPostPagBankOrders({
      headers: {
        Authorization: `Bearer ${PAGBANK_TOKEN}`,
        'x-idempotency-key': idempotencyKey,
        accept: 'application/json',
        'Content-Type': 'application/json'
      },
      payload
    });

    const statusInfoCartao = extrairStatusPagamentoPagBank(responsePayload);
    const chargePrincipalCartao = statusInfoCartao.chargePrincipal || {};
    const paymentResponseCartao = chargePrincipalCartao?.payment_response || {};
    const statusPagBankCartao = String(statusInfoCartao.statusResolvido || responsePayload?.status || '').toUpperCase() || null;

    registrarLogPagBank({
      operacao: 'orders.cartao.response',
      endpoint,
      method: 'POST',
      httpStatus: response.status,
      requestPayload: payload,
      responsePayload,
      extra: {
        idempotency_key: idempotencyKey,
        pedido_id: pedidoId,
        tipo_cartao: tipoCartaoNormalizado,
        authentication_method_mode: authenticationMethodMode,
        payment_method_type: paymentMethodType,
        authentication_method_type: payload?.charges?.[0]?.payment_method?.authentication_method?.type || null,
        authentication_method_id_present: Boolean(payload?.charges?.[0]?.payment_method?.authentication_method?.id),
        capture: Boolean(payload?.charges?.[0]?.payment_method?.capture),
        reference_id: payload.reference_id,
        has_charges_in_response: Array.isArray(responsePayload?.charges) && responsePayload.charges.length > 0,
        order_id: responsePayload?.id || null,
        charge_id: chargePrincipalCartao?.id || null,
        status_pagbank: statusPagBankCartao,
        status_order: statusInfoCartao.orderStatus || null,
        status_charge: statusInfoCartao.chargeStatus || null,
        status_charge_threeds: statusInfoCartao.chargeThreeDSStatus || null,
        payment_response_code: paymentResponseCartao?.code || null,
        payment_response_message: paymentResponseCartao?.message || null,
        status_fonte: statusInfoCartao.fonteStatus,
        trace_id: traceId || undefined
      }
    });

    if (PAGBANK_DEBUG_LOGS && !IS_PRODUCTION) {
      try {
        gerarLogsHomologacaoPagBank({
          orderRequest: {
            endpoint,
            method: 'POST',
            payload,
            headers: {
              Authorization: `Bearer ${PAGBANK_TOKEN}`,
              'x-idempotency-key': idempotencyKey,
              accept: 'application/json',
              'Content-Type': 'application/json'
            },
            idempotencyKey
          },
          orderResponse: {
            httpStatus: response.status,
            responsePayload,
            traceId
          }
        });
      } catch (_logErr) {
        // log de homologação nunca deve impedir o fluxo
      }
    }

    if (!response.ok) {
      registrarFalhaOperacaoPagBank({
        operacao: 'orders.cartao.error',
        endpoint,
        method: 'POST',
        httpStatus: response.status,
        requestPayload: payload,
        responsePayload,
        extra: {
          idempotency_key: idempotencyKey,
          pedido_id: pedidoId,
          tipo_cartao: tipoCartaoNormalizado,
          reference_id: payload.reference_id,
          trace_id: traceId || undefined
        }
      });

      const errorText = responseText
        || (typeof responsePayload?.raw_text === 'string' ? responsePayload.raw_text : JSON.stringify(responsePayload));
      const error = new Error(`Erro PagBank cartão: ${response.status} - ${errorText}`);
      error.httpStatus = response.status;
      error.endpoint = endpoint;
      error.traceId = traceId || undefined;
      error.referenceId = payload.reference_id;
      error.responsePayload = responsePayload;
      throw error;
    }

    return responsePayload;
  };
}

module.exports = {
  criarPagamentoPixFactory,
  criarPagamentoCartaoFactory
};
