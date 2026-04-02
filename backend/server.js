const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const timeout = require('connect-timeout');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const multer = require('multer');
const fetch = global.fetch;
const fs = require('fs');
const logger = require('./lib/logger');
const { BoundedCache } = require('./lib/cache');
const { captureException, sentryErrorHandler } = require('./lib/sentry');
const config = require('./lib/config');
const {
  criarErroHttp,
  toLowerTrim,
  parsePositiveInt,
  toMoney,
  escapeLike,
  montarPaginacao,
  compararTextoSegura
} = require('./lib/helpers');
const {
  MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO,
  validarArquivoImportacao,
} = require('./services/produtosImportacao');
const { createDefaultBarcodeLookupService } = require('./services/barcode/BarcodeLookupService');
const {
  ensureAdminCatalogSchema
} = require('./services/admin/catalogoAdminService');

// Extracted modules
const { criarCookieAuthHelpers } = require('./lib/cookieAuth');
const { criarWhatsappService } = require('./lib/whatsapp');
const { criarRecaptchaValidator } = require('./lib/recaptcha');
const { criarRateLimiters } = require('./middleware/rateLimits');
const { criarCsrfMiddleware } = require('./middleware/csrf');

const app = express();

let requestCounter = 0;

// ============================================
// CONFIGURAÇÃO CENTRALIZADA (lib/config.js)
// ============================================
const {
  IS_PRODUCTION, PORT,
  FRONTEND_DIST_PATH, REACT_DIST_INDEX, FRONTEND_APP_URL, SHOULD_SERVE_REACT,
  DB_DIALECT, TRUST_PROXY, BASE_URL_ENV,
  TAMANHO_MAXIMO_IMPORTACAO_BYTES,
  EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, EVOLUTION_WEBHOOK_TOKEN,
  RECAPTCHA_SECRET_KEY, RECAPTCHA_MIN_SCORE,
  RECAPTCHA_AUTH_PROTECTION_ENABLED,
  RECAPTCHA_PROJECT_ID, RECAPTCHA_CLOUD_API_KEY, RECAPTCHA_ENTERPRISE_MODE,
  JWT_SECRET, DIAGNOSTIC_TOKEN, ALLOW_REMOTE_DIAGNOSTIC,
  METRICS_ENABLED, METRICS_TOKEN,
  CORS_ORIGINS, CORS_ORIGIN_PATTERNS,
  USER_AUTH_COOKIE_NAME, ADMIN_AUTH_COOKIE_NAME, CSRF_COOKIE_NAME,
  CSRF_COOKIE_MAX_AGE,
  COOKIE_SECURE, COOKIE_DOMAIN, COOKIE_SAME_SITE,
  PRECO_COMBUSTIVEL_LITRO, CEP_MERCADO, NUMERO_MERCADO, LIMITE_BIKE_KM,
  CEP_GEO_TTL_MS, PRODUTOS_QUERY_CACHE_TTL_MS, READ_QUERY_CACHE_TTL_MS,
  FRETE_DEBUG_LOGS,
  UBER_DIRECT_ENABLED,
  UBER_DIRECT_OAUTH_URL,
  UBER_DIRECT_BASE_URL,
  UBER_DIRECT_CUSTOMER_ID,
  UBER_DIRECT_CLIENT_ID,
  UBER_DIRECT_CLIENT_SECRET,
  UBER_DIRECT_TIMEOUT_MS,
  UBER_PICKUP_NAME,
  UBER_PICKUP_PHONE,
  UBER_PICKUP_ADDRESS,
  UBER_DIRECT_WEBHOOK_TOKEN,
} = config;

// Runtime instances (dependem de config, não podem ficar no módulo config)
const cepGeoCache = new BoundedCache({ maxSize: 2000, ttlMs: CEP_GEO_TTL_MS, name: 'cepGeo' });
const produtosQueryCache = new BoundedCache({ maxSize: 200, ttlMs: PRODUTOS_QUERY_CACHE_TTL_MS, name: 'produtosQuery' });
const readQueryCache = new BoundedCache({ maxSize: 500, ttlMs: READ_QUERY_CACHE_TTL_MS, name: 'readQuery' });

// ── Mercado Pago service instance ───────────────────────────────────────
const { criarMercadoPagoService } = require('./services/mercadoPagoService');
const { criarMercadoPagoPaymentSyncService } = require('./services/mercadoPagoPaymentSyncService');
const {
  MP_ACCESS_TOKEN,
  MP_ENV,
  MP_NOTIFICATION_URL,
  MP_SUCCESS_URL,
  MP_PENDING_URL,
  MP_FAILURE_URL,
  MP_WEBHOOK_SECRET,
  MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING
} = config;
const mercadoPagoService = criarMercadoPagoService({
  accessToken: MP_ACCESS_TOKEN,
  env: MP_ENV,
  notificationUrl: MP_NOTIFICATION_URL,
  successUrl: MP_SUCCESS_URL,
  pendingUrl: MP_PENDING_URL,
  failureUrl: MP_FAILURE_URL,
  baseUrl: BASE_URL_ENV,
  webhookSecret: MP_WEBHOOK_SECRET,
  allowInsecureWebhookWithoutSecret: MP_WEBHOOK_ALLOW_INSECURE_WHEN_SECRET_MISSING,
  timeoutMs: 15000
});

