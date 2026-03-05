require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const fetch = global.fetch || require('node-fetch');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIST_PATH = path.resolve(__dirname, '..', 'frontend-react', 'dist');
const REACT_DIST_INDEX = path.join(FRONTEND_DIST_PATH, 'index.html');
const SHOULD_SERVE_REACT = process.env.SERVE_REACT !== 'false';

// Configuração Evolution API (WhatsApp)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'loja';

// Configuração PagBank
const PAGBANK_TOKEN = process.env.PAGBANK_TOKEN;
const PAGBANK_WEBHOOK_TOKEN = String(process.env.PAGBANK_WEBHOOK_TOKEN || '').trim();
const PAGBANK_API_URL = process.env.PAGBANK_ENV === 'production' 
  ? 'https://api.pagseguro.com' 
  : 'https://sandbox.api.pagseguro.com';

const JWT_SECRET = String(process.env.JWT_SECRET || '');
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const DIAGNOSTIC_TOKEN = String(process.env.DIAGNOSTIC_TOKEN || '').trim();
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const USER_AUTH_COOKIE_NAME = 'bf_access_token';
const ADMIN_AUTH_COOKIE_NAME = 'bf_admin_token';
const CSRF_COOKIE_NAME = 'bf_csrf_token';
const USER_AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ADMIN_AUTH_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
const CSRF_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim() || null;

if (JWT_SECRET.length < 32) {
  const aviso = 'JWT_SECRET deve ter no mínimo 32 caracteres para segurança adequada.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(aviso);
  }
  console.warn(`⚠️ ${aviso}`);
}

function normalizarIp(ip) {
  return String(ip || '').replace('::ffff:', '').trim();
}

function getCookieOptions({ httpOnly = true, maxAge } = {}) {
  const options = {
    httpOnly,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    path: '/'
  };

  if (Number.isFinite(maxAge)) {
    options.maxAge = maxAge;
  }

  if (COOKIE_DOMAIN) {
    options.domain = COOKIE_DOMAIN;
  }

  return options;
}

function definirCookieAuth(res, nome, token, maxAge) {
  res.cookie(nome, token, getCookieOptions({ httpOnly: true, maxAge }));
}

function limparCookie(res, nome, { httpOnly = true } = {}) {
  res.clearCookie(nome, getCookieOptions({ httpOnly }));
}

function emitirCsrfToken(res) {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCookieOptions({ httpOnly: false, maxAge: CSRF_COOKIE_MAX_AGE }));
  return csrfToken;
}

function isOriginPermitida(origin) {
  if (!origin) {
    return true;
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }

  return CORS_ORIGINS.includes(origin);
}

function montarWebhookPagBankUrl({ incluirToken = true } = {}) {
  const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const webhookBase = `${baseUrl}/api/webhooks/pagbank`;

  if (incluirToken && PAGBANK_WEBHOOK_TOKEN) {
    return `${webhookBase}?token=${encodeURIComponent(PAGBANK_WEBHOOK_TOKEN)}`;
  }

  return webhookBase;
}

function extrairBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return String(authHeader.slice(7)).trim();
}

function extrairTokenUsuarioRequest(req) {
  return extrairBearerToken(req) || String(req.cookies?.[USER_AUTH_COOKIE_NAME] || '').trim();
}

function extrairTokenAdminRequest(req) {
  return extrairBearerToken(req) || String(req.cookies?.[ADMIN_AUTH_COOKIE_NAME] || '').trim();
}

function extrairTokenDiagnostico(req) {
  const headerToken = req.headers['x-diagnostic-token'];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  return String(headerToken || bearerToken || '').trim();
}

function protegerDiagnostico(req, res, next) {
  const ip = normalizarIp(req.ip || req.socket?.remoteAddress);
  const acessoLocal = ip === '127.0.0.1' || ip === '::1';

  if (!acessoLocal) {
    return res.status(403).json({ erro: 'Rota de diagnóstico permitida apenas localmente' });
  }

  if (DIAGNOSTIC_TOKEN) {
    const token = extrairTokenDiagnostico(req);
    if (!token || token !== DIAGNOSTIC_TOKEN) {
      return res.status(401).json({ erro: 'Token de diagnóstico inválido' });
    }
  }

  return next();
}

function compararTextoSegura(valorA, valorB) {
  const bufferA = Buffer.from(String(valorA || ''));
  const bufferB = Buffer.from(String(valorB || ''));

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function criarErroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.httpStatus = status;
  return erro;
}

function validarWebhookPagBank(req) {
  if (!PAGBANK_WEBHOOK_TOKEN) {
    return true;
  }

  const tokenHeader = String(req.headers['x-webhook-token'] || '').trim();
  const tokenQuery = String(req.query?.token || '').trim();

  return tokenHeader === PAGBANK_WEBHOOK_TOKEN || tokenQuery === PAGBANK_WEBHOOK_TOKEN;
}

// Cache simples de diagnóstico do PagBank
let pagbankLastAuthCheck = {
  checkedAt: null,
  ok: null,
  status: 'not_checked',
  httpStatus: null,
  message: null
};

if (PAGBANK_TOKEN) {
  console.log('✅ PagBank configurado com sucesso!');
  // Check não-bloqueante para avisar cedo se a credencial está inválida
  setTimeout(() => {
    verificarCredencialPagBank()
      .then((r) => {
        if (r.ok) {
          console.log(`✅ PagBank token OK (${r.message})`);
        } else {
          console.warn(`⚠️ PagBank token inválido/erro (${r.status}): ${r.message}`);
        }
      })
      .catch((e) => console.warn('⚠️ Falha ao checar token PagBank:', e?.message));
  }, 0);
} else {
  console.warn('⚠️ PAGBANK_TOKEN não configurado; PIX desabilitado.');
}

// ============================================
// MIDDLEWARES
// ============================================
app.disable('x-powered-by');

if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin(origin, callback) {
    if (isOriginPermitida(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-diagnostic-token', 'x-webhook-token', 'x-csrf-token'],
  maxAge: 600
}));

app.use(bodyParser.json({ limit: '200kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de autenticação. Aguarde 15 minutos.' }
});

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login admin. Aguarde 15 minutos.' }
});

app.use('/api', apiLimiter);

const csrfIgnoredPaths = new Set([
  '/api/auth/login',
  '/api/auth/cadastro',
  '/api/admin/login',
  '/api/pagbank/test-pix'
]);

const metodosMutaveis = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

app.use((req, res, next) => {
  const pathAtual = req.path || '';

  if (!pathAtual.startsWith('/api/')) {
    return next();
  }

  if (!metodosMutaveis.has(req.method)) {
    return next();
  }

  if (pathAtual.startsWith('/api/webhooks/')) {
    return next();
  }

  if (csrfIgnoredPaths.has(pathAtual)) {
    return next();
  }

  if (extrairBearerToken(req)) {
    return next();
  }

  const csrfCookie = String(req.cookies?.[CSRF_COOKIE_NAME] || '').trim();
  const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();

  if (!csrfCookie || !csrfHeader || !compararTextoSegura(csrfCookie, csrfHeader)) {
    return res.status(403).json({ erro: 'Falha de validação CSRF' });
  }

  return next();
});

