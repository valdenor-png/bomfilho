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
const crypto = require('crypto');
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

const EXTERNAL_HTTP_TIMEOUT_MS = Number.parseInt(String(process.env.EXTERNAL_HTTP_TIMEOUT_MS || '8000'), 10) || 8000;
const BRASIL_API_TIMEOUT_MS = Number.parseInt(String(process.env.BRASIL_API_TIMEOUT_MS || '5000'), 10) || 5000;
const WHATSAPP_HTTP_TIMEOUT_MS = Number.parseInt(String(process.env.WHATSAPP_HTTP_TIMEOUT_MS || '8000'), 10) || 8000;
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

function registrarLogFreteDebug(evento, dados = {}) {
  if (!FRETE_DEBUG_LOGS) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    evento: String(evento || 'frete'),
    dados
  };

  logger.info(`FRETE_DEBUG ${JSON.stringify(payload)}`);
}

function calcularFreteEntregaDetalhado(veiculoKey, distanciaKm) {
  const veiculo = VEICULOS_ENTREGA[veiculoKey] || VEICULOS_ENTREGA.moto;
  const distanciaBruta = Number(distanciaKm);
  const distanciaNormalizada = normalizarDistanciaEntregaKm(distanciaBruta);
  const custoCombustivelKm = veiculo.consumoKmLitro
    ? PRECO_COMBUSTIVEL_LITRO / veiculo.consumoKmLitro
    : 0;
  const custoOperacionalKm = (custoCombustivelKm + veiculo.custoManutencaoKm) * veiculo.fatorReparo;
  const frete = toMoney(veiculo.taxaBase + (distanciaNormalizada * custoOperacionalKm));

  return {
    frete,
    distancia_bruta_km: Number((Number.isFinite(distanciaBruta) ? distanciaBruta : 0).toFixed(3)),
    distancia_cobrada_km: distanciaNormalizada,
    taxa_base: toMoney(veiculo.taxaBase),
    custo_combustivel_km: Number(custoCombustivelKm.toFixed(4)),
    custo_manutencao_km: Number(veiculo.custoManutencaoKm.toFixed(4)),
    fator_reparo: Number(veiculo.fatorReparo.toFixed(2)),
    custo_operacional_km: Number(custoOperacionalKm.toFixed(4))
  };
}

function _calcularFreteEntrega(veiculoKey, distanciaKm) {
  return calcularFreteEntregaDetalhado(veiculoKey, distanciaKm).frete;
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

function normalizarTextoComparacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function textoCompativel(textoA, textoB) {
  const a = normalizarTextoComparacao(textoA);
  const b = normalizarTextoComparacao(textoB);

  if (!a || !b) {
    return true;
  }

  return a.includes(b) || b.includes(a);
}

function criarCoordenadaFonteValida(latitude, longitude, fonte) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lon,
    fonte: String(fonte || 'desconhecida')
  };
}

function listarCoordenadasPossiveis(localidade) {
  const coordenadas = [];
  const visitados = new Set();

  function adicionar(coord) {
    if (!coord || !Number.isFinite(coord.latitude) || !Number.isFinite(coord.longitude)) {
      return;
    }

    const chave = `${coord.latitude.toFixed(6)}:${coord.longitude.toFixed(6)}`;
    if (visitados.has(chave)) {
      return;
    }

    visitados.add(chave);
    coordenadas.push(coord);
  }

  adicionar(criarCoordenadaFonteValida(localidade?.latitude, localidade?.longitude, localidade?.fonte_coordenadas || 'principal'));
  adicionar(criarCoordenadaFonteValida(localidade?.coordenadas_alternativas?.brasilapi?.latitude, localidade?.coordenadas_alternativas?.brasilapi?.longitude, 'brasilapi'));
  adicionar(criarCoordenadaFonteValida(localidade?.coordenadas_alternativas?.nominatim?.latitude, localidade?.coordenadas_alternativas?.nominatim?.longitude, 'nominatim'));

  return coordenadas;
}