const createUberDirectService = require('./services/uberDirectService');
const uberDirectService = createUberDirectService({
  enabled: UBER_DIRECT_ENABLED,
  oauthUrl: UBER_DIRECT_OAUTH_URL,
  baseUrl: UBER_DIRECT_BASE_URL,
  customerId: UBER_DIRECT_CUSTOMER_ID,
  clientId: UBER_DIRECT_CLIENT_ID,
  clientSecret: UBER_DIRECT_CLIENT_SECRET,
  timeoutMs: UBER_DIRECT_TIMEOUT_MS,
  pickup: {
    name: UBER_PICKUP_NAME,
    phone: UBER_PICKUP_PHONE,
    address: UBER_PICKUP_ADDRESS
  },
  loggerInstance: logger
});

// ============================================
// HTTP FETCH HELPER
// ============================================
const EXTERNAL_HTTP_TIMEOUT_MS = Number.parseInt(String(process.env.EXTERNAL_HTTP_TIMEOUT_MS || '8000'), 10) || 8000;
const BARCODE_LEGADO_TIMEOUT_MS = Number.parseInt(String(process.env.BARCODE_LEGADO_TIMEOUT_MS || '4500'), 10) || 4500;

async function fetchWithTimeout(url, {
  method = 'GET',
  headers,
  body,
  timeoutMs = EXTERNAL_HTTP_TIMEOUT_MS
} = {}) {
  const fetchTimeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : EXTERNAL_HTTP_TIMEOUT_MS;

  if (typeof AbortController === 'undefined') {
    return fetch(url, { method, headers, body });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, fetchTimeoutMs);

  try {
    return await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// EXTRACTED MODULE INITIALIZATION
// ============================================
const { criarFreteService, VEICULOS_ENTREGA } = require('./lib/frete');
const freteService = criarFreteService({
  criarErroHttp, toMoney, compararTextoSegura, logger, config,
  cepGeoCache, fetchWithTimeout
});
const { calcularEntregaPorCep, normalizarCep, formatarCep } = freteService;

const cookieAuthHelpers = criarCookieAuthHelpers({ config });
const {
  normalizarIp, getCookieOptions, definirCookieAuth, limparCookie,
  emitirCsrfToken, isOriginPermitida, extrairBearerToken,
  extrairTokenUsuarioRequest, extrairTokenAdminRequest
} = cookieAuthHelpers;

const whatsappService = criarWhatsappService({ logger, config, fetchWithTimeout });
const { formatarTelefoneWhatsapp, enviarWhatsappTexto, enviarWhatsappPedido } = whatsappService;

const recaptchaValidator = criarRecaptchaValidator({ criarErroHttp, logger, config, normalizarIp });
const { validarRecaptcha } = recaptchaValidator;

if (JWT_SECRET.length < 32) {
  const aviso = 'JWT_SECRET deve ter no mínimo 32 caracteres para segurança adequada.';
  if (IS_PRODUCTION) {
    throw new Error(aviso);
  }
  logger.warn(`⚠️ ${aviso}`);
}

// Cookie/auth/token helpers extracted to lib/cookieAuth.js

function extrairTokenDiagnostico(req) {
  const headerToken = req.headers['x-diagnostic-token'];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  return String(headerToken || bearerToken || '').trim();
}

function _protegerDiagnostico(req, res, next) {
  const ip = normalizarIp(req.ip || req.socket?.remoteAddress);
  const acessoLocal = ip === '127.0.0.1' || ip === '::1';

  if (acessoLocal) {
    if (DIAGNOSTIC_TOKEN) {
      const token = extrairTokenDiagnostico(req);
      if (!token || token !== DIAGNOSTIC_TOKEN) {
        return res.status(401).json({ erro: 'Token de diagnóstico inválido' });
      }
    }

    return next();
  }

  if (!ALLOW_REMOTE_DIAGNOSTIC) {
    return res.status(403).json({ erro: 'Rota de diagnóstico permitida apenas localmente' });
  }

  if (!DIAGNOSTIC_TOKEN) {
    return res.status(503).json({ erro: 'Diagnóstico remoto indisponível: DIAGNOSTIC_TOKEN não configurado.' });
  }

  const token = extrairTokenDiagnostico(req);
  if (!token || token !== DIAGNOSTIC_TOKEN) {
    return res.status(401).json({ erro: 'Token de diagnóstico inválido' });
  }

  return next();
}

function extrairTokenMetrics(req) {
  const headerToken = req.headers['x-metrics-token'];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  return String(headerToken || bearerToken || '').trim();
}

function protegerMetrics(req, res, next) {
  if (!METRICS_ENABLED) {
    return res.status(404).json({ erro: 'Not Found' });
  }

  if (!IS_PRODUCTION) {
    return next();
  }

  if (!METRICS_TOKEN) {
    return res.status(503).json({ erro: 'Metricas indisponiveis no momento.' });
  }

  const token = extrairTokenMetrics(req);
  if (!token || !compararTextoSegura(token, METRICS_TOKEN)) {
    return res.status(401).json({ erro: 'Token de metricas invalido.' });
  }

  return next();
}

// Recaptcha extracted to lib/recaptcha.js

const uploadImportacaoProdutos = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TAMANHO_MAXIMO_IMPORTACAO_BYTES
  },
  fileFilter(req, file, callback) {
    try {
      validarArquivoImportacao({
        nomeArquivo: file?.originalname,
        mimeType: file?.mimetype
      });
    } catch (erroValidacao) {
      return callback(new Error(erroValidacao?.message || MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO));
    }

    return callback(null, true);
  }
});

