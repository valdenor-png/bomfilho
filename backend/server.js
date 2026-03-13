  const dotenvLoadResult = require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const bodyParser = require('body-parser');
  const cookieParser = require('cookie-parser');
  const helmet = require('helmet');
  const rateLimit = require('express-rate-limit');
  const multer = require('multer');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  const mysql = require("mysql2/promise");
  const fetch = global.fetch || require('node-fetch');
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const {
    EXTENSOES_IMPORTACAO_ACEITAS,
    construirModeloImportacaoProdutosCsv,
    importarProdutosPlanilha,
    listarImportacoesProdutos
  } = require('./services/produtosImportacao');

  const app = express();
  const PORT = process.env.PORT || 3000;
  const FRONTEND_DIST_PATH = path.resolve(__dirname, '..', 'frontend-react', 'dist');
  const REACT_DIST_INDEX = path.join(FRONTEND_DIST_PATH, 'index.html');
  const SHOULD_SERVE_REACT = process.env.SERVE_REACT !== 'false';
  const FRONTEND_APP_URL = String(process.env.FRONTEND_APP_URL || '').trim();

  if (dotenvLoadResult?.error) {
    console.warn(
      `[${new Date().toISOString()}] dotenv: arquivo .env não carregado (${dotenvLoadResult.error.message}). Usando variáveis de ambiente do sistema.`
    );
  }

  function parseBooleanEnv(name, fallback = false) {
    const rawValue = String(process.env[name] || '').trim().toLowerCase();

    if (!rawValue) {
      return fallback;
    }

    if (['true', '1', 'yes', 'on'].includes(rawValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(rawValue)) {
      return false;
    }

    return fallback;
  }

  function requireEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) {
      console.error(`❌ Variável obrigatória não definida: ${name}`);
      process.exit(1);
    }

    return value;
  }

  // ============================================
  // CONFIGURACAO DE AMBIENTE (BOOT)
  // ============================================
  const NODE_ENV = String(process.env.NODE_ENV || 'development').trim().toLowerCase() || 'development';
  const IS_PRODUCTION = NODE_ENV === 'production';
  const TRUST_PROXY = parseBooleanEnv('TRUST_PROXY', IS_PRODUCTION);

  const DATABASE_URL = requireEnv('DATABASE_URL');
  const JWT_SECRET = requireEnv('JWT_SECRET');

  const PAGBANK_ENV = String(process.env.PAGBANK_ENV || 'sandbox').trim().toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
  const PAGBANK_TOKEN = String(process.env.PAGBANK_TOKEN || '').trim();
  const PAGBANK_PUBLIC_KEY = String(process.env.PAGBANK_PUBLIC_KEY || '').trim();
  const PAGBANK_WEBHOOK_TOKEN = String(process.env.PAGBANK_WEBHOOK_TOKEN || '').trim();
  const PAGBANK_DEBUG_LOGS = parseBooleanEnv('PAGBANK_DEBUG_LOGS', true);
  const ALLOW_PIX_MOCK = parseBooleanEnv('ALLOW_PIX_MOCK', false);
  const ALLOW_DEBIT_3DS_MOCK = parseBooleanEnv('ALLOW_DEBIT_3DS_MOCK', PAGBANK_ENV !== 'production');

  console.log(`🚀 Ambiente: ${NODE_ENV}`);
  console.log(`🔐 PagBank configurado: ${Boolean(PAGBANK_TOKEN)}`);
  console.log(`🧪 Fallback PIX mock ativo: ${ALLOW_PIX_MOCK}`);
  console.log(`🧪 Fallback 3DS débito mock ativo: ${ALLOW_DEBIT_3DS_MOCK}`);
  console.log(`🌐 Trust proxy ativo: ${TRUST_PROXY}`);

  // Configuração Evolution API (WhatsApp)
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

  // Configuração PagBank
  const PAGBANK_API_URL = PAGBANK_ENV === 'production' 
    ? 'https://api.pagseguro.com' 
    : 'https://sandbox.api.pagseguro.com';
  const RECAPTCHA_SECRET_KEY = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
  const RECAPTCHA_MIN_SCORE = (() => {
    const valor = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
    if (!Number.isFinite(valor)) {
      return 0.5;
    }
    return Math.min(1, Math.max(0, valor));
  })();

  const DIAGNOSTIC_TOKEN = String(process.env.DIAGNOSTIC_TOKEN || '').trim();
  const CORS_ORIGINS = (() => {
    const fallbackOrigins = [
      'https://bomfilho-delivery.vercel.app',
      'https://bomfilho-web.vercel.app',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];

    const configuredOrigins = String(process.env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => String(origin).trim())
      .filter(Boolean);

    if (FRONTEND_APP_URL) {
      configuredOrigins.push(FRONTEND_APP_URL);
    }

    const origins = [...fallbackOrigins, ...configuredOrigins];

    return Array.from(
      new Set(origins.map((origin) => String(origin).trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean))
    );
  })();
  const CORS_ORIGIN_PATTERNS = [
    /^https:\/\/bomfilho-delivery(?:-[a-z0-9-]+)?\.vercel\.app$/i,
    /^https:\/\/bomfilho-web(?:-[a-z0-9-]+)?\.vercel\.app$/i,
    /^https:\/\/bomfilho(?:-[a-z0-9-]+)?\.vercel\.app$/i
  ];
  const USER_AUTH_COOKIE_NAME = 'bf_access_token';
  const ADMIN_AUTH_COOKIE_NAME = 'bf_admin_token';
  const CSRF_COOKIE_NAME = 'bf_csrf_token';
  const USER_AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  const ADMIN_AUTH_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
  const CSRF_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;
  const COOKIE_SECURE = parseBooleanEnv('COOKIE_SECURE', IS_PRODUCTION);
  const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || '').trim() || null;
  const COOKIE_SAME_SITE_FALLBACK = IS_PRODUCTION ? 'none' : 'strict';
  const COOKIE_SAME_SITE_RAW = String(process.env.COOKIE_SAME_SITE || COOKIE_SAME_SITE_FALLBACK).trim().toLowerCase();
  const COOKIE_SAME_SITE = ['strict', 'lax', 'none'].includes(COOKIE_SAME_SITE_RAW)
    ? COOKIE_SAME_SITE_RAW
    : COOKIE_SAME_SITE_FALLBACK;
  const PRECO_COMBUSTIVEL_LITRO = Number(process.env.PRECO_COMBUSTIVEL_LITRO || 6.2);
  const CEP_MERCADO = String(process.env.CEP_MERCADO || '68740-180').replace(/\D/g, '');
  const NUMERO_MERCADO = String(process.env.NUMERO_MERCADO || '70').trim() || '70';
  const LIMITE_BIKE_KM = (() => {
    const valor = Number(process.env.LIMITE_BIKE_KM || 1);
    return Number.isFinite(valor) && valor > 0 ? valor : 1;
  })();
  const CEP_GEO_TTL_MS = 24 * 60 * 60 * 1000;
  const cepGeoCache = new Map();
  const PRODUTOS_QUERY_CACHE_TTL_MS = Number(process.env.PRODUTOS_QUERY_CACHE_TTL_MS || 20000);
  const produtosQueryCache = new Map();
  const TAMANHO_MAXIMO_IMPORTACAO_BYTES = 10 * 1024 * 1024;
  const MIME_IMPORTACAO_PLANILHA_ACEITOS = new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]);

const VEICULOS_ENTREGA = {
  bike: {
    consumoKmLitro: null,
    custoManutencaoKm: 0.12,
    fatorReparo: 1.1,
    taxaBase: 3.5
  },
  moto: {
    consumoKmLitro: 30,
    custoManutencaoKm: 0.2,
    fatorReparo: 1.5,
    taxaBase: 5
  },
  carro: {
    consumoKmLitro: 12,
    custoManutencaoKm: 0.45,
    fatorReparo: 2.2,
    taxaBase: 7.5
  }
};

function normalizarCep(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarCep(valor) {
  const cep = normalizarCep(valor);
  if (cep.length !== 8) {
    return cep;
  }

  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function normalizarDistanciaEntregaKm(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    return 0.5;
  }

  return Number(Math.min(numero, 80).toFixed(1));
}

function calcularFreteEntrega(veiculoKey, distanciaKm) {
  const veiculo = VEICULOS_ENTREGA[veiculoKey] || VEICULOS_ENTREGA.moto;
  const distanciaNormalizada = normalizarDistanciaEntregaKm(distanciaKm);
  const custoCombustivelKm = veiculo.consumoKmLitro
    ? PRECO_COMBUSTIVEL_LITRO / veiculo.consumoKmLitro
    : 0;
  const custoOperacionalKm = (custoCombustivelKm + veiculo.custoManutencaoKm) * veiculo.fatorReparo;
  const frete = veiculo.taxaBase + (distanciaNormalizada * custoOperacionalKm);

  return Number(frete.toFixed(2));
}

function calcularDistanciaHaversineKm(latA, lonA, latB, lonB) {
  const toRad = (grau) => (grau * Math.PI) / 180;
  const terraKm = 6371;

  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const latArad = toRad(latA);
  const latBrad = toRad(latB);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(latArad) * Math.cos(latBrad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return terraKm * c;
}

async function buscarCoordenadasPorCep(cep) {
  const cepNormalizado = normalizarCep(cep);
  if (cepNormalizado.length !== 8) {
    throw criarErroHttp(400, 'CEP inválido. Informe 8 dígitos.');
  }

  const cache = cepGeoCache.get(cepNormalizado);
  if (cache && Date.now() - cache.cachedAt < CEP_GEO_TTL_MS) {
    return cache.data;
  }

  const dados = await buscarDadosCepComFallback(cepNormalizado);

  let latitude = Number(dados?.location?.coordinates?.latitude);
  let longitude = Number(dados?.location?.coordinates?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const coordenadasFallback = await buscarCoordenadasNominatim({
      cepNormalizado,
      dadosCep: dados
    });

    if (coordenadasFallback) {
      latitude = coordenadasFallback.latitude;
      longitude = coordenadasFallback.longitude;
    }
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw criarErroHttp(400, 'CEP sem coordenadas para cálculo de entrega.');
  }

  const resultado = {
    cep: formatarCep(cepNormalizado),
    latitude,
    longitude,
    cidade: String(dados?.city || '').trim(),
    estado: String(dados?.state || '').trim(),
    bairro: String(dados?.neighborhood || '').trim(),
    rua: String(dados?.street || '').trim()
  };

  cepGeoCache.set(cepNormalizado, {
    cachedAt: Date.now(),
    data: resultado
  });

  return resultado;
}

async function buscarDadosCepComFallback(cepNormalizado) {
  let dadosV2 = null;

  try {
    const responseV2 = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepNormalizado}`);
    if (responseV2.ok) {
      dadosV2 = await responseV2.json().catch(() => ({}));
    } else if (responseV2.status === 404) {
      throw criarErroHttp(400, 'CEP não encontrado.');
    }
  } catch (erro) {
    if (erro?.status === 400) {
      throw erro;
    }
  }

  let dadosV1 = null;
  if (!dadosV2 || !String(dadosV2?.city || '').trim()) {
    try {
      const responseV1 = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepNormalizado}`);
      if (responseV1.ok) {
        dadosV1 = await responseV1.json().catch(() => ({}));
      } else if (responseV1.status === 404) {
        throw criarErroHttp(400, 'CEP não encontrado.');
      }
    } catch (erro) {
      if (erro?.status === 400) {
        throw erro;
      }
    }
  }

  const dadosMesclados = {
    ...(dadosV1 || {}),
    ...(dadosV2 || {}),
    location: dadosV2?.location || dadosV1?.location || null
  };

  if (!Object.keys(dadosMesclados).length) {
    throw criarErroHttp(503, 'Falha ao consultar CEP.');
  }

  return dadosMesclados;
}