if (SHOULD_SERVE_REACT && fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));
}

// Diagnóstico PagBank: valida token e mostra URLs configuradas
app.get('/api/pagbank/status', protegerDiagnostico, async (req, res) => {
  try {
    const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000');
    const webhookUrl = montarWebhookPagBankUrl({ incluirToken: false });
    const token = process.env.PAGBANK_TOKEN || '';

    // Atualiza o cache se nunca foi checado ou se está velho
    const shouldRefresh = !pagbankLastAuthCheck.checkedAt ||
      (Date.now() - Date.parse(pagbankLastAuthCheck.checkedAt)) > 60_000;

    if (shouldRefresh) {
      await verificarCredencialPagBank();
    }

    res.json({
      pagbank_env: process.env.PAGBANK_ENV || 'sandbox',
      pagbank_api_url: PAGBANK_API_URL,
      base_url: baseUrl,
      webhook_url: webhookUrl,
      token_present: !!token,
      webhook_protected: !!PAGBANK_WEBHOOK_TOKEN,
      auth_check: pagbankLastAuthCheck
    });
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao verificar PagBank', detalhe: e?.message });
  }
});

// Teste de criação de pedido PIX no PagBank (diagnóstico)
app.post('/api/pagbank/test-pix', protegerDiagnostico, async (req, res) => {
  try {
    const valueReais = Number(req.body?.valor_reais ?? 1.00);
    const valor = Number.isFinite(valueReais) ? Math.max(0.5, valueReais) : 1.0;

    // PagBank exige customer.tax_id (CPF/CNPJ) para criação do pedido.
    // Para diagnóstico no sandbox, aceitamos enviar um CPF de teste se não for informado.
    const taxIdRaw = req.body?.tax_id ?? req.body?.cpf;
    const taxIdDigits = (taxIdRaw || '').toString().replace(/\D/g, '');
    const taxId = taxIdDigits || (process.env.PAGBANK_ENV === 'production' ? null : '12345678909');

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

    return res.json({
      ok: true,
      pagbank_env: process.env.PAGBANK_ENV || 'sandbox',
      notification_url: montarWebhookPagBankUrl({ incluirToken: false }),
      webhook_protected: !!PAGBANK_WEBHOOK_TOKEN,
      pagbank_order_id: resultadoPix?.id || null,
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

// ============================================
// CONEXÃO COM O BANCO DE DADOS
// ============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 50, // Aumentado de 10 para 50
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Testar conexão
pool.getConnection()
  .then(connection => {
    console.log('✅ Conectado ao MySQL com sucesso!');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao MySQL:', err.message);
  });

// ============================================
// FUNÇÕES DE APOIO - WHATSAPP
// ============================================
function formatarTelefoneWhatsapp(telefone) {
  const digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

// Mapeia status do PagBank para status interno do pedido
function mapearStatusPedido(statusPagBank) {
  if (statusPagBank === 'PAID') return 'pago';
  if (statusPagBank === 'WAITING' || statusPagBank === 'IN_ANALYSIS') return 'pendente';
  if (statusPagBank === 'DECLINED' || statusPagBank === 'CANCELED') return 'cancelado';
  return 'pendente';
}

async function verificarCredencialPagBank() {
  if (!PAGBANK_TOKEN) {
    pagbankLastAuthCheck = {
      checkedAt: new Date().toISOString(),
      ok: false,
      status: 'missing_token',
      httpStatus: null,
      message: 'PAGBANK_TOKEN ausente'
    };
    return pagbankLastAuthCheck;
  }

  const headers = {
    'Authorization': `Bearer ${PAGBANK_TOKEN}`,
    'Content-Type': 'application/json'
  };

  // 1) Tenta um GET sem efeitos colaterais.
  // Se não existir/for proibido, cai para um POST inválido só pra validar autenticação.
  try {
    const respGet = await fetch(`${PAGBANK_API_URL}/orders`, { method: 'GET', headers });
    if (respGet.ok) {
      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: true,
        status: 'ok',
        httpStatus: respGet.status,
        message: 'Credencial válida (GET /orders)'
      };
      return pagbankLastAuthCheck;
    }

    if (respGet.status === 401) {
      const text = await respGet.text();
      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: false,
        status: 'unauthorized',
        httpStatus: respGet.status,
        message: text || 'UNAUTHORIZED'
      };
      return pagbankLastAuthCheck;
    }
  } catch (e) {
    // Ignora e tenta fallback
  }

  // 2) Fallback: POST inválido, esperando 400 (token ok) ou 401 (token inválido)
  try {
    const respPost = await fetch(`${PAGBANK_API_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });

    const text = await respPost.text();

    if (respPost.status === 401) {
      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: false,
        status: 'unauthorized',
        httpStatus: respPost.status,
        message: text || 'UNAUTHORIZED'
      };
      return pagbankLastAuthCheck;
    }

    if (respPost.status === 400) {
      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: true,
        status: 'ok',
        httpStatus: respPost.status,
        message: 'Credencial parece válida (POST /orders retornou 400 por payload inválido)'
      };
      return pagbankLastAuthCheck;
    }

    pagbankLastAuthCheck = {
      checkedAt: new Date().toISOString(),
      ok: respPost.ok,
      status: respPost.ok ? 'ok' : 'unknown',
      httpStatus: respPost.status,
      message: text || `Resposta inesperada (${respPost.status})`
    };
    return pagbankLastAuthCheck;
  } catch (e) {
    pagbankLastAuthCheck = {
      checkedAt: new Date().toISOString(),
      ok: false,
      status: 'network_error',
      httpStatus: null,
      message: e?.message || 'Erro de rede'
    };
    return pagbankLastAuthCheck;
  }
}

async function obterPedidoPagBank(orderId) {
  if (!PAGBANK_TOKEN) return null;
  if (!orderId) return null;
  const response = await fetch(`${PAGBANK_API_URL}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${PAGBANK_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao consultar PagBank order ${orderId}: ${response.status} - ${errorText}`);
  }
  return await response.json();
}

async function criarPagamentoPix({ pedidoId, total, descricao, email, nome, taxId }) {
  if (!PAGBANK_TOKEN) {
    throw new Error('PAGBANK_TOKEN ausente');
  }

  const taxIdDigits = (taxId || '').toString().replace(/\D/g, '');
  if (!taxIdDigits) {
    throw new Error('CPF/CNPJ ausente (customer.tax_id) - necessário para gerar PIX PagBank');
  }

  // PagBank costuma exigir `expiration_date` com offset (ex.: -03:00).
  // Para evitar rejeição por "data no passado", enviamos o horário LOCAL com o offset real da máquina.
  const formatIsoLocalWithOffset = (date) => {
    const pad2 = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());

    // getTimezoneOffset() retorna minutos a ADICIONAR no local para virar UTC.
    // Ex.: Brasil (-03) => 180. ISO precisa de -03:00.
    const tz = -date.getTimezoneOffset();
    const sign = tz >= 0 ? '+' : '-';
    const abs = Math.abs(tz);
    const oh = pad2(Math.floor(abs / 60));
    const om = pad2(abs % 60);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}.000${sign}${oh}:${om}`;
  };

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
        unit_amount: Math.round(Number(total || 0) * 100) // Valor em centavos
      }
    ],
    qr_codes: [
      {
        amount: {
          value: Math.round(Number(total || 0) * 100) // Valor em centavos
        },
        expiration_date: expirationDate
      }
    ],
    notification_urls: [
      montarWebhookPagBankUrl()
    ]
  };

  console.log('🔔 PagBank notification URL:', payload.notification_urls?.[0]);

  const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const response = await fetch(`${PAGBANK_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAGBANK_TOKEN}`,
      'x-idempotency-key': idempotencyKey,
      'accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro PagBank: ${response.status} - ${errorText}`);
  }

  const resultado = await response.json();
  return resultado;
}

async function enviarWhatsappPedido({ telefone, nome, pedidoId, total, pixCodigo, mensagemExtra }) {
  if (!EVOLUTION_API_KEY) {
    console.warn('⚠️ Evolution API não configurada. WhatsApp desabilitado.');
    return; // Integração não configurada
  }

  const numero = formatarTelefoneWhatsapp(telefone);
  if (!numero) return;
  if (typeof fetch !== 'function') {
    console.warn('Fetch indisponível; mensagem de WhatsApp não enviada.');
    return;
  }

  const mensagemBase = mensagemExtra || `Recebemos o seu pedido #${pedidoId}! Total: R$ ${Number(total || 0).toFixed(2)}.`;
  const detalhePix = pixCodigo ? ` Código PIX: ${pixCodigo}` : '';
  const mensagem = `Olá ${nome || 'cliente'}! ${mensagemBase}${detalhePix}`;
  
  // URL da Evolution API
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  const payload = {
    number: numero,
    text: mensagem
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const erroTexto = await resp.text();
      console.error('❌ Erro ao enviar WhatsApp:', erroTexto);
    } else {
      const resultado = await resp.json();
      console.log('✅ WhatsApp enviado:', resultado);
    }
  } catch (erro) {
    console.error('❌ Erro ao enviar WhatsApp:', erro.message);
  }
}

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================
const autenticarToken = (req, res, next) => {
  const token = extrairTokenUsuarioRequest(req);

  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) {
      return res.status(403).json({ erro: 'Token inválido' });
    }
    req.usuario = usuario;
    next();
  });
};

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_LOCAL_ONLY = process.env.ADMIN_LOCAL_ONLY !== 'false';