function middlewareUploadImportacaoProdutos(req, res, next) {
  uploadImportacaoProdutos.single('arquivo')(req, res, (erroUpload) => {
    if (!erroUpload) {
      return next();
    }

    if (erroUpload instanceof multer.MulterError) {
      if (erroUpload.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          erro: `Arquivo acima de ${Math.round(TAMANHO_MAXIMO_IMPORTACAO_BYTES / (1024 * 1024))}MB. Reduza o tamanho da planilha e tente novamente.`
        });
      }

      return res.status(400).json({ erro: 'Não foi possível processar o upload da planilha.' });
    }

    return res.status(400).json({
      erro: erroUpload?.message || 'Arquivo inválido para importação.'
    });
  });
}

function montarChaveCacheLeitura(prefixo, payload = {}) {
  return `${prefixo}:${JSON.stringify(payload)}`;
}

function obterCacheLeitura(chave) {
  return readQueryCache.get(chave) ?? null;
}

function salvarCacheLeitura(chave, payload) {
  readQueryCache.set(chave, payload);
}

function limparCacheLeituraPorPrefixo(prefixo) {
  readQueryCache.clearByPrefix(prefixo);
}

function limparCacheProdutos() {
  produtosQueryCache.clear();
  limparCacheLeituraPorPrefixo('produtos:');
  limparCacheLeituraPorPrefixo('categorias:');
}

function montarChaveCacheProdutos({ pagina, limite, busca, categoria, ordenacao }) {
  return JSON.stringify({ pagina, limite, busca, categoria, ordenacao });
}

function obterCacheProdutos(chave) {
  return produtosQueryCache.get(chave) ?? null;
}

function salvarCacheProdutos(chave, payload) {
  produtosQueryCache.set(chave, payload);
}

function validarWebhookEvolution(req) {
  if (!EVOLUTION_WEBHOOK_TOKEN) {
    return true;
  }

  const tokenHeader = String(req.headers['x-webhook-token'] || req.headers['x-evolution-token'] || '').trim();
  const tokenQuery = String(req.query?.token || '').trim();

  return compararTextoSegura(tokenHeader, EVOLUTION_WEBHOOK_TOKEN) || compararTextoSegura(tokenQuery, EVOLUTION_WEBHOOK_TOKEN);
}

function limparCacheEvolution() {
  evolutionProcessedMessageIds.purgeExpired();
  evolutionLastReplyByNumber.purgeExpired();
}

function extrairDadosMensagemEvolution(payload) {
  const data = payload?.data || payload || {};
  const key = data?.key || payload?.key || {};
  const remoteJid = String(
    key?.remoteJid || data?.remoteJid || payload?.remoteJid || data?.from || payload?.from || ''
  ).trim();
  const fromMe = Boolean(key?.fromMe ?? data?.fromMe ?? payload?.fromMe);
  const messageId = String(key?.id || data?.id || payload?.id || '').trim();

  const messageObject = data?.message || payload?.message;
  const textual = String(data?.body || payload?.body || data?.text || payload?.text || '').trim();
  const temConteudo = Boolean(messageObject) || textual.length > 0;

  return {
    remoteJid,
    fromMe,
    messageId,
    temConteudo
  };
}

function isJidGrupoOuBroadcast(remoteJid) {
  const jid = String(remoteJid || '').toLowerCase();
  return jid.includes('@g.us') || jid.includes('status@broadcast') || jid.includes('@broadcast');
}

const evolutionProcessedMessageIds = new BoundedCache({ maxSize: 5000, ttlMs: 30 * 60 * 1000, name: 'evolutionMsgIds' });
const evolutionLastReplyByNumber = new BoundedCache({ maxSize: 2000, ttlMs: 24 * 60 * 60 * 1000, name: 'evolutionReply' });

// ============================================
// MIDDLEWARES
// ============================================
app.disable('x-powered-by');

if (TRUST_PROXY !== false) {
  app.set('trust proxy', TRUST_PROXY);
}

function haltOnTimedout(req, res, next) {
  if (!req.timedout) {
    next();
  }
}

const rateLimitValidateOptions = TRUST_PROXY !== false
  ? { trustProxy: false }
  : { xForwardedForHeader: false };

const REQUEST_TIMEOUT_PADRAO = String(process.env.REQUEST_TIMEOUT_PADRAO || '20s').trim() || '20s';
const REQUEST_TIMEOUT_ADMIN = String(process.env.REQUEST_TIMEOUT_ADMIN || '30s').trim() || '30s';
const REQUEST_TIMEOUT_IMPORTACAO = String(process.env.REQUEST_TIMEOUT_IMPORTACAO || '600s').trim() || '600s';
const ROTAS_TIMEOUT_IMPORTACAO = new Set([
  '/api/admin/catalogo/produtos/importar',
  '/api/admin/produtos/importar'
]);
const timeoutPadraoMiddleware = timeout(REQUEST_TIMEOUT_PADRAO);
const timeoutAdminMiddleware = timeout(REQUEST_TIMEOUT_ADMIN);
const timeoutImportacaoMiddleware = timeout(REQUEST_TIMEOUT_IMPORTACAO);