function montarConsultasNominatim({ cepNormalizado, dadosCep }) {
  const cepFormatado = formatarCep(cepNormalizado);
  const rua = String(dadosCep?.street || '').trim();
  const bairro = String(dadosCep?.neighborhood || '').trim();
  const cidade = String(dadosCep?.city || '').trim();
  const estado = String(dadosCep?.state || '').trim();

  const consultas = [
    [rua, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
    [cepFormatado, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
    [cepFormatado, 'Brasil'].filter(Boolean).join(', ')
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return Array.from(new Set(consultas));
}

async function buscarCoordenadasNominatim({ cepNormalizado, dadosCep }) {
  const consultas = montarConsultasNominatim({ cepNormalizado, dadosCep });
  if (!consultas.length) {
    return null;
  }

  const headers = {
    'User-Agent': 'BomFilhoFrete/1.0 (fallback-cep)',
    'Accept-Language': 'pt-BR,pt;q=0.9'
  };

  for (const consulta of consultas) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(consulta)}&format=jsonv2&limit=1`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        continue;
      }

      const resultados = await response.json().catch(() => []);
      const primeiro = Array.isArray(resultados) ? resultados[0] : null;
      const latitude = Number(primeiro?.lat);
      const longitude = Number(primeiro?.lon);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    } catch {
      // Ignora falha de fallback para tentar a proxima consulta.
    }
  }

  return null;
}

async function calcularEntregaPorCep({ cepDestino, veiculo }) {
  const veiculoKey = String(veiculo || 'moto').trim().toLowerCase();
  if (!VEICULOS_ENTREGA[veiculoKey]) {
    throw criarErroHttp(400, 'Veículo de entrega inválido');
  }

  const origem = await buscarCoordenadasPorCep(CEP_MERCADO);
  const destino = await buscarCoordenadasPorCep(cepDestino);
  const distanciaKm = Number(
    calcularDistanciaHaversineKm(origem.latitude, origem.longitude, destino.latitude, destino.longitude).toFixed(2)
  );

  if (!Number.isFinite(distanciaKm)) {
    throw criarErroHttp(500, 'Não foi possível calcular a distância da entrega.');
  }

  if (veiculoKey === 'bike' && distanciaKm > LIMITE_BIKE_KM) {
    throw criarErroHttp(
      400,
      `Bike disponível apenas para até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado (${formatarCep(CEP_MERCADO)}).`
    );
  }

  const frete = calcularFreteEntrega(veiculoKey, distanciaKm);

  return {
    veiculo: veiculoKey,
    frete,
    distancia_km: distanciaKm,
    cep_origem: origem.cep,
    numero_origem: NUMERO_MERCADO,
    cep_destino: destino.cep,
    cidade_destino: destino.cidade,
    bairro_destino: destino.bairro
  };
}

if (JWT_SECRET.length < 32) {
  const aviso = 'JWT_SECRET deve ter no mínimo 32 caracteres para segurança adequada.';
  if (IS_PRODUCTION) {
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
    sameSite: COOKIE_SAME_SITE,
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

  const originNormalizada = String(origin).trim().replace(/\/+$/, '').toLowerCase();
  if (CORS_ORIGINS.includes(originNormalizada)) {
    return true;
  }

  return CORS_ORIGIN_PATTERNS.some((pattern) => pattern.test(originNormalizada));
}

function montarWebhookPagBankUrl({ incluirToken = true } = {}) {
  const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const webhookBase = `${baseUrl}/api/webhooks/pagbank`;

  if (incluirToken && PAGBANK_WEBHOOK_TOKEN) {
    return `${webhookBase}?token=${encodeURIComponent(PAGBANK_WEBHOOK_TOKEN)}`;
  }

  return webhookBase;
}

function analisarChavePublicaPagBank() {
  const chaveBruta = String(process.env.PAGBANK_PUBLIC_KEY || PAGBANK_PUBLIC_KEY || '').trim();
  if (!chaveBruta) {
    return {
      valid: false,
      reason: 'missing',
      publicKey: ''
    };
  }

  // Remove aspas acidentais na configuração e normaliza quebras de linha escapadas.
  const chaveNormalizada = chaveBruta
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n')
    .trim();

  if (!chaveNormalizada) {
    return {
      valid: false,
      reason: 'empty_after_normalize',
      publicKey: ''
    };
  }

  // "..." costuma indicar valor truncado/placeholder copiado parcialmente.
  if (chaveNormalizada.includes('...')) {
    return {
      valid: false,
      reason: 'placeholder_or_truncated',
      publicKey: chaveNormalizada
    };
  }

  const hasPemHeader = /-----BEGIN PUBLIC KEY-----/.test(chaveNormalizada);
  const hasPemFooter = /-----END PUBLIC KEY-----/.test(chaveNormalizada);

  if (hasPemHeader !== hasPemFooter) {
    return {
      valid: false,
      reason: 'malformed_pem_header_footer',
      publicKey: chaveNormalizada
    };
  }

  const base64Body = (hasPemHeader || hasPemFooter)
    ? chaveNormalizada
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s+/g, '')
    : chaveNormalizada.replace(/\s+/g, '');

  if (!base64Body) {
    return {
      valid: false,
      reason: 'empty_base64_body',
      publicKey: chaveNormalizada
    };
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(base64Body)) {
    return {
      valid: false,
      reason: 'invalid_base64_characters',
      publicKey: chaveNormalizada
    };
  }

  // Chaves RSA públicas reais (2048+) normalmente passam com folga desse tamanho.
  if (base64Body.length < 300) {
    return {
      valid: false,
      reason: 'base64_too_short',
      publicKey: chaveNormalizada
    };
  }

  return {
    valid: true,
    reason: 'ok',
    publicKey: chaveNormalizada
  };
}

function traduzirMotivoChavePublicaPagBank(reason) {
  const motivo = String(reason || '').trim().toLowerCase();

  if (motivo === 'missing') return 'PAGBANK_PUBLIC_KEY ausente';
  if (motivo === 'empty_after_normalize') return 'PAGBANK_PUBLIC_KEY vazia após normalização';
  if (motivo === 'placeholder_or_truncated') return 'PAGBANK_PUBLIC_KEY truncada/placeholder (contém "...")';
  if (motivo === 'malformed_pem_header_footer') return 'PAGBANK_PUBLIC_KEY com PEM malformado (BEGIN/END inconsistentes)';
  if (motivo === 'empty_base64_body') return 'PAGBANK_PUBLIC_KEY sem conteúdo base64';
  if (motivo === 'invalid_base64_characters') return 'PAGBANK_PUBLIC_KEY com caracteres inválidos';
  if (motivo === 'base64_too_short') return 'PAGBANK_PUBLIC_KEY curta demais (possível valor incompleto)';

  return 'PAGBANK_PUBLIC_KEY inválida';
}

function obterPagBankPublicKeyAtual() {
  const info = analisarChavePublicaPagBank();
  return info.valid ? info.publicKey : '';
}

function registrarLogEndpointDiagnostico({ endpoint, statusHttp, detalhe, extra } = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    endpoint: String(endpoint || ''),
    status_http: Number.isFinite(Number(statusHttp)) ? Number(statusHttp) : null,
    detalhe: detalhe ? String(detalhe) : undefined,
    extra
  };

  const status = Number(payload.status_http || 0);
  if (status >= 500) {
    console.error('📍 API diagnóstico:', JSON.stringify(payload));
    return;
  }

  console.log('📍 API diagnóstico:', JSON.stringify(payload));
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

function extrairRecaptchaErrorCodes(payload) {
  if (!payload || !Array.isArray(payload['error-codes'])) {
    return [];
  }

  return payload['error-codes']
    .map((codigo) => String(codigo || '').trim())
    .filter(Boolean);
}

async function validarRecaptcha({ token, req, action = '' } = {}) {
  if (!RECAPTCHA_SECRET_KEY) {
    return;
  }

  const recaptchaToken = String(token || '').trim();
  if (!recaptchaToken) {
    throw criarErroHttp(400, 'Confirme o reCAPTCHA para continuar.');
  }

  const formData = new URLSearchParams();
  formData.set('secret', RECAPTCHA_SECRET_KEY);
  formData.set('response', recaptchaToken);

  const ipCliente = normalizarIp(req?.ip || req?.socket?.remoteAddress);
  if (ipCliente) {
    formData.set('remoteip', ipCliente);
  }

  let response;
  try {
    response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
  } catch {
    throw criarErroHttp(503, 'Não foi possível validar o reCAPTCHA no momento.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw criarErroHttp(503, 'Falha ao validar reCAPTCHA. Tente novamente.');
  }

  if (!payload?.success) {
    const codigos = extrairRecaptchaErrorCodes(payload);
    if (codigos.includes('timeout-or-duplicate')) {
      throw criarErroHttp(400, 'reCAPTCHA expirado. Confirme novamente.');
    }

    throw criarErroHttp(400, 'Falha na validação do reCAPTCHA. Tente novamente.');
  }

  if (typeof payload?.score === 'number' && payload.score < RECAPTCHA_MIN_SCORE) {
    throw criarErroHttp(403, 'A validação de segurança não foi aprovada. Tente novamente.');
  }

  if (action && payload?.action && String(payload.action).trim() !== String(action).trim()) {
    throw criarErroHttp(400, 'Falha na validação do reCAPTCHA. Tente novamente.');
  }
}

function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePositiveInt(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parseBooleanInput(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'sim', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'não', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

const uploadImportacaoProdutos = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TAMANHO_MAXIMO_IMPORTACAO_BYTES
  },
  fileFilter(req, file, callback) {
    const nomeArquivo = String(file?.originalname || '').trim();
    const extensao = path.extname(nomeArquivo).toLowerCase();
    const mimeType = String(file?.mimetype || '').trim().toLowerCase();

    if (!EXTENSOES_IMPORTACAO_ACEITAS.includes(extensao)) {
      return callback(new Error('Formato de arquivo não suportado. Envie .xlsx ou .csv.'));
    }

    if (mimeType && !MIME_IMPORTACAO_PLANILHA_ACEITOS.has(mimeType)) {
      return callback(new Error('Tipo de arquivo inválido para importação de produtos.'));
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

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&');
}

function montarPaginacao(total, pagina, limite) {
  const totalSeguro = Number.isFinite(total) ? Math.max(0, total) : 0;
  const totalPaginas = totalSeguro > 0 ? Math.ceil(totalSeguro / limite) : 1;
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const temMais = paginaAtual < totalPaginas;

  return {
    pagina: paginaAtual,
    limite,
    total: totalSeguro,
    total_paginas: totalPaginas,
    tem_mais: temMais
  };
}

function limparCacheProdutos() {
  produtosQueryCache.clear();
}

function montarChaveCacheProdutos({ pagina, limite, busca, categoria, ordenacao }) {
  return JSON.stringify({ pagina, limite, busca, categoria, ordenacao });
}

function obterCacheProdutos(chave) {
  const cached = produtosQueryCache.get(chave);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > PRODUTOS_QUERY_CACHE_TTL_MS) {
    produtosQueryCache.delete(chave);
    return null;
  }

  return cached.payload;
}

function salvarCacheProdutos(chave, payload) {
  produtosQueryCache.set(chave, {
    cachedAt: Date.now(),
    payload
  });
}

function validarWebhookPagBank(req) {
  if (!PAGBANK_WEBHOOK_TOKEN) {
    return true;
  }

  const tokenHeader = String(req.headers['x-webhook-token'] || '').trim();
  const tokenQuery = String(req.query?.token || '').trim();

  return tokenHeader === PAGBANK_WEBHOOK_TOKEN || tokenQuery === PAGBANK_WEBHOOK_TOKEN;
}

function validarWebhookEvolution(req) {
  if (!EVOLUTION_WEBHOOK_TOKEN) {
    return true;
  }

  const tokenHeader = String(req.headers['x-webhook-token'] || req.headers['x-evolution-token'] || '').trim();
  const tokenQuery = String(req.query?.token || '').trim();

  return tokenHeader === EVOLUTION_WEBHOOK_TOKEN || tokenQuery === EVOLUTION_WEBHOOK_TOKEN;
}

function limparCacheEvolution() {
  const agora = Date.now();
  const ttlMensagemMs = 30 * 60 * 1000;
  const ttlNumeroMs = 24 * 60 * 60 * 1000;

  for (const [id, ts] of evolutionProcessedMessageIds.entries()) {
    if (agora - ts > ttlMensagemMs) {
      evolutionProcessedMessageIds.delete(id);
    }
  }

  for (const [numero, ts] of evolutionLastReplyByNumber.entries()) {
    if (agora - ts > ttlNumeroMs) {
      evolutionLastReplyByNumber.delete(numero);
    }
  }
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

// Cache simples de diagnóstico do PagBank
let pagbankLastAuthCheck = {
  checkedAt: null,
  ok: null,
  status: 'not_checked',
  httpStatus: null,
  message: null
};

const evolutionProcessedMessageIds = new Map();
const evolutionLastReplyByNumber = new Map();

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-diagnostic-token', 'x-webhook-token', 'x-csrf-token', 'ngrok-skip-browser-warning'],
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
  message: { erro: 'Recebemos muitas solicitações em sequência. Tente novamente em alguns minutos.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' }
});

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de acesso administrativo. Aguarde 15 minutos.' }
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

  if (pathAtual.startsWith('/api/webhooks/') || pathAtual === '/api/pagbank/webhook') {
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
    return res.status(403).json({ erro: 'Sua sessão expirou por segurança. Atualize a página e tente novamente.' });
  }

  return next();
});

if (SHOULD_SERVE_REACT && fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));
}

// Chave publica do PagBank para criptografia de cartao no frontend
app.get('/api/pagbank/public-key', (req, res) => {
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
app.get('/api/pagbank/status', protegerDiagnostico, async (req, res) => {
  try {
    const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000');
    const webhookUrl = montarWebhookPagBankUrl({ incluirToken: false });
    const token = process.env.PAGBANK_TOKEN || '';
    const chaveInfo = analisarChavePublicaPagBank();

    // Atualiza o cache se nunca foi checado ou se está velho
    const shouldRefresh = !pagbankLastAuthCheck.checkedAt ||
      (Date.now() - Date.parse(pagbankLastAuthCheck.checkedAt)) > 60_000;

    if (shouldRefresh) {
      await verificarCredencialPagBank();
    }

    res.json({
      pagbank_env: PAGBANK_ENV,
      pagbank_api_url: PAGBANK_API_URL,
      base_url: baseUrl,
      webhook_url: webhookUrl,
      token_present: !!token,
      public_key_present: Boolean(chaveInfo.publicKey),
      public_key_valid: chaveInfo.valid,
      public_key_validation_reason: chaveInfo.reason,
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

// ============================================
// CONEXÃO COM O BANCO DE DADOS
// ============================================
const dbUrl = new URL(DATABASE_URL);

const pool = mysql.createPool({
  host: dbUrl.hostname,
  port: dbUrl.port,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace("/", ""),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('🧭 MySQL config:', {
  host: dbUrl.hostname,
  port: dbUrl.port,
  user: dbUrl.username,
  database: dbUrl.pathname.replace("/", ""),
  source: 'DATABASE_URL'
});

// Testar conexão ao iniciar
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL conectado');
    conn.release();
  } catch (err) {
    console.error('❌ Erro ao conectar ao MySQL:', err);
  }
})();

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

function mascararTextoSensivel(valor, { prefixo = 6, sufixo = 4 } = {}) {
  const texto = String(valor || '').trim();
  if (!texto) {
    return '';
  }

  if (texto.length <= prefixo + sufixo) {
    return `${texto.slice(0, 2)}***`;
  }

  return `${texto.slice(0, prefixo)}***${texto.slice(-sufixo)}`;
}

function deveMascararCampoLog({ chave, caminho }) {
  const key = String(chave || '').toLowerCase();
  const pathKey = `${String(caminho || '').toLowerCase()}.${key}`;

  if (['token_cartao', 'cartao_encriptado', 'encrypted', 'encryptedcard'].includes(key)) {
    return true;
  }

  if (['tax_id', 'cpf', 'cnpj', 'x-webhook-token', 'webhook_token'].includes(key)) {
    return true;
  }

  if (key === 'token' || key.endsWith('_token')) {
    return true;
  }

  if (['cvv', 'securitycode', 'security_code'].includes(key)) {
    return true;
  }

  if (key === 'number' && pathKey.includes('.card')) {
    return true;
  }

  return false;
}

function mascararTokensEmTexto(texto) {
  return String(texto || '').replace(
    /([?&](?:token|access_token|signature|webhook_token)=)([^&]+)/gi,
    '$1***'
  );
}

function sanitizarPayloadPagBankParaLog(valor, caminho = 'root') {
  if (Array.isArray(valor)) {
    return valor.map((item, index) => sanitizarPayloadPagBankParaLog(item, `${caminho}[${index}]`));
  }

  if (typeof valor === 'string') {
    return mascararTokensEmTexto(valor);
  }

  if (!valor || typeof valor !== 'object') {
    return valor;
  }

  const saida = {};

  for (const [chave, conteudo] of Object.entries(valor)) {
    if (deveMascararCampoLog({ chave, caminho })) {
      saida[chave] = mascararTextoSensivel(conteudo);
      continue;
    }

    saida[chave] = sanitizarPayloadPagBankParaLog(conteudo, `${caminho}.${chave}`);
  }

  return saida;
}

function registrarLogPagBank({
  operacao,
  endpoint,
  method,
  httpStatus,
  requestPayload,
  responsePayload,
  extra
} = {}) {
  if (!PAGBANK_DEBUG_LOGS) {
    return;
  }

  const logSeguro = {
    operacao: String(operacao || 'pagbank'),
    method: String(method || 'POST').toUpperCase(),
    endpoint: String(endpoint || ''),
    http_status: Number.isFinite(Number(httpStatus)) ? Number(httpStatus) : null,
    request: requestPayload !== undefined ? sanitizarPayloadPagBankParaLog(requestPayload) : undefined,
    response: responsePayload !== undefined ? sanitizarPayloadPagBankParaLog(responsePayload) : undefined,
    extra: extra !== undefined ? sanitizarPayloadPagBankParaLog(extra) : undefined,
    timestamp: new Date().toISOString()
  };

  console.log('📦 PagBank debug:', JSON.stringify(logSeguro));
}

function mapearStatusPorEventoPagBank(evento) {
  const eventoUpper = String(evento || '').trim().toUpperCase();

  if (!eventoUpper) {
    return '';
  }

  if (['CHARGE.PAID', 'ORDER.PAID', 'CHARGE.CAPTURED'].includes(eventoUpper)) {
    return 'PAID';
  }

  if (['CHARGE.DECLINED', 'ORDER.CANCELED', 'CHARGE.CANCELED', 'ORDER.DECLINED'].includes(eventoUpper)) {
    return 'DECLINED';
  }

  if (['CHARGE.IN_ANALYSIS', 'ORDER.IN_ANALYSIS'].includes(eventoUpper)) {
    return 'IN_ANALYSIS';
  }

  if (['ORDER.CREATED', 'CHARGE.CREATED', 'ORDER.WAITING', 'CHARGE.WAITING'].includes(eventoUpper)) {
    return 'WAITING';
  }

  return '';
}

function extrairStatusPagamentoPagBank(payload = {}, evento) {
  const charges = Array.isArray(payload?.charges) ? payload.charges : [];
  const chargePrincipal = charges[0] || null;
  const chargeStatus = String(chargePrincipal?.status || '').trim().toUpperCase();
  const orderStatus = String(payload?.status || '').trim().toUpperCase();
  const eventStatus = mapearStatusPorEventoPagBank(evento);
  const statusResolvido = chargeStatus || eventStatus || orderStatus || 'WAITING';

  let fonteStatus = 'fallback';
  if (chargeStatus) {
    fonteStatus = 'charge';
  } else if (eventStatus) {
    fonteStatus = 'event';
  } else if (orderStatus) {
    fonteStatus = 'order';
  }

  return {
    statusResolvido,
    fonteStatus,
    orderStatus,
    chargeStatus,
    eventStatus,
    chargePrincipal,
    charges
  };
}

function normalizarParcelasCartao(valor) {
  const parcelas = Number.parseInt(valor, 10);
  if (!Number.isFinite(parcelas) || parcelas < 1) {
    return 1;
  }

  return Math.min(3, parcelas);
}

function normalizarTipoCartao(valor) {
  const tipo = String(valor || '').trim().toLowerCase();
  if (['debito', 'debit', 'debit_card'].includes(tipo)) {
    return 'debito';
  }
  return 'credito';
}

function normalizarAuthenticationMethodPagBank(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return null;
  }

  const type = String(valor.type || 'THREEDS').trim().toUpperCase();
  if (type !== 'THREEDS') {
    return null;
  }

  const id = String(valor.id || '').trim();
  if (id) {
    return {
      type: 'THREEDS',
      id
    };
  }

  const cavv = String(valor.cavv || '').trim();
  const xid = String(valor.xid || '').trim();
  const eci = String(valor.eci || '').trim();
  const version = String(valor.version || '').trim();
  const dstransId = String(valor.dstrans_id || valor.dsTransId || '').trim();

  const auth = { type: 'THREEDS' };
  if (cavv) {
    auth.cavv = cavv;
  }
  if (xid) {
    auth.xid = xid;
  }
  if (eci) {
    auth.eci = eci;
  }
  if (version) {
    auth.version = version;
  }
  if (dstransId) {
    auth.dstrans_id = dstransId;
  }

  const hasExternalData = Object.keys(auth).length > 1;
  return hasExternalData ? auth : null;
}

function montarAuthenticationMethodMock3DS() {
  return {
    type: 'THREEDS',
    cavv: 'BwABBylVaQAAAAFwllVpAAAAAAA=',
    xid: 'BwABBylVaQAAAAFwllVpAAAAAAA=',
    eci: '05',
    version: '2.1.0',
    dstrans_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  };
}

function validarAuthenticationMethodPagBank(authenticationMethod) {
  const auth = normalizarAuthenticationMethodPagBank(authenticationMethod);

  if (!auth) {
    return {
      ok: false,
      auth: null,
      modo: 'none',
      motivo: 'missing'
    };
  }

  if (auth.id) {
    return {
      ok: true,
      auth,
      modo: 'id',
      motivo: null
    };
  }

  const validoExterno = Boolean(auth.cavv && auth.eci && auth.version && (auth.xid || auth.dstrans_id));
  if (!validoExterno) {
    return {
      ok: false,
      auth,
      modo: 'external',
      motivo: 'incomplete_external'
    };
  }

  return {
    ok: true,
    auth,
    modo: 'external',
    motivo: null
  };
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
    const payloadDiagnostico = {
      reference_id: `diag_auth_${Date.now()}`,
      customer: {
        name: 'Diagnostico Auth',
        email: 'diagnostico@example.com',
        tax_id: '12345678909'
      },
      // Mantem payload propositalmente invalido para nao criar pedido real.
      items: []
    };

    const respPost = await fetch(`${PAGBANK_API_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadDiagnostico)
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
  const endpoint = `${PAGBANK_API_URL}/orders/${orderId}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${PAGBANK_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const responseText = await response.text();
  let responsePayload = {};
  try {
    responsePayload = responseText ? JSON.parse(responseText) : {};
  } catch {
    responsePayload = { raw_text: responseText };
  }

  registrarLogPagBank({
    operacao: 'orders.get',
    endpoint,
    method: 'GET',
    httpStatus: response.status,
    responsePayload,
    extra: { order_id: orderId }
  });

  if (!response.ok) {
    const detalheErro = typeof responsePayload?.raw_text === 'string'
      ? responsePayload.raw_text
      : JSON.stringify(responsePayload);
    throw new Error(`Erro ao consultar PagBank order ${orderId}: ${response.status} - ${detalheErro}`);
  }
  return responsePayload;
}

async function criarPagamentoPix({ pedidoId, total, descricao, email, nome, taxId }) {
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
  const endpoint = `${PAGBANK_API_URL}/orders`;

  registrarLogPagBank({
    operacao: 'orders.pix.request',
    endpoint,
    method: 'POST',
    requestPayload: payload,
    extra: {
      idempotency_key: idempotencyKey,
      pedido_id: pedidoId,
      reference_id: payload.reference_id,
      amount_value: payload?.qr_codes?.[0]?.amount?.value ?? null,
      notification_url: payload.notification_urls?.[0]
    }
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAGBANK_TOKEN}`,
      'x-idempotency-key': idempotencyKey,
      'accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let responsePayload = {};
  try {
    responsePayload = responseText ? JSON.parse(responseText) : {};
  } catch {
    responsePayload = { raw_text: responseText };
  }

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
      status_fonte: statusInfoPix.fonteStatus
    }
  });

  if (!response.ok) {
    const detalheErro = typeof responsePayload?.raw_text === 'string'
      ? responsePayload.raw_text
      : JSON.stringify(responsePayload);
    throw new Error(`Erro PagBank: ${response.status} - ${detalheErro}`);
  }

  return responsePayload;
}