function extrairIpRequisicao(req) {
  return normalizarIp(req.ip || req.socket?.remoteAddress || '');
}

function isIpLocal(ip) {
  const ipNormalizado = normalizarIp(ip);
  return ipNormalizado === '127.0.0.1' || ipNormalizado === '::1' || ipNormalizado === 'localhost';
}

const exigirAcessoLocalAdmin = (req, res, next) => {
  if (!ADMIN_LOCAL_ONLY) {
    return next();
  }

  const ip = extrairIpRequisicao(req);
  if (!isIpLocal(ip)) {
    return res.status(403).json({ erro: 'Acesso administrativo permitido apenas no computador da loja' });
  }

  next();
};

const autenticarAdminToken = (req, res, next) => {
  const token = extrairTokenAdminRequest(req);

  if (!token) {
    return res.status(401).json({ erro: 'Token admin não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err || !payload || payload.role !== 'admin') {
      return res.status(403).json({ erro: 'Token admin inválido' });
    }

    req.admin = payload;
    next();
  });
};

let produtosColumnsCache = null;

async function obterColunasProdutos() {
  if (produtosColumnsCache) {
    return produtosColumnsCache;
  }

  const [colunas] = await pool.query('SHOW COLUMNS FROM produtos');
  produtosColumnsCache = new Set(colunas.map((coluna) => String(coluna.Field || '').toLowerCase()));
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

async function buscarProdutoOpenFoodFacts(codigo) {
  const resposta = await fetch(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json`);
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

async function buscarProdutoUpcItemDb(codigo) {
  const resposta = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigo}`);
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
// ROTAS DE AUTENTICAÇÃO
// ============================================

// Cadastro de usuário
app.post('/api/auth/cadastro', authLimiter, async (req, res) => {
  try {
    const { nome, email, senha, telefone, whatsapp_opt_in } = req.body;
    const optIn = !!whatsapp_opt_in;

    if (!nome || !email || !senha || !telefone) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    if (!/^\S+@\S+\.\S+$/.test(String(email))) {
      return res.status(400).json({ erro: 'E-mail inválido' });
    }

    if (String(senha).length < 8) {
      return res.status(400).json({ erro: 'A senha deve ter ao menos 8 caracteres' });
    }

    // Verificar se o email já existe
    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length > 0) {
      return res.status(409).json({ erro: 'E-mail já cadastrado' });
    }

    // Criptografar senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Inserir usuário
    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nome, email, senha, telefone, whatsapp_opt_in) VALUES (?, ?, ?, ?, ?)',
      [nome, email, senhaHash, telefone, optIn]
    );

    // Gerar token
    const token = jwt.sign(
      { id: resultado.insertId, email: email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const csrfToken = emitirCsrfToken(res);
    definirCookieAuth(res, USER_AUTH_COOKIE_NAME, token, USER_AUTH_COOKIE_MAX_AGE);

    res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso',
      csrfToken,
      usuario: {
        id: resultado.insertId,
        nome: nome,
        email: email,
        telefone: telefone,
        whatsapp_opt_in: optIn
      }
    });
  } catch (erro) {
    console.error('Erro ao cadastrar usuário:', erro);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
    }

    // Buscar usuário
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
    }

    const usuario = usuarios[0];

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
    }

    // Gerar token
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const csrfToken = emitirCsrfToken(res);
    definirCookieAuth(res, USER_AUTH_COOKIE_NAME, token, USER_AUTH_COOKIE_MAX_AGE);

    res.json({
      mensagem: 'Login realizado com sucesso',
      csrfToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        whatsapp_opt_in: usuario.whatsapp_opt_in === 1 || usuario.whatsapp_opt_in === true
      }
    });
  } catch (erro) {
    console.error('Erro ao fazer login:', erro);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// Login administrativo (somente acesso local)
app.post('/api/admin/login', adminAuthLimiter, exigirAcessoLocalAdmin, async (req, res) => {
  try {
    const { usuario, senha } = req.body || {};

    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ erro: 'ADMIN_PASSWORD não configurado no servidor' });
    }

    if (!usuario || !senha) {
      return res.status(400).json({ erro: 'Usuário e senha admin são obrigatórios' });
    }

    if (!compararTextoSegura(String(usuario).trim(), ADMIN_USER) || !compararTextoSegura(String(senha), ADMIN_PASSWORD)) {
      return res.status(401).json({ erro: 'Credenciais admin inválidas' });
    }

    const token = jwt.sign(
      { role: 'admin', usuario: ADMIN_USER },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const csrfToken = emitirCsrfToken(res);
    definirCookieAuth(res, ADMIN_AUTH_COOKIE_NAME, token, ADMIN_AUTH_COOKIE_MAX_AGE);

    return res.json({
      mensagem: 'Login admin realizado com sucesso',
      usuario: ADMIN_USER,
      csrfToken
    });
  } catch (erro) {
    console.error('Erro no login admin:', erro);
    return res.status(500).json({ erro: 'Erro ao fazer login admin' });
  }
});

