'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const { construirConfiguracaoPagBank } = require('../services/pagbankConfigService');

function parseBooleanEnv(name, fallback = false) {
  const rawValue = String(process.env[name] || '').trim().toLowerCase();
  if (!rawValue) return fallback;
  if (['true', '1', 'yes', 'on', 'sim'].includes(rawValue)) return true;
  if (['false', '0', 'no', 'off', 'nao', 'não'].includes(rawValue)) return false;
  return fallback;
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizarOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '').toLowerCase();
}

// ============================================
// CORE
// ============================================
const NODE_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase() || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = String(process.env.SERVICE_NAME || 'bom-filho-backend').trim() || 'bom-filho-backend';
const API_VERSION = String(process.env.API_VERSION || '1.0.0').trim() || '1.0.0';
const FRONTEND_DIST_PATH = path.resolve(__dirname, '..', '..', 'frontend-react', 'dist');
const REACT_DIST_INDEX = path.join(FRONTEND_DIST_PATH, 'index.html');
const FRONTEND_APP_URL = String(process.env.FRONTEND_APP_URL || '').trim();
const SHOULD_SERVE_REACT = parseBooleanEnv('SERVE_REACT', !IS_PRODUCTION);
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const TRUST_PROXY = parseBooleanEnv('TRUST_PROXY', IS_PRODUCTION);

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL nao configurada no ambiente.');
}

const DB_DIALECT = (() => {
  try {
    const protocol = String(new URL(DATABASE_URL).protocol || '').toLowerCase();
    if (protocol.includes('postgres')) return 'postgres';
    if (protocol.includes('mysql')) return 'mysql';
    return 'unknown';
  } catch {
    return 'unknown';
  }
})();

// ============================================
// PAGBANK
// ============================================
const PAGBANK_ENABLED = parseBooleanEnv('PAGBANK_ENABLED', false);
const PAGBANK_CONFIG = construirConfiguracaoPagBank({ env: process.env, isProductionApp: IS_PRODUCTION });
const PAGBANK_ENV = PAGBANK_CONFIG.env;
const PAGBANK_TOKEN = PAGBANK_CONFIG.token;
const PAGBANK_PUBLIC_KEY = PAGBANK_CONFIG.publicKey;
const PAGBANK_WEBHOOK_TOKEN = PAGBANK_CONFIG.webhookToken;
const PAGBANK_DEBUG_LOGS = PAGBANK_CONFIG.debugLogs;
const ALLOW_PIX_MOCK = PAGBANK_CONFIG.allowPixMock;
const ALLOW_DEBIT_3DS_MOCK = PAGBANK_CONFIG.allowDebit3dsMock;
const PAGBANK_TIMEOUT_MS = PAGBANK_CONFIG.timeoutMs;
const PAGBANK_API_URL = PAGBANK_CONFIG.ordersApiUrl;
const PAGBANK_SDK_API_URL = PAGBANK_CONFIG.sdkApiUrl;
const PAGBANK_3DS_SDK_ENV = PAGBANK_CONFIG.sdkEnv;

// ============================================
// MERCADO PAGO
// ============================================
const MP_ACCESS_TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim();
const MP_ENV_RAW = String(process.env.MP_ENV || '').trim().toLowerCase();
const MP_ENV = ['test', 'production'].includes(MP_ENV_RAW)
  ? MP_ENV_RAW
  : (IS_PRODUCTION ? 'production' : 'test');
const MP_NOTIFICATION_URL = String(process.env.MP_NOTIFICATION_URL || '').trim();
const MP_SUCCESS_URL = String(process.env.MP_SUCCESS_URL || '').trim();
const MP_PENDING_URL = String(process.env.MP_PENDING_URL || '').trim();
const MP_FAILURE_URL = String(process.env.MP_FAILURE_URL || '').trim();
const MP_WEBHOOK_SECRET = String(process.env.MP_WEBHOOK_SECRET || '').trim();
const MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING = parseBooleanEnv('MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING', false);