async function criarPagamentoCartao({
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

    if (!authParaUso && PAGBANK_ENV !== 'production' && ALLOW_DEBIT_3DS_MOCK) {
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
  const endpoint = `${PAGBANK_API_URL}/orders`;

  registrarLogPagBank({
    operacao: 'orders.cartao.request',
    endpoint,
    method: 'POST',
    requestPayload: payload,
    extra: {
      idempotency_key: idempotencyKey,
      pedido_id: pedidoId,
      reference_id: payload.reference_id,
      charge_reference_id: payload?.charges?.[0]?.reference_id || null,
      tipo_cartao: tipoCartaoNormalizado,
      installments: tipoCartaoNormalizado === 'debito' ? 1 : parcelasNormalizadas,
      capture: payload?.charges?.[0]?.payment_method?.capture,
      has_encrypted_card: hasEncryptedCard,
      has_authentication_method: Boolean(payload?.charges?.[0]?.payment_method?.authentication_method),
      authentication_method_mode: authenticationMethodMode,
      notification_url: payload.notification_urls?.[0]
    }
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAGBANK_TOKEN}`,
      'x-idempotency-key': idempotencyKey,
      'accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let responsePayload = {};
  try {
    responsePayload = responseText ? JSON.parse(responseText) : {};
  } catch {
    responsePayload = { raw_text: responseText };
  }

  const statusInfoCartao = extrairStatusPagamentoPagBank(responsePayload);
  const chargePrincipalCartao = statusInfoCartao.chargePrincipal || {};
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
      has_charges_in_response: Array.isArray(responsePayload?.charges) && responsePayload.charges.length > 0,
      order_id: responsePayload?.id || null,
      charge_id: chargePrincipalCartao?.id || null,
      status_pagbank: statusPagBankCartao,
      status_order: statusInfoCartao.orderStatus || null,
      status_charge: statusInfoCartao.chargeStatus || null,
      status_fonte: statusInfoCartao.fonteStatus
    }
  });

  if (!response.ok) {
    const detalheErro = typeof responsePayload?.raw_text === 'string'
      ? responsePayload.raw_text
      : JSON.stringify(responsePayload);
    throw new Error(`Erro PagBank cartão: ${response.status} - ${detalheErro}`);
  }

  return responsePayload;
}

async function enviarWhatsappTexto({ telefone, mensagem }) {
  if (!EVOLUTION_API_KEY) {
    console.warn('⚠️ Evolution API não configurada. WhatsApp desabilitado.');
    return false;
  }

  const numero = formatarTelefoneWhatsapp(telefone);
  if (!numero || !mensagem) {
    return false;
  }

  if (typeof fetch !== 'function') {
    console.warn('Fetch indisponível; mensagem de WhatsApp não enviada.');
    return false;
  }
  
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
      return false;
    } else {
      const resultado = await resp.json();
      console.log('✅ WhatsApp enviado:', resultado);
      return true;
    }
  } catch (erro) {
    console.error('❌ Erro ao enviar WhatsApp:', erro.message);
    return false;
  }
}

async function enviarWhatsappPedido({ telefone, nome, pedidoId, total, pixCodigo, mensagemExtra }) {
  const mensagemBase = mensagemExtra || `Recebemos o seu pedido #${pedidoId}! Total: R$ ${Number(total || 0).toFixed(2)}.`;
  const detalhePix = pixCodigo ? ` Codigo PIX: ${pixCodigo}` : '';
  const mensagem = `Ola ${nome || 'cliente'}! ${mensagemBase}${detalhePix}`;

  await enviarWhatsappTexto({
    telefone,
    mensagem
  });
}

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================
const autenticarToken = (req, res, next) => {
  const token = extrairTokenUsuarioRequest(req);

  if (!token) {
    return res.status(401).json({ erro: 'Sessão não encontrada. Faça login para continuar.' });
  }

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) {
      limparCookie(res, USER_AUTH_COOKIE_NAME, { httpOnly: true });
      return res.status(403).json({ erro: 'Sua sessão expirou. Faça login novamente.' });
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
    return res.status(403).json({ erro: 'O acesso administrativo é permitido apenas no computador da loja.' });
  }

  next();
};

const autenticarAdminToken = (req, res, next) => {
  const token = extrairTokenAdminRequest(req);

  if (!token) {
    return res.status(401).json({ erro: 'Sessão administrativa não encontrada. Faça login para continuar.' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err || !payload || payload.role !== 'admin') {
      limparCookie(res, ADMIN_AUTH_COOKIE_NAME, { httpOnly: true });
      return res.status(403).json({ erro: 'Sua sessão administrativa expirou. Faça login novamente.' });
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
    const { nome, email, senha, telefone, whatsapp_opt_in, recaptcha_token } = req.body || {};
    const optIn = !!whatsapp_opt_in;

    await validarRecaptcha({
      token: recaptcha_token,
      req,
      action: 'auth_cadastro'
    });

    if (!nome || !email || !senha || !telefone) {
      return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
    }

    if (!/^\S+@\S+\.\S+$/.test(String(email))) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }

    if (String(senha).length < 8) {
      return res.status(400).json({ erro: 'A senha deve ter no mínimo 8 caracteres.' });
    }

    // Verificar se o email já existe
    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length > 0) {
      return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' });
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
      mensagem: 'Cadastro realizado com sucesso.',
      csrfToken,
      accessToken: token,
      usuario: {
        id: resultado.insertId,
        nome: nome,
        email: email,
        telefone: telefone,
        whatsapp_opt_in: optIn
      }
    });
  } catch (erro) {
    if (erro?.httpStatus) {
      return res.status(erro.httpStatus).json({ erro: erro.message });
    }

    console.error('Erro ao cadastrar usuário:', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir o cadastro. Tente novamente.' });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, senha, recaptcha_token } = req.body || {};

    await validarRecaptcha({
      token: recaptcha_token,
      req,
      action: 'auth_login'
    });

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha.' });
    }

    // Buscar usuário
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha não conferem.' });
    }

    const usuario = usuarios[0];

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'E-mail ou senha não conferem.' });
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
      mensagem: 'Login realizado com sucesso.',
      csrfToken,
      accessToken: token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        whatsapp_opt_in: usuario.whatsapp_opt_in === 1 || usuario.whatsapp_opt_in === true
      }
    });
  } catch (erro) {
    if (erro?.httpStatus) {
      return res.status(erro.httpStatus).json({ erro: erro.message });
    }

    console.error('Erro ao fazer login:', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir o login. Tente novamente.' });
  }
});

