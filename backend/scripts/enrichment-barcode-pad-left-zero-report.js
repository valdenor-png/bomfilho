'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { normalizarBarcode, validarBarcode } = require('../services/barcode/utils/barcodeUtils');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const TARGET_ERROR_MESSAGE = 'Codigo de barras invalido. Tamanho nao suportado para EAN/GTIN.';
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-pad-left-zero');
const DEFAULT_SOURCE_FILE = path.join(
  __dirname,
  '..',
  'logs',
  'enrichment-barcode-invalid-length',
  'latest.details.json'
);
const DEFAULT_EXAMPLES = 12;
const QUERY_RETRY_ATTEMPTS = 4;
const QUERY_RETRY_DELAY_MS = 1200;
const MYSQL_RETRYABLE_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ER_CON_COUNT_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT'
]);

const BUCKET_DEFINITIONS = {
  candidate: {
    nome: 'PAD_LEFT_ZERO_CANDIDATE',
    definicao: '7 ou 11 digitos numericos em que prefixar 0 gera GTIN valido com checksum valido.',
    risco_operacional: 'medio',
    recomendacao: 'Manter como base tecnica para triagem adicional.'
  },
  safe: {
    nome: 'PAD_LEFT_ZERO_SAFE',
    definicao: 'Candidate sem colisao problematica, sem conflito evidente e sem ambiguidade relevante.',
    risco_operacional: 'baixo_medio',
    recomendacao: 'Elegivel para futura fase de autoaprovacao controlada com auditoria.'
  },
  assisted: {
    nome: 'PAD_LEFT_ZERO_ASSISTED',
    definicao: 'Candidate com risco residual, colisao/ambiguidade ou falta de dados para decidir automaticamente.',
    risco_operacional: 'medio_alto',
    recomendacao: 'Encaminhar para revisao assistida humana.'
  },
  rejected: {
    nome: 'PAD_LEFT_ZERO_REJECTED',
    definicao: 'Falha tecnica na hipotese de 0+original ou conflito de seguranca que impede automacao.',
    risco_operacional: 'alto',
    recomendacao: 'Fora da automacao; manter fluxo manual ou saneamento na origem.'
  }
};

function toArgKey(rawKey) {
  return String(rawKey || '').trim().replace(/^--?/, '').replace(/-/g, '_');
}

function parseCliArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();

    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    if (token.startsWith('--no-')) {
      args[toArgKey(token.slice(5))] = false;
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex > -1) {
      const key = toArgKey(token.slice(0, eqIndex));
      const value = token.slice(eqIndex + 1);
      args[key] = value === '' ? true : value;
      continue;
    }

    const key = toArgKey(token);
    const next = argv[i + 1];
    if (next === undefined || String(next).startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function parsePositiveInt(value, fallback, { min = 1, max = 1000000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = normalizeTextComparable(String(value));
  if (['false', '0', 'no', 'nao', 'off'].includes(normalized)) {
    return false;
  }

  if (['true', '1', 'yes', 'sim', 'on'].includes(normalized)) {
    return true;
  }

  return fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateForId(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function buildRunBaseName() {
  return `pad_left_zero_report_${formatDateForId(new Date())}`;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeTextFile(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, String(payload || ''), 'utf8');
}

function copyAsLatest(source, latest) {
  ensureDirectory(path.dirname(latest));
  fs.copyFileSync(source, latest);
}

function normalizeTextComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeMessage(value) {
  return normalizeTextComparable(value)
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMode(value) {
  const normalized = normalizeTextComparable(value || 'report');
  if (['report', 'dry-run', 'dry_run', 'dryrun'].includes(normalized)) {
    return 'report';
  }

  return 'report';
}

function getDatabaseConfigFromEnv() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, ''))
    };
  }

  return {
    host: String(process.env.DB_HOST || '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3306),
    user: String(process.env.DB_USER || process.env.MYSQL_USER || ''),
    password: String(process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || ''),
    database: String(process.env.DB_NAME || process.env.MYSQL_DATABASE || '')
  };
}

function createMysqlPool() {
  const cfg = getDatabaseConfigFromEnv();
  if (!cfg.host || !cfg.user || !cfg.database) {
    throw new Error('Configuracao de banco incompleta. Defina DATABASE_URL ou DB_HOST/DB_USER/DB_NAME.');
  }

  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableMysqlError(error) {
  if (!error) {
    return false;
  }

  if (MYSQL_RETRYABLE_CODES.has(error.code)) {
    return true;
  }

  const message = String(error.message || '').toLowerCase();
  return message.includes('connection') || message.includes('socket') || message.includes('timeout');
}

async function queryWithRetry(pool, sql, params = []) {
  let lastError = null;

  for (let attempt = 1; attempt <= QUERY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await pool.query(sql, params);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < QUERY_RETRY_ATTEMPTS && isRetryableMysqlError(error);
      if (!canRetry) {
        break;
      }

      await wait(QUERY_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError || new Error('Falha ao executar query com retry.');
}

async function getExistingProductColumns(pool) {
  const [rows] = await queryWithRetry(
    pool,
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'produtos'`
  );

  return new Set(rows.map((row) => String(row.COLUMN_NAME || '').trim().toLowerCase()).filter(Boolean));
}

function textColumnExpr(columnSet, columnName, alias) {
  const col = String(columnName || '').toLowerCase();
  if (columnSet.has(col)) {
    return `COALESCE(${columnName}, '') AS ${alias}`;
  }

  return `'' AS ${alias}`;
}

function numberColumnExpr(columnSet, columnName, alias, fallback = 0) {
  const col = String(columnName || '').toLowerCase();
  if (columnSet.has(col)) {
    return `COALESCE(${columnName}, ${fallback}) AS ${alias}`;
  }

  return `${fallback} AS ${alias}`;
}

function chooseFirstExisting(columnSet, names = []) {
  for (const name of names) {
    if (columnSet.has(String(name || '').toLowerCase())) {
      return name;
    }
  }

  return '';
}

function extractDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function tokenize(value) {
  return normalizeTextComparable(value)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function tokenSimilarityScore(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (!tokensA.size || !tokensB.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  if (!union) {
    return 0;
  }

  return intersection / union;
}

function evaluateConsistency(current, collisionTargets = []) {
  if (!collisionTargets.length) {
    return {
      status_consistencia: 'sem_conflito_evidente',
      motivo_consistencia: 'Nao ha colisao com outro produto ativo.'
    };
  }

  const checks = [];

  for (const target of collisionTargets) {
    const nomeAtual = toText(current.nome, '');
    const nomeAlvo = toText(target.nome, '');
    const marcaAtual = normalizeTextComparable(current.marca);
    const marcaAlvo = normalizeTextComparable(target.marca);
    const categoriaAtual = normalizeTextComparable(current.categoria);
    const categoriaAlvo = normalizeTextComparable(target.categoria);

    const sameBrand = Boolean(marcaAtual && marcaAlvo && marcaAtual === marcaAlvo);
    const sameCategory = Boolean(categoriaAtual && categoriaAlvo && categoriaAtual === categoriaAlvo);
    const similarity = tokenSimilarityScore(nomeAtual, nomeAlvo);

    let status = 'conflito_potencial';
    let motivo = 'Semelhança parcial; requer revisão assistida.';

    if (!nomeAtual || !nomeAlvo) {
      status = 'sem_dados_suficientes';
      motivo = 'Nome ausente em um dos cadastros para comparar consistencia.';
    } else if (similarity >= 0.7 || (sameBrand && (similarity >= 0.4 || sameCategory))) {
      status = 'sem_conflito_evidente';
      motivo = 'Semelhança de cadastro sem conflito evidente.';
    } else if (similarity <= 0.1 && !sameBrand && !sameCategory) {
      status = 'conflito_evidente';
      motivo = 'Nome/marca/categoria sugerem conflito evidente com produto colidido.';
    }

    checks.push({
      product_id_colidido: target.id,
      nome_colidido: target.nome,
      similarity_score: Number(similarity.toFixed(4)),
      same_brand: sameBrand,
      same_category: sameCategory,
      status,
      motivo
    });
  }

  if (checks.some((item) => item.status === 'conflito_evidente')) {
    return {
      status_consistencia: 'conflito_evidente',
      motivo_consistencia: 'Ao menos uma colisao aponta conflito evidente de cadastro.',
      checks
    };
  }

  if (checks.some((item) => item.status === 'conflito_potencial')) {
    return {
      status_consistencia: 'conflito_potencial',
      motivo_consistencia: 'Ha colisao sem conflito evidente, mas com ambiguidade.',
      checks
    };
  }

  if (checks.some((item) => item.status === 'sem_dados_suficientes')) {
    return {
      status_consistencia: 'sem_dados_suficientes',
      motivo_consistencia: 'Faltam dados para confirmar consistencia com seguranca.',
      checks
    };
  }

  return {
    status_consistencia: 'sem_conflito_evidente',
    motivo_consistencia: 'Nao foi identificado conflito evidente nas colisoes.'
  };
}

function buildArtifacts(outputDir, baseName) {
  return {
    summary: path.join(outputDir, `${baseName}.summary.json`),
    details: path.join(outputDir, `${baseName}.details.json`),
    markdown: path.join(outputDir, `${baseName}.md`),
    bucket_candidate: path.join(outputDir, `${baseName}.bucket.candidate.json`),
    bucket_safe: path.join(outputDir, `${baseName}.bucket.safe.json`),
    bucket_assisted: path.join(outputDir, `${baseName}.bucket.assisted.json`),
    bucket_rejected: path.join(outputDir, `${baseName}.bucket.rejected.json`),
    latest_summary: path.join(outputDir, 'latest.summary.json'),
    latest_details: path.join(outputDir, 'latest.details.json'),
    latest_markdown: path.join(outputDir, 'latest.md')
  };
}

async function loadTargetRows(pool, { limit = 0 } = {}) {
  const columnSet = await getExistingProductColumns(pool);
  const vendasColumn = chooseFirstExisting(columnSet, [
    'vendas',
    'total_vendas',
    'qtd_vendas',
    'quantidade_vendida'
  ]);

  const selectFields = [
    'id',
    textColumnExpr(columnSet, 'nome', 'nome'),
    textColumnExpr(columnSet, 'descricao', 'descricao'),
    textColumnExpr(columnSet, 'marca', 'marca'),
    textColumnExpr(columnSet, 'categoria', 'categoria'),
    textColumnExpr(columnSet, 'codigo_barras', 'barcode_original'),
    textColumnExpr(columnSet, 'enrichment_last_error', 'enrichment_last_error'),
    numberColumnExpr(columnSet, 'estoque', 'estoque', 0),
    vendasColumn ? numberColumnExpr(columnSet, vendasColumn, 'vendas', 0) : '0 AS vendas'
  ];

  const sql = `
    SELECT
      ${selectFields.join(',\n      ')}
    FROM produtos
    WHERE ativo = TRUE
      AND COALESCE(enrichment_status, 'pendente') = 'erro'
      AND LOWER(COALESCE(enrichment_last_error, '')) LIKE '%tamanho nao suportado para ean/gtin%'
    ORDER BY id ASC
  `;

  const [rows] = await queryWithRetry(pool, sql, []);
  const targetNormalized = normalizeMessage(TARGET_ERROR_MESSAGE);
  const safeLimit = parsePositiveInt(limit, 0, { min: 0, max: 500000 });

  const filtered = rows
    .map((row) => ({
      id: toNumber(row.id, 0),
      nome: toText(row.nome, ''),
      descricao: toText(row.descricao, ''),
      marca: toText(row.marca, ''),
      categoria: toText(row.categoria, ''),
      barcode_original: toText(row.barcode_original, ''),
      enrichment_last_error: toText(row.enrichment_last_error, ''),
      estoque: toNumber(row.estoque, 0),
      vendas: toNumber(row.vendas, 0)
    }))
    .filter((row) => normalizeMessage(row.enrichment_last_error) === targetNormalized)
    .map((row) => {
      const digits = extractDigits(row.barcode_original);
      return {
        ...row,
        barcode_digits: digits,
        grupo_origem: digits.length
      };
    })
    .filter((row) => row.grupo_origem === 7 || row.grupo_origem === 11);

  return safeLimit > 0 ? filtered.slice(0, safeLimit) : filtered;
}

async function loadActiveBarcodeMap(pool) {
  const [rows] = await queryWithRetry(
    pool,
    `SELECT
        id,
        COALESCE(nome, '') AS nome,
        COALESCE(descricao, '') AS descricao,
        COALESCE(marca, '') AS marca,
        COALESCE(categoria, '') AS categoria,
        COALESCE(codigo_barras, '') AS codigo_barras
     FROM produtos
     WHERE ativo = TRUE
        AND COALESCE(TRIM(codigo_barras), '') <> ''`
  );

  const map = new Map();

  for (const row of rows) {
    const barcode = normalizarBarcode(row.codigo_barras);
    if (!barcode) {
      continue;
    }

    if (!map.has(barcode)) {
      map.set(barcode, []);
    }

    map.get(barcode).push({
      id: toNumber(row.id, 0),
      nome: toText(row.nome, ''),
      descricao: toText(row.descricao, ''),
      marca: toText(row.marca, ''),
      categoria: toText(row.categoria, '')
    });
  }

  return map;
}

function loadTargetRowsFromDetailsFile(detailsFilePath, { limit = 0 } = {}) {
  const absolutePath = path.resolve(detailsFilePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo de detalhes nao encontrado: ${absolutePath}`);
  }

  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const items = Array.isArray(payload?.itens) ? payload.itens : [];
  const targetNormalized = normalizeMessage(TARGET_ERROR_MESSAGE);

  const mapped = items
    .map((item) => {
      const barcodeOriginal = toText(
        item.barcode_trim || item.barcode_bruto || item.barcode_original || item.barcode_digitos,
        ''
      );
      const digits = extractDigits(item.barcode_digitos || barcodeOriginal);
      const groupLen = toNumber(item.comprimento_digitos, digits.length) || digits.length;

      return {
        id: toNumber(item.id ?? item.product_id, 0),
        nome: toText(item.nome, ''),
        descricao: toText(item.descricao, ''),
        marca: toText(item.marca, ''),
        categoria: toText(item.categoria, ''),
        barcode_original: barcodeOriginal,
        enrichment_last_error: toText(item.enrichment_last_error, ''),
        estoque: toNumber(item.estoque, 0),
        vendas: toNumber(item.vendas, 0),
        barcode_digits: digits,
        grupo_origem: groupLen,
        candidate_collision_hint: item.candidato_zero_esquerda_colide === true
      };
    })
    .filter((row) => normalizeMessage(row.enrichment_last_error) === targetNormalized)
    .filter((row) => row.grupo_origem === 7 || row.grupo_origem === 11)
    .sort((a, b) => a.id - b.id);

  const safeLimit = parsePositiveInt(limit, 0, { min: 0, max: 500000 });
  return safeLimit > 0 ? mapped.slice(0, safeLimit) : mapped;
}

function buildCollisionMapFromRows(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const barcodeOriginal = String(row.barcode_original || '').trim();
    if (!/^\d+$/.test(barcodeOriginal)) {
      continue;
    }

    if (barcodeOriginal.length !== 7 && barcodeOriginal.length !== 11) {
      continue;
    }

    const candidate = `0${barcodeOriginal}`;
    if (!map.has(candidate)) {
      map.set(candidate, []);
    }

    map.get(candidate).push({
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      marca: row.marca,
      categoria: row.categoria
    });
  }

  return map;
}

function analyzeRow(row, collisionContext = {}) {
  const barcodeMap = collisionContext.barcodeMap || new Map();
  const limitedCollisionScope = Boolean(collisionContext.limitedCollisionScope);

  const reasons = [];
  const barcodeOriginal = toText(row.barcode_original, '');
  const barcodeTrim = String(barcodeOriginal || '').trim();
  const barcodeDigits = extractDigits(barcodeTrim);

  const pre_numeric_only = /^\d+$/.test(barcodeTrim);
  const pre_no_internal_spaces = !/\s/.test(barcodeTrim);
  const pre_exact_length = barcodeTrim.length === 7 || barcodeTrim.length === 11;
  const pre_no_mask_or_text = barcodeTrim === barcodeDigits;

  if (!pre_numeric_only) reasons.push('pre_validacao_falhou:nao_numerico_estrito');
  if (!pre_no_internal_spaces) reasons.push('pre_validacao_falhou:espacos_internos');
  if (!pre_exact_length) reasons.push('pre_validacao_falhou:comprimento_diferente_7_11');
  if (!pre_no_mask_or_text) reasons.push('pre_validacao_falhou:mascara_ou_texto');

  const pre_ok = pre_numeric_only && pre_no_internal_spaces && pre_exact_length && pre_no_mask_or_text;

  const barcodeCandidate = pre_ok ? `0${barcodeTrim}` : '';
  const validationCandidate = pre_ok ? validarBarcode(barcodeCandidate) : { ok: false, message: 'Nao avaliado' };

  const candidate_length_ok = pre_ok ? (barcodeCandidate.length === 8 || barcodeCandidate.length === 12) : false;
  const candidate_checksum_ok = pre_ok ? Boolean(validationCandidate.ok) : false;
  const candidate_transform_deterministic = pre_ok;

  if (pre_ok && !candidate_length_ok) reasons.push('candidate_falhou:comprimento_final_invalido');
  if (pre_ok && !candidate_checksum_ok) reasons.push('candidate_falhou:checksum_invalido');

  const isCandidate = pre_ok && candidate_length_ok && candidate_checksum_ok && candidate_transform_deterministic;

  const collisionsRaw = isCandidate ? (barcodeMap.get(barcodeCandidate) || []) : [];
  const collisionsSame = collisionsRaw.filter((item) => item.id === row.id);
  const collisionsOther = collisionsRaw.filter((item) => item.id !== row.id);
  const hintedCollision = row.candidate_collision_hint === true;

  let statusColisao = 'nao_avaliado';
  if (isCandidate) {
    if (!limitedCollisionScope) {
      if (!collisionsRaw.length) {
        statusColisao = 'sem_colisao';
      } else if (collisionsOther.length === 0 && collisionsSame.length > 0) {
        statusColisao = 'colisao_mesmo_produto';
      } else if (collisionsOther.length === 1) {
        statusColisao = 'colisao_outro_produto';
      } else {
        statusColisao = 'colisao_ambigua';
      }
    } else {
      if (hintedCollision) {
        statusColisao = collisionsOther.length >= 2 ? 'colisao_ambigua' : 'colisao_outro_produto';
      } else if (collisionsOther.length === 0) {
        statusColisao = 'sem_colisao';
      } else if (collisionsOther.length === 1) {
        statusColisao = 'colisao_outro_produto';
      } else {
        statusColisao = 'colisao_ambigua';
      }
    }
  }

  let consistency = {
    status_consistencia: 'nao_avaliado',
    motivo_consistencia: 'Nao e candidate tecnico; consistencia nao avaliada.'
  };

  if (isCandidate) {
    if (statusColisao === 'sem_colisao' || statusColisao === 'colisao_mesmo_produto') {
      consistency = {
        status_consistencia: 'sem_conflito_evidente',
        motivo_consistencia: 'Nao ha conflito evidente para o escopo avaliado.'
      };
    } else if (collisionsOther.length > 0) {
      consistency = evaluateConsistency(row, collisionsOther);
    } else {
      consistency = {
        status_consistencia: 'sem_dados_suficientes',
        motivo_consistencia: limitedCollisionScope
          ? 'Colisao indicada no dataset base sem detalhes do produto colidido.'
          : 'Colisao sem detalhes suficientes para validacao semantica.'
      };
    }
  }

  const operationalAmbiguous = statusColisao === 'colisao_ambigua';

  let bucketFinal = 'rejected';
  let bucketReason = 'Falha tecnica na etapa de candidate.';

  if (isCandidate) {
    bucketReason = 'Candidate tecnico aprovado para pad left zero.';

    const hardConflict = consistency.status_consistencia === 'conflito_evidente';
    if (hardConflict) {
      bucketFinal = 'rejected';
      bucketReason = 'Conflito evidente em colisao impede automacao segura.';
      reasons.push('seguranca_falhou:conflito_evidente');
    } else if (statusColisao === 'sem_colisao' || statusColisao === 'colisao_mesmo_produto') {
      if (consistency.status_consistencia === 'sem_conflito_evidente') {
        bucketFinal = 'safe';
        bucketReason = 'Sem colisao problematica e sem conflito evidente.';
      } else {
        bucketFinal = 'assisted';
        bucketReason = 'Nao ha conflito evidente, mas faltam dados para seguranca plena.';
      }
    } else {
      if (operationalAmbiguous || consistency.status_consistencia === 'sem_dados_suficientes' || consistency.status_consistencia === 'conflito_potencial') {
        bucketFinal = 'assisted';
        bucketReason = 'Candidate com ambiguidade/risco residual; requer revisao assistida.';
      } else {
        bucketFinal = 'assisted';
        bucketReason = 'Colisao com outro produto requer validacao humana.';
      }
    }
  }

  if (limitedCollisionScope) {
    reasons.push('fonte_colisao_limitada:dataset_fase1_com_hint');
  }

  return {
    product_id: row.id,
    nome: row.nome,
    marca: row.marca,
    categoria: row.categoria,
    estoque: row.estoque,
    vendas: row.vendas,
    enrichment_last_error: row.enrichment_last_error,
    grupo_origem: row.grupo_origem,
    barcode_original: barcodeOriginal,
    barcode_original_trim: barcodeTrim,
    barcode_original_digits: barcodeDigits,
    barcode_candidato: barcodeCandidate,
    pre_validacao: {
      numeric_only: pre_numeric_only,
      no_internal_spaces: pre_no_internal_spaces,
      exact_length_7_11: pre_exact_length,
      no_mask_or_text: pre_no_mask_or_text,
      ok: pre_ok
    },
    candidate_tecnico: isCandidate,
    candidate_validacoes: {
      candidate_length_ok,
      candidate_checksum_ok,
      candidate_transform_deterministic,
      validation_message: isCandidate ? '' : String(validationCandidate.message || '')
    },
    status_checksum: isCandidate ? 'valido' : (pre_ok ? 'invalido' : 'nao_avaliado'),
    status_colisao: statusColisao,
    colisoes: {
      total_detectado: collisionsRaw.length,
      total_mesmo_produto: collisionsSame.length,
      total_outros_produtos: collisionsOther.length,
      hinted_external_collision: hintedCollision,
      escopo_limitado: limitedCollisionScope,
      exemplos_outros_produtos: collisionsOther.slice(0, 5)
    },
    status_consistencia: consistency.status_consistencia,
    motivo_consistencia: consistency.motivo_consistencia,
    consistencia_checks: consistency.checks || [],
    operacional: {
      multiple_interpretation: operationalAmbiguous,
      trilha_auditoria_completa: true,
      regra_aplicada_exclusiva: 'prefixar_um_zero'
    },
    bucket_final: bucketFinal,
    motivo_bucket_final: bucketReason,
    motivos_classificacao: reasons
  };
}

function countBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    map.set(key, toNumber(map.get(key), 0) + 1);
  }
  return map;
}