function calcularDistanciaEntregaAjustada(origem, destino) {
  const distanciaBase = Number(
    calcularDistanciaHaversineKm(origem.latitude, origem.longitude, destino.latitude, destino.longitude).toFixed(2)
  );

  const coordsOrigem = listarCoordenadasPossiveis(origem);
  const coordsDestino = listarCoordenadasPossiveis(destino);

  let menorDistancia = Number.POSITIVE_INFINITY;
  let melhorPar = null;
  let combinacoesAvaliadas = 0;

  for (const coordOrigem of coordsOrigem) {
    for (const coordDestino of coordsDestino) {
      combinacoesAvaliadas += 1;
      const distancia = Number(
        calcularDistanciaHaversineKm(
          coordOrigem.latitude,
          coordOrigem.longitude,
          coordDestino.latitude,
          coordDestino.longitude
        ).toFixed(2)
      );

      if (!Number.isFinite(distancia) || distancia <= 0) {
        continue;
      }

      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        melhorPar = {
          origem: coordOrigem,
          destino: coordDestino
        };
      }
    }
  }

  const cidadeOrigem = String(origem?.cidade || '').trim().toLowerCase();
  const cidadeDestino = String(destino?.cidade || '').trim().toLowerCase();
  const estadoOrigem = String(origem?.estado || '').trim().toLowerCase();
  const estadoDestino = String(destino?.estado || '').trim().toLowerCase();
  const mesmaCidadeEstado = Boolean(cidadeOrigem && cidadeDestino && cidadeOrigem === cidadeDestino && estadoOrigem && estadoDestino && estadoOrigem === estadoDestino);

  let distanciaFinal = distanciaBase;
  let fonteOrigem = String(origem?.fonte_coordenadas || 'principal');
  let fonteDestino = String(destino?.fonte_coordenadas || 'principal');
  let ajusteAplicado = false;

  if (Number.isFinite(menorDistancia) && Number.isFinite(distanciaBase) && menorDistancia < distanciaBase) {
    const variacao = distanciaBase > 0 ? (distanciaBase - menorDistancia) / distanciaBase : 0;
    const podeAjustar = mesmaCidadeEstado || variacao >= 0.2;

    if (podeAjustar && melhorPar) {
      distanciaFinal = menorDistancia;
      fonteOrigem = melhorPar.origem.fonte;
      fonteDestino = melhorPar.destino.fonte;
      ajusteAplicado = true;
    }
  }

  return {
    metodo_distancia: 'haversine_linha_reta',
    distancia_base_km: distanciaBase,
    distancia_km: Number(distanciaFinal.toFixed(2)),
    fonte_origem: fonteOrigem,
    fonte_destino: fonteDestino,
    ajuste_aplicado: ajusteAplicado,
    combinacoes_avaliadas: combinacoesAvaliadas
  };
}