if (!MP_ACCESS_TOKEN) {
  throw new Error('MP_ACCESS_TOKEN não configurado. Defina o token privado do Mercado Pago para iniciar o backend.');
}
if (MP_ENV_RAW && !['test', 'production'].includes(MP_ENV_RAW)) {
  console.warn(`⚠️ MP_ENV inválido (${MP_ENV_RAW}). Usando fallback seguro: ${MP_ENV}.`);
}
if (IS_PRODUCTION && MP_ENV !== 'production') {
  throw new Error('MP_ENV deve ser "production" quando NODE_ENV=production.');
}
if (MP_ENV === 'production' && /^test-/i.test(MP_ACCESS_TOKEN)) {
  throw new Error('MP_ENV=production não permite MP_ACCESS_TOKEN de teste (prefixo TEST-).');
}
if (IS_PRODUCTION && !MP_WEBHOOK_SECRET) {
  throw new Error('MP_WEBHOOK_SECRET é obrigatório em produção para validação de webhook do Mercado Pago.');
}
if (IS_PRODUCTION && MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING) {
  throw new Error('MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING não pode ser true em produção.');
}

const TAMANHO_MAXIMO_IMPORTACAO_MB = (() => {
  const valor = Number(process.env.TAMANHO_MAXIMO_IMPORTACAO_MB || 8);
  return Number.isFinite(valor) && valor > 0 ? Math.min(valor, 100) : 8;
})();
const TAMANHO_MAXIMO_IMPORTACAO_BYTES = Math.round(TAMANHO_MAXIMO_IMPORTACAO_MB * 1024 * 1024);

// ============================================
// EVOLUTION API (WhatsApp)
// ============================================
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'loja';
const EVOLUTION_WEBHOOK_TOKEN = String(process.env.EVOLUTION_WEBHOOK_TOKEN || '').trim();
const WHATSAPP_AUTO_REPLY_ENABLED = process.env.WHATSAPP_AUTO_REPLY_ENABLED === 'true';
const WHATSAPP_AUTO_REPLY_TEXT = String(
  process.env.WHATSAPP_AUTO_REPLY_TEXT ||
  'Estamos com o site do Bom Filho no ar. Faca seu pedido por la.'
).trim();
const WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS = Number.parseInt(
  process.env.WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS || '0',
  10
);

// ============================================
// PAGBANK VALIDATIONS
// ============================================
if (PAGBANK_ENABLED && IS_PRODUCTION && !PAGBANK_WEBHOOK_TOKEN) {
  throw new Error('PAGBANK_WEBHOOK_TOKEN é obrigatório em produção para validação segura dos webhooks PagBank.');
}
if (PAGBANK_ENABLED && !PAGBANK_WEBHOOK_TOKEN) {
  console.warn('⚠️ PAGBANK_WEBHOOK_TOKEN não configurado. Em produção o servidor não inicializa sem essa variável.');
}
if (PAGBANK_ENABLED && IS_PRODUCTION && ALLOW_PIX_MOCK) {
  throw new Error('ALLOW_PIX_MOCK nao pode ser true em producao.');
}
if (PAGBANK_ENABLED && IS_PRODUCTION && ALLOW_DEBIT_3DS_MOCK) {
  throw new Error('ALLOW_DEBIT_3DS_MOCK nao pode ser true em producao.');
}

// ============================================
// RECAPTCHA
// ============================================
const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
const RECAPTCHA_MIN_SCORE = (() => {
  const valor = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  if (!Number.isFinite(valor)) return 0.5;
  return Math.min(1, Math.max(0, valor));
})();
const RECAPTCHA_CHECKOUT_ENABLED = parseBooleanEnv('RECAPTCHA_CHECKOUT_ENABLED', false);
const RECAPTCHA_PAYMENT_ENABLED = parseBooleanEnv('RECAPTCHA_PAYMENT_ENABLED', false);
const RECAPTCHA_AUTH_ENABLED = parseBooleanEnv('RECAPTCHA_AUTH_ENABLED', IS_PRODUCTION);
// Enterprise Score — set both to enable Enterprise API path; falls back to siteverify
const RECAPTCHA_PROJECT_ID = String(process.env.RECAPTCHA_PROJECT_ID || '').trim();
const RECAPTCHA_CLOUD_API_KEY = String(process.env.RECAPTCHA_CLOUD_API_KEY || '').trim();
const RECAPTCHA_ENTERPRISE_MODE = Boolean(RECAPTCHA_PROJECT_ID && RECAPTCHA_CLOUD_API_KEY);

