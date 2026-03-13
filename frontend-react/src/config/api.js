const DEFAULT_API_BASE_URL = 'https://bomfilho.onrender.com';
const DEFAULT_API_TIMEOUT_MS = 15000;

function normalizarBaseUrl(url) {
  const valor = String(url || '').trim();
  if (!valor) {
    return '';
  }

  return valor.replace(/\/+$/, '');
}

function detectarAmbienteRuntime() {
  if (import.meta.env.DEV) {
    return 'development';
  }

  if (typeof window !== 'undefined') {
    const host = String(window.location?.hostname || '').trim().toLowerCase();

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return 'development';
    }

    if (host.endsWith('.vercel.app')) {
      return 'vercel-preview';
    }
  }

  return 'production';
}

function parseTimeoutMs(valor, fallback) {
  const numero = Number.parseInt(String(valor || ''), 10);
  if (!Number.isFinite(numero) || numero < 1000) {
    return fallback;
  }

  return numero;
}

const RUNTIME_ENV = detectarAmbienteRuntime();
const API_BASE_URL = normalizarBaseUrl(import.meta.env.VITE_API_URL) || DEFAULT_API_BASE_URL;
const API_TIMEOUT_MS = parseTimeoutMs(import.meta.env.VITE_API_TIMEOUT_MS, DEFAULT_API_TIMEOUT_MS);
const IS_DEVELOPMENT = RUNTIME_ENV === 'development';
const IS_PREVIEW = RUNTIME_ENV === 'vercel-preview';
const IS_PRODUCTION = RUNTIME_ENV === 'production';
const IS_NGROK_API = /ngrok(-free)?\.dev|ngrok\.io/i.test(API_BASE_URL);

export {
  DEFAULT_API_BASE_URL,
  DEFAULT_API_TIMEOUT_MS,
  API_BASE_URL,
  API_TIMEOUT_MS,
  RUNTIME_ENV,
  IS_DEVELOPMENT,
  IS_PREVIEW,
  IS_PRODUCTION,
  IS_NGROK_API
};

export default API_BASE_URL;