async function buscarCoordenadasPorCep(cep, { numero = '', tipoLocal = 'destino' } = {}) {
  const cepNormalizado = normalizarCep(cep);
  if (cepNormalizado.length !== 8) {
    throw criarErroHttp(400, 'CEP inválido. Informe 8 dígitos.');
  }

  const numeroNormalizado = String(numero || '').trim();
  const chaveCache = numeroNormalizado
    ? `${cepNormalizado}:${numeroNormalizado}`
    : cepNormalizado;
  const cache = cepGeoCache.get(chaveCache);
  const cacheIdadeMs = cache ? Date.now() - cache.cachedAt : null;

  if (cache && cacheIdadeMs < CEP_GEO_TTL_MS) {
    registrarLogFreteDebug('geocode_cache_hit', {
      tipo_local: tipoLocal,
      cep: formatarCep(cepNormalizado),
      numero_referencia: numeroNormalizado || null,
      cache_idade_segundos: Number((cacheIdadeMs / 1000).toFixed(1)),
      fonte_coordenadas: cache.data?.fonte_coordenadas,
      metodo_geocodificacao: cache.data?.metodo_geocodificacao,
      latitude: cache.data?.latitude,
      longitude: cache.data?.longitude
    });

    return cache.data;
  }

  const dados = await buscarDadosCepComFallback(cepNormalizado);

  const coordenadasBrasilApi = criarCoordenadaFonteValida(
    dados?.location?.coordinates?.latitude,
    dados?.location?.coordinates?.longitude,
    'brasilapi'
  );

  const coordenadasNominatimRaw = await buscarCoordenadasNominatim({
    cepNormalizado,
    dadosCep: dados,
    numero: numeroNormalizado,
    tipoLocal
  });
  const coordenadasNominatim = criarCoordenadaFonteValida(
    coordenadasNominatimRaw?.latitude,
    coordenadasNominatimRaw?.longitude,
    coordenadasNominatimRaw?.fonte || 'nominatim'
  );

  // Priorizamos resultado por logradouro quando disponível; caso contrário,
  // mantemos BrasilAPI como primeira fonte e Nominatim como fallback.
  const nominatimEhLogradouro = String(coordenadasNominatimRaw?.nivel_confianca || '').startsWith('logradouro');
  const coordenadaEscolhida = nominatimEhLogradouro
    ? coordenadasNominatim || coordenadasBrasilApi
    : coordenadasBrasilApi || coordenadasNominatim;
  const latitude = Number(coordenadaEscolhida?.latitude);
  const longitude = Number(coordenadaEscolhida?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw criarErroHttp(400, 'CEP sem coordenadas para cálculo de entrega.');
  }

  const resultado = {
    cep: formatarCep(cepNormalizado),
    numero_referencia: numeroNormalizado || null,
    latitude,
    longitude,
    cidade: String(dados?.city || '').trim(),
    estado: String(dados?.state || '').trim(),
    bairro: String(dados?.neighborhood || '').trim(),
    rua: String(dados?.street || '').trim(),
    fonte_coordenadas: String(coordenadaEscolhida?.fonte || 'desconhecida'),
    metodo_geocodificacao: nominatimEhLogradouro
      ? String(coordenadasNominatimRaw?.fonte || 'nominatim_logradouro')
      : coordenadasBrasilApi
        ? 'brasilapi'
        : String(coordenadasNominatimRaw?.fonte || 'nominatim_fallback'),
    coordenadas_alternativas: {
      brasilapi: coordenadasBrasilApi
        ? {
          latitude: coordenadasBrasilApi.latitude,
          longitude: coordenadasBrasilApi.longitude
        }
        : null,
      nominatim: coordenadasNominatim
        ? {
          latitude: coordenadasNominatim.latitude,
          longitude: coordenadasNominatim.longitude,
          tipo_consulta: coordenadasNominatimRaw?.tipo_consulta || null,
          nivel_confianca: coordenadasNominatimRaw?.nivel_confianca || null,
          score: Number.isFinite(Number(coordenadasNominatimRaw?.score)) ? Number(coordenadasNominatimRaw.score) : null,
          consulta: coordenadasNominatimRaw?.consulta || null
        }
        : null
    }
  };

  cepGeoCache.set(chaveCache, {
    cachedAt: Date.now(),
    data: resultado
  });

  registrarLogFreteDebug('geocode_cep', {
    tipo_local: tipoLocal,
    cep: resultado.cep,
    numero_referencia: resultado.numero_referencia,
    cache_hit: false,
    cidade: resultado.cidade,
    estado: resultado.estado,
    bairro: resultado.bairro,
    rua: resultado.rua,
    fonte_coordenadas: resultado.fonte_coordenadas,
    metodo_geocodificacao: resultado.metodo_geocodificacao,
    coordenadas: {
      latitude: resultado.latitude,
      longitude: resultado.longitude
    },
    coordenadas_alternativas: resultado.coordenadas_alternativas
  });

  return resultado;
}

async function buscarDadosCepComFallback(cepNormalizado) {
  let dadosV2 = null;

  try {
    const responseV2 = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cepNormalizado}`, {
      timeoutMs: BRASIL_API_TIMEOUT_MS
    });
    if (responseV2.ok) {
      dadosV2 = await responseV2.json().catch(() => ({}));
    } else if (responseV2.status === 404) {
      throw criarErroHttp(400, 'CEP não encontrado.');
    }
  } catch (erro) {
    if (erro?.status === 400) {
      throw erro;
    }

    logger.warn('Falha ao consultar BrasilAPI CEP v2.', {
      cep: formatarCep(cepNormalizado),
      timeout: erro?.name === 'AbortError',
      message: erro?.message || null
    });
  }

  let dadosV1 = null;
  if (!dadosV2 || !String(dadosV2?.city || '').trim()) {
    try {
      const responseV1 = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cepNormalizado}`, {
        timeoutMs: BRASIL_API_TIMEOUT_MS
      });
      if (responseV1.ok) {
        dadosV1 = await responseV1.json().catch(() => ({}));
      } else if (responseV1.status === 404) {
        throw criarErroHttp(400, 'CEP não encontrado.');
      }
    } catch (erro) {
      if (erro?.status === 400) {
        throw erro;
      }

      logger.warn('Falha ao consultar BrasilAPI CEP v1.', {
        cep: formatarCep(cepNormalizado),
        timeout: erro?.name === 'AbortError',
        message: erro?.message || null
      });
    }
  }

  const dadosMesclados = {
    ...(dadosV1 || {}),
    ...(dadosV2 || {}),
    location: dadosV2?.location || dadosV1?.location || null
  };

  if (!Object.keys(dadosMesclados).length) {
    logger.error('Falha ao resolver CEP via BrasilAPI (v1/v2).', {
      cep: formatarCep(cepNormalizado),
      etapa: 'buscarDadosCepComFallback'
    });
    throw criarErroHttp(503, 'Falha ao consultar CEP.');
  }

  return dadosMesclados;
}