app.get('/api/auth/csrf', (req, res) => {
  const csrfToken = emitirCsrfToken(res);
  return res.json({ csrfToken });
});

app.post('/api/auth/logout', (req, res) => {
  limparCookie(res, USER_AUTH_COOKIE_NAME, { httpOnly: true });
  limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
  return res.json({ mensagem: 'Logout realizado com sucesso' });
});

app.get('/api/admin/me', exigirAcessoLocalAdmin, autenticarAdminToken, (req, res) => {
  return res.json({ admin: { usuario: req.admin?.usuario || ADMIN_USER } });
});

app.post('/api/admin/logout', exigirAcessoLocalAdmin, (req, res) => {
  limparCookie(res, ADMIN_AUTH_COOKIE_NAME, { httpOnly: true });
  limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
  return res.json({ mensagem: 'Logout admin realizado com sucesso' });
});

// Obter dados do usuário logado
app.get('/api/auth/me', autenticarToken, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({ usuario: usuarios[0] });
  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
    res.status(500).json({ erro: 'Erro ao buscar usuário' });
  }
});

// Atualizar telefone e consentimento de WhatsApp
app.post('/api/usuario/whatsapp', autenticarToken, async (req, res) => {
  try {
    const { telefone, whatsapp_opt_in } = req.body;

    if (!telefone) {
      return res.status(400).json({ erro: 'Telefone é obrigatório' });
    }

    const numeroLimpo = telefone.trim();
    const optIn = !!whatsapp_opt_in;

    await pool.query(
      'UPDATE usuarios SET telefone = ?, whatsapp_opt_in = ? WHERE id = ?',
      [numeroLimpo, optIn, req.usuario.id]
    );

    res.json({ mensagem: 'Preferências de WhatsApp atualizadas', whatsapp_opt_in: optIn, telefone: numeroLimpo });
  } catch (erro) {
    console.error('Erro ao atualizar WhatsApp:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar preferências de WhatsApp' });
  }
});

// ============================================
// ROTAS DE ENDEREÇOS
// ============================================

// Obter endereço do usuário
app.get('/api/endereco', autenticarToken, async (req, res) => {
  try {
    const [enderecos] = await pool.query(
      'SELECT * FROM enderecos WHERE usuario_id = ?',
      [req.usuario.id]
    );

    if (enderecos.length === 0) {
      return res.json({ endereco: null });
    }

    res.json({ endereco: enderecos[0] });
  } catch (erro) {
    console.error('Erro ao buscar endereço:', erro);
    res.status(500).json({ erro: 'Erro ao buscar endereço' });
  }
});

// Salvar/atualizar endereço
app.post('/api/endereco', autenticarToken, async (req, res) => {
  try {
    const { rua, numero, bairro, cidade, estado, cep } = req.body;

    if (!rua || !numero || !bairro || !cidade || !estado || !cep) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    // Verificar se já existe endereço
    const [enderecosExistentes] = await pool.query(
      'SELECT id FROM enderecos WHERE usuario_id = ?',
      [req.usuario.id]
    );

    if (enderecosExistentes.length > 0) {
      // Atualizar
      await pool.query(
        'UPDATE enderecos SET rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ? WHERE usuario_id = ?',
        [rua, numero, bairro, cidade, estado, cep, req.usuario.id]
      );
    } else {
      // Inserir
      await pool.query(
        'INSERT INTO enderecos (usuario_id, rua, numero, bairro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.usuario.id, rua, numero, bairro, cidade, estado, cep]
      );
    }

    res.json({ mensagem: 'Endereço salvo com sucesso' });
  } catch (erro) {
    console.error('Erro ao salvar endereço:', erro);
    res.status(500).json({ erro: 'Erro ao salvar endereço' });
  }
});

// ============================================
// ROTAS DE PRODUTOS
// ============================================

// Listar todos os produtos ativos
app.get('/api/produtos', async (req, res) => {
  try {
    const colunas = await obterColunasProdutos();
    const campos = [
      'id',
      'nome',
      'descricao',
      'marca',
      'preco',
      'unidade',
      'categoria',
      'emoji',
      'estoque',
      'validade'
    ];

    if (colunas.has('codigo_barras')) {
      campos.push('codigo_barras');
    }

    if (colunas.has('imagem_url')) {
      campos.push('imagem_url AS imagem');
    }

    const [produtos] = await pool.query(
      `SELECT ${campos.join(', ')} FROM produtos WHERE ativo = TRUE ORDER BY categoria, nome`
    );
    res.json({ produtos: produtos });
  } catch (erro) {
    console.error('Erro ao buscar produtos:', erro);
    res.status(500).json({ erro: 'Erro ao buscar produtos' });
  }
});

app.get('/api/admin/produtos/barcode/:codigo', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const codigo = String(req.params.codigo || '').replace(/\D/g, '');
    if (codigo.length < 8) {
      return res.status(400).json({ erro: 'Código de barras inválido' });
    }

    const externoOpenFoodFacts = await buscarProdutoOpenFoodFacts(codigo);
    if (externoOpenFoodFacts) {
      return res.json(externoOpenFoodFacts);
    }

    const externoUpcItemDb = await buscarProdutoUpcItemDb(codigo);
    if (externoUpcItemDb) {
      return res.json(externoUpcItemDb);
    }

    const colunas = await obterColunasProdutos();
    if (colunas.has('codigo_barras')) {
      const campoImagem = colunas.has('imagem_url') ? 'imagem_url AS imagem, ' : '';
      const [locais] = await pool.query(
        `SELECT id, nome, descricao, marca, categoria, emoji, ${campoImagem}codigo_barras
         FROM produtos
         WHERE codigo_barras = ?
         LIMIT 1`,
        [codigo]
      );

      if (locais.length > 0) {
        return res.json({ fonte: 'local', produto: locais[0] });
      }
    }

    return res.status(404).json({ erro: 'Produto não encontrado em APIs externas nem na base local' });
  } catch (erro) {
    console.error('Erro ao buscar produto por código de barras:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar produto por código de barras' });
  }
});

