'use strict';

/**
 * Mercado Pago Service — Integração com API v1 do Mercado Pago.
 *
 * Responsável por:
 * - Criar pagamentos PIX (com QR code)
 * - Criar pagamentos com cartão de crédito
 * - Consultar status de pagamento
 * - Validar assinatura de webhook
 *
 * Usa fetch nativo (Node 18+). Sem dependências externas.
 */

const crypto = require('crypto');
const logger = require('../lib/logger');
const { mapGatewayStatusToOrderStatus } = require('./mercadoPagoStatusPolicy');

const MP_API_BASE = 'https://api.mercadopago.com';

/**
 * Cria instância configurada do service.
 * @param {object} opts
 * @param {string} opts.accessToken - MP_ACCESS_TOKEN
 * @param {string} opts.webhookSecret - MP_WEBHOOK_SECRET (para validar x-signature)
 * @param {number} [opts.timeoutMs=15000]
 * @param {string} [opts.env='test']
 * @param {string} [opts.notificationUrl='']
 * @param {string} [opts.successUrl='']
 * @param {string} [opts.pendingUrl='']
 * @param {string} [opts.failureUrl='']
 * @param {string} [opts.baseUrl='']
 * @param {boolean} [opts.allowInsecureWebhookWithoutSecret=false]
 */