function montarConsultasNominatim({ cepNormalizado, dadosCep, numero }) {
  const cepFormatado = formatarCep(cepNormalizado);
  const rua = String(dadosCep?.street || '').trim();
  const bairro = String(dadosCep?.neighborhood || '').trim();
  const cidade = String(dadosCep?.city || '').trim();
  const estado = String(dadosCep?.state || '').trim();
  const numeroNormalizado = String(numero || '').trim();

  const consultas = [];

  if (rua && cidade && estado) {
    if (numeroNormalizado) {
      consultas.push({
        texto: [rua, numeroNormalizado, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
        tipo_consulta: 'logradouro_numero',
        nivel_confianca: 'logradouro_numero'
      });
    }

    consultas.push({
      texto: [rua, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
      tipo_consulta: 'logradouro',
      nivel_confianca: 'logradouro'
    });

    if (bairro) {
      consultas.push({
        texto: [rua, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
        tipo_consulta: 'logradouro_bairro',
        nivel_confianca: 'logradouro'
      });
    }
  }

  consultas.push({
    texto: [cepFormatado, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
    tipo_consulta: 'cep_cidade',
    nivel_confianca: 'cep'
  });
  consultas.push({
    texto: [cepFormatado, 'Brasil'].filter(Boolean).join(', '),
    tipo_consulta: 'cep_generico',
    nivel_confianca: 'cep_generico'
  });

  const consultasUnicas = [];
  const visitadas = new Set();

  for (const consulta of consultas) {
    const texto = String(consulta?.texto || '').trim();
    if (!texto || visitadas.has(texto)) {
      continue;
    }

    visitadas.add(texto);
    consultasUnicas.push({
      ...consulta,
      texto
    });
  }

  return consultasUnicas;
}

function resultadoNominatimEhCompativel({ resultado, dadosCep, cepNormalizado, tipoConsulta }) {
  const endereco = resultado?.address || {};
  const cidadeEsperada = String(dadosCep?.city || '').trim();
  const estadoEsperado = String(dadosCep?.state || '').trim();
  const cidadeRetornada =
    endereco?.city
    || endereco?.town
    || endereco?.village
    || endereco?.municipality
    || endereco?.city_district
    || '';
  const estadoRetornado = endereco?.state || endereco?.state_district || '';
  const countryCode = normalizarTextoComparacao(endereco?.country_code);

  if (countryCode && countryCode !== 'br') {
    return false;
  }

  if (!textoCompativel(cidadeRetornada, cidadeEsperada) || !textoCompativel(estadoRetornado, estadoEsperado)) {
    return false;
  }

  const consultaPorCep = String(tipoConsulta || '').startsWith('cep');
  if (consultaPorCep) {
    const cepRetornado = normalizarCep(endereco?.postcode || '');
    if (cepRetornado && cepRetornado.slice(0, 5) !== cepNormalizado.slice(0, 5)) {
      return false;
    }
  }

  return true;
}

function pontuarResultadoNominatim({ resultado, dadosCep, cepNormalizado, numero }) {
  const endereco = resultado?.address || {};
  const cepRetornado = normalizarCep(endereco?.postcode || '');
  const cepEsperadoPrefixo5 = String(cepNormalizado || '').slice(0, 5);
  const cepEsperadoPrefixo3 = String(cepNormalizado || '').slice(0, 3);
  const ruaEsperada = normalizarTextoComparacao(dadosCep?.street || '');
  const ruaRetornada = normalizarTextoComparacao(endereco?.road || '');
  const bairroEsperado = normalizarTextoComparacao(dadosCep?.neighborhood || '');
  const bairroRetornado = normalizarTextoComparacao(endereco?.suburb || endereco?.quarter || endereco?.neighbourhood || '');
  const numeroEsperado = String(numero || '').trim();
  const numeroRetornado = String(endereco?.house_number || '').trim();

  let score = 0;

  if (cepRetornado) {
    if (cepRetornado.slice(0, 5) === cepEsperadoPrefixo5) {
      score += 40;
    } else if (cepRetornado.slice(0, 3) === cepEsperadoPrefixo3) {
      score += 20;
    } else {
      score -= 15;
    }
  } else {
    score -= 3;
  }

  if (ruaEsperada && ruaRetornada && textoCompativel(ruaRetornada, ruaEsperada)) {
    score += 10;
  }

  if (bairroEsperado && bairroRetornado && textoCompativel(bairroRetornado, bairroEsperado)) {
    score += 6;
  }

  if (numeroEsperado && numeroRetornado && numeroEsperado === numeroRetornado) {
    score += 8;
  }

  return score;
}

async function buscarCoordenadasNominatim({ cepNormalizado, dadosCep, numero, tipoLocal }) {
  const consultas = montarConsultasNominatim({ cepNormalizado, dadosCep, numero });
  if (!consultas.length) {
    return null;
  }

  const headers = {
    'User-Agent': 'BomFilhoFrete/1.0 (fallback-cep)',
    'Accept-Language': 'pt-BR,pt;q=0.9'
  };

  for (const consulta of consultas) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(consulta.texto)}&format=jsonv2&limit=5&addressdetails=1&countrycodes=br`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        continue;
      }

      const resultados = await response.json().catch(() => []);
      const candidatos = Array.isArray(resultados) ? resultados : [];
      let melhorCandidato = null;

      for (const candidato of candidatos) {
        const latitude = Number(candidato?.lat);
        const longitude = Number(candidato?.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          continue;
        }

        const compativel = resultadoNominatimEhCompativel({
          resultado: candidato,
          dadosCep,
          cepNormalizado,
          tipoConsulta: consulta.tipo_consulta
        });
        if (!compativel) {
          continue;
        }

        const score = pontuarResultadoNominatim({
          resultado: candidato,
          dadosCep,
          cepNormalizado,
          numero
        });

        if (!melhorCandidato || score > melhorCandidato.score) {
          melhorCandidato = {
            score,
            latitude,
            longitude,
            candidato
          };
        }
      }

      if (melhorCandidato) {
        return {
          latitude: melhorCandidato.latitude,
          longitude: melhorCandidato.longitude,
          consulta: consulta.texto,
          tipo_consulta: consulta.tipo_consulta,
          nivel_confianca: consulta.nivel_confianca,
          score: melhorCandidato.score,
          display_name: String(melhorCandidato.candidato?.display_name || '').trim() || null,
          fonte: `nominatim_${consulta.tipo_consulta}`
        };
      }
    } catch {
      // Ignora falha de fallback para tentar a proxima consulta.
    }
  }

  registrarLogFreteDebug('nominatim_sem_match', {
    tipo_local: tipoLocal || 'desconhecido',
    cep: formatarCep(cepNormalizado),
    cidade: String(dadosCep?.city || '').trim(),
    estado: String(dadosCep?.state || '').trim(),
    rua: String(dadosCep?.street || '').trim(),
    numero_referencia: String(numero || '').trim() || null
  });

  return null;
}

async function calcularEntregaPorCep({ cepDestino, veiculo, numeroDestino = '' }) {
  const veiculoKey = String(veiculo || 'moto').trim().toLowerCase();
  if (!VEICULOS_ENTREGA[veiculoKey]) {
    throw criarErroHttp(400, 'Veículo de entrega inválido');
  }

  // Limitacao tecnica atual: sem numero de destino, a precisao do geocoding pode
  // cair para nivel de CEP/logradouro aproximado (nao rota viaria porta a porta).
  const origem = await buscarCoordenadasPorCep(CEP_MERCADO, {
    numero: NUMERO_MERCADO,
    tipoLocal: 'origem'
  });
  const destino = await buscarCoordenadasPorCep(cepDestino, {
    numero: numeroDestino,
    tipoLocal: 'destino'
  });
  const cepOrigemNormalizado = normalizarCep(origem.cep);
  const cepDestinoNormalizado = normalizarCep(destino.cep);
  const numeroOrigemNormalizado = String(NUMERO_MERCADO || '').replace(/\D/g, '');
  const numeroDestinoNormalizado = String(numeroDestino || '').replace(/\D/g, '');
  const mesmoNumeroLoja = Boolean(
    numeroOrigemNormalizado
    && numeroDestinoNormalizado
    && numeroOrigemNormalizado === numeroDestinoNormalizado
  );
  const mesmaRua = textoCompativel(origem.rua, destino.rua);
  const mesmoBairro = textoCompativel(origem.bairro, destino.bairro);
  const enderecoEhLoja = cepOrigemNormalizado === cepDestinoNormalizado && (mesmoNumeroLoja || (mesmaRua && mesmoBairro));

  let distanciaInfo = calcularDistanciaEntregaAjustada(origem, destino);
  let distanciaKm = Number(distanciaInfo.distancia_km);

  if (enderecoEhLoja) {
    distanciaInfo = {
      ...distanciaInfo,
      distancia_base_km: Number(distanciaInfo.distancia_base_km || 0),
      distancia_km: 0,
      ajuste_aplicado: true,
      metodo_distancia: 'endereco_loja_zerado'
    };
    distanciaKm = 0;
  }

  if (!Number.isFinite(distanciaKm)) {
    throw criarErroHttp(500, 'Não foi possível calcular a distância da entrega.');
  }

  if (veiculoKey === 'bike' && distanciaKm > LIMITE_BIKE_KM) {
    throw criarErroHttp(
      400,
      `Bike disponível apenas para até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado (${formatarCep(CEP_MERCADO)}).`
    );
  }

  const freteDetalhado = enderecoEhLoja
    ? {
      frete: 0,
      distancia_bruta_km: Number(distanciaInfo.distancia_base_km || 0),
      distancia_cobrada_km: 0,
      taxa_base: 0,
      custo_combustivel_km: 0,
      custo_manutencao_km: 0,
      fator_reparo: 1,
      custo_operacional_km: 0
    }
    : calcularFreteEntregaDetalhado(veiculoKey, distanciaKm);

  registrarLogFreteDebug('simulacao_frete', {
    origem: {
      cep: origem.cep,
      numero: NUMERO_MERCADO,
      cidade: origem.cidade,
      estado: origem.estado,
      bairro: origem.bairro,
      rua: origem.rua,
      latitude: origem.latitude,
      longitude: origem.longitude,
      fonte: origem.fonte_coordenadas,
      metodo_geocodificacao: origem.metodo_geocodificacao || null
    },
    destino: {
      cep: destino.cep,
      numero: String(numeroDestino || '').trim() || null,
      cidade: destino.cidade,
      estado: destino.estado,
      bairro: destino.bairro,
      rua: destino.rua,
      latitude: destino.latitude,
      longitude: destino.longitude,
      fonte: destino.fonte_coordenadas,
      metodo_geocodificacao: destino.metodo_geocodificacao || null
    },
    metodo_distancia: distanciaInfo.metodo_distancia,
    distancia_bruta_km: distanciaInfo.distancia_base_km,
    distancia_final_km: distanciaInfo.distancia_km,
    distancia_cobrada_km: freteDetalhado.distancia_cobrada_km,
    ajuste_aplicado: distanciaInfo.ajuste_aplicado,
    combinacoes_avaliadas: distanciaInfo.combinacoes_avaliadas,
    veiculo: veiculoKey,
    frete: {
      valor_final: freteDetalhado.frete,
      taxa_base: freteDetalhado.taxa_base,
      custo_operacional_km: freteDetalhado.custo_operacional_km,
      custo_combustivel_km: freteDetalhado.custo_combustivel_km,
      custo_manutencao_km: freteDetalhado.custo_manutencao_km,
      fator_reparo: freteDetalhado.fator_reparo
    }
  });

  return {
    veiculo: veiculoKey,
    frete: freteDetalhado.frete,
    distancia_km: distanciaKm,
    distancia_cobrada_km: freteDetalhado.distancia_cobrada_km,
    metodo_distancia: distanciaInfo.metodo_distancia,
    distancia_base_km: Number(distanciaInfo.distancia_base_km),
    endereco_loja: enderecoEhLoja,
    cep_origem: origem.cep,
    numero_origem: NUMERO_MERCADO,
    fonte_coordenadas_origem: distanciaInfo.fonte_origem,
    cep_destino: destino.cep,
    numero_destino: String(numeroDestino || '').trim() || null,
    fonte_coordenadas_destino: distanciaInfo.fonte_destino,
    cidade_destino: destino.cidade,
    bairro_destino: destino.bairro
  };
}

if (JWT_SECRET.length < 32) {
  const aviso = 'JWT_SECRET deve ter no mínimo 32 caracteres para segurança adequada.';
  if (IS_PRODUCTION) {
    throw new Error(aviso);
  }
  logger.warn(`⚠️ ${aviso}`);
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


function extrairBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return String(authHeader.slice(7)).trim();
}

function extrairTokenUsuarioRequest(req) {
  return extrairBearerToken(req)
    || String(req.cookies?.[USER_AUTH_COOKIE_NAME] || '').trim()
    || String(req.query?.token || '').trim();
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

function extrairRecaptchaErrorCodes(payload) {
  if (!payload || !Array.isArray(payload['error-codes'])) {
    return [];
  }

  return payload['error-codes']
    .map((codigo) => String(codigo || '').trim())
    .filter(Boolean);
}

async function validarRecaptcha({ token, req, action = '' } = {}) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (normalizedAction.startsWith('auth_') && !RECAPTCHA_AUTH_PROTECTION_ENABLED) {
    return;
  }

  if (!RECAPTCHA_SECRET_KEY && !RECAPTCHA_ENTERPRISE_MODE) {
    return;
  }

  const recaptchaToken = String(token || '').trim();
  if (!recaptchaToken) {
    throw criarErroHttp(400, 'Proteção de segurança ausente. Tente novamente.');
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  let response;
  try {
    if (RECAPTCHA_ENTERPRISE_MODE) {
      // Enterprise Score — POST to Enterprise API
      const ipCliente = normalizarIp(req?.ip || req?.socket?.remoteAddress);
      const body = {
        event: {
          token: recaptchaToken,
          siteKey: String(process.env.RECAPTCHA_SITE_KEY || '').trim(),
          ...(action ? { expectedAction: String(action).trim() } : {}),
          ...(ipCliente ? { userIpAddress: ipCliente } : {})
        }
      };
      response = await fetch(
        `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(RECAPTCHA_PROJECT_ID)}/assessments?key=${encodeURIComponent(RECAPTCHA_CLOUD_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller?.signal
        }
      );
    } else {
      // Legacy siteverify (v2/v3)
      const formData = new URLSearchParams();
      formData.set('secret', RECAPTCHA_SECRET_KEY);
      formData.set('response', recaptchaToken);
      const ipCliente = normalizarIp(req?.ip || req?.socket?.remoteAddress);
      if (ipCliente) formData.set('remoteip', ipCliente);
      response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: controller?.signal
      });
    }
  } catch (erroRecaptcha) {
    if (erroRecaptcha?.name === 'AbortError') {
      throw criarErroHttp(503, 'Validação de segurança indisponível no momento. Tente novamente em instantes.');
    }
    throw criarErroHttp(503, 'Não foi possível validar a proteção de segurança. Tente novamente.');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw criarErroHttp(503, 'Falha ao validar proteção de segurança. Tente novamente.');
  }

  if (RECAPTCHA_ENTERPRISE_MODE) {
    // Enterprise response shape: { tokenProperties: { valid, action }, riskAnalysis: { score } }
    if (!payload?.tokenProperties?.valid) {
      const invalido = String(payload?.tokenProperties?.invalidReason || '').toLowerCase();
      if (invalido.includes('expired') || invalido.includes('timeout')) {
        throw criarErroHttp(400, 'Proteção de segurança expirada. Tente novamente.');
      }
      throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
    }

    const score = typeof payload?.riskAnalysis?.score === 'number' ? payload.riskAnalysis.score : 1;
    if (score < RECAPTCHA_MIN_SCORE) {
      throw criarErroHttp(403, 'A verificação de segurança não foi aprovada. Tente novamente.');
    }

    if (action && payload?.tokenProperties?.action &&
        String(payload.tokenProperties.action).trim() !== String(action).trim()) {
      throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
    }
  } else {
    // siteverify shape: { success, score, action, error-codes }
    if (!payload?.success) {
      const codigos = extrairRecaptchaErrorCodes(payload);
      if (codigos.includes('timeout-or-duplicate')) {
        throw criarErroHttp(400, 'Proteção de segurança expirada. Tente novamente.');
      }
      throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
    }

    if (typeof payload?.score === 'number' && payload.score < RECAPTCHA_MIN_SCORE) {
      throw criarErroHttp(403, 'A verificação de segurança não foi aprovada. Tente novamente.');
    }

    if (action && payload?.action && String(payload.action).trim() !== String(action).trim()) {
      throw criarErroHttp(400, 'Falha na verificação de segurança. Tente novamente.');
    }
  }
}

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

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 400,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  // Limiter leve para API, ignorando rotas críticas/integracoes externas.
  skip: (req) => {
    const pathAtual = req.path || '';

    if (!pathAtual.startsWith('/api/')) return true;
    if (pathAtual.startsWith('/api/produtos')) return true;
    if (pathAtual.startsWith('/api/webhook/')) return true;
    if (pathAtual.startsWith('/api/webhooks/')) return true;
    if (pathAtual.startsWith('/api/admin/')) return true;

    return false;
  },
  message: { erro: 'Muitas requisições em sequência. Tente novamente em instantes.' }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

