'use strict';

function parseBooleanLike(value, fallback = false) {
  const raw = String(value || '').trim().toLowerCase();

  if (!raw) {
    return fallback;
  }

  if (['true', '1', 'yes', 'on', 'sim'].includes(raw)) {
    return true;
  }

  if (['false', '0', 'no', 'off', 'nao', 'não'].includes(raw)) {
    return false;
  }

  return fallback;
}

function normalizarPagBankEnv(value) {
  return String(value || '').trim().toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
}

function normalizarTimeoutMs(value, fallback = 15000) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return fallback;
  }

  return Math.min(parsed, 120000);
}

function resolverBaseUrlPagBankOrders(env) {
  return env === 'production'
    ? 'https://api.pagseguro.com'
    : 'https://sandbox.api.pagseguro.com';
}

function resolverBaseUrlPagBankSdk(env) {
  return env === 'production'
    ? 'https://sdk.pagseguro.com'
    : 'https://sandbox.sdk.pagseguro.com';
}

function resolverSdkEnv(env) {
  return env === 'production' ? 'PROD' : 'SANDBOX';
}

function construirConfiguracaoPagBank({
  env = process.env,
  isProductionApp = false
} = {}) {
  const pagbankEnv = normalizarPagBankEnv(env.PAGBANK_ENV);
  const isProductionPagBank = pagbankEnv === 'production';

  return {
    env: pagbankEnv,
    isProductionPagBank,
    token: String(env.PAGBANK_TOKEN || '').trim(),
    publicKey: String(env.PAGBANK_PUBLIC_KEY || '').trim(),
    webhookToken: String(env.PAGBANK_WEBHOOK_TOKEN || '').trim(),
    debugLogs: parseBooleanLike(env.PAGBANK_DEBUG_LOGS, !isProductionApp),
    allowPixMock: parseBooleanLike(env.ALLOW_PIX_MOCK, false),
    allowDebit3dsMock: parseBooleanLike(env.ALLOW_DEBIT_3DS_MOCK, false),
    timeoutMs: normalizarTimeoutMs(env.PAGBANK_TIMEOUT_MS, 15000),
    ordersApiUrl: resolverBaseUrlPagBankOrders(pagbankEnv),
    sdkApiUrl: resolverBaseUrlPagBankSdk(pagbankEnv),
    sdkEnv: resolverSdkEnv(pagbankEnv)
  };
}

module.exports = {
  construirConfiguracaoPagBank,
  normalizarPagBankEnv,
  resolverBaseUrlPagBankOrders,
  resolverBaseUrlPagBankSdk,
  resolverSdkEnv
};