// Buscar produto por ID
app.get('/api/produtos/:id', async (req, res) => {
  try {
    const [produtos] = await pool.query(
      'SELECT * FROM produtos WHERE id = ? AND ativo = TRUE',
      [req.params.id]
    );

    if (produtos.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    res.json({ produto: produtos[0] });
  } catch (erro) {
    console.error('Erro ao buscar produto:', erro);
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

// Cadastrar produto (admin)
app.post('/api/admin/produtos', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const {
      nome,
      preco,
      unidade,
      categoria,
      emoji,
      estoque,
      descricao,
      marca,
      codigo_barras,
      imagem
    } = req.body;

    if (!nome || !preco || !unidade || !categoria) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const colunas = await obterColunasProdutos();
    const insertCols = ['nome', 'preco', 'unidade', 'categoria', 'emoji', 'estoque', 'ativo'];
    const valores = [nome, preco, unidade, categoria, emoji || '📦', estoque || 0, true];

    if (colunas.has('descricao')) {
      insertCols.push('descricao');
      valores.push(descricao || null);
    }

    if (colunas.has('marca')) {
      insertCols.push('marca');
      valores.push(marca || null);
    }

    if (colunas.has('codigo_barras')) {
      insertCols.push('codigo_barras');
      valores.push(codigo_barras || null);
    }

    if (colunas.has('imagem_url')) {
      insertCols.push('imagem_url');
      valores.push(imagem || null);
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    const [resultado] = await pool.query(
      `INSERT INTO produtos (${insertCols.join(', ')}) VALUES (${placeholders})`,
      valores
    );

    res.status(201).json({
      mensagem: 'Produto cadastrado com sucesso',
      produto_id: resultado.insertId
    });
  } catch (erro) {
    console.error('Erro ao cadastrar produto:', erro);
    res.status(500).json({ erro: 'Erro ao cadastrar produto' });
  }
});

// Importação em massa de produtos (admin)
app.post('/api/admin/produtos/bulk', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { produtos } = req.body;

    if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ erro: 'Lista de produtos inválida' });
    }

    await connection.beginTransaction();

    let importados = 0;
    for (const produto of produtos) {
      if (!produto.nome || !produto.preco || !produto.unidade || !produto.categoria) {
        continue; // Pular produtos inválidos
      }

      await connection.query(
        'INSERT INTO produtos (nome, preco, unidade, categoria, emoji, estoque, ativo) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
        [produto.nome, produto.preco, produto.unidade, produto.categoria, produto.emoji || '📦', produto.estoque || 0]
      );
      
      importados++;
    }

    await connection.commit();

    res.status(201).json({
      mensagem: 'Produtos importados com sucesso',
      total_importados: importados
    });
  } catch (erro) {
    await connection.rollback();
    console.error('Erro ao importar produtos:', erro);
    res.status(500).json({ erro: 'Erro ao importar produtos' });
  } finally {
    connection.release();
  }
});

// Excluir produto (admin) - soft delete
app.delete('/api/admin/produtos/:id', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE produtos SET ativo = FALSE WHERE id = ?',
      [req.params.id]
    );

    res.json({ mensagem: 'Produto excluído com sucesso' });
  } catch (erro) {
    console.error('Erro ao excluir produto:', erro);
    res.status(500).json({ erro: 'Erro ao excluir produto' });
  }
});

// ============================================
// ROTAS DE PEDIDOS
// ============================================