// Login administrativo (somente acesso local)
app.post('/api/admin/login', adminAuthLimiter, exigirAcessoLocalAdmin, async (req, res) => {
  try {
    const { usuario, senha } = req.body || {};

    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ erro: 'A autenticação administrativa está indisponível no momento.' });
    }

    if (!usuario || !senha) {
      return res.status(400).json({ erro: 'Informe usuário e senha de administrador.' });
    }

    if (!compararTextoSegura(String(usuario).trim(), ADMIN_USER) || !compararTextoSegura(String(senha), ADMIN_PASSWORD)) {
      return res.status(401).json({ erro: 'Usuário ou senha de administrador inválidos.' });
    }

    const token = jwt.sign(
      { role: 'admin', usuario: ADMIN_USER },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const csrfToken = emitirCsrfToken(res);
    definirCookieAuth(res, ADMIN_AUTH_COOKIE_NAME, token, ADMIN_AUTH_COOKIE_MAX_AGE);

    return res.json({
      mensagem: 'Acesso administrativo liberado com sucesso.',
      usuario: ADMIN_USER,
      csrfToken,
      accessToken: token
    });
  } catch (erro) {
    console.error('Erro no login admin:', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir o login administrativo.' });
  }
});

app.get('/api/auth/csrf', (req, res) => {
  const csrfToken = emitirCsrfToken(res);
  return res.json({ csrfToken });
});

