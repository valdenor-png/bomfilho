'use strict';

const fetch = global.fetch;
const logger = require('../lib/logger');
const { toMoney } = require('../lib/helpers');

function createHttpError(status, message, details = {}) {
  const error = new Error(message);
  error.httpStatus = Number(status || 500);
  error.details = details;
  return error;
}

function normalizeCurrency(amount) {
  const value = Number(amount || 0);
  return toMoney(Number.isFinite(value) ? value : 0);
}

module.exports = function createUberDirectService({
  enabled,
  oauthUrl,
  baseUrl,
  customerId,
  clientId,
  clientSecret,
  timeoutMs,
  pickup,
  loggerInstance = logger
}) {
  let tokenCache = {
    accessToken: '',
    expiresAt: 0
  };

  function validateEnabled() {
    if (!enabled) {
      throw createHttpError(503, 'Entrega Uber temporariamente indisponível.');
    }
  }

  function normalizeUberError(payload, fallback = 'Erro na integração Uber.') {
    const title = String(payload?.title || payload?.message || payload?.error || '').trim();
    const detail = String(payload?.detail || '').trim();
    const message = [title, detail].filter(Boolean).join(' - ').trim();
    return message || fallback;
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function getAccessToken({ forceRefresh = false } = {}) {
    validateEnabled();

    if (!forceRefresh && tokenCache.accessToken && tokenCache.expiresAt > (Date.now() + 10000)) {
      return tokenCache.accessToken;
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('scope', 'eats.deliveries');

    const response = await fetchWithTimeout(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      loggerInstance.error('Uber OAuth falhou', {
        status: response.status,
        payload
      });
      throw createHttpError(502, normalizeUberError(payload, 'Não foi possível autenticar na Uber.'), {
        provider_status: response.status
      });
    }

    const accessToken = String(payload?.access_token || '').trim();
    const expiresIn = Number(payload?.expires_in || 0);

    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw createHttpError(502, 'Resposta de autenticação Uber inválida.');
    }

    tokenCache = {
      accessToken,
      expiresAt: Date.now() + ((expiresIn - 30) * 1000)
    };

    return accessToken;
  }

  async function requestUber(path, { method = 'GET', body = null } = {}) {
    const token = await getAccessToken();
    const url = `${baseUrl}/customers/${encodeURIComponent(customerId)}${path}`;

    const response = await fetchWithTimeout(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const providerMessage = normalizeUberError(payload, 'Falha na comunicação com Uber Direct.');
      throw createHttpError(response.status === 404 ? 404 : 502, providerMessage, {
        provider_status: response.status,
        provider_payload: payload
      });
    }

    return payload;
  }

  async function getUberEstimate({
    dropoff,
    manifestItems,
    externalId,
    orderValue = 0
  }) {
    const payload = {
      external_id: externalId,
      pickup_address: pickup.address,
      pickup_name: pickup.name,
      pickup_phone_number: pickup.phone,
      dropoff_address: dropoff.address,
      dropoff_name: dropoff.name,
      dropoff_phone_number: dropoff.phone,
      manifest_items: manifestItems,
      order_value: Math.max(0, Math.round(Number(orderValue || 0) * 100))
    };

    const estimate = await requestUber('/delivery_quotes', {
      method: 'POST',
      body: payload
    });

    return {
      estimate_id: String(estimate?.id || estimate?.quote_id || '').trim(),
      amount: normalizeCurrency((estimate?.fee || estimate?.price || estimate?.total_fee || 0) / 100),
      currency: String(estimate?.currency || 'BRL').trim() || 'BRL',
      eta_seconds: Number(estimate?.eta || estimate?.pickup_eta || 0) || null,
      raw: estimate
    };
  }

  async function createUberDelivery({
    quoteId,
    manifestItems,
    dropoff,
    externalId,
    tip = 0
  }) {
    const payload = {
      quote_id: quoteId,
      external_id: externalId,
      pickup_address: pickup.address,
      pickup_name: pickup.name,
      pickup_phone_number: pickup.phone,
      dropoff_address: dropoff.address,
      dropoff_name: dropoff.name,
      dropoff_phone_number: dropoff.phone,
      manifest_items: manifestItems,
      tip_by_customer: Math.max(0, Math.round(Number(tip || 0) * 100))
    };

    const delivery = await requestUber('/deliveries', {
      method: 'POST',
      body: payload
    });

    return {
      delivery_id: String(delivery?.id || '').trim(),
      tracking_url: String(delivery?.tracking_url || delivery?.tracking?.url || '').trim(),
      status: String(delivery?.status || 'pending').trim().toLowerCase(),
      eta_seconds: Number(delivery?.eta || 0) || null,
      fee_amount: normalizeCurrency((delivery?.fee || delivery?.total_fee || 0) / 100),
      raw: delivery
    };
  }

  async function cancelUberDelivery({ deliveryId, reason = 'cancelado_operacao' }) {
    const payload = {
      cancel_reason: String(reason || 'cancelado_operacao').slice(0, 120)
    };

    const result = await requestUber(`/deliveries/${encodeURIComponent(deliveryId)}/cancel`, {
      method: 'POST',
      body: payload
    });

    return {
      ok: true,
      status: String(result?.status || 'canceled').trim().toLowerCase(),
      raw: result
    };
  }

  return {
    getAccessToken,
    getUberEstimate,
    createUberDelivery,
    cancelUberDelivery
  };
};