const produtosPublicLimiter = rateLimit({
  // Catalogo dispara mais chamadas por filtros, busca e navegacao de secoes.
  windowMs: 5 * 60 * 1000,
  max: IS_PRODUCTION ? 1200 : 5000,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Catálogo temporariamente sobrecarregado. Tente novamente em instantes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de autenticação. Aguarde 15 minutos.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' }
});

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login admin. Aguarde 15 minutos.' }
});

app.use(globalLimiter);

// Limiter para rotas públicas de maior tráfego.
app.use('/api/produtos', produtosPublicLimiter);
app.use('/api/pedidos', publicLimiter);

// Limiters dedicados para endpoints financeiros (Q006, Q007)
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario?.id ? 'user_' + req.usuario.id : ipKeyGenerator(req.ip),
  message: { erro: 'Muitas tentativas de pagamento. Aguarde 1 minuto.' }
});

const orderCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  validate: rateLimitValidateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario?.id ? 'user_' + req.usuario.id : ipKeyGenerator(req.ip),
  message: { erro: 'Muitas tentativas de criação de pedido. Aguarde 1 minuto.' }
});

const csrfIgnoredPaths = new Set([
  '/api/auth/login',
  '/api/auth/cadastro',
  '/api/admin/login'
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
    return res.status(403).json({ erro: 'Sua sessão expirou por segurança. Atualize a página e tente novamente.' });
  }

  return next();
});

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