// ============================================
// SECURITY & AUTH
// ============================================
const JWT_SECRET = String(process.env.JWT_SECRET || '');
if (IS_PRODUCTION && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET deve ter no minimo 32 caracteres em producao.');
}
const DIAGNOSTIC_TOKEN = String(process.env.DIAGNOSTIC_TOKEN || '').trim();
const ALLOW_REMOTE_DIAGNOSTIC = parseBooleanEnv('ALLOW_REMOTE_DIAGNOSTIC', false);
const BASE_URL_ENV = String(process.env.BASE_URL || '').trim();
const METRICS_ENABLED = parseBooleanEnv('METRICS_ENABLED', !IS_PRODUCTION);
const METRICS_TOKEN = String(process.env.METRICS_TOKEN || '').trim();
const DISTRIBUTED_IDEMPOTENCY_ENABLED = parseBooleanEnv('DISTRIBUTED_IDEMPOTENCY_ENABLED', NODE_ENV !== 'test');

const RECAPTCHA_CHECKOUT_PROTECTION_ENABLED = RECAPTCHA_CHECKOUT_ENABLED && Boolean(RECAPTCHA_SECRET_KEY);
const RECAPTCHA_PAYMENT_PROTECTION_ENABLED = RECAPTCHA_PAYMENT_ENABLED && Boolean(RECAPTCHA_SECRET_KEY);
const RECAPTCHA_AUTH_PROTECTION_ENABLED = RECAPTCHA_AUTH_ENABLED && Boolean(RECAPTCHA_SECRET_KEY);

if ((RECAPTCHA_CHECKOUT_ENABLED || RECAPTCHA_PAYMENT_ENABLED) && !RECAPTCHA_SECRET_KEY) {
  const avisoRecaptcha = 'RECAPTCHA_CHECKOUT_ENABLED/RECAPTCHA_PAYMENT_ENABLED ativos sem RECAPTCHA_SECRET_KEY. A protecao antiabuso do checkout ficara desabilitada.';
  if (IS_PRODUCTION) throw new Error(avisoRecaptcha);
  console.warn(`⚠️ ${avisoRecaptcha}`);
}

if (RECAPTCHA_AUTH_ENABLED && !RECAPTCHA_SECRET_KEY) {
  const avisoRecaptchaAuth = 'RECAPTCHA_AUTH_ENABLED ativo sem RECAPTCHA_SECRET_KEY. A protecao antiabuso do login/cadastro ficara desabilitada.';
  if (IS_PRODUCTION) throw new Error(avisoRecaptchaAuth);
  console.warn(`⚠️ ${avisoRecaptchaAuth}`);
}