app.use((req, _res, next) => {
  requestCounter += 1;
  const requestIdHeader = String(req.headers['x-request-id'] || '').trim();
  req.requestId = requestIdHeader || `${Date.now()}-${requestCounter}`;
  req.requestStartMs = Date.now();
  next();
});

app.use((req, res, next) => {
  if (req.requestId) {
    res.setHeader('x-request-id', req.requestId);
  }
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    const inicio = Number(req.requestStartMs || Date.now());
    const duracaoMs = Date.now() - inicio;
    const statusCode = Number(res.statusCode || 0);

    if (duracaoMs >= 2000 || statusCode >= 500) {
      const payload = {
        request_id: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: statusCode,
        duration_ms: duracaoMs,
        timedout: Boolean(req.timedout),
        ip: req.ip
      };

      if (statusCode >= 500) {
        logger.error('HTTP_REQUEST_PROBLEM', payload);
      } else {
        logger.warn('HTTP_REQUEST_SLOW', payload);
      }
    }
  });

  next();
});

app.use((req, res, next) => {
  const rota = String(req.path || '');
  const metodo = String(req.method || 'GET').toUpperCase();
  const ehRotaImportacao = metodo === 'POST' && ROTAS_TIMEOUT_IMPORTACAO.has(rota);
  const ehRotaAdmin = rota.startsWith('/api/admin/');
  const timeoutMiddleware = ehRotaImportacao
    ? timeoutImportacaoMiddleware
    : (ehRotaAdmin ? timeoutAdminMiddleware : timeoutPadraoMiddleware);
  return timeoutMiddleware(req, res, next);
});
app.use(haltOnTimedout);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://assets.pagseguro.com.br',
        'https://sdk.pagseguro.com',
        'https://stc.pagseguro.uol.com.br',
        'https://www.google.com',
        'https://www.gstatic.com',
        'https://www.recaptcha.net'
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      connectSrc: [
        "'self'",
        'https://api.pagseguro.com',
        'https://sandbox.api.pagseguro.com',
        'https://sdk.pagseguro.com',
        'https://stc.pagseguro.uol.com.br',
        'https://www.google.com',
        'https://www.recaptcha.net',
        'https://brasilapi.com.br',
        'https://viacep.com.br',
        'https://nominatim.openstreetmap.org',
        ...(FRONTEND_APP_URL ? [FRONTEND_APP_URL] : []),
        ...(IS_PRODUCTION ? [] : ['http://localhost:*', 'ws://localhost:*'])
      ],
      frameSrc: [
        "'self'",
        'https://assets.pagseguro.com.br',
        'https://sandbox.api.pagseguro.com',
        'https://api.pagseguro.com',
        'https://www.google.com',
        'https://www.recaptcha.net'
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(haltOnTimedout);

const corsOptions = {
  origin(origin, callback) {
    if (isOriginPermitida(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-diagnostic-token', 'x-webhook-token', 'x-csrf-token', 'ngrok-skip-browser-warning'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 600
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(haltOnTimedout);

app.use(compression());
app.use(haltOnTimedout);

app.use(bodyParser.json({ limit: '200kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());
app.use(haltOnTimedout);

const {
  globalLimiter, publicLimiter, produtosPublicLimiter,
  authLimiter, loginLimiter, adminAuthLimiter,
  paymentLimiter, orderCreateLimiter
} = criarRateLimiters({ rateLimit, ipKeyGenerator, IS_PRODUCTION, rateLimitValidateOptions });

app.use(globalLimiter);
app.use('/api/produtos', produtosPublicLimiter);
app.use('/api/pedidos', publicLimiter);

app.use(criarCsrfMiddleware({ compararTextoSegura, extrairBearerToken, config }));

if (SHOULD_SERVE_REACT && fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));
}

// ============================================
// CONEXÃO COM O BANCO DE DADOS (lib/db.js)
// ============================================
const { pool, queryWithRetry, testConnection } = require('./lib/db');
const mercadoPagoPaymentSyncService = criarMercadoPagoPaymentSyncService({
  pool,
  mercadoPagoService
});

const barcodeLookupService = createDefaultBarcodeLookupService({
  pool,
  logger
});

async function preloadData() {
  try {
    const colunas = await obterColunasProdutos();
    const campos = [
      'id',
      'nome',
      colunas.has('descricao') ? 'descricao' : 'NULL AS descricao',
      colunas.has('marca') ? 'marca' : 'NULL AS marca',
      'preco',
      colunas.has('unidade') ? 'unidade' : "'un' AS unidade",
      colunas.has('categoria') ? 'categoria' : "'geral' AS categoria",
      colunas.has('emoji') ? 'emoji' : "'📦' AS emoji",
      colunas.has('estoque') ? 'estoque' : '0 AS estoque',
      colunas.has('validade') ? 'validade' : 'NULL AS validade'
    ];

    if (colunas.has('codigo_barras')) {
      campos.push('codigo_barras');
    }

    if (colunas.has('imagem_url')) {
      campos.push('imagem_url AS imagem');
    }

    const [produtos] = await queryWithRetry(
      `SELECT ${campos.join(', ')} FROM produtos WHERE ativo = TRUE ORDER BY categoria ASC, nome ASC LIMIT 500`
    );
    const chaveProdutos = montarChaveCacheLeitura('produtos:lista', {
      busca: '',
      categoria: '',
      ordenacao: 'categoria ASC, nome ASC',
      where: 'WHERE ativo = TRUE',
      params: []
    });
    salvarCacheLeitura(chaveProdutos, {
      produtos,
      total: produtos.length
    });

    const [rowsCategorias] = await queryWithRetry(
      `SELECT DISTINCT categoria
       FROM produtos
       WHERE ativo = TRUE
         AND categoria IS NOT NULL
         AND categoria <> ''
       ORDER BY categoria ASC`
    );
    const categorias = rowsCategorias
      .map((item) => String(item?.categoria || '').trim())
      .filter(Boolean);
    salvarCacheLeitura('categorias:ativas', categorias);

    try {
      const [rowsBanners] = await queryWithRetry(
        `SELECT id, titulo, imagem_url, link_url, ordem
         FROM banners
         WHERE ativo = TRUE
         ORDER BY ordem ASC, id DESC`
      );
      salvarCacheLeitura('banners:ativos', rowsBanners);
    } catch (erroTabela) {
      if (erroTabela?.code !== 'ER_NO_SUCH_TABLE') {
        throw erroTabela;
      }
    }

    logger.info(`✅ Preload concluído: ${produtos.length} produtos e ${categorias.length} categorias em cache.`);
  } catch (err) {
    logger.warn('⚠️ Falha no preload inicial de dados:', err?.message || err);
  }
}

// Testar conexão ao iniciar
(async () => {
  try {
    await testConnection();
    await ensureAdminCatalogSchema(pool);
    await barcodeLookupService.ensureCacheSchema();
    await preloadData();
  } catch (err) {
    logger.error('❌ Erro ao executar inicialização do backend:', err);
  }
})();

// WhatsApp helpers extracted to lib/whatsapp.js

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO (middleware/auth.js)
// ============================================
const {
  autenticarToken,
  autenticarAdminToken,
  exigirAcessoLocalAdmin,
  extrairIpRequisicao
} = require('./middleware/auth')({
  normalizarIp,
  extrairTokenUsuarioRequest,
  extrairTokenAdminRequest,
  limparCookie
});

let produtosColumnsCache = null;

function limparCacheColunaProdutos() {
  produtosColumnsCache = null;
}

async function obterColunasProdutos() {
  if (produtosColumnsCache) {
    return produtosColumnsCache;
  }

  if (DB_DIALECT === 'postgres') {
    try {
      const [colunas] = await queryWithRetry(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_name = 'produtos'
            AND table_schema NOT IN ('pg_catalog', 'information_schema')`
      );

      if (Array.isArray(colunas) && colunas.length > 0) {
        produtosColumnsCache = new Set(colunas.map((coluna) => String(coluna.column_name || '').toLowerCase()));
        return produtosColumnsCache;
      }
    } catch (erroColunasInfoSchema) {
      logger.warn('Falha ao listar colunas de produtos via information_schema. Tentando fallback pg_catalog.', {
        code: erroColunasInfoSchema?.code,
        message: erroColunasInfoSchema?.message
      });
    }

    const [colunasPgCatalog] = await queryWithRetry(
      `SELECT a.attname AS column_name
         FROM pg_catalog.pg_attribute a
         JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'produtos'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND a.attnum > 0
          AND NOT a.attisdropped`
    );
    produtosColumnsCache = new Set(colunasPgCatalog.map((coluna) => String(coluna.column_name || '').toLowerCase()));
    return produtosColumnsCache;
  }

  const [colunas] = await queryWithRetry('SHOW COLUMNS FROM produtos');
  produtosColumnsCache = new Set(colunas.map((coluna) => String(coluna.Field || coluna.field || '').toLowerCase()));
  return produtosColumnsCache;
}

function inferirCategoriaProduto(texto) {
  const valor = String(texto || '').toLowerCase();

  if (!valor) return 'mercearia';
  if (/agua|suco|refrigerante|cerveja|bebida|café|cha|chá|leite/.test(valor)) return 'bebidas';
  if (/alface|tomate|banana|maçã|maca|batata|fruta|verdura|legume|hortifruti/.test(valor)) return 'hortifruti';
  if (/sabao|sabão|detergente|desinfetante|limpeza|amaciante|alvejante/.test(valor)) return 'limpeza';
  return 'mercearia';
}

function inferirEmojiPorCategoria(categoria) {
  const cat = String(categoria || '').toLowerCase();
  if (cat === 'bebidas') return '🥤';
  if (cat === 'hortifruti') return '🥬';
  if (cat === 'limpeza') return '🧴';
  return '📦';
}

async function _buscarProdutoOpenFoodFacts(codigo) {
  const resposta = await fetchWithTimeout(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json`, {
    timeoutMs: BARCODE_LEGADO_TIMEOUT_MS
  });
  if (!resposta.ok) {
    return null;
  }

  const dados = await resposta.json();
  if (!dados || dados.status !== 1 || !dados.product) {
    return null;
  }

  const produtoApi = dados.product;
  const nome = String(produtoApi.product_name_pt || produtoApi.product_name || produtoApi.generic_name || '').trim();
  if (!nome) {
    return null;
  }

  const descricao = String(produtoApi.ingredients_text_pt || produtoApi.ingredients_text || produtoApi.quantity || '').trim();
  const marca = String(produtoApi.brands || '').split(',')[0].trim();
  const imagem = String(produtoApi.image_front_url || produtoApi.image_url || '').trim();
  const categoria = inferirCategoriaProduto(`${produtoApi.categories || ''} ${nome} ${descricao}`);

  return {
    fonte: 'openfoodfacts',
    produto: {
      codigo_barras: codigo,
      nome,
      descricao,
      marca,
      categoria,
      emoji: inferirEmojiPorCategoria(categoria),
      imagem
    }
  };
}

async function _buscarProdutoUpcItemDb(codigo) {
  const resposta = await fetchWithTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigo}`, {
    timeoutMs: BARCODE_LEGADO_TIMEOUT_MS
  });
  if (!resposta.ok) {
    return null;
  }

  const dados = await resposta.json();
  const item = Array.isArray(dados?.items) ? dados.items[0] : null;
  if (!item) {
    return null;
  }

  const nome = String(item.title || item.description || '').trim();
  if (!nome) {
    return null;
  }

  const descricao = String(item.description || '').trim();
  const marca = String(item.brand || '').trim();
  const imagem = Array.isArray(item.images) && item.images.length > 0 ? String(item.images[0] || '').trim() : '';
  const categoria = inferirCategoriaProduto(`${item.category || ''} ${nome} ${descricao}`);

  return {
    fonte: 'upcitemdb',
    produto: {
      codigo_barras: codigo,
      nome,
      descricao,
      marca,
      categoria,
      emoji: inferirEmojiPorCategoria(categoria),
      imagem
    }
  };
}

// ============================================
// SWAGGER / OPENAPI DOCS
// ============================================
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ============================================
// ROTAS DE AUTENTICAÇÃO (routes/auth.js)
// ============================================
app.use(require('./routes/auth')({
  authLimiter, loginLimiter, adminAuthLimiter,
  autenticarToken, autenticarAdminToken, exigirAcessoLocalAdmin,
  validarRecaptcha, emitirCsrfToken, definirCookieAuth, limparCookie,
  compararTextoSegura, registrarAuditoria, extrairIpRequisicao,
  enviarWhatsappTexto,
}));

// ============================================
// ROTAS DE ENDEREÇOS (routes/enderecos.js)
// ============================================
app.use(require('./routes/enderecos')({ autenticarToken }));

// ============================================
// ROTAS DE PRODUTOS PÚBLICO (routes/produtos.js)
// ============================================
app.use(require('./routes/produtos')({
  obterColunasProdutos, toLowerTrim, parsePositiveInt, escapeLike,
  montarPaginacao, montarChaveCacheProdutos, obterCacheProdutos, salvarCacheProdutos,
  obterCacheLeitura, salvarCacheLeitura
}));

// ============================================
// ROTAS OFERTAS DO DIA (routes/ofertas-dia.js)
// ============================================
app.use(require('./routes/ofertas-dia')({ autenticarAdminToken, exigirAcessoLocalAdmin }));


// ============================================
// ROTAS CATÁLOGO ADMIN + PRODUTOS CRUD (routes/admin-catalogo.js)
// ============================================
app.use(require('./routes/admin-catalogo')({
  autenticarAdminToken,
  exigirAcessoLocalAdmin,
  pool,
  barcodeLookupService,
  obterColunasProdutos,
  limparCacheProdutos,
  middlewareUploadImportacaoProdutos,
  limparCacheColunaProdutos
}));

// ============================================
// ROTAS MERCADO PAGO (routes/mercadopago.js)
// ============================================
// Superfície de pagamento ativa em runtime: Mercado Pago.
// Fluxos PagBank permanecem apenas como legado no repositório e não são montados aqui.
app.post('/api/mercadopago/criar-pix', paymentLimiter);
app.post('/api/mercadopago/criar-cartao', paymentLimiter);
app.use(require('./routes/mercadopago')({
  autenticarToken,
  mercadoPagoService,
  paymentSyncService: mercadoPagoPaymentSyncService,
  pool,
  validarRecaptcha
}));

// ============================================
// ROTAS DE PEDIDOS
// ============================================

// Simular frete por CEP (routes/frete.js)
app.use(require('./routes/frete')({ calcularEntregaPorCep }));

// Criar pedido (routes/pedidos-criar.js)
app.post('/api/pedidos', orderCreateLimiter);
app.use(require('./routes/pedidos-criar')({
  autenticarToken,
  validarRecaptcha,
  calcularEntregaPorCep,
  enviarWhatsappPedido,
  normalizarCep,
  pool
}));

// Listar/detalhar pedidos do usuário (routes/pedidos.js)
app.use(require('./routes/pedidos')({ autenticarToken, parsePositiveInt, montarPaginacao }));

// Delivery Uber (cotação em tempo real + criação segura + cancelamento)
app.use(require('./routes/delivery')({
  autenticarToken,
  exigirAcessoLocalAdmin,
  autenticarAdminToken,
  pool,
  uberDirectService,
  UBER_DIRECT_ENABLED
}));

// ============================================
// ROTAS DE CUPONS (routes/cupons.js)
// ============================================
app.use(require('./routes/cupons')({ autenticarToken, toMoney }));

// ============================================
// ROTAS ADMIN OPERACIONAL (routes/admin-operacional.js)
// ============================================
app.use(require('./routes/admin-operacional')({
  exigirAcessoLocalAdmin,
  autenticarAdminToken,
  pool,
  enviarWhatsappPedido,
  registrarAuditoria
}));

app.use(require('./routes/admin-pagamentos')({
  exigirAcessoLocalAdmin,
  autenticarAdminToken,
  paymentSyncService: mercadoPagoPaymentSyncService,
  registrarAuditoria: async (payload) => registrarAuditoria(pool, payload),
  pool
}));

// ============================================
// WEBHOOKS (routes/webhooks.js)
// ============================================
app.use(require('./routes/webhooks')({
  validarWebhookEvolution,
  extrairDadosMensagemEvolution, isJidGrupoOuBroadcast,
  formatarTelefoneWhatsapp, enviarWhatsappTexto, limparCacheEvolution,
  evolutionProcessedMessageIds, evolutionLastReplyByNumber,
  mercadoPagoService,
  paymentSyncService: mercadoPagoPaymentSyncService,
  enviarWhatsappPedido,
}));

app.use(require('./routes/uber-webhook')({
  pool,
  webhookToken: UBER_DIRECT_WEBHOOK_TOKEN,
  IS_PRODUCTION
}));

// ============================================
// SSE — acompanhamento de pedido em tempo real
// ============================================
app.use(require('./routes/pedidos-stream')({ autenticarToken }));

// ============================================
// ROTAS DE TESTE/MONITORAMENTO (routes/health.js)
// ============================================
app.use(require('./routes/health')({ protegerMetrics }));

// ============================================
// ROTAS DE AVALIAÇÕES (routes/avaliacoes.js)
// ============================================
app.use(require('./routes/avaliacoes')({ autenticarToken, rateLimit, rateLimitValidateOptions }));
app.use(require('./routes/shared-carts')({ autenticarToken }));

if (SHOULD_SERVE_REACT && fs.existsSync(REACT_DIST_INDEX)) {
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(REACT_DIST_INDEX);
  });
} else {
  app.get('/', (req, res) => {
    if (FRONTEND_APP_URL) {
      return res.redirect(FRONTEND_APP_URL);
    }

    return res.status(200).send(
      '<h1>Bom Filho API online</h1><p>Frontend nao esta hospedado neste servico.</p><p>Use <a href="/api">/api</a> para status da API.</p>'
    );
  });

  app.get(/^\/(?!api).*/, (req, res) => {
    if (FRONTEND_APP_URL) {
      const caminho = String(req.originalUrl || req.url || '/').trim() || '/';
      const destinoBase = FRONTEND_APP_URL.replace(/\/+$/, '');
      return res.redirect(`${destinoBase}${caminho.startsWith('/') ? caminho : `/${caminho}`}`);
    }

    return res.status(404).send('Rota de frontend indisponivel neste servico.');
  });
}

// ============================================
// ADMIN FASE 2 — Auditoria, Clientes, Fila, Conciliação, Relatórios
// ============================================

// Helper: registrar ação de auditoria
async function registrarAuditoria(pool, { acao, entidade, entidade_id, detalhes, admin_usuario, ip }) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (acao, entidade, entidade_id, detalhes, admin_usuario, ip) VALUES (?, ?, ?, ?, ?, ?)`,
      [acao, entidade || null, entidade_id || null, detalhes ? JSON.stringify(detalhes) : null, admin_usuario || 'admin', ip || null]
    );
  } catch (err) {
    // Registrar falha de auditoria de forma visível sem derrubar o fluxo principal
    const detalhesErro = { acao, entidade, entidade_id, erro: err?.message || 'desconhecido', code: err?.code };
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      logger.warn('⚠️ Tabela admin_audit_log não existe. Execute as migrations: node migrate.js', detalhesErro);
    } else {
      logger.error('❌ Falha ao registrar auditoria:', detalhesErro);
    }
  }
}

// ============================================
// SENTRY ERROR HANDLER (antes do listen)
// ============================================
app.use(sentryErrorHandler());

app.use((err, req, res, next) => {
  if (!err) {
    return next();
  }

  const isTimeoutError =
    err.code === 'ETIMEDOUT'
    || err.timeout === true
    || String(err.message || '').toLowerCase().includes('response timeout');

  if (isTimeoutError) {
    logger.error('HTTP_REQUEST_TIMEOUT', {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      timeout_message: err.message,
      ip: req.ip
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(503).json({
      erro: 'O servidor demorou para responder. Tente novamente em instantes.',
      codigo: 'REQUEST_TIMEOUT',
      request_id: req.requestId
    });
  }

  const status = Number(err.status || err.statusCode || 500);
  const mensagem = status >= 500
    ? 'Erro interno ao processar a requisição.'
    : String(err.message || 'Não foi possível concluir a requisição.');

  logger.error('HTTP_UNHANDLED_ERROR', {
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status,
    error_message: err.message,
    error_code: err.code,
    ip: req.ip
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json({
    erro: mensagem,
    request_id: req.requestId
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const server = app.listen(PORT, () => {
  logger.info(`\n🚀 Servidor rodando na porta ${PORT}`);
  logger.info(`📍 URL: http://localhost:${PORT}`);
  logger.info(`🌍 CORS_ORIGINS: ${CORS_ORIGINS.join(', ') || '(nenhuma origem explícita)'}`);
  logger.info(`💳 Mercado Pago: access_token=${config.MP_ACCESS_TOKEN ? '✅ configurado' : '❌ ausente'} | env=${config.MP_ENV} | notification_url=${config.MP_NOTIFICATION_URL ? '✅' : 'fallback(BASE_URL)'} | webhook_secret=${config.MP_WEBHOOK_SECRET ? '✅' : '❌'}`);
  logger.info(`🍪 Cookies: secure=${COOKIE_SECURE} sameSite=${COOKIE_SAME_SITE} domain=${COOKIE_DOMAIN || '(sem domínio)'}`);
  logger.info(`\n📚 Endpoints disponíveis:`);
  logger.info(`   POST   /api/auth/cadastro`);
  logger.info(`   POST   /api/auth/login`);
  logger.info(`   GET    /api/auth/me`);
  logger.info(`   GET    /api/endereco`);
  logger.info(`   POST   /api/endereco`);
  logger.info(`   GET    /api/produtos`);
  logger.info(`   GET    /api/produtos/:id`);
  logger.info(`   GET    /api/frete/simular?cep=68740180&veiculo=moto`);
  logger.info(`   POST   /api/pedidos`);
  logger.info(`   GET    /api/pedidos`);
  logger.info(`   GET    /api/pedidos/:id`);
  logger.info(`   GET    /api/avaliacoes/:produto_id`);
  logger.info(`   POST   /api/avaliacoes`);
  if (SHOULD_SERVE_REACT) {
    if (fs.existsSync(REACT_DIST_INDEX)) {
      logger.info(`\n🧩 Frontend React servido em: http://localhost:${PORT}`);
    } else {
      logger.info(`\n⚠️ Build React não encontrada em frontend-react/dist (rode: cd frontend-react && npm run build)`);
    }
  }
  logger.info(`\n✅ Pronto para receber requisições!\n`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

// ============================================
// AUTO-EXPIRAR PEDIDOS PENDENTES (a cada 15 min)
// ============================================
const ORDER_EXPIRE_HOURS = 2;
const ORDER_EXPIRE_INTERVAL_MS = 15 * 60 * 1000;

async function expirePendingOrders() {
  try {
    const query = DB_DIALECT === 'postgres'
      ? `UPDATE pedidos SET status = 'expirado', atualizado_em = NOW()
         WHERE status = 'pendente' AND criado_em < NOW() - INTERVAL '${ORDER_EXPIRE_HOURS} hours'`
      : `UPDATE pedidos SET status = 'expirado', atualizado_em = NOW()
         WHERE status = 'pendente' AND criado_em < DATE_SUB(NOW(), INTERVAL ${ORDER_EXPIRE_HOURS} HOUR)`;
    const [result] = await pool.query(query);
    const affected = result?.affectedRows || result?.rowCount || 0;
    if (affected > 0) {
      logger.info(`🕐 Auto-expirou ${affected} pedido(s) pendente(s) com mais de ${ORDER_EXPIRE_HOURS}h`);
    }
  } catch (err) {
    logger.error('Erro ao expirar pedidos pendentes:', err);
  }
}

setInterval(expirePendingOrders, ORDER_EXPIRE_INTERVAL_MS);
setTimeout(expirePendingOrders, 10000); // run once shortly after startup

// Tratamento de erros não capturados com graceful shutdown
let shuttingDown = false;
function gracefulShutdown(reason, err) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.error(`❌ ${reason}:`, err);
  logger.info('🛑 Iniciando encerramento gracioso...');

  // Parar de aceitar novas conexões
  try {
    server.close(() => {
      logger.info('✅ Servidor HTTP encerrado.');
    });
  } catch (_) {
    // Ignora erro de close em shutdown para manter encerramento resiliente.
  }

  // Aguardar requests em andamento e fechar pool
  const forceExitTimeout = setTimeout(() => {
    logger.error('⚠️ Timeout de graceful shutdown atingido. Forçando saída.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  pool.end()
    .then(() => {
      logger.info('✅ Pool MySQL encerrado.');
      process.exit(1);
    })
    .catch(() => {
      process.exit(1);
    });
}

process.on('unhandledRejection', (reason) => {
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
  logger.error('⚠️ Promise rejeitada sem catch (não fatal):', reason);
});

process.on('uncaughtException', (err) => {
  captureException(err);
  gracefulShutdown('Erro não capturado (Exception)', err);
});

process.on('SIGTERM', () => {
  logger.info('📥 SIGTERM recebido. Iniciando encerramento gracioso...');
  gracefulShutdown('SIGTERM', new Error('Processo recebeu SIGTERM'));
});

process.on('SIGINT', () => {
  logger.info('📥 SIGINT recebido. Encerrando...');
  gracefulShutdown('SIGINT', new Error('Processo recebeu SIGINT'));
});