// Gerar QR Code PIX (PagBank) para um pedido existente
app.post('/api/pagamentos/pix', autenticarToken, async (req, res) => {
  try {
    const { pedido_id } = req.body;
    const taxIdRaw = req.body?.tax_id ?? req.body?.cpf;
    const taxIdDigits = (taxIdRaw || '').toString().replace(/\D/g, '');
    const taxId = taxIdDigits || (process.env.PAGBANK_ENV === 'production' ? null : '12345678909');

    if (!PAGBANK_TOKEN) {
      return res.status(503).json({ erro: 'PagBank não configurado' });
    }

    if (!pedido_id) {
      return res.status(400).json({ erro: 'pedido_id é obrigatório' });
    }

    if (!taxId) {
      return res.status(400).json({ erro: 'tax_id (CPF/CNPJ) é obrigatório para gerar PIX no PagBank em produção' });
    }

    // Buscar pedido e dados do usuário
    const [rows] = await pool.query(
      `SELECT p.id, p.total, p.status, p.forma_pagamento, u.email, u.nome
       FROM pedidos p
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.id = ? AND p.usuario_id = ?
       LIMIT 1`,
      [pedido_id, req.usuario.id]
    );

    if (!rows.length) {
      return res.status(404).json({ erro: 'Pedido não encontrado para este usuário' });
    }

    const pedido = rows[0];

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

    // Tentar persistir dados do pagamento (ignora erro se colunas não existirem)
    try {
      await pool.query(
        `UPDATE pedidos 
         SET pix_id = ?, pix_status = ?, pix_codigo = ?, pix_qrcode = ?
         WHERE id = ?`,
        [paymentId, statusPagBank, pixCodigo, pixQrCode, pedido.id]
      );
    } catch (err) {
      console.warn('Não foi possível salvar dados do PIX (faltam colunas?):', err.message);
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
    console.error('Erro ao gerar PIX:', erro);
    res.status(500).json({ erro: 'Erro ao gerar PIX' });
  }
});

// Criar pedido
app.post('/api/pedidos', autenticarToken, async (req, res) => {
  const connection = await pool.getConnection();
  let transacaoAberta = false;
  
  try {
    const { itens, forma_pagamento, cupom_id } = req.body || {};
    let usuarioPedido = null;

    if (!Array.isArray(itens) || itens.length === 0) {
      throw criarErroHttp(400, 'Carrinho vazio');
    }

    if (itens.length > 100) {
      throw criarErroHttp(400, 'Quantidade máxima de itens por pedido excedida');
    }

    const formaPagamento = String(forma_pagamento || 'pix').toLowerCase();
    const formasPermitidas = new Set(['pix', 'dinheiro', 'debito', 'credito', 'cartao']);
    if (!formasPermitidas.has(formaPagamento)) {
      throw criarErroHttp(400, 'Forma de pagamento inválida');
    }

    const itensNormalizados = itens.map((item) => ({
      produto_id: Number(item?.produto_id),
      quantidade: Math.floor(Number(item?.quantidade || 1))
    }));

    if (itensNormalizados.some((item) => !Number.isInteger(item.produto_id) || item.produto_id <= 0 || !Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > 100)) {
      throw criarErroHttp(400, 'Itens do pedido inválidos');
    }

    const idsProdutos = [...new Set(itensNormalizados.map((item) => item.produto_id))];
    const placeholdersProdutos = idsProdutos.map(() => '?').join(', ');

    const [produtos] = await connection.query(
      `SELECT id, nome, preco FROM produtos WHERE ativo = TRUE AND id IN (${placeholdersProdutos})`,
      idsProdutos
    );

    if (produtos.length !== idsProdutos.length) {
      throw criarErroHttp(400, 'Um ou mais produtos são inválidos ou estão inativos');
    }

    const produtosPorId = new Map(produtos.map((produto) => [Number(produto.id), produto]));
    const itensCalculados = itensNormalizados.map((item) => {
      const produto = produtosPorId.get(item.produto_id);
      const precoUnitario = Number(produto.preco || 0);
      const subtotal = Number((precoUnitario * item.quantidade).toFixed(2));

      return {
        produto_id: item.produto_id,
        nome: produto.nome,
        preco: precoUnitario,
        quantidade: item.quantidade,
        subtotal
      };
    });

    const total = Number(itensCalculados.reduce((acumulado, item) => acumulado + item.subtotal, 0).toFixed(2));
    if (!Number.isFinite(total) || total <= 0) {
      throw criarErroHttp(400, 'Total do pedido inválido');
    }

    const [usuarioPedidoRows] = await connection.query(
      'SELECT nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE id = ? LIMIT 1',
      [req.usuario.id]
    );
    usuarioPedido = usuarioPedidoRows.length ? usuarioPedidoRows[0] : null;

    if (!usuarioPedido) {
      throw criarErroHttp(404, 'Usuário não encontrado');
    }

    await connection.beginTransaction();
    transacaoAberta = true;

    let descontoAplicado = 0;
    let cupomIdValidado = null;

    if (cupom_id !== undefined && cupom_id !== null && String(cupom_id).trim() !== '') {
      const cupomIdNumerico = Number(cupom_id);
      if (!Number.isInteger(cupomIdNumerico) || cupomIdNumerico <= 0) {
        throw criarErroHttp(400, 'Cupom inválido');
      }

      const [cupons] = await connection.query(
        `SELECT * FROM cupons 
         WHERE id = ?
         AND ativo = TRUE
         AND (validade IS NULL OR validade >= CURDATE())
         AND (uso_maximo IS NULL OR uso_atual < uso_maximo)
         LIMIT 1`,
        [cupomIdNumerico]
      );

      if (cupons.length === 0) {
        throw criarErroHttp(400, 'Cupom inválido ou expirado');
      }

      const cupom = cupons[0];
      const valorMinimo = Number(cupom.valor_minimo || 0);
      if (total < valorMinimo) {
        throw criarErroHttp(400, `Valor mínimo do pedido para este cupom: R$ ${valorMinimo.toFixed(2)}`);
      }

      const [usados] = await connection.query(
        'SELECT id FROM cupons_usados WHERE cupom_id = ? AND usuario_id = ? LIMIT 1',
        [cupom.id, req.usuario.id]
      );

      if (usados.length > 0) {
        throw criarErroHttp(400, 'Você já utilizou este cupom');
      }

      if (cupom.tipo === 'percentual') {
        descontoAplicado = total * (Number(cupom.valor || 0) / 100);
      } else {
        descontoAplicado = Number(cupom.valor || 0);
      }

      if (descontoAplicado > total) {
        descontoAplicado = total;
      }

      descontoAplicado = Number(descontoAplicado.toFixed(2));
      cupomIdValidado = cupom.id;
    }

    const totalFinal = Number((total - descontoAplicado).toFixed(2));

    // Criar pedido
    const [pedidoResultado] = await connection.query(
      'INSERT INTO pedidos (usuario_id, total, status, forma_pagamento) VALUES (?, ?, ?, ?)',
      [req.usuario.id, totalFinal, 'pendente', formaPagamento]
    );

    const pedidoId = pedidoResultado.insertId;

    // Inserir itens do pedido
    for (const item of itensCalculados) {
      await connection.query(
        'INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, preco, quantidade, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [pedidoId, item.produto_id, item.nome, item.preco, item.quantidade, item.subtotal]
      );
    }

    // Registrar uso do cupom
    if (cupomIdValidado) {
      await connection.query(
        'UPDATE cupons SET uso_atual = uso_atual + 1 WHERE id = ?',
        [cupomIdValidado]
      );

      await connection.query(
        'INSERT INTO cupons_usados (cupom_id, usuario_id, pedido_id) VALUES (?, ?, ?)',
        [cupomIdValidado, req.usuario.id, pedidoId]
      );
    }

    await connection.commit();
    transacaoAberta = false;

    // Gerar PIX real usando PagBank se for pagamento via PIX
    let pixCodigo = null;
    let pixQrCode = null;
    let pixId = null;
    let pixErro = null;

    const taxIdRaw = req.body?.tax_id ?? req.body?.cpf;
    const taxIdDigits = (taxIdRaw || '').toString().replace(/\D/g, '');
    
    if (formaPagamento === 'pix' && PAGBANK_TOKEN) {
      try {
        const resultadoPix = await criarPagamentoPix({
          pedidoId: pedidoId,
          total: totalFinal,
          descricao: `Pedido #${pedidoId} - Bom Filho Supermercado`,
          email: usuarioPedido?.email || req.usuario?.email || 'cliente@example.com',
          nome: usuarioPedido?.nome || 'Cliente',
          taxId: taxIdDigits
        });
        
        if (resultadoPix && resultadoPix.qr_codes && resultadoPix.qr_codes.length > 0) {
          pixCodigo = resultadoPix.qr_codes[0].text; // Código PIX Copia e Cola
          pixQrCode = resultadoPix.qr_codes[0].links?.[0]?.href; // URL da imagem QR Code
          pixId = resultadoPix.id; // ID do pagamento no PagBank
          
          // Tentar atualizar pedido com informações do PIX (se colunas existirem)
          try {
            await connection.query(
              'UPDATE pedidos SET pix_id = ?, pix_codigo = ?, pix_qrcode = ?, pix_status = ? WHERE id = ?',
              [pixId, pixCodigo, pixQrCode, 'WAITING', pedidoId]
            );
          } catch (errUpdate) {
            console.warn('⚠️ Colunas pix_id/pix_codigo não existem na tabela pedidos:', errUpdate.message);
          }
        }
      } catch (erro) {
        console.error('Erro ao gerar PIX PagBank:', erro.message);
        pixErro = erro.message;
        // Gerar código simulado como fallback
        pixCodigo = '00020126580014BR.GOV.BCB.PIX' + pedidoId.toString().padStart(10, '0');
      }
    } else if (formaPagamento === 'pix') {
      // Gerar código PIX simulado se PagBank não estiver configurado
      pixCodigo = '00020126580014BR.GOV.BCB.PIX' + pedidoId.toString().padStart(10, '0');
    }

    if (usuarioPedido && usuarioPedido.whatsapp_opt_in) {
      try {
        await enviarWhatsappPedido({
          telefone: usuarioPedido.telefone,
          nome: usuarioPedido.nome,
          pedidoId: pedidoId,
          total: totalFinal,
          pixCodigo: pixCodigo
        });
      } catch (erro) {
        console.error('Falha ao disparar WhatsApp do pedido:', erro.message);
      }
    }

    res.status(201).json({
      mensagem: 'Pedido realizado com sucesso',
      pedido_id: pedidoId,
      total: totalFinal,
      desconto_aplicado: descontoAplicado,
      forma_pagamento: formaPagamento,
      pix_codigo: pixCodigo,
      pix_qrcode: pixQrCode,
      pix_id: pixId,
      pix_erro: pixErro
    });
  } catch (erro) {
    if (transacaoAberta) {
      await connection.rollback();
    }

    if (erro?.httpStatus) {
      return res.status(erro.httpStatus).json({ erro: erro.message });
    }

    console.error('Erro ao criar pedido:', erro);
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  } finally {
    connection.release();
  }
});

// Listar pedidos do usuário
app.get('/api/pedidos', autenticarToken, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC',
      [req.usuario.id]
    );

    res.json({ pedidos: pedidos });
  } catch (erro) {
    console.error('Erro ao buscar pedidos:', erro);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// Detalhes de um pedido
app.get('/api/pedidos/:id', autenticarToken, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      'SELECT * FROM pedidos WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    // Buscar itens com informações do produto (incluindo emoji)
    const [itens] = await pool.query(`
      SELECT 
        pi.*,
        p.emoji,
        p.nome
      FROM pedido_itens pi
      LEFT JOIN produtos p ON pi.produto_id = p.id
      WHERE pi.pedido_id = ?
    `, [req.params.id]);

    res.json({
      pedido: pedidos[0],
      itens: itens
    });
  } catch (erro) {
    console.error('Erro ao buscar pedido:', erro);
    res.status(500).json({ erro: 'Erro ao buscar pedido' });
  }
});