app.post('/api/auth/logout', (req, res) => {
  limparCookie(res, USER_AUTH_COOKIE_NAME, { httpOnly: true });
  limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
  return res.json({ mensagem: 'Sessão encerrada com sucesso.' });
});

app.get('/api/admin/me', exigirAcessoLocalAdmin, autenticarAdminToken, (req, res) => {
  return res.json({ admin: { usuario: req.admin?.usuario || ADMIN_USER } });
});

app.post('/api/admin/logout', exigirAcessoLocalAdmin, (req, res) => {
  limparCookie(res, ADMIN_AUTH_COOKIE_NAME, { httpOnly: true });
  limparCookie(res, CSRF_COOKIE_NAME, { httpOnly: false });
  return res.json({ mensagem: 'Sessão administrativa encerrada com sucesso.' });
});

// Obter dados do usuário logado
app.get('/api/auth/me', autenticarToken, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ erro: 'Não encontramos sua conta.' });
    }

    res.json({ usuario: usuarios[0] });
  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
    res.status(500).json({ erro: 'Não foi possível carregar os dados da sua conta.' });
  }
});

// Atualizar telefone e consentimento de WhatsApp
app.post('/api/usuario/whatsapp', autenticarToken, async (req, res) => {
  try {
    const { telefone, whatsapp_opt_in } = req.body;

    if (!telefone) {
      return res.status(400).json({ erro: 'Informe um telefone para continuar.' });
    }

    const numeroLimpo = telefone.trim();
    const optIn = !!whatsapp_opt_in;

    await pool.query(
      'UPDATE usuarios SET telefone = ?, whatsapp_opt_in = ? WHERE id = ?',
      [numeroLimpo, optIn, req.usuario.id]
    );

    res.json({ mensagem: 'Preferências de WhatsApp atualizadas com sucesso.', whatsapp_opt_in: optIn, telefone: numeroLimpo });
  } catch (erro) {
    console.error('Erro ao atualizar WhatsApp:', erro);
    res.status(500).json({ erro: 'Não foi possível atualizar suas preferências de WhatsApp.' });
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
    res.status(500).json({ erro: 'Não foi possível carregar seu endereço.' });
  }
});