function toCountRows(map, total) {
  return Array.from(map.entries())
    .map(([key, count]) => ({
      chave: key,
      total: count,
      percentual: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return String(a.chave).localeCompare(String(b.chave));
    });
}

function pickExamples(items, maxItems = DEFAULT_EXAMPLES) {
  const size = parsePositiveInt(maxItems, DEFAULT_EXAMPLES, { min: 1, max: 50 });
  return items.slice(0, size).map((item) => ({
    product_id: item.product_id,
    barcode_original: item.barcode_original,
    barcode_candidato: item.barcode_candidato,
    grupo_origem: item.grupo_origem,
    status_checksum: item.status_checksum,
    status_colisao: item.status_colisao,
    status_consistencia: item.status_consistencia,
    bucket_final: item.bucket_final,
    motivo_resumido: item.motivo_bucket_final
  }));
}

function buildSectionB(items) {
  const groups = [7, 11];
  return groups.map((groupValue) => {
    const subset = items.filter((item) => item.grupo_origem === groupValue);
    const total = subset.length;

    const candidate = subset.filter((item) => item.candidate_tecnico).length;
    const safe = subset.filter((item) => item.bucket_final === 'safe').length;
    const assisted = subset.filter((item) => item.bucket_final === 'assisted').length;
    const rejected = subset.filter((item) => item.bucket_final === 'rejected').length;

    return {
      grupo_origem: groupValue,
      total,
      candidate,
      safe,
      assisted,
      rejected,
      percentuais: {
        candidate: total > 0 ? Number(((candidate / total) * 100).toFixed(2)) : 0,
        safe: total > 0 ? Number(((safe / total) * 100).toFixed(2)) : 0,
        assisted: total > 0 ? Number(((assisted / total) * 100).toFixed(2)) : 0,
        rejected: total > 0 ? Number(((rejected / total) * 100).toFixed(2)) : 0
      }
    };
  });
}

function buildSectionC(items, exampleLimit = DEFAULT_EXAMPLES) {
  const candidateItems = items.filter((item) => item.candidate_tecnico);
  const total = candidateItems.length;
  const distribution = toCountRows(countBy(candidateItems, (item) => item.status_colisao), total);
  const totalSemColisao = candidateItems.filter((item) => item.status_colisao === 'sem_colisao').length;
  const totalColisaoMesmo = candidateItems.filter((item) => item.status_colisao === 'colisao_mesmo_produto').length;
  const totalColisaoOutro = candidateItems.filter((item) => item.status_colisao === 'colisao_outro_produto').length;
  const totalColisaoAmbigua = candidateItems.filter((item) => item.status_colisao === 'colisao_ambigua').length;

  return {
    total_candidate_analisado: total,
    total_sem_colisao: totalSemColisao,
    total_colisao_mesmo_produto: totalColisaoMesmo,
    total_colisao_outro_produto: totalColisaoOutro,
    total_colisao_ambigua: totalColisaoAmbigua,
    distribuicao_status_colisao: distribution,
    exemplos_sem_colisao: pickExamples(candidateItems.filter((item) => item.status_colisao === 'sem_colisao'), exampleLimit),
    exemplos_colisao_outro_produto: pickExamples(candidateItems.filter((item) => item.status_colisao === 'colisao_outro_produto'), exampleLimit),
    exemplos_colisao_ambigua: pickExamples(candidateItems.filter((item) => item.status_colisao === 'colisao_ambigua'), exampleLimit)
  };
}

function buildSectionD(items, exampleLimit = DEFAULT_EXAMPLES) {
  const candidateItems = items.filter((item) => item.candidate_tecnico);
  const total = candidateItems.length;
  const distribution = toCountRows(countBy(candidateItems, (item) => item.status_consistencia), total);
  const totalSemConflito = candidateItems.filter((item) => item.status_consistencia === 'sem_conflito_evidente').length;
  const totalConflitoEvidente = candidateItems.filter((item) => item.status_consistencia === 'conflito_evidente').length;
  const totalSemDados = candidateItems.filter((item) => item.status_consistencia === 'sem_dados_suficientes').length;
  const totalConflitoPotencial = candidateItems.filter((item) => item.status_consistencia === 'conflito_potencial').length;

  return {
    total_candidate_analisado: total,
    total_sem_conflito_evidente: totalSemConflito,
    total_conflito_evidente: totalConflitoEvidente,
    total_sem_dados_suficientes: totalSemDados,
    total_conflito_potencial: totalConflitoPotencial,
    distribuicao_status_consistencia: distribution,
    exemplos_conflito_evidente: pickExamples(candidateItems.filter((item) => item.status_consistencia === 'conflito_evidente'), exampleLimit),
    exemplos_sem_dados_suficientes: pickExamples(candidateItems.filter((item) => item.status_consistencia === 'sem_dados_suficientes'), exampleLimit),
    exemplos_sem_conflito_evidente: pickExamples(candidateItems.filter((item) => item.status_consistencia === 'sem_conflito_evidente'), exampleLimit)
  };
}

function buildSectionE(items, exampleLimit = DEFAULT_EXAMPLES) {
  const total = items.length;
  const bucketCandidate = items.filter((item) => item.candidate_tecnico);
  const bucketSafe = items.filter((item) => item.bucket_final === 'safe');
  const bucketAssisted = items.filter((item) => item.bucket_final === 'assisted');
  const bucketRejected = items.filter((item) => item.bucket_final === 'rejected');

  const payload = {
    candidate: {
      ...BUCKET_DEFINITIONS.candidate,
      total: bucketCandidate.length,
      percentual: total > 0 ? Number(((bucketCandidate.length / total) * 100).toFixed(2)) : 0,
      exemplos: pickExamples(bucketCandidate, exampleLimit)
    },
    safe: {
      ...BUCKET_DEFINITIONS.safe,
      total: bucketSafe.length,
      percentual: total > 0 ? Number(((bucketSafe.length / total) * 100).toFixed(2)) : 0,
      exemplos: pickExamples(bucketSafe, exampleLimit)
    },
    assisted: {
      ...BUCKET_DEFINITIONS.assisted,
      total: bucketAssisted.length,
      percentual: total > 0 ? Number(((bucketAssisted.length / total) * 100).toFixed(2)) : 0,
      exemplos: pickExamples(bucketAssisted, exampleLimit)
    },
    rejected: {
      ...BUCKET_DEFINITIONS.rejected,
      total: bucketRejected.length,
      percentual: total > 0 ? Number(((bucketRejected.length / total) * 100).toFixed(2)) : 0,
      exemplos: pickExamples(bucketRejected, exampleLimit)
    }
  };

  return {
    payload,
    bucketCandidate,
    bucketSafe,
    bucketAssisted,
    bucketRejected
  };
}

function buildSectionF(sectionE) {
  return {
    total_elegiveis_futuros_safe: sectionE.payload.safe.total,
    total_revisao_assistida: sectionE.payload.assisted.total,
    total_rejeitados_automacao: sectionE.payload.rejected.total,
    recomendacao_objetiva: [
      'SAFE: considerar piloto futuro com governanca e trilha de auditoria.',
      'ASSISTED: manter revisao assistida com validacao humana.',
      'REJECTED: manter fora da automacao e tratar na origem cadastral/importacao.'
    ]
  };
}

function renderMarkdown(summary, sectionB, sectionC, sectionD, sectionE, sectionF) {
  const lines = [];
  lines.push('# Relatorio de Triagem - Pad Left Zero (7 e 11 digitos)');
  lines.push('');
  lines.push(`Gerado em: ${summary.gerado_em}`);
  lines.push(`Mensagem alvo: ${summary.filtro_mensagem_alvo}`);
  lines.push(`Fonte de dados: ${summary.fonte_dados}`);
  lines.push(`Escopo de colisao: ${summary.escopo_colisao}`);
  if (Array.isArray(summary.alertas) && summary.alertas.length > 0) {
    lines.push('- Alertas de execucao:');
    for (const warning of summary.alertas) {
      lines.push(`  - ${warning}`);
    }
  }
  lines.push('');

  lines.push('## SECAO A - RESUMO EXECUTIVO');
  lines.push(`- Total elegivel analisado (somente grupos 7 e 11): ${summary.total_analisado}`);
  lines.push(`- Total grupo 7: ${summary.total_grupo_7}`);
  lines.push(`- Total grupo 11: ${summary.total_grupo_11}`);
  lines.push(`- Total candidate: ${summary.total_candidate}`);
  lines.push(`- Total safe: ${summary.total_safe}`);
  lines.push(`- Total assisted: ${summary.total_assisted}`);
  lines.push(`- Total rejected: ${summary.total_rejected}`);
  lines.push('');

  lines.push('## SECAO B - DISTRIBUICAO POR GRUPO');
  for (const row of sectionB) {
    lines.push(`- Grupo ${row.grupo_origem}: total=${row.total} | candidate=${row.candidate} | safe=${row.safe} | assisted=${row.assisted} | rejected=${row.rejected}`);
  }
  lines.push('');

  lines.push('## SECAO C - COLISOES');
  lines.push(`- Candidatos sem colisao: ${sectionC.total_sem_colisao}`);
  lines.push(`- Candidatos com colisao no mesmo produto: ${sectionC.total_colisao_mesmo_produto}`);
  lines.push(`- Candidatos com colisao em outro produto: ${sectionC.total_colisao_outro_produto}`);
  lines.push(`- Candidatos com colisao ambigua: ${sectionC.total_colisao_ambigua}`);
  for (const row of sectionC.distribuicao_status_colisao) {
    lines.push(`- ${row.chave}: ${row.total} (${row.percentual}%)`);
  }
  lines.push('- Exemplos colisao com outro produto:');
  for (const example of sectionC.exemplos_colisao_outro_produto) {
    lines.push(`  - product_id=${example.product_id} | original=${example.barcode_original} | candidato=${example.barcode_candidato} | bucket=${example.bucket_final} | motivo=${example.motivo_resumido}`);
  }
  lines.push('- Exemplos colisao ambigua:');
  for (const example of sectionC.exemplos_colisao_ambigua) {
    lines.push(`  - product_id=${example.product_id} | original=${example.barcode_original} | candidato=${example.barcode_candidato} | bucket=${example.bucket_final} | motivo=${example.motivo_resumido}`);
  }
  lines.push('');

  lines.push('## SECAO D - CONSISTENCIA');
  lines.push(`- Sem conflito evidente: ${sectionD.total_sem_conflito_evidente}`);
  lines.push(`- Conflito evidente: ${sectionD.total_conflito_evidente}`);
  lines.push(`- Sem dados suficientes: ${sectionD.total_sem_dados_suficientes}`);
  lines.push(`- Conflito potencial: ${sectionD.total_conflito_potencial}`);
  for (const row of sectionD.distribuicao_status_consistencia) {
    lines.push(`- ${row.chave}: ${row.total} (${row.percentual}%)`);
  }
  lines.push('- Exemplos conflito evidente:');
  for (const example of sectionD.exemplos_conflito_evidente) {
    lines.push(`  - product_id=${example.product_id} | original=${example.barcode_original} | candidato=${example.barcode_candidato} | bucket=${example.bucket_final} | motivo=${example.motivo_resumido}`);
  }
  lines.push('- Exemplos sem dados suficientes:');
  for (const example of sectionD.exemplos_sem_dados_suficientes) {
    lines.push(`  - product_id=${example.product_id} | original=${example.barcode_original} | candidato=${example.barcode_candidato} | bucket=${example.bucket_final} | motivo=${example.motivo_resumido}`);
  }
  lines.push('');

  lines.push('## SECAO E - BUCKETS FINAIS');
  for (const bucketKey of ['candidate', 'safe', 'assisted', 'rejected']) {
    const bucket = sectionE.payload[bucketKey];
    lines.push(`### ${bucket.nome}`);
    lines.push(`- Definicao: ${bucket.definicao}`);
    lines.push(`- Contagem: ${bucket.total} (${bucket.percentual}%)`);
    lines.push(`- Risco operacional: ${bucket.risco_operacional}`);
    lines.push(`- Recomendacao: ${bucket.recomendacao}`);
    lines.push('- Exemplos:');
    for (const example of bucket.exemplos) {
      lines.push(`  - product_id=${example.product_id} | original=${example.barcode_original} | candidato=${example.barcode_candidato} | grupo=${example.grupo_origem} | checksum=${example.status_checksum} | colisao=${example.status_colisao} | consistencia=${example.status_consistencia} | bucket=${example.bucket_final}`);
    }
    lines.push('');
  }

  lines.push('## SECAO F - PROXIMOS PASSOS');
  lines.push(`- Casos elegiveis para futura autoaprovacao segura (SAFE): ${sectionF.total_elegiveis_futuros_safe}`);
  lines.push(`- Casos para revisao assistida (ASSISTED): ${sectionF.total_revisao_assistida}`);
  lines.push(`- Casos rejeitados da automacao (REJECTED): ${sectionF.total_rejeitados_automacao}`);
  for (const line of sectionF.recomendacao_objetiva) {
    lines.push(`- ${line}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-barcode-pad-left-zero-report.js [opcoes]',
    '',
    'Modos:',
    '  --mode report          Executa triagem restritiva (somente leitura).',
    '',
    'Opcoes:',
    '  --output-dir <pasta>   Pasta de saida dos artefatos.',
    '  --limit <n>            Limite de casos para amostragem controlada.',
    '  --examples <n>         Quantidade de exemplos por secao/bucket.',
    '  --source-file <arq>    Arquivo details.json da fase 1 para fallback.',
    '  --no-fallback-file     Desativa fallback por arquivo quando o banco falhar.',
    '',
    'Observacao: script nao altera dados e nao reprocessa.'
  ];

  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
}

async function runReport(args) {
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const limit = parsePositiveInt(args.limit, 0, { min: 0, max: 500000 });
  const examples = parsePositiveInt(args.examples, DEFAULT_EXAMPLES, { min: 1, max: 50 });
  const sourceFile = path.resolve(String(args.source_file || DEFAULT_SOURCE_FILE));
  const allowFileFallback = parseBoolean(args.fallback_file, true);
  const baseName = buildRunBaseName();
  const artifacts = buildArtifacts(outputDir, baseName);

  let rows = [];
  let collisionContext = {
    barcodeMap: new Map(),
    limitedCollisionScope: false
  };
  let sourceType = 'database';
  const warnings = [];
  let pool = null;

  try {
    pool = createMysqlPool();
    rows = await loadTargetRows(pool, { limit });
    const barcodeMap = await loadActiveBarcodeMap(pool);
    collisionContext = {
      barcodeMap,
      limitedCollisionScope: false
    };
  } catch (dbError) {
    const canFallback = allowFileFallback && fs.existsSync(sourceFile);
    if (!canFallback) {
      throw dbError;
    }

    rows = loadTargetRowsFromDetailsFile(sourceFile, { limit });
    collisionContext = {
      barcodeMap: buildCollisionMapFromRows(rows),
      limitedCollisionScope: true
    };
    sourceType = 'fallback_invalid_length_details';
    warnings.push(`Banco indisponivel (${dbError?.code || 'erro_desconhecido'}); fallback por arquivo ativado.`);
    warnings.push(`Arquivo base: ${sourceFile}`);
    warnings.push('Colisao externa detalhada pode ficar limitada quando somente fallback e usado.');
  } finally {
    if (pool) {
      await pool.end().catch(() => null);
    }
  }

  const analyzed = rows.map((row) => analyzeRow(row, collisionContext));

  const sectionB = buildSectionB(analyzed);
  const sectionC = buildSectionC(analyzed, examples);
  const sectionD = buildSectionD(analyzed, examples);
  const sectionE = buildSectionE(analyzed, examples);
  const sectionF = buildSectionF(sectionE);

  const totalGrupo7 = sectionB.find((row) => row.grupo_origem === 7)?.total || 0;
  const totalGrupo11 = sectionB.find((row) => row.grupo_origem === 11)?.total || 0;

  const summary = {
    gerado_em: nowIso(),
    modo: 'report',
    sem_mutacao_de_dados: true,
    sem_autoaprovacao: true,
    sem_reprocessamento: true,
    fonte_dados: sourceType,
    arquivo_fonte_fallback: sourceType === 'fallback_invalid_length_details' ? sourceFile : '',
    escopo_colisao: collisionContext.limitedCollisionScope
      ? 'limitado_dataset_fase1_com_hint_colisao'
      : 'todos_produtos_ativos',
    alertas: warnings,
    filtro_status: 'erro',
    filtro_mensagem_alvo: TARGET_ERROR_MESSAGE,
    filtro_grupos_origem: [7, 11],
    total_analisado: analyzed.length,
    total_grupo_7: totalGrupo7,
    total_grupo_11: totalGrupo11,
    total_candidate: sectionE.payload.candidate.total,
    total_safe: sectionE.payload.safe.total,
    total_assisted: sectionE.payload.assisted.total,
    total_rejected: sectionE.payload.rejected.total,
    secao_b_distribuicao_por_grupo: sectionB,
    secao_c_colisoes: sectionC,
    secao_d_consistencia: sectionD,
    secao_e_buckets_finais: sectionE.payload,
    secao_f_proximos_passos: sectionF,
    artefatos: artifacts
  };

  const details = {
    gerado_em: nowIso(),
    fonte_dados: sourceType,
    escopo_colisao: summary.escopo_colisao,
    alertas: warnings,
    total_itens: analyzed.length,
    itens: analyzed
  };

  writeJsonFile(artifacts.summary, summary);
  writeJsonFile(artifacts.details, details);

  writeJsonFile(artifacts.bucket_candidate, {
    bucket: BUCKET_DEFINITIONS.candidate,
    total: sectionE.bucketCandidate.length,
    ids: sectionE.bucketCandidate.map((item) => item.product_id),
    itens: sectionE.bucketCandidate
  });

  writeJsonFile(artifacts.bucket_safe, {
    bucket: BUCKET_DEFINITIONS.safe,
    total: sectionE.bucketSafe.length,
    ids: sectionE.bucketSafe.map((item) => item.product_id),
    itens: sectionE.bucketSafe
  });

  writeJsonFile(artifacts.bucket_assisted, {
    bucket: BUCKET_DEFINITIONS.assisted,
    total: sectionE.bucketAssisted.length,
    ids: sectionE.bucketAssisted.map((item) => item.product_id),
    itens: sectionE.bucketAssisted
  });

  writeJsonFile(artifacts.bucket_rejected, {
    bucket: BUCKET_DEFINITIONS.rejected,
    total: sectionE.bucketRejected.length,
    ids: sectionE.bucketRejected.map((item) => item.product_id),
    itens: sectionE.bucketRejected
  });

  const markdown = renderMarkdown(summary, sectionB, sectionC, sectionD, sectionE, sectionF);
  writeTextFile(artifacts.markdown, markdown);

  copyAsLatest(artifacts.summary, artifacts.latest_summary);
  copyAsLatest(artifacts.details, artifacts.latest_details);
  copyAsLatest(artifacts.markdown, artifacts.latest_markdown);

  process.stdout.write('\n=== TRIAGEM PAD_LEFT_ZERO (FASE 2) ===\n');
  process.stdout.write(`Mensagem alvo: ${TARGET_ERROR_MESSAGE}\n`);
  process.stdout.write(`Fonte de dados: ${summary.fonte_dados}\n`);
  process.stdout.write(`Escopo colisao: ${summary.escopo_colisao}\n`);
  process.stdout.write(`Total analisado (7/11): ${analyzed.length}\n`);
  process.stdout.write(`Candidate: ${sectionE.payload.candidate.total}\n`);
  process.stdout.write(`Safe: ${sectionE.payload.safe.total}\n`);
  process.stdout.write(`Assisted: ${sectionE.payload.assisted.total}\n`);
  process.stdout.write(`Rejected: ${sectionE.payload.rejected.total}\n`);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      process.stdout.write(`Aviso: ${warning}\n`);
    }
  }
  process.stdout.write(`Summary: ${artifacts.summary}\n`);
  process.stdout.write(`Details: ${artifacts.details}\n`);
  process.stdout.write(`Markdown: ${artifacts.markdown}\n`);
  process.stdout.write(`IDs SAFE: ${artifacts.bucket_safe}\n`);

  return { summary, details, artifacts };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help === true) {
    printUsage();
    return;
  }

  const mode = normalizeMode(args.mode);
  if (mode !== 'report') {
    throw new Error(`Modo nao suportado: ${mode}. Use --mode report.`);
  }

  await runReport(args);
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('[enrichment-barcode-pad-left-zero-report] falha:', error?.message || error);
    process.exitCode = 1;
  });