// ============================================
// ROTAS DE CUPONS
// ============================================

// Validar cupom
app.post('/api/cupons/validar', autenticarToken, async (req, res) => {
  try {
    const { codigo, valorPedido } = req.body;

    // Buscar cupom
    const [cupons] = await pool.query(
      `SELECT * FROM cupons 
       WHERE codigo = ? 
       AND ativo = TRUE 
       AND (validade IS NULL OR validade >= CURDATE())
       AND (uso_maximo IS NULL OR uso_atual < uso_maximo)`,
      [codigo.toUpperCase()]
    );

    if (cupons.length === 0) {
      return res.status(404).json({ erro: 'Cupom inválido ou expirado' });
    }

    const cupom = cupons[0];

    // Verificar valor mínimo
    if (valorPedido < cupom.valor_minimo) {
      return res.status(400).json({ 
        erro: `Valor mínimo do pedido para este cupom: R$ ${cupom.valor_minimo.toFixed(2)}` 
      });
    }

    // Verificar se usuário já usou
    const [usados] = await pool.query(
      'SELECT id FROM cupons_usados WHERE cupom_id = ? AND usuario_id = ?',
      [cupom.id, req.usuario.id]
    );

    if (usados.length > 0) {
      return res.status(400).json({ erro: 'Você já utilizou este cupom' });
    }

    // Calcular desconto
    let desconto = 0;
    if (cupom.tipo === 'percentual') {
      desconto = valorPedido * (cupom.valor / 100);
    } else {
      desconto = cupom.valor;
    }

    // Garantir que desconto não seja maior que o valor do pedido
    if (desconto > valorPedido) {
      desconto = valorPedido;
    }

    res.json({
      valido: true,
      cupom_id: cupom.id,
      codigo: cupom.codigo,
      descricao: cupom.descricao,
      tipo: cupom.tipo,
      valor: cupom.valor,
      desconto: desconto,
      total_com_desconto: valorPedido - desconto
    });
  } catch (erro) {
    console.error('Erro ao validar cupom:', erro);
    res.status(500).json({ erro: 'Erro ao validar cupom' });
  }
});

// Listar cupons ativos (para mostrar na página)
app.get('/api/cupons/disponiveis', async (req, res) => {
  try {
    const [cupons] = await pool.query(
      `SELECT codigo, descricao, tipo, valor, valor_minimo, validade 
       FROM cupons 
       WHERE ativo = TRUE 
       AND (validade IS NULL OR validade >= CURDATE())
       AND (uso_maximo IS NULL OR uso_atual < uso_maximo)
       ORDER BY valor DESC`
    );

    res.json({ cupons: cupons });
  } catch (erro) {
    console.error('Erro ao listar cupons:', erro);
    res.status(500).json({ erro: 'Erro ao listar cupons' });
  }
});

// ============================================
// ROTAS ADMINISTRATIVAS
// ============================================