// Salvar/atualizar endereço
app.post('/api/endereco', autenticarToken, async (req, res) => {
  try {
    const { rua, numero, bairro, cidade, estado, cep } = req.body;

    if (!rua || !numero || !bairro || !cidade || !estado || !cep) {
      return res.status(400).json({ erro: 'Preencha todos os campos do endereço.' });
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

    res.json({ mensagem: 'Endereço salvo com sucesso.' });
  } catch (erro) {
    console.error('Erro ao salvar endereço:', erro);
    res.status(500).json({ erro: 'Não foi possível salvar seu endereço. Tente novamente.' });
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

    const busca = toLowerTrim(req.query?.busca);
    const categoriaRaw = toLowerTrim(req.query?.categoria);
    const categoria = categoriaRaw && categoriaRaw !== 'todas' ? categoriaRaw : '';
    const ordenacaoRaw = toLowerTrim(req.query?.sort || req.query?.ordenacao);
    const ordenacaoMap = {
      nome_asc: 'categoria ASC, nome ASC',
      nome_desc: 'categoria DESC, nome DESC',
      preco_asc: 'preco ASC, nome ASC',
      preco_desc: 'preco DESC, nome ASC',
      recentes: 'id DESC'
    };
    const ordenacaoSql = ordenacaoMap[ordenacaoRaw] || 'categoria ASC, nome ASC';

    const usarPaginacao = ['page', 'pagina', 'limit', 'limite', 'busca', 'categoria', 'sort', 'ordenacao']
      .some((chave) => req.query?.[chave] !== undefined);

    const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 60, { min: 1, max: 200 });
    const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

    const filtros = ['ativo = TRUE'];
    const params = [];

    if (categoria) {
      filtros.push('LOWER(categoria) = ?');
      params.push(categoria);
    }

    if (busca) {
      const termo = `%${escapeLike(busca)}%`;
      const filtrosBusca = [
        `LOWER(nome) LIKE ? ESCAPE '\\\\'`
      ];
      params.push(termo);

      if (colunas.has('descricao')) {
        filtrosBusca.push(`LOWER(COALESCE(descricao, '')) LIKE ? ESCAPE '\\\\'`);
        params.push(termo);
      }

      if (colunas.has('marca')) {
        filtrosBusca.push(`LOWER(COALESCE(marca, '')) LIKE ? ESCAPE '\\\\'`);
        params.push(termo);
      }

      filtros.push(`(${filtrosBusca.join(' OR ')})`);
    }

    const whereSql = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    if (!usarPaginacao) {
      const [produtos] = await pool.query(
        `SELECT ${campos.join(', ')} FROM produtos ${whereSql} ORDER BY ${ordenacaoSql}`,
        params
      );

      return res.json({
        produtos,
        total: produtos.length
      });
    }

    const chaveCache = montarChaveCacheProdutos({
      pagina: paginaSolicitada,
      limite,
      busca,
      categoria,
      ordenacao: ordenacaoSql
    });
    const cachePayload = obterCacheProdutos(chaveCache);
    if (cachePayload) {
      return res.json({
        ...cachePayload,
        cache: true
      });
    }

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM produtos ${whereSql}`,
      params
    );
    const total = Number(countRow?.total || 0);
    const paginacao = montarPaginacao(total, paginaSolicitada, limite);
    const offset = (paginacao.pagina - 1) * paginacao.limite;

    const [produtos] = await pool.query(
      `SELECT ${campos.join(', ')}
       FROM produtos
       ${whereSql}
       ORDER BY ${ordenacaoSql}
       LIMIT ? OFFSET ?`,
      [...params, paginacao.limite, offset]
    );

    const payload = {
      produtos,
      paginacao
    };
    salvarCacheProdutos(chaveCache, payload);

    return res.json(payload);
  } catch (erro) {
    console.error('Erro ao buscar produtos:', erro);
    res.status(500).json({ erro: 'Não foi possível carregar os produtos no momento.' });
  }
});

app.get('/api/admin/produtos/barcode/:codigo', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const codigo = String(req.params.codigo || '').replace(/\D/g, '');
    if (codigo.length < 8) {
      return res.status(400).json({ erro: 'Informe um código de barras válido.' });
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

    return res.status(404).json({ erro: 'Produto não encontrado no catálogo e nas bases consultadas.' });
  } catch (erro) {
    console.error('Erro ao buscar produto por código de barras:', erro);
    return res.status(500).json({ erro: 'Não foi possível consultar o código de barras.' });
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
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    res.json({ produto: produtos[0] });
  } catch (erro) {
    console.error('Erro ao buscar produto:', erro);
    res.status(500).json({ erro: 'Não foi possível carregar este produto.' });
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
      return res.status(400).json({ erro: 'Preencha os campos obrigatórios do produto.' });
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

    limparCacheProdutos();

    res.status(201).json({
      mensagem: 'Produto cadastrado com sucesso',
      produto_id: resultado.insertId
    });
  } catch (erro) {
    console.error('Erro ao cadastrar produto:', erro);
    res.status(500).json({ erro: 'Não foi possível cadastrar o produto.' });
  }
});

// Importação em massa de produtos (admin)
app.post('/api/admin/produtos/bulk', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { produtos } = req.body;

    if (!produtos || !Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ erro: 'Envie uma lista válida de produtos para importação.' });
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
    limparCacheProdutos();

    res.status(201).json({
      mensagem: 'Produtos importados com sucesso',
      total_importados: importados
    });
  } catch (erro) {
    await connection.rollback();
    console.error('Erro ao importar produtos:', erro);
    res.status(500).json({ erro: 'Não foi possível importar os produtos.' });
  } finally {
    connection.release();
  }
});

app.get('/api/admin/produtos/importacao/modelo', exigirAcessoLocalAdmin, autenticarAdminToken, (req, res) => {
  const csvModelo = construirModeloImportacaoProdutosCsv();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-produtos.csv"');
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).send(`\uFEFF${csvModelo}`);
});

app.get('/api/admin/produtos/importacoes', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });
    const limit = parsePositiveInt(req.query?.limit || req.query?.limite, 20, { min: 1, max: 100 });

    const resultado = await listarImportacoesProdutos({
      pool,
      page,
      limit
    });

    return res.json(resultado);
  } catch (erro) {
    console.error('Erro ao listar histórico de importações de produtos:', erro);
    return res.status(500).json({
      erro: 'Não foi possível carregar o histórico de importações agora.'
    });
  }
});

app.post(
  '/api/admin/produtos/importar',
  exigirAcessoLocalAdmin,
  autenticarAdminToken,
  middlewareUploadImportacaoProdutos,
  async (req, res) => {
    try {
      if (!req.file || !Buffer.isBuffer(req.file.buffer)) {
        return res.status(400).json({ erro: 'Selecione um arquivo .xlsx ou .csv para importar.' });
      }

      const criarNovos = parseBooleanInput(req.body?.criar_novos, false);
      const simular = parseBooleanInput(req.body?.simular, false);

      const resultado = await importarProdutosPlanilha({
        pool,
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        createMissing: criarNovos,
        simulate: simular,
        adminUser: req.admin?.usuario || ADMIN_USER,
        adminUserId: req.admin?.id || null
      });

      if (!simular) {
        produtosColumnsCache = null;

        if (Number(resultado?.total_atualizados || 0) > 0 || Number(resultado?.total_criados || 0) > 0) {
          limparCacheProdutos();
        }
      }

      return res.status(200).json(resultado);
    } catch (erro) {
      const status = Number.isFinite(Number(erro?.httpStatus))
        ? Number(erro.httpStatus)
        : 500;

      if (status >= 500) {
        console.error('Erro ao importar planilha de produtos:', erro);
      }

      const payloadErro = {
        erro: erro?.message || 'Não foi possível processar a importação da planilha.'
      };

      if (erro?.extra && typeof erro.extra === 'object') {
        payloadErro.detalhes = erro.extra;
      }

      return res.status(status).json(payloadErro);
    }
  }
);

// Excluir produto (admin) - soft delete
app.delete('/api/admin/produtos/:id', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE produtos SET ativo = FALSE WHERE id = ?',
      [req.params.id]
    );

    limparCacheProdutos();

    res.json({ mensagem: 'Produto removido com sucesso.' });
  } catch (erro) {
    console.error('Erro ao excluir produto:', erro);
    res.status(500).json({ erro: 'Não foi possível remover o produto.' });
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
    const taxId = taxIdDigits || (PAGBANK_ENV === 'production' ? null : '12345678909');

    if (!PAGBANK_TOKEN) {
      return res.status(503).json({ erro: 'Esta forma de pagamento está temporariamente indisponível.' });
    }

    if (!pedido_id) {
      return res.status(400).json({ erro: 'Não foi possível identificar o pedido para pagamento.' });
    }

    if (!taxId) {
      return res.status(400).json({ erro: 'Informe CPF ou CNPJ para gerar o PIX.' });
    }

    if (![11, 14].includes(String(taxId).length)) {
      return res.status(400).json({ erro: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
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
      return res.status(404).json({ erro: 'Pedido não encontrado para esta conta.' });
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
    res.status(500).json({ erro: 'Não foi possível gerar o PIX. Tente novamente.' });
  }
});

// Processar pagamento com cartão (PagBank API Orders) para um pedido existente
app.post('/api/pagamentos/cartao', autenticarToken, async (req, res) => {
  try {
    const { pedido_id } = req.body || {};
    const taxIdRaw = req.body?.tax_id ?? req.body?.cpf;
    const taxIdDigits = (taxIdRaw || '').toString().replace(/\D/g, '');
    const tokenCartao = String(req.body?.token_cartao || req.body?.cartao_encriptado || '').trim();
    const authenticationMethod = req.body?.authentication_method;
    const tipoCartaoSolicitado = String(req.body?.tipo_cartao || req.body?.forma_pagamento || '').trim();
    const parcelas = normalizarParcelasCartao(req.body?.parcelas);

    registrarLogPagBank({
      operacao: 'api.pagamentos.cartao.request',
      endpoint: '/api/pagamentos/cartao',
      method: 'POST',
      requestPayload: req.body,
      extra: {
        usuario_id: req.usuario?.id || null,
        pedido_id
      }
    });

    if (!PAGBANK_TOKEN) {
      return res.status(503).json({ erro: 'Esta forma de pagamento está temporariamente indisponível.' });
    }

    if (!pedido_id) {
      return res.status(400).json({ erro: 'Não foi possível identificar o pedido para pagamento.' });
    }

    if (![11, 14].includes(taxIdDigits.length)) {
      return res.status(400).json({ erro: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
    }

    if (!tokenCartao) {
      return res.status(400).json({ erro: 'Não foi possível validar os dados do cartão.' });
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.total, p.status, p.forma_pagamento, u.email, u.nome
       FROM pedidos p
       JOIN usuarios u ON p.usuario_id = u.id
       WHERE p.id = ? AND p.usuario_id = ?
       LIMIT 1`,
      [pedido_id, req.usuario.id]
    );

    if (!rows.length) {
      return res.status(404).json({ erro: 'Pedido não encontrado para esta conta.' });
    }

    const pedido = rows[0];
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

    if (tipoCartao === 'debito' && PAGBANK_ENV === 'production') {
      const validacaoAuthDebito = validarAuthenticationMethodPagBank(authenticationMethod);
      if (!validacaoAuthDebito.ok) {
        return res.status(400).json({
          erro: 'Não foi possível validar a autenticação de segurança do cartão.'
        });
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
        console.warn('⚠️ Não foi possível reconsultar order no PagBank após criação:', erroConsultaOrder?.message || erroConsultaOrder);
      }
    }

    const chargePrincipal = statusInfo.chargePrincipal || {};
    const paymentResponse = chargePrincipal?.payment_response || {};
    const statusPagBank = String(statusInfo.statusResolvido || 'WAITING').toUpperCase();
    const statusInterno = mapearStatusPedido(statusPagBank);
    const pagbankChargeId = chargePrincipal?.id || null;

    try {
      await pool.query(
        `UPDATE pedidos
         SET status = ?, pix_status = ?, pix_id = ?
         WHERE id = ?`,
        [statusInterno, statusPagBank, pagbankOrderId, pedido.id]
      );
    } catch (err) {
      console.warn('Não foi possível salvar dados do pagamento cartão (faltam colunas?):', err.message);
    }

    const payloadResposta = {
      payment_id: pagbankChargeId,
      pagbank_order_id: pagbankOrderId,
      status: statusPagBank,
      status_interno: statusInterno,
      status_order: statusInfo.orderStatus || null,
      status_charge: statusInfo.chargeStatus || null,
      status_fonte: statusInfo.fonteStatus,
      tipo_cartao: tipoCartao,
      parcelas: tipoCartao === 'debito' ? 1 : parcelasAplicadas,
      authorization_code: paymentResponse?.code || null,
      message: paymentResponse?.message || null,
      raw: pagamento
    };

    registrarLogPagBank({
      operacao: 'api.pagamentos.cartao.response',
      endpoint: '/api/pagamentos/cartao',
      method: 'POST',
      httpStatus: 200,
      responsePayload: payloadResposta,
      extra: {
        usuario_id: req.usuario?.id || null,
        pedido_id: pedido.id,
        pagbank_order_id: pagbankOrderId,
        pagbank_charge_id: pagbankChargeId
      }
    });

    return res.json(payloadResposta);
  } catch (erro) {
    registrarLogPagBank({
      operacao: 'api.pagamentos.cartao.error',
      endpoint: '/api/pagamentos/cartao',
      method: 'POST',
      httpStatus: 500,
      requestPayload: req.body,
      responsePayload: {
        erro: erro?.message || 'Não foi possível processar o pagamento com cartão'
      },
      extra: {
        usuario_id: req.usuario?.id || null
      }
    });

    console.error('Erro ao processar pagamento com cartão:', erro);
    return res.status(500).json({ erro: erro?.message || 'Não foi possível processar o pagamento com cartão.' });
  }
});

// Simular frete por CEP
app.get('/api/frete/simular', async (req, res) => {
  try {
    const cep = String(req.query?.cep || '').trim();
    const veiculo = String(req.query?.veiculo || 'moto').trim().toLowerCase();

    const entrega = await calcularEntregaPorCep({
      cepDestino: cep,
      veiculo
    });

    return res.json({
      mensagem: 'Frete calculado com sucesso',
      ...entrega,
      limite_bike_km: LIMITE_BIKE_KM
    });
  } catch (erro) {
    if (erro?.httpStatus) {
      return res.status(erro.httpStatus).json({ erro: erro.message });
    }

    console.error('Erro ao simular frete por CEP:', erro);
    return res.status(500).json({ erro: 'Não foi possível calcular o frete no momento.' });
  }
});