if (IS_PRODUCTION) {
  if (!BASE_URL_ENV) throw new Error('BASE_URL obrigatoria em producao para notificacoes e webhooks.');
  if (!/^https:\/\//i.test(BASE_URL_ENV)) throw new Error('BASE_URL deve usar HTTPS em producao.');
  if (FRONTEND_APP_URL && !/^https:\/\//i.test(FRONTEND_APP_URL)) throw new Error('FRONTEND_APP_URL deve usar HTTPS em producao.');
  if (PAGBANK_ENABLED && !PAGBANK_TOKEN) throw new Error('PAGBANK_TOKEN e obrigatorio em producao quando PAGBANK_ENABLED=true.');
  if (METRICS_ENABLED && !METRICS_TOKEN) throw new Error('METRICS_TOKEN e obrigatorio quando METRICS_ENABLED=true em producao.');
}

if (ALLOW_REMOTE_DIAGNOSTIC && !DIAGNOSTIC_TOKEN) {
  console.warn('⚠️ ALLOW_REMOTE_DIAGNOSTIC=true sem DIAGNOSTIC_TOKEN. O acesso remoto de diagnóstico ficará indisponível.');
}

// ============================================
// ADMIN
// ============================================
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin').trim() || 'admin';
const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_LOCAL_ONLY = parseBooleanEnv('ADMIN_LOCAL_ONLY', true);

if (IS_PRODUCTION && !ADMIN_PASSWORD_HASH && ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD em texto plano nao e permitida em producao. Configure ADMIN_PASSWORD_HASH (bcrypt).');
}
if (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD) {
  console.warn('⚠️ Nenhuma senha de admin configurada (ADMIN_PASSWORD_HASH ou ADMIN_PASSWORD). O login admin ficará inacessível.');
}

// ============================================
// CORS
// ============================================
const CORS_ORIGENS_FIXAS_PRODUCAO = [
  'https://bomfilho-delivery.vercel.app',
  'https://bomfilhoadmin.vercel.app'
];
const CORS_ORIGENS_FIXAS_DESENVOLVIMENTO = [
  'http://localhost:5173', 'http://localhost:5174',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174'
];
const origensPadrao = IS_PRODUCTION
  ? CORS_ORIGENS_FIXAS_PRODUCAO
  : [...CORS_ORIGENS_FIXAS_DESENVOLVIMENTO, ...CORS_ORIGENS_FIXAS_PRODUCAO];

const CORS_ORIGINS_SET = new Set(origensPadrao.map((o) => normalizarOrigin(o)).filter(Boolean));
for (const origin of String(process.env.CORS_ORIGINS || '').split(',')) {
  const n = normalizarOrigin(origin);
  if (n) CORS_ORIGINS_SET.add(n);
}
const frontendAppOrigin = normalizarOrigin(FRONTEND_APP_URL);
if (frontendAppOrigin) CORS_ORIGINS_SET.add(frontendAppOrigin);
const CORS_ORIGINS = Array.from(CORS_ORIGINS_SET);
if (IS_PRODUCTION && CORS_ORIGINS.length === 0) throw new Error('CORS_ORIGINS nao configurada no ambiente de producao.');
if (IS_PRODUCTION) {
  const origensLocais = CORS_ORIGINS.filter((o) => /localhost|127\.0\.0\.1/.test(o));
  if (origensLocais.length) console.warn(`⚠️ CORS_ORIGINS em producao contem origem local: ${origensLocais.join(', ')}`);
}
const CORS_ORIGIN_PATTERNS = CORS_ORIGINS
  .filter((o) => o.includes('*'))
  .map((o) => new RegExp(`^${escapeRegex(o).replace(/\\\*/g, '[^.]+')}$`, 'i'));

// ============================================
// COOKIES
// ============================================
const USER_AUTH_COOKIE_NAME = 'bf_access_token';
const ADMIN_AUTH_COOKIE_NAME = 'bf_admin_token';
const CSRF_COOKIE_NAME = 'bf_csrf_token';
const USER_AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ADMIN_AUTH_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
const CSRF_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
const COOKIE_SECURE = parseBooleanEnv('COOKIE_SECURE', IS_PRODUCTION);
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim() || null;
const COOKIE_SAME_SITE_RAW = String(process.env.COOKIE_SAME_SITE || (IS_PRODUCTION ? 'none' : 'strict')).trim().toLowerCase();
const COOKIE_SAME_SITE = ['strict', 'lax', 'none'].includes(COOKIE_SAME_SITE_RAW) ? COOKIE_SAME_SITE_RAW : 'strict';
if (IS_PRODUCTION && !COOKIE_SECURE) throw new Error('COOKIE_SECURE deve ser true em producao.');
if (COOKIE_SAME_SITE === 'none' && !COOKIE_SECURE) {
  throw new Error('COOKIE_SAME_SITE=none requer COOKIE_SECURE=true.');
}
if (IS_PRODUCTION && FRONTEND_APP_URL && BASE_URL_ENV) {
  try {
    const frontendHost = new URL(FRONTEND_APP_URL).host;
    const backendHost = new URL(BASE_URL_ENV).host;
    if (frontendHost !== backendHost && COOKIE_SAME_SITE !== 'none') {
      throw new Error('COOKIE_SAME_SITE deve ser "none" em producao quando frontend e backend estao em dominios diferentes.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('COOKIE_SAME_SITE')) {
      throw err;
    }
    console.warn('⚠️ Nao foi possivel validar hosts de FRONTEND_APP_URL/BASE_URL para politica de cookies.');
  }
}

// ============================================
// DELIVERY / FRETE
// ============================================
const PRECO_COMBUSTIVEL_LITRO = Number(process.env.PRECO_COMBUSTIVEL_LITRO || 6.2);
const CEP_MERCADO = String(process.env.CEP_MERCADO || '68740-180').replace(/\D/g, '');
const NUMERO_MERCADO = String(process.env.NUMERO_MERCADO || '70').trim() || '70';
const LIMITE_BIKE_KM = (() => {
  const valor = Number(process.env.LIMITE_BIKE_KM || 1);
  return Number.isFinite(valor) && valor > 0 ? valor : 1;
})();
const CEP_GEO_TTL_MS = 24 * 60 * 60 * 1000;
const PRODUTOS_QUERY_CACHE_TTL_MS = Number(process.env.PRODUTOS_QUERY_CACHE_TTL_MS || 120000);
const READ_QUERY_CACHE_TTL_MS = 30 * 1000;
const FRETE_DEBUG_LOGS = (() => {
  const raw = String(process.env.FRETE_DEBUG_LOGS || '').trim().toLowerCase();
  if (!raw) return !IS_PRODUCTION;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(raw);
})();

// ============================================
// UBER DIRECT
// ============================================
const UBER_DIRECT_ENABLED = parseBooleanEnv('UBER_DIRECT_ENABLED', false);
const UBER_DIRECT_BASE_URL = String(process.env.UBER_DIRECT_BASE_URL || 'https://api.uber.com/v1').trim().replace(/\/+$/, '');
const UBER_DIRECT_OAUTH_URL = String(process.env.UBER_DIRECT_OAUTH_URL || 'https://login.uber.com/oauth/v2/token').trim();
const UBER_DIRECT_CUSTOMER_ID = String(process.env.UBER_DIRECT_CUSTOMER_ID || '').trim();
const UBER_DIRECT_CLIENT_ID = String(process.env.UBER_DIRECT_CLIENT_ID || '').trim();
const UBER_DIRECT_CLIENT_SECRET = String(process.env.UBER_DIRECT_CLIENT_SECRET || '').trim();
const UBER_DIRECT_WEBHOOK_TOKEN = String(process.env.UBER_DIRECT_WEBHOOK_TOKEN || '').trim();
const UBER_DIRECT_TIMEOUT_MS = (() => {
  const valor = Number(process.env.UBER_DIRECT_TIMEOUT_MS || 15000);
  if (!Number.isFinite(valor)) return 15000;
  return Math.max(5000, Math.min(60000, Math.round(valor)));
})();
const UBER_PICKUP_NAME = String(process.env.UBER_PICKUP_NAME || 'BomFilho Supermercado').trim() || 'BomFilho Supermercado';
const UBER_PICKUP_PHONE = String(process.env.UBER_PICKUP_PHONE || '').trim();
const UBER_PICKUP_ADDRESS = String(process.env.UBER_PICKUP_ADDRESS || '').trim();

if (UBER_DIRECT_ENABLED) {
  if (!UBER_DIRECT_CUSTOMER_ID || !UBER_DIRECT_CLIENT_ID || !UBER_DIRECT_CLIENT_SECRET) {
    const msg = 'UBER_DIRECT_ENABLED=true requer UBER_DIRECT_CUSTOMER_ID, UBER_DIRECT_CLIENT_ID e UBER_DIRECT_CLIENT_SECRET.';
    if (IS_PRODUCTION) {
      throw new Error(msg);
    }
    console.warn(`⚠️ ${msg}`);
  }

  if (!UBER_PICKUP_PHONE || !UBER_PICKUP_ADDRESS) {
    const msg = 'UBER_DIRECT_ENABLED=true requer UBER_PICKUP_PHONE e UBER_PICKUP_ADDRESS para coleta.';
    if (IS_PRODUCTION) {
      throw new Error(msg);
    }
    console.warn(`⚠️ ${msg}`);
  }

  if (IS_PRODUCTION && !UBER_DIRECT_WEBHOOK_TOKEN) {
    throw new Error('UBER_DIRECT_WEBHOOK_TOKEN é obrigatório em produção para validar webhook Uber.');
  }
}

const TAXA_SERVICO_PERCENTUAL = (() => {
  const valor = Number(process.env.TAXA_SERVICO_PERCENTUAL || 3);
  return Number.isFinite(valor) && valor >= 0 && valor <= 100 ? valor : 3;
})();

// ============================================
// EXPORT
// ============================================
module.exports = {
  // core
  NODE_ENV, IS_PRODUCTION, PORT, SERVICE_NAME, API_VERSION,
  FRONTEND_DIST_PATH, REACT_DIST_INDEX, FRONTEND_APP_URL, SHOULD_SERVE_REACT,
  DATABASE_URL, DB_DIALECT, TRUST_PROXY, BASE_URL_ENV,
  // pagbank
  PAGBANK_ENABLED,
  PAGBANK_CONFIG, PAGBANK_ENV, PAGBANK_TOKEN, PAGBANK_PUBLIC_KEY,
  PAGBANK_WEBHOOK_TOKEN, PAGBANK_DEBUG_LOGS, ALLOW_PIX_MOCK, ALLOW_DEBIT_3DS_MOCK,
  PAGBANK_TIMEOUT_MS, PAGBANK_API_URL, PAGBANK_SDK_API_URL, PAGBANK_3DS_SDK_ENV,
  // mercado pago
  MP_ACCESS_TOKEN, MP_ENV, MP_NOTIFICATION_URL, MP_SUCCESS_URL, MP_PENDING_URL, MP_FAILURE_URL, MP_WEBHOOK_SECRET,
  MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING,
  TAMANHO_MAXIMO_IMPORTACAO_MB, TAMANHO_MAXIMO_IMPORTACAO_BYTES,
  // evolution
  EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, EVOLUTION_WEBHOOK_TOKEN,
  WHATSAPP_AUTO_REPLY_ENABLED, WHATSAPP_AUTO_REPLY_TEXT, WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS,
  // recaptcha
  RECAPTCHA_SECRET_KEY, RECAPTCHA_MIN_SCORE, RECAPTCHA_CHECKOUT_ENABLED, RECAPTCHA_PAYMENT_ENABLED, RECAPTCHA_AUTH_ENABLED,
  RECAPTCHA_CHECKOUT_PROTECTION_ENABLED, RECAPTCHA_PAYMENT_PROTECTION_ENABLED, RECAPTCHA_AUTH_PROTECTION_ENABLED,
  RECAPTCHA_PROJECT_ID, RECAPTCHA_CLOUD_API_KEY, RECAPTCHA_ENTERPRISE_MODE,
  // security
  JWT_SECRET, DIAGNOSTIC_TOKEN, ALLOW_REMOTE_DIAGNOSTIC,
  METRICS_ENABLED, METRICS_TOKEN,
  DISTRIBUTED_IDEMPOTENCY_ENABLED,
  // admin
  ADMIN_USER, ADMIN_PASSWORD_HASH, ADMIN_PASSWORD, ADMIN_LOCAL_ONLY,
  // cors
  CORS_ORIGINS, CORS_ORIGIN_PATTERNS,
  // cookies
  USER_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME, CSRF_COOKIE_NAME,
  USER_AUTH_COOKIE_MAX_AGE, ADMIN_AUTH_COOKIE_MAX_AGE, CSRF_COOKIE_MAX_AGE,
  COOKIE_SECURE, COOKIE_DOMAIN, COOKIE_SAME_SITE,
  // delivery
  PRECO_COMBUSTIVEL_LITRO, CEP_MERCADO, NUMERO_MERCADO, LIMITE_BIKE_KM,
  CEP_GEO_TTL_MS, PRODUTOS_QUERY_CACHE_TTL_MS, READ_QUERY_CACHE_TTL_MS,
  FRETE_DEBUG_LOGS,
  UBER_DIRECT_ENABLED,
  UBER_DIRECT_BASE_URL,
  UBER_DIRECT_OAUTH_URL,
  UBER_DIRECT_CUSTOMER_ID,
  UBER_DIRECT_CLIENT_ID,
  UBER_DIRECT_CLIENT_SECRET,
  UBER_DIRECT_WEBHOOK_TOKEN,
  UBER_DIRECT_TIMEOUT_MS,
  UBER_PICKUP_NAME,
  UBER_PICKUP_PHONE,
  UBER_PICKUP_ADDRESS,
  TAXA_SERVICO_PERCENTUAL,
  // helpers
  parseBooleanEnv, escapeRegex, normalizarOrigin,
};