// Listar todos os pedidos (admin)
app.get('/api/admin/pedidos', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const [pedidos] = await pool.query(`
      SELECT 
        p.*,
        u.nome as cliente_nome,
        u.email as cliente_email,
        u.telefone as cliente_telefone
      FROM pedidos p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
      ORDER BY p.criado_em DESC
    `);

    // Buscar itens de cada pedido
    for (let pedido of pedidos) {
      const [itens] = await pool.query(
        'SELECT * FROM pedido_itens WHERE pedido_id = ?',
        [pedido.id]
      );
      pedido.itens = itens;

      // Buscar endereço do cliente
      const [enderecos] = await pool.query(
        'SELECT * FROM enderecos WHERE usuario_id = ? LIMIT 1',
        [pedido.usuario_id]
      );
      if (enderecos.length > 0) {
        pedido.endereco = enderecos[0];
      }
    }

    res.json({ pedidos: pedidos });
  } catch (erro) {
    console.error('Erro ao buscar pedidos (admin):', erro);
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

// Atualizar status do pedido (admin)
app.put('/api/admin/pedidos/:id/status', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const { status } = req.body;
    const pedidoId = req.params.id;

    const statusValidos = ['pendente', 'preparando', 'enviado', 'entregue', 'cancelado'];
    
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    await pool.query(
      'UPDATE pedidos SET status = ? WHERE id = ?',
      [status, pedidoId]
    );

    // Notificar cliente via WhatsApp se estiver configurado e houver opt-in
    if (status === 'preparando' || status === 'enviado' || status === 'entregue') {
      try {
        const [dados] = await pool.query(
          `SELECT p.id, p.total, p.forma_pagamento, u.nome, u.telefone, u.whatsapp_opt_in
             FROM pedidos p
             JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.id = ?
            LIMIT 1`,
          [pedidoId]
        );

        if (dados.length && dados[0].whatsapp_opt_in) {
          const mensagemStatus = status === 'preparando'
            ? 'Seu pedido está sendo preparado!'
            : status === 'enviado'
              ? 'Seu pedido saiu para entrega!'
              : 'Seu pedido foi entregue.';

          await enviarWhatsappPedido({
            telefone: dados[0].telefone,
            nome: dados[0].nome,
            pedidoId: pedidoId,
            total: dados[0].total,
            pixCodigo: null,
            mensagemExtra: mensagemStatus
          });
        }
      } catch (errNotifica) {
        console.error('Falha ao notificar por WhatsApp:', errNotifica.message);
      }
    }

    res.json({ mensagem: 'Status atualizado com sucesso', status: status });
  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// ============================================
// WEBHOOK PAGBANK (PIX)
// ============================================
app.post('/api/webhooks/pagbank', async (req, res) => {
  try {
    if (!validarWebhookPagBank(req)) {
      return res.status(401).json({ erro: 'Webhook não autorizado' });
    }

    const notificacao = req.body;

    console.log('📩 Webhook PagBank recebido:', {
      id: notificacao?.id || null,
      reference_id: notificacao?.reference_id || null
    });

    // PagBank envia notificações com estrutura:
    // { id, reference_id, charges: [{ id, status, ... }] }
    
    if (!notificacao || !notificacao.id) {
      return res.status(400).json({ erro: 'Notificação inválida' });
    }

    const orderId = notificacao.id;

    // Alguns eventos podem vir sem reference_id/charges.
    // Se faltar, consulta o pedido no PagBank para obter os dados completos.
    let referenceId = notificacao.reference_id; // Ex: "pedido_123"
    let charges = notificacao.charges || [];
    if ((!referenceId || charges.length === 0) && PAGBANK_TOKEN) {
      try {
        const detalhes = await obterPedidoPagBank(orderId);
        referenceId = referenceId || detalhes?.reference_id;
        charges = charges.length ? charges : (detalhes?.charges || []);
      } catch (errConsulta) {
        console.error('Erro ao consultar pedido no PagBank:', errConsulta.message);
      }
    }
    
    // Pegar o status da primeira cobrança
    let statusPagBank = 'WAITING';
    if (charges.length > 0) {
      statusPagBank = charges[0].status || 'WAITING';
    }

    const statusInterno = mapearStatusPedido(statusPagBank);
    
    // Extrair pedidoId do reference_id (formato: "pedido_123")
    let pedidoId = null;
    if (referenceId && referenceId.startsWith('pedido_')) {
      const parsedPedidoId = Number.parseInt(referenceId.replace('pedido_', ''), 10);
      pedidoId = Number.isInteger(parsedPedidoId) ? parsedPedidoId : null;
    }

    if (pedidoId) {
      try {
        await pool.query(
          'UPDATE pedidos SET status = ?, pix_status = ?, pix_id = ? WHERE id = ?',
          [statusInterno, statusPagBank, orderId, pedidoId]
        );
        console.log(`✅ Pedido #${pedidoId} atualizado para status: ${statusInterno}`);
      } catch (err) {
        console.error('Erro ao atualizar pedido:', err.message);
      }
    } else {
      // Tentar encontrar pelo pix_id
      try {
        await pool.query(
          'UPDATE pedidos SET status = ?, pix_status = ? WHERE pix_id = ?',
          [statusInterno, statusPagBank, orderId]
        );
        console.log(`✅ Pedido com pix_id ${orderId} atualizado para status: ${statusInterno}`);
      } catch (err) {
        console.error('Erro ao atualizar pedido por pix_id:', err.message);
      }
    }

    return res.sendStatus(200);
  } catch (erro) {
    console.error('Erro no webhook do PagBank:', erro);
    return res.sendStatus(500);
  }
});

// ============================================
// ROTA DE TESTE DA API
// ============================================
app.get('/api', (req, res) => {
  res.json({
    mensagem: '🛒 API Bom Filho Supermercado',
    versao: '1.0.0',
    status: 'online'
  });
});

// ============================================
// ROTAS DE AVALIAÇÕES
// ============================================

// Listar avaliações de um produto
app.get('/api/avaliacoes/:produto_id', async (req, res) => {
  try {
    const [avaliacoes] = await pool.query(
      `SELECT a.*, u.nome as usuario_nome 
       FROM avaliacoes a 
       LEFT JOIN usuarios u ON a.usuario_id = u.id 
       WHERE a.produto_id = ? 
       ORDER BY a.criado_em DESC`,
      [req.params.produto_id]
    );
    
    res.json({ avaliacoes });
  } catch (error) {
    console.error('Erro ao carregar avaliações:', error);
    res.status(500).json({ erro: 'Erro ao carregar avaliações' });
  }
});

// Criar avaliação
app.post('/api/avaliacoes', autenticarToken, async (req, res) => {
  try {
    const { produto_id, nota, comentario } = req.body;
    
    if (!produto_id || !nota || nota < 1 || nota > 5) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }
    
    // Verificar se já existe avaliação
    const [existente] = await pool.query(
      'SELECT id FROM avaliacoes WHERE usuario_id = ? AND produto_id = ?',
      [req.usuario.id, produto_id]
    );
    
    if (existente.length > 0) {
      // Atualizar avaliação existente
      await pool.query(
        'UPDATE avaliacoes SET nota = ?, comentario = ? WHERE id = ?',
        [nota, comentario || null, existente[0].id]
      );
    } else {
      // Criar nova avaliação
      await pool.query(
        'INSERT INTO avaliacoes (usuario_id, produto_id, nota, comentario) VALUES (?, ?, ?, ?)',
        [req.usuario.id, produto_id, nota, comentario || null]
      );
    }
    
    res.json({ mensagem: 'Avaliação registrada com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar avaliação:', error);
    res.status(500).json({ erro: 'Erro ao salvar avaliação' });
  }
});

if (SHOULD_SERVE_REACT && fs.existsSync(REACT_DIST_INDEX)) {
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(REACT_DIST_INDEX);
  });
}

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`\n📚 Endpoints disponíveis:`);
  console.log(`   POST   /api/auth/cadastro`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/endereco`);
  console.log(`   POST   /api/endereco`);
  console.log(`   GET    /api/produtos`);
  console.log(`   GET    /api/produtos/:id`);
  console.log(`   POST   /api/pedidos`);
  console.log(`   GET    /api/pedidos`);
  console.log(`   GET    /api/pedidos/:id`);
  console.log(`   GET    /api/avaliacoes/:produto_id`);
  console.log(`   POST   /api/avaliacoes`);
  if (SHOULD_SERVE_REACT) {
    if (fs.existsSync(REACT_DIST_INDEX)) {
      console.log(`\n🧩 Frontend React servido em: http://localhost:${PORT}`);
    } else {
      console.log(`\n⚠️ Build React não encontrada em frontend-react/dist (rode: cd frontend-react && npm run build)`);
    }
  }
  console.log(`\n✅ Pronto para receber requisições!\n`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado (Promise):', err);
  // NÃO encerrar o servidor, apenas logar o erro
});

process.on('uncaughtException', (err) => {
  console.error('❌ Erro não capturado (Exception):', err);
  // NÃO encerrar o servidor, apenas logar o erro
});