// Criar pedido
app.post('/api/pedidos', autenticarToken, async (req, res) => {
  const connection = await pool.getConnection();
  let transacaoAberta = false;
  
  try {
    const { itens, forma_pagamento, cupom_id, entrega } = req.body || {};
    let usuarioPedido = null;

    if (!Array.isArray(itens) || itens.length === 0) {
      throw criarErroHttp(400, 'Seu carrinho está vazio.');
    }

    if (itens.length > 100) {
      throw criarErroHttp(400, 'Este pedido excede a quantidade máxima de itens permitida.');
    }

    const formaPagamento = String(forma_pagamento || 'pix').toLowerCase();
    const formasPermitidas = new Set(['pix', 'dinheiro', 'debito', 'credito', 'cartao']);
    if (!formasPermitidas.has(formaPagamento)) {
      throw criarErroHttp(400, 'Forma de pagamento inválida para este pedido.');
    }

    const taxIdRaw = req.body?.tax_id ?? req.body?.cpf;
    const taxIdDigits = (taxIdRaw || '').toString().replace(/\D/g, '');
    const pagbankProducao = PAGBANK_ENV === 'production';
    const usaPagbank = ['pix', 'cartao', 'credito', 'debito'].includes(formaPagamento);
    const pixMockPermitido = !pagbankProducao && ALLOW_PIX_MOCK;

    if (usaPagbank && pagbankProducao && !PAGBANK_TOKEN) {
      throw criarErroHttp(503, 'Esta forma de pagamento está temporariamente indisponível.');
    }

    if (formaPagamento === 'pix' && !PAGBANK_TOKEN && !pixMockPermitido) {
      throw criarErroHttp(503, 'O pagamento via PIX está temporariamente indisponível.');
    }

    if (usaPagbank && pagbankProducao && ![11, 14].includes(taxIdDigits.length)) {
      throw criarErroHttp(400, 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamentos via PagBank.');
    }

    const itensNormalizados = itens.map((item) => ({
      produto_id: Number(item?.produto_id),
      quantidade: Math.floor(Number(item?.quantidade || 1))
    }));

    if (itensNormalizados.some((item) => !Number.isInteger(item.produto_id) || item.produto_id <= 0 || !Number.isInteger(item.quantidade) || item.quantidade <= 0 || item.quantidade > 100)) {
      throw criarErroHttp(400, 'Há itens inválidos no carrinho.');
    }

    const idsProdutos = [...new Set(itensNormalizados.map((item) => item.produto_id))];
    const placeholdersProdutos = idsProdutos.map(() => '?').join(', ');

    const [produtos] = await connection.query(
      `SELECT id, nome, preco FROM produtos WHERE ativo = TRUE AND id IN (${placeholdersProdutos})`,
      idsProdutos
    );

    if (produtos.length !== idsProdutos.length) {
      throw criarErroHttp(400, 'Um ou mais produtos do carrinho estão indisponíveis.');
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
      throw criarErroHttp(400, 'Não foi possível calcular o total do pedido.');
    }

    if (!entrega || typeof entrega !== 'object') {
      throw criarErroHttp(400, 'Informe os dados de entrega para continuar.');
    }

    const veiculoEntrega = String(entrega.veiculo || 'moto').trim().toLowerCase();
    const cepDestinoEntrega = normalizarCep(entrega.cep_destino || entrega.cep);

    if (cepDestinoEntrega.length !== 8) {
      throw criarErroHttp(400, 'Informe um CEP de entrega válido.');
    }

    const entregaCalculada = await calcularEntregaPorCep({
      cepDestino: cepDestinoEntrega,
      veiculo: veiculoEntrega
    });

    const freteEntrega = entregaCalculada.frete;
    const entregaNormalizada = {
      veiculo: entregaCalculada.veiculo,
      distancia_km: entregaCalculada.distancia_km,
      cep_origem: entregaCalculada.cep_origem,
      numero_origem: entregaCalculada.numero_origem,
      cep_destino: entregaCalculada.cep_destino
    };

    const [usuarioPedidoRows] = await connection.query(
      'SELECT nome, email, telefone, whatsapp_opt_in FROM usuarios WHERE id = ? LIMIT 1',
      [req.usuario.id]
    );
    usuarioPedido = usuarioPedidoRows.length ? usuarioPedidoRows[0] : null;

    if (!usuarioPedido) {
      throw criarErroHttp(404, 'Não encontramos a conta do usuário para este pedido.');
    }

    await connection.beginTransaction();
    transacaoAberta = true;

    let descontoAplicado = 0;
    let cupomIdValidado = null;

    if (cupom_id !== undefined && cupom_id !== null && String(cupom_id).trim() !== '') {
      const cupomIdNumerico = Number(cupom_id);
      if (!Number.isInteger(cupomIdNumerico) || cupomIdNumerico <= 0) {
        throw criarErroHttp(400, 'Cupom inválido.');
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
        throw criarErroHttp(400, 'Cupom inválido ou expirado.');
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
        throw criarErroHttp(400, 'Este cupom já foi utilizado nesta conta.');
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

    const totalProdutos = Number((total - descontoAplicado).toFixed(2));
    const totalFinal = Number((totalProdutos + freteEntrega).toFixed(2));

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
    const podeUsarPixMock = !pagbankProducao && ALLOW_PIX_MOCK;

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

        if (podeUsarPixMock) {
          // Fallback local controlado por flag explícita.
          pixCodigo = '00020126580014BR.GOV.BCB.PIX' + pedidoId.toString().padStart(10, '0');
        }
      }
    } else if (formaPagamento === 'pix' && podeUsarPixMock) {
      // Gerar código PIX simulado somente quando ALLOW_PIX_MOCK=true.
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
      mensagem: 'Pedido confirmado com sucesso.',
      pedido_id: pedidoId,
      total: totalFinal,
      total_produtos: totalProdutos,
      frete_entrega: freteEntrega,
      veiculo_entrega: entregaNormalizada?.veiculo || null,
      distancia_entrega_km: entregaNormalizada?.distancia_km || null,
      cep_origem_entrega: entregaNormalizada?.cep_origem || null,
      numero_origem_entrega: entregaNormalizada?.numero_origem || null,
      cep_destino_entrega: entregaNormalizada?.cep_destino || null,
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
    res.status(500).json({ erro: 'Não foi possível finalizar seu pedido. Tente novamente.' });
  } finally {
    connection.release();
  }
});

// Listar pedidos do usuário
app.get('/api/pedidos', autenticarToken, async (req, res) => {
  try {
    const usarPaginacao = ['page', 'pagina', 'limit', 'limite']
      .some((chave) => req.query?.[chave] !== undefined);

    if (!usarPaginacao) {
      const [pedidos] = await pool.query(
        'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC',
        [req.usuario.id]
      );

      return res.json({
        pedidos,
        total: pedidos.length
      });
    }

    const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 20, { min: 1, max: 100 });
    const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pedidos WHERE usuario_id = ?',
      [req.usuario.id]
    );
    const total = Number(countRow?.total || 0);
    const paginacao = montarPaginacao(total, paginaSolicitada, limite);
    const offset = (paginacao.pagina - 1) * paginacao.limite;

    const [pedidos] = await pool.query(
      'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT ? OFFSET ?',
      [req.usuario.id, paginacao.limite, offset]
    );

    return res.json({
      pedidos,
      paginacao
    });
  } catch (erro) {
    console.error('Erro ao buscar pedidos:', erro);
    res.status(500).json({ erro: 'Não foi possível carregar seus pedidos.' });
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
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
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
    res.status(500).json({ erro: 'Não foi possível carregar os detalhes do pedido.' });
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
      return res.status(404).json({ erro: 'Cupom inválido ou expirado.' });
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
      return res.status(400).json({ erro: 'Este cupom já foi utilizado nesta conta.' });
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
    res.status(500).json({ erro: 'Não foi possível validar o cupom. Tente novamente.' });
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
    res.status(500).json({ erro: 'Não foi possível carregar os cupons disponíveis.' });
  }
});

// ============================================
// ROTAS ADMINISTRATIVAS
// ============================================