// ============================================
// FUNÇÕES DE APOIO - WHATSAPP
// ============================================
function formatarTelefoneWhatsapp(telefone) {
  const digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

async function enviarWhatsappTexto({ telefone, mensagem }) {
  if (!EVOLUTION_API_KEY) {
    logger.warn('⚠️ Evolution API não configurada. WhatsApp desabilitado.');
    return false;
  }

  const numero = formatarTelefoneWhatsapp(telefone);
  if (!numero || !mensagem) {
    return false;
  }

  if (typeof fetch !== 'function') {
    logger.warn('Fetch indisponível; mensagem de WhatsApp não enviada.');
    return false;
  }
  
  // URL da Evolution API
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
  const payload = {
    number: numero,
    text: mensagem
  };

  try {
    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeoutMs: WHATSAPP_HTTP_TIMEOUT_MS
    });

    if (!resp.ok) {
      const erroTexto = await resp.text();
      logger.error('❌ Erro ao enviar WhatsApp:', erroTexto);
      return false;
    } else {
      const resultado = await resp.json();
      logger.info('✅ WhatsApp enviado:', resultado);
      return true;
    }
  } catch (erro) {
    logger.error('❌ Erro ao enviar WhatsApp:', erro?.name === 'AbortError'
      ? 'timeout ao chamar Evolution API'
      : erro.message);
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