function criarMercadoPagoService({
  accessToken,
  webhookSecret,
  timeoutMs = 15000,
  env = 'test',
  notificationUrl = '',
  successUrl = '',
  pendingUrl = '',
  failureUrl = '',
  baseUrl = '',
  allowInsecureWebhookWithoutSecret = false
}) {
  if (!accessToken) {
    logger.warn('⚠️ MP_ACCESS_TOKEN não configurado. Pagamentos Mercado Pago indisponíveis.');
  }

  const mpEnv = String(env || 'test').trim().toLowerCase() === 'production' ? 'production' : 'test';

  function normalizarUrl(url) {
    return String(url || '').trim();
  }

  function normalizarNotificationUrl(url) {
    const raw = normalizarUrl(url);
    if (!raw) {
      return '';
    }

    try {
      const parsed = new URL(raw);
      const protocol = String(parsed.protocol || '').toLowerCase();
      const hostname = String(parsed.hostname || '').toLowerCase();
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

      if (!['http:', 'https:'].includes(protocol)) {
        return '';
      }

      // Mercado Pago costuma recusar callback local/inacessível; em dev local é melhor omitir notification_url.
      if (isLocalHost) {
        return '';
      }

      return parsed.toString();
    } catch {
      return '';
    }
  }

  function montarNotificationUrl() {
    const explicit = normalizarUrl(notificationUrl);
    if (explicit) {
      return normalizarNotificationUrl(explicit);
    }

    const base = normalizarUrl(baseUrl).replace(/\/+$/, '');
    if (!base) {
      return '';
    }

    return normalizarNotificationUrl(`${base}/api/webhooks/mercadopago`);
  }

  const mpNotificationUrl = montarNotificationUrl();
  const mpSuccessUrl = normalizarUrl(successUrl);
  const mpPendingUrl = normalizarUrl(pendingUrl);
  const mpFailureUrl = normalizarUrl(failureUrl);

  function normalizarTaxId(cpfOuCnpj) {
    const digits = String(cpfOuCnpj || '').replace(/\D/g, '');
    if (digits.length === 11) {
      return { type: 'CPF', number: digits };
    }
    if (digits.length === 14) {
      return { type: 'CNPJ', number: digits };
    }
    return null;
  }

  function normalizarChaveIdempotenciaGateway(rawKey) {
    const key = String(rawKey || '').trim().toLowerCase();
    if (!key) return '';

    const sane = key.replace(/[^a-z0-9:_-]/g, '');
    if (sane.length < 8) return '';
    return sane.slice(0, 64);
  }

  // ============================================
  // HTTP Client base
  // ============================================
  async function mpRequest(method, path, body = null, { idempotencyKey } = {}) {
    const url = `${MP_API_BASE}${path}`;
    const idemKey = normalizarChaveIdempotenciaGateway(idempotencyKey) || crypto.randomUUID();
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idemKey
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const opts = { method, headers, signal: controller.signal };
      if (body) opts.body = JSON.stringify(body);

      const response = await fetch(url, opts);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = data?.message || data?.error || `HTTP ${response.status}`;
        const err = new Error(`Mercado Pago API error: ${msg}`);
        err.status = response.status;
        err.mpResponse = data;
        throw err;
      }

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ============================================
  // Criar pagamento PIX
  // ============================================
  async function criarPagamentoPix({ pedidoId, valor, descricao, email, nome, cpf, idempotencyKey }) {
    if (!accessToken) throw new Error('Mercado Pago não configurado.');

    const identification = normalizarTaxId(cpf);
    if (!identification) {
      const err = new Error('Informe um CPF ou CNPJ válido para gerar o PIX.');
      err.status = 400;
      throw err;
    }

    const payload = {
      transaction_amount: Number(valor),
      description: descricao || `Pedido #${pedidoId} - Mercado BomFilho`,
      payment_method_id: 'pix',
      notification_url: mpNotificationUrl || undefined,
      payer: {
        email: email,
        first_name: String(nome || 'Cliente').split(' ')[0],
        last_name: String(nome || '').split(' ').slice(1).join(' ') || 'BomFilho',
        identification
      },
      external_reference: String(pedidoId)
    };

    logger.info(`[MP] Criando PIX para pedido #${pedidoId}, valor R$ ${valor}`, {
      pedido_id: Number(pedidoId) || null,
      idempotency_key_prefix: normalizarChaveIdempotenciaGateway(idempotencyKey).slice(0, 16) || null
    });
    const data = await mpRequest('POST', '/v1/payments', payload, { idempotencyKey });

    const qrCode = data.point_of_interaction?.transaction_data?.qr_code || null;
    const qrCodeBase64 = data.point_of_interaction?.transaction_data?.qr_code_base64 || null;
    const ticketUrl = data.point_of_interaction?.transaction_data?.ticket_url || null;

    logger.info(`[MP] PIX criado: payment_id=${data.id}, status=${data.status}`);

    return {
      payment_id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
      date_of_expiration: data.date_of_expiration
    };
  }

  // ============================================
  // Criar pagamento com cartão de crédito
  // ============================================
  async function criarPagamentoCartao({
    pedidoId,
    valor,
    descricao,
    token,
    parcelas,
    email,
    nome,
    cpf,
    paymentMethodId,
    issuerId,
    idempotencyKey
  }) {
    if (!accessToken) throw new Error('Mercado Pago não configurado.');

    const identification = normalizarTaxId(cpf);
    if (!identification) {
      const err = new Error('Informe um CPF ou CNPJ válido para pagamento com cartão.');
      err.status = 400;
      throw err;
    }

    const payload = {
      transaction_amount: Number(valor),
      description: descricao || `Pedido #${pedidoId} - Mercado BomFilho`,
      token: token,
      installments: Number(parcelas) || 1,
      notification_url: mpNotificationUrl || undefined,
      payer: {
        email: email,
        first_name: String(nome || 'Cliente').split(' ')[0],
        last_name: String(nome || '').split(' ').slice(1).join(' ') || 'BomFilho',
        identification
      },
      external_reference: String(pedidoId)
    };

    const paymentMethod = String(paymentMethodId || '').trim();
    if (paymentMethod) {
      payload.payment_method_id = paymentMethod;
    }

    const issuerNumeric = Number(issuerId);
    if (Number.isFinite(issuerNumeric) && issuerNumeric > 0) {
      payload.issuer_id = issuerNumeric;
    }

    logger.info(`[MP] Criando pagamento cartão para pedido #${pedidoId}, valor R$ ${valor}, ${parcelas}x`);
    logger.info('[MP] Contexto idempotencia cartao', {
      pedido_id: Number(pedidoId) || null,
      idempotency_key_prefix: normalizarChaveIdempotenciaGateway(idempotencyKey).slice(0, 16) || null
    });
    const data = await mpRequest('POST', '/v1/payments', payload, { idempotencyKey });

    logger.info(`[MP] Cartão processado: payment_id=${data.id}, status=${data.status}`);

    return {
      payment_id: data.id,
      status: data.status,
      status_detail: data.status_detail
    };
  }

  // ============================================
  // Consultar pagamento
  // ============================================
  async function consultarPagamento(paymentId) {
    if (!accessToken) throw new Error('Mercado Pago não configurado.');

    const data = await mpRequest('GET', `/v1/payments/${paymentId}`);
    return {
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
      external_reference: data.external_reference,
      transaction_amount: data.transaction_amount,
      payment_method_id: data.payment_method_id,
      payment_type_id: data.payment_type_id,
      date_approved: data.date_approved,
      date_created: data.date_created
    };
  }

  // ============================================
  // Validar assinatura do webhook (x-signature)
  // ============================================
  function validarAssinaturaWebhook(xSignature, xRequestId, dataId) {
    if (!webhookSecret) {
      if (allowInsecureWebhookWithoutSecret) {
        logger.warn('[MP] MP_WEBHOOK_SECRET ausente. Modo inseguro explicitamente habilitado; webhook aceito sem validação criptográfica.');
        return true;
      }
      logger.error('[MP] MP_WEBHOOK_SECRET ausente. Webhook rejeitado para evitar validação silenciosamente permissiva.');
      return false;
    }

    if (!xSignature) return false;

    // Parse x-signature: "ts=XXX,v1=YYY"
    const parts = {};
    xSignature.split(',').forEach(part => {
      const [key, val] = part.split('=');
      if (key && val) parts[key.trim()] = val.trim();
    });

    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    // Montar template e calcular HMAC
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', webhookSecret)
      .update(manifest)
      .digest('hex');

    return hmac === v1;
  }

  // ============================================
  // Mapear status MP → status pedido BomFilho
  // ============================================
  function mapearStatusPagamento(mpStatus) {
    return mapGatewayStatusToOrderStatus(mpStatus);
  }

  return {
    env: mpEnv,
    notificationUrl: mpNotificationUrl,
    successUrl: mpSuccessUrl,
    pendingUrl: mpPendingUrl,
    failureUrl: mpFailureUrl,
    criarPagamentoPix,
    criarPagamentoCartao,
    consultarPagamento,
    validarAssinaturaWebhook,
    mapearStatusPagamento
  };
}

module.exports = { criarMercadoPagoService };