// Listar todos os pedidos (admin)
app.get('/api/admin/pedidos', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const usarPaginacao = ['page', 'pagina', 'limit', 'limite']
      .some((chave) => req.query?.[chave] !== undefined);
    const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 200, { min: 1, max: 500 });
    const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

    let pedidosBase = [];
    let paginacao = null;

    if (usarPaginacao) {
      const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM pedidos');
      const total = Number(countRow?.total || 0);
      paginacao = montarPaginacao(total, paginaSolicitada, limite);
      const offset = (paginacao.pagina - 1) * paginacao.limite;

      [pedidosBase] = await pool.query(
        `SELECT
          p.*,
          u.nome AS cliente_nome,
          u.email AS cliente_email,
          u.telefone AS cliente_telefone
         FROM pedidos p
         LEFT JOIN usuarios u ON p.usuario_id = u.id
         ORDER BY p.criado_em DESC
         LIMIT ? OFFSET ?`,
        [paginacao.limite, offset]
      );
    } else {
      [pedidosBase] = await pool.query(`
        SELECT
          p.*,
          u.nome AS cliente_nome,
          u.email AS cliente_email,
          u.telefone AS cliente_telefone
        FROM pedidos p
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.criado_em DESC
      `);
    }

    if (pedidosBase.length === 0) {
      if (paginacao) {
        return res.json({ pedidos: [], paginacao });
      }
      return res.json({ pedidos: [] });
    }

    const pedidoIds = pedidosBase
      .map((pedido) => Number(pedido.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const usuariosIds = [...new Set(
      pedidosBase
        .map((pedido) => Number(pedido.usuario_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    const itensPorPedido = new Map();
    if (pedidoIds.length > 0) {
      const placeholdersPedidos = pedidoIds.map(() => '?').join(', ');
      const [itensRows] = await pool.query(
        `SELECT * FROM pedido_itens WHERE pedido_id IN (${placeholdersPedidos}) ORDER BY pedido_id, id`,
        pedidoIds
      );

      for (const item of itensRows) {
        const pedidoId = Number(item.pedido_id);
        const atual = itensPorPedido.get(pedidoId) || [];
        atual.push(item);
        itensPorPedido.set(pedidoId, atual);
      }
    }

    const enderecosPorUsuario = new Map();
    if (usuariosIds.length > 0) {
      const placeholdersUsuarios = usuariosIds.map(() => '?').join(', ');
      const [enderecosRows] = await pool.query(
        `SELECT * FROM enderecos WHERE usuario_id IN (${placeholdersUsuarios}) ORDER BY usuario_id, atualizado_em DESC`,
        usuariosIds
      );

      for (const endereco of enderecosRows) {
        const usuarioId = Number(endereco.usuario_id);
        if (!enderecosPorUsuario.has(usuarioId)) {
          enderecosPorUsuario.set(usuarioId, endereco);
        }
      }
    }

    const pedidos = pedidosBase.map((pedido) => {
      const pedidoId = Number(pedido.id);
      const usuarioId = Number(pedido.usuario_id);
      return {
        ...pedido,
        itens: itensPorPedido.get(pedidoId) || [],
        endereco: enderecosPorUsuario.get(usuarioId) || null
      };
    });

    if (paginacao) {
      return res.json({ pedidos, paginacao });
    }

    return res.json({ pedidos });
  } catch (erro) {
    console.error('Erro ao buscar pedidos (admin):', erro);
    res.status(500).json({ erro: 'Não foi possível carregar os pedidos no painel.' });
  }
});

// Atualizar status do pedido (admin)
app.put('/api/admin/pedidos/:id/status', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
  try {
    const { status } = req.body;
    const pedidoId = req.params.id;

    const statusValidos = ['pendente', 'preparando', 'enviado', 'entregue', 'cancelado'];
    
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Selecione um status de pedido válido.' });
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

    res.json({ mensagem: 'Status do pedido atualizado com sucesso.', status: status });
  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    res.status(500).json({ erro: 'Não foi possível atualizar o status do pedido.' });
  }
});

// ============================================
// WEBHOOK EVOLUTION (WHATSAPP)
// ============================================
app.post('/api/webhooks/evolution', async (req, res) => {
  try {
    if (!validarWebhookEvolution(req)) {
      return res.status(401).json({ erro: 'Webhook Evolution nao autorizado' });
    }

    if (!WHATSAPP_AUTO_REPLY_ENABLED || !WHATSAPP_AUTO_REPLY_TEXT) {
      return res.sendStatus(200);
    }

    const payload = req.body || {};
    const evento = String(payload?.event || payload?.type || '').toLowerCase();
    const { remoteJid, fromMe, messageId, temConteudo } = extrairDadosMensagemEvolution(payload);

    if (evento && !evento.includes('message')) {
      return res.sendStatus(200);
    }

    if (!remoteJid || fromMe || isJidGrupoOuBroadcast(remoteJid) || !temConteudo) {
      return res.sendStatus(200);
    }

    limparCacheEvolution();

    if (messageId) {
      if (evolutionProcessedMessageIds.has(messageId)) {
        return res.sendStatus(200);
      }
      evolutionProcessedMessageIds.set(messageId, Date.now());
    }

    const telefone = formatarTelefoneWhatsapp(remoteJid);
    if (!telefone) {
      return res.sendStatus(200);
    }

    const cooldown = Number.isInteger(WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS)
      ? Math.max(0, WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS)
      : 0;
    const agora = Date.now();
    const ultimaResposta = evolutionLastReplyByNumber.get(telefone) || 0;
    if (cooldown > 0 && (agora - ultimaResposta) < cooldown * 1000) {
      return res.sendStatus(200);
    }

    const enviado = await enviarWhatsappTexto({
      telefone,
      mensagem: WHATSAPP_AUTO_REPLY_TEXT
    });

    if (enviado) {
      evolutionLastReplyByNumber.set(telefone, agora);
      console.log('✅ Auto-resposta WhatsApp enviada para:', telefone);
    }

    return res.sendStatus(200);
  } catch (erro) {
    console.error('Erro no webhook Evolution:', erro?.message || erro);
    return res.sendStatus(500);
  }
});

// ============================================
// WEBHOOK PAGBANK (PIX + CARTAO)
// ============================================
async function processarWebhookPagBank(req, res, endpointLog = '/api/webhooks/pagbank') {
  try {
    if (!validarWebhookPagBank(req)) {
      return res.status(401).json({ erro: 'Webhook não autorizado' });
    }

    const notificacao = req.body || {};
    const eventType = String(notificacao?.event || notificacao?.type || '').trim().toUpperCase();

    // PagBank envia notificações com estrutura:
    // { id, reference_id, charges: [{ id, status, ... }] }
    
    if (!notificacao || !notificacao.id) {
      return res.status(400).json({ erro: 'Notificação inválida' });
    }

    const orderId = String(notificacao.id).trim();

    // Alguns eventos podem vir sem reference_id/charges.
    // Se faltar, consulta o pedido no PagBank para obter os dados completos.
    let referenceId = notificacao.reference_id; // Ex: "pedido_123"
    let charges = Array.isArray(notificacao.charges) ? notificacao.charges : [];
    let orderStatus = String(notificacao?.status || '').trim().toUpperCase();
    if ((!referenceId || charges.length === 0 || !orderStatus) && PAGBANK_TOKEN) {
      try {
        const detalhes = await obterPedidoPagBank(orderId);
        referenceId = referenceId || detalhes?.reference_id;
        charges = charges.length ? charges : (detalhes?.charges || []);
        orderStatus = orderStatus || String(detalhes?.status || '').trim().toUpperCase();
      } catch (errConsulta) {
        console.error('Erro ao consultar pedido no PagBank:', errConsulta.message);
      }
    }

    const statusInfo = extrairStatusPagamentoPagBank(
      {
        status: orderStatus,
        charges
      },
      eventType
    );
    const statusPagBank = String(statusInfo.statusResolvido || 'WAITING').toUpperCase();
    const chargePrincipal = statusInfo.chargePrincipal || {};
    const chargeId = chargePrincipal?.id || null;

    const statusInterno = mapearStatusPedido(statusPagBank);

    registrarLogPagBank({
      operacao: 'webhook.pagbank.recebido',
      endpoint: endpointLog,
      method: 'POST',
      requestPayload: notificacao,
      extra: {
        event_type: eventType || null,
        order_id: orderId,
        charge_id: chargeId,
        reference_id: referenceId || null,
        status_pagbank: statusPagBank,
        status_fonte: statusInfo.fonteStatus,
        status_order: statusInfo.orderStatus || null,
        status_charge: statusInfo.chargeStatus || null
      }
    });
    
    // Extrair pedidoId do reference_id (formato: "pedido_123")
    let pedidoId = null;
    if (referenceId && referenceId.startsWith('pedido_')) {
      const parsedPedidoId = Number.parseInt(referenceId.replace('pedido_', ''), 10);
      pedidoId = Number.isInteger(parsedPedidoId) ? parsedPedidoId : null;
    }

    if (pedidoId) {
      try {
        let resultadoUpdate = null;
        let modoPersistencia = 'completo';

        try {
          const [resultadoCompleto] = await pool.query(
            'UPDATE pedidos SET status = ?, pix_status = ?, pix_id = ? WHERE id = ?',
            [statusInterno, statusPagBank, orderId, pedidoId]
          );
          resultadoUpdate = resultadoCompleto;
        } catch (erroUpdateCompleto) {
          const colunaPixAusente = /unknown column\s+'(?:pix_status|pix_id)'/i.test(String(erroUpdateCompleto?.message || ''));
          if (!colunaPixAusente) {
            throw erroUpdateCompleto;
          }

          const [resultadoFallback] = await pool.query(
            'UPDATE pedidos SET status = ? WHERE id = ?',
            [statusInterno, pedidoId]
          );
          resultadoUpdate = resultadoFallback;
          modoPersistencia = 'fallback_sem_colunas_pix';
          console.warn('⚠️ Coluna pix_status/pix_id ausente. Persistindo webhook PagBank em modo fallback por status.');
        }

        console.log(`✅ Pedido #${pedidoId} atualizado para status: ${statusInterno}`);
        registrarLogPagBank({
          operacao: 'webhook.pagbank.persistencia',
          endpoint: endpointLog,
          method: 'POST',
          responsePayload: {
            pedido_id: pedidoId,
            order_id: orderId,
            charge_id: chargeId,
            persist_mode: modoPersistencia,
            status_interno: statusInterno,
            status_pagbank: statusPagBank,
            linhas_afetadas: Number(resultadoUpdate?.affectedRows || 0)
          }
        });
      } catch (err) {
        console.error('Erro ao atualizar pedido:', err.message);
      }
    } else {
      // Tentar encontrar pelo pix_id
      try {
        let resultadoUpdate = null;
        let modoPersistencia = 'completo';

        try {
          const [resultadoCompleto] = await pool.query(
            'UPDATE pedidos SET status = ?, pix_status = ? WHERE pix_id = ?',
            [statusInterno, statusPagBank, orderId]
          );
          resultadoUpdate = resultadoCompleto;
        } catch (erroUpdateCompleto) {
          const colunaPixAusente = /unknown column\s+'(?:pix_status|pix_id)'/i.test(String(erroUpdateCompleto?.message || ''));
          if (!colunaPixAusente) {
            throw erroUpdateCompleto;
          }

          // Sem pix_id no schema, não é possível localizar pedido por orderId quando reference_id não mapeia para pedido_id.
          resultadoUpdate = { affectedRows: 0 };
          modoPersistencia = 'fallback_sem_colunas_pix_sem_lookup';
          console.warn('⚠️ Coluna pix_status/pix_id ausente e sem pedido_id no reference_id. Persistência do webhook não aplicada.');
        }

        console.log(`✅ Pedido com pix_id ${orderId} atualizado para status: ${statusInterno}`);
        registrarLogPagBank({
          operacao: 'webhook.pagbank.persistencia',
          endpoint: endpointLog,
          method: 'POST',
          responsePayload: {
            pix_id: orderId,
            order_id: orderId,
            charge_id: chargeId,
            persist_mode: modoPersistencia,
            status_interno: statusInterno,
            status_pagbank: statusPagBank,
            linhas_afetadas: Number(resultadoUpdate?.affectedRows || 0)
          }
        });
      } catch (err) {
        console.error('Erro ao atualizar pedido por pix_id:', err.message);
      }
    }

    return res.sendStatus(200);
  } catch (erro) {
    console.error('Erro no webhook do PagBank:', erro);
    return res.sendStatus(500);
  }
}

app.post('/api/webhooks/pagbank', (req, res) => {
  return processarWebhookPagBank(req, res, '/api/webhooks/pagbank');
});

app.post('/api/pagbank/webhook', (req, res) => {
  return processarWebhookPagBank(req, res, '/api/pagbank/webhook');
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
    res.status(500).json({ erro: 'Não foi possível carregar as avaliações.' });
  }
});

// Criar avaliação
app.post('/api/avaliacoes', autenticarToken, async (req, res) => {
  try {
    const { produto_id, nota, comentario } = req.body;
    
    if (!produto_id || !nota || nota < 1 || nota > 5) {
      return res.status(400).json({ erro: 'Informe uma nota válida entre 1 e 5.' });
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
    
    res.json({ mensagem: 'Avaliação registrada com sucesso.' });
  } catch (error) {
    console.error('Erro ao salvar avaliação:', error);
    res.status(500).json({ erro: 'Não foi possível salvar sua avaliação.' });
  }
});

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
}

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌍 CORS_ORIGINS: ${CORS_ORIGINS.join(', ') || '(nenhuma origem explícita)'}`);
  console.log(`🍪 Cookies: secure=${COOKIE_SECURE} sameSite=${COOKIE_SAME_SITE} domain=${COOKIE_DOMAIN || '(sem domínio)'}`);
  console.log(`\n📚 Endpoints disponíveis:`);
  console.log(`   POST   /api/auth/cadastro`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/endereco`);
  console.log(`   POST   /api/endereco`);
  console.log(`   GET    /api/produtos`);
  console.log(`   GET    /api/produtos/:id`);
  console.log(`   GET    /api/frete/simular?cep=68740180&veiculo=moto`);
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
