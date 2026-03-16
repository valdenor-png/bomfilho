'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { normalizarBarcode, validarBarcode } = require('../services/barcode/utils/barcodeUtils');
const { createDefaultBarcodeLookupService } = require('../services/barcode/BarcodeLookupService');
const {
  ensureAdminCatalogSchema,
  enriquecerProdutosPendentes
} = require('../services/admin/catalogoAdminService');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const TARGET_ERROR_MESSAGE = 'Codigo de barras invalido. Tamanho nao suportado para EAN/GTIN.';
const BUCKET_SAFE_NAME = 'PAD_LEFT_ZERO_SAFE';
const DECISION_SOURCE = 'auto_recovery_invalid_length_pad_left_zero_safe';
const DECISION_RULE = 'prefixar_um_zero_esquerda_para_barcodes_7_11_do_bucket_safe';

const DEFAULT_SAFE_REPORT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-pad-left-zero');
const DEFAULT_SAFE_LATEST_SUMMARY = path.join(DEFAULT_SAFE_REPORT_DIR, 'latest.summary.json');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-pad-left-zero-apply');

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_REPROCESS_CONCURRENCY = 3;
const DEFAULT_EXAMPLES = 12;
const GTIN_TAMANHOS_VALIDOS = new Set([8, 12, 13, 14]);

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

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
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
  return `pad_left_zero_apply_${formatDateForId(new Date())}`;
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

function chunkArray(list, size) {
  const chunks = [];
  const safeSize = Math.max(1, Number(size) || 1);

  for (let i = 0; i < list.length; i += safeSize) {
    chunks.push(list.slice(i, i + safeSize));
  }

  return chunks;
}

function buildOutputPaths(outputDir, baseName) {
  return {
    summary: path.join(outputDir, `${baseName}.summary.json`),
    details: path.join(outputDir, `${baseName}.details.json`),
    markdown: path.join(outputDir, `${baseName}.md`),
    changed_ids: path.join(outputDir, `${baseName}.changed.ids.json`),
    skipped_ids: path.join(outputDir, `${baseName}.skipped.ids.json`),
    revalidation_failed_ids: path.join(outputDir, `${baseName}.revalidation_failed.ids.json`),
    reprocessed_ids: path.join(outputDir, `${baseName}.reprocessed.ids.json`),
    reprocess_failed_ids: path.join(outputDir, `${baseName}.reprocess_failed.ids.json`),

    latest_summary: path.join(outputDir, 'latest.summary.json'),
    latest_details: path.join(outputDir, 'latest.details.json'),
    latest_markdown: path.join(outputDir, 'latest.md'),
    latest_changed_ids: path.join(outputDir, 'latest.changed.ids.json'),
    latest_skipped_ids: path.join(outputDir, 'latest.skipped.ids.json'),
    latest_revalidation_failed_ids: path.join(outputDir, 'latest.revalidation_failed.ids.json'),
    latest_reprocessed_ids: path.join(outputDir, 'latest.reprocessed.ids.json'),
    latest_reprocess_failed_ids: path.join(outputDir, 'latest.reprocess_failed.ids.json')
  };
}

function normalizeMode(value) {
  const normalized = normalizeTextComparable(value || 'dry-run');
  if (['dry-run', 'dry_run', 'dryrun', 'report'].includes(normalized)) {
    return 'dry-run';
  }

  if (['execute', 'apply'].includes(normalized)) {
    return 'execute';
  }

  return 'dry-run';
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-barcode-pad-left-zero-apply.js [opcoes]',
    '',
    'Modos:',
    '  --mode dry-run   Revalida e simula, sem alteracao de dados (padrao).',
    '  --mode execute   Aplica apenas itens SAFE revalidados e reprocessa apenas alterados.',
    '',
    'Opcoes:',
    '  --input <arquivo>          Arquivo bucket SAFE da fase 2.',
    '  --limit <n>                Limita quantos IDs SAFE processar (piloto).',
    '  --batch-size <n>           Tamanho do lote de processamento (padrao: 100).',
    '  --examples <n>             Quantidade de exemplos no resumo (padrao: 12).',
    '  --output-dir <pasta>       Pasta de saida dos artefatos.',
    '  --reprocess-concurrency <n> Concorrencia do reprocessamento (padrao: 3).',
    '',
    'Importante: este script nunca recalcula SAFE por conta propria.',
    'Sem --input, ele usa o latest SAFE da fase 2 via latest.summary.json.'
  ];

  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
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

async function queryWithRetry(executor, sql, params = []) {
  let lastError = null;

  for (let attempt = 1; attempt <= QUERY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await executor.query(sql, params);
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

function resolveInputFile(args) {
  if (args.input) {
    const explicitPath = path.resolve(String(args.input));
    if (!fs.existsSync(explicitPath)) {
      throw new Error(`Arquivo --input nao encontrado: ${explicitPath}`);
    }

    return {
      filePath: explicitPath,
      source: 'input_explicito'
    };
  }

  const latestSummaryPath = path.resolve(DEFAULT_SAFE_LATEST_SUMMARY);
  if (!fs.existsSync(latestSummaryPath)) {
    throw new Error(`Latest summary da fase 2 nao encontrado: ${latestSummaryPath}`);
  }

  const summary = JSON.parse(fs.readFileSync(latestSummaryPath, 'utf8'));
  const candidatePath = toText(summary?.artefatos?.bucket_safe, '');
  if (!candidatePath) {
    throw new Error(`Latest summary da fase 2 sem caminho bucket_safe: ${latestSummaryPath}`);
  }

  const absoluteBucketPath = path.resolve(candidatePath);
  if (!fs.existsSync(absoluteBucketPath)) {
    throw new Error(`Arquivo bucket SAFE indicado no latest summary nao existe: ${absoluteBucketPath}`);
  }

  return {
    filePath: absoluteBucketPath,
    source: 'latest_fase2_summary'
  };
}

function loadSafeRecords(inputFile, { limit = 0 } = {}) {
  const raw = fs.readFileSync(inputFile, 'utf8');
  const payload = JSON.parse(raw);

  const bucketName = toText(payload?.bucket?.nome || payload?.bucket_name || '', '');
  if (bucketName && bucketName !== BUCKET_SAFE_NAME) {
    throw new Error(`Arquivo de input nao e bucket SAFE. Encontrado: ${bucketName}`);
  }

  const ids = Array.isArray(payload?.ids)
    ? Array.from(
      new Set(
        payload.ids
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    )
    : [];

  if (!ids.length) {
    throw new Error(`Arquivo SAFE sem ids validos: ${inputFile}`);
  }

  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  const itensPorId = new Map();

  for (const item of itens) {
    const id = Number(item?.product_id || item?.id);
    if (!Number.isFinite(id) || id <= 0) {
      continue;
    }

    itensPorId.set(id, {
      product_id: id,
      nome: toText(item?.nome, ''),
      marca: toText(item?.marca, ''),
      categoria: toText(item?.categoria, ''),
      grupo_origem: toNumber(item?.grupo_origem, 0),
      barcode_original: normalizarBarcode(item?.barcode_original || ''),
      barcode_candidato: normalizarBarcode(item?.barcode_candidato || ''),
      enrichment_last_error: toText(item?.enrichment_last_error, ''),
      motivo_bucket_final: toText(item?.motivo_bucket_final, '')
    });
  }

  const safeLimit = parsePositiveInt(limit, 0, { min: 0, max: 500000 });
  const selectedIds = safeLimit > 0 ? ids.slice(0, safeLimit) : ids;

  const records = selectedIds.map((id) => {
    const fromItem = itensPorId.get(id);
    return {
      product_id: id,
      report_item_found: Boolean(fromItem),
      grupo_origem: toNumber(fromItem?.grupo_origem, 0),
      barcode_original: toText(fromItem?.barcode_original, ''),
      barcode_candidato_report: toText(fromItem?.barcode_candidato, ''),
      nome_report: toText(fromItem?.nome, ''),
      marca_report: toText(fromItem?.marca, ''),
      categoria_report: toText(fromItem?.categoria, ''),
      motivo_bucket_final_report: toText(fromItem?.motivo_bucket_final, ''),
      enrichment_last_error_report: toText(fromItem?.enrichment_last_error, '')
    };
  });

  return {
    total_ids_arquivo: ids.length,
    total_itens_arquivo: itens.length,
    records,
    selected_ids: selectedIds,
    bucket_name: bucketName || BUCKET_SAFE_NAME
  };
}

async function fetchCurrentProduct(pool, productId) {
  const [rows] = await queryWithRetry(
    pool,
    `SELECT
        id,
        COALESCE(ativo, 0) AS ativo,
        COALESCE(nome, '') AS nome,
        COALESCE(marca, '') AS marca,
        COALESCE(categoria, '') AS categoria,
        COALESCE(codigo_barras, '') AS codigo_barras,
        COALESCE(enrichment_status, 'pendente') AS enrichment_status,
        COALESCE(enrichment_last_error, '') AS enrichment_last_error
     FROM produtos
     WHERE id = ?
     LIMIT 1`,
    [productId]
  );

  return rows[0] || null;
}

async function fetchCollisionInfo(pool, candidateBarcode, productId) {
  const [rows] = await queryWithRetry(
    pool,
    `SELECT
        id,
        COALESCE(nome, '') AS nome,
        COALESCE(codigo_barras, '') AS codigo_barras
     FROM produtos
     WHERE ativo = TRUE
       AND COALESCE(codigo_barras, '') = ?
     ORDER BY id ASC
     LIMIT 10`,
    [candidateBarcode]
  );

  const same = rows.filter((row) => Number(row.id) === Number(productId));
  const others = rows.filter((row) => Number(row.id) !== Number(productId));

  let status = 'sem_colisao';
  if (!rows.length) {
    status = 'sem_colisao';
  } else if (others.length === 0 && same.length > 0) {
    status = 'colisao_mesmo_produto';
  } else if (others.length === 1) {
    status = 'colisao_outro_produto';
  } else if (others.length > 1) {
    status = 'colisao_ambigua';
  }

  return {
    status,
    total_detectado: rows.length,
    total_mesmo_produto: same.length,
    total_outros_produtos: others.length,
    outros_produtos: others.map((row) => ({
      id: Number(row.id),
      nome: toText(row.nome, ''),
      codigo_barras: normalizarBarcode(row.codigo_barras)
    }))
  };
}

function pickReason(resultType, reason, fallback = '') {
  return toText(reason, '') || (resultType === 'revalidation_failed' ? 'revalidation_failed' : fallback);
}

function evaluateRevalidation(record, currentProduct, collisionInfo) {
  const targetErrorNormalized = normalizeMessage(TARGET_ERROR_MESSAGE);

  const productId = record.product_id;
  const barcodeOriginalReport = normalizarBarcode(record.barcode_original || '');

  const payload = {
    product_id: productId,
    grupo_origem: record.grupo_origem,
    barcode_original_report: barcodeOriginalReport,
    barcode_candidato_report: normalizarBarcode(record.barcode_candidato_report || ''),
    decision_source: DECISION_SOURCE,
    decision_rule: DECISION_RULE,
    current_product: null,
    candidate_barcode_rule: '',
    candidate_validation: {
      length_ok: false,
      checksum_ok: false,
      validation_message: ''
    },
    revalidation: {
      ativo_ok: false,
      estado_esperado_ok: false,
      barcode_origem_inalterado_ok: false,
      candidate_collision_ok: false,
      deterministic_rule_ok: false
    },
    collision: collisionInfo || {
      status: 'nao_avaliado',
      total_detectado: 0,
      total_mesmo_produto: 0,
      total_outros_produtos: 0,
      outros_produtos: []
    },
    result_type: 'revalidation_failed',
    reason: 'revalidation_failed',
    reason_detail: ''
  };

  if (!currentProduct) {
    payload.result_type = 'skipped';
    payload.reason = 'missing_product';
    payload.reason_detail = 'Produto nao encontrado no banco no momento da execucao.';
    return payload;
  }

  const currentBarcode = normalizarBarcode(currentProduct.codigo_barras || '');
  const currentStatus = normalizeTextComparable(currentProduct.enrichment_status || 'pendente');
  const currentErrorNormalized = normalizeMessage(currentProduct.enrichment_last_error || '');
  const ativoOk = Number(currentProduct.ativo) === 1;

  payload.current_product = {
    ativo: ativoOk,
    nome: toText(currentProduct.nome, ''),
    marca: toText(currentProduct.marca, ''),
    categoria: toText(currentProduct.categoria, ''),
    barcode_atual: currentBarcode,
    enrichment_status: toText(currentProduct.enrichment_status, ''),
    enrichment_last_error: toText(currentProduct.enrichment_last_error, '')
  };

  payload.revalidation.ativo_ok = ativoOk;

  if (!barcodeOriginalReport) {
    payload.result_type = 'revalidation_failed';
    payload.reason = 'revalidation_failed';
    payload.reason_detail = 'Registro SAFE sem barcode_original valido para revalidar.';
    return payload;
  }

  if (currentBarcode === `0${barcodeOriginalReport}`) {
    payload.result_type = 'skipped';
    payload.reason = (currentStatus !== 'erro' || currentErrorNormalized !== targetErrorNormalized)
      ? 'already_processed'
      : 'already_corrected';
    payload.reason_detail = 'Produto ja esta com barcode candidato aplicado.';
    return payload;
  }

  if (!ativoOk) {
    payload.result_type = 'skipped';
    payload.reason = 'product_no_longer_eligible';
    payload.reason_detail = 'Produto nao esta mais ativo.';
    return payload;
  }

  const estadoEsperadoOk = currentStatus === 'erro' && currentErrorNormalized === targetErrorNormalized;
  payload.revalidation.estado_esperado_ok = estadoEsperadoOk;

  if (!estadoEsperadoOk) {
    payload.result_type = 'skipped';
    payload.reason = 'product_no_longer_eligible';
    payload.reason_detail = 'Estado de enrichment atual difere do esperado para aplicacao SAFE.';
    return payload;
  }

  const barcodeOrigemInalteradoOk = currentBarcode === barcodeOriginalReport;
  payload.revalidation.barcode_origem_inalterado_ok = barcodeOrigemInalteradoOk;

  if (!barcodeOrigemInalteradoOk) {
    payload.result_type = 'skipped';
    payload.reason = 'source_barcode_changed';
    payload.reason_detail = 'Barcode atual diverge do barcode_original do relatorio SAFE.';
    return payload;
  }

  const candidateFromRule = normalizarBarcode(`0${barcodeOriginalReport}`);
  payload.candidate_barcode_rule = candidateFromRule;

  const deterministicRuleOk = candidateFromRule === `0${barcodeOriginalReport}`;
  payload.revalidation.deterministic_rule_ok = deterministicRuleOk;

  if (!deterministicRuleOk) {
    payload.result_type = 'revalidation_failed';
    payload.reason = 'revalidation_failed';
    payload.reason_detail = 'Falha na construcao deterministica do candidato 0+original.';
    return payload;
  }

  const candidateLengthOk = GTIN_TAMANHOS_VALIDOS.has(candidateFromRule.length);
  const candidateValidation = validarBarcode(candidateFromRule);
  const candidateChecksumOk = Boolean(candidateValidation.ok);

  payload.candidate_validation.length_ok = candidateLengthOk;
  payload.candidate_validation.checksum_ok = candidateChecksumOk;
  payload.candidate_validation.validation_message = toText(candidateValidation.message, '');

  if (!candidateLengthOk || !candidateChecksumOk) {
    payload.result_type = 'revalidation_failed';
    payload.reason = 'candidate_checksum_invalid';
    payload.reason_detail = 'Candidato 0+original nao passou validacao tecnica de GTIN/checksum.';
    return payload;
  }

  const collisionOk = collisionInfo
    ? collisionInfo.total_outros_produtos === 0
    : true;

  payload.revalidation.candidate_collision_ok = collisionOk;

  if (!collisionOk) {
    payload.result_type = 'revalidation_failed';
    payload.reason = 'candidate_collision_detected';
    payload.reason_detail = 'Candidato colide com outro produto ativo no momento da execucao.';
    return payload;
  }

  payload.result_type = 'eligible';
  payload.reason = 'eligible';
  payload.reason_detail = 'Item SAFE revalidado com sucesso para aplicacao controlada.';
  return payload;
}

async function insertDecisionAuditLog(connection, auditPayload) {
  const barcode = normalizarBarcode(auditPayload.barcode || '').slice(0, 32);
  const provider = toText(auditPayload.provider, DECISION_SOURCE).slice(0, 80);
  const status = toText(auditPayload.status, 'pendente').slice(0, 40);
  const mensagem = toText(auditPayload.mensagem, '').slice(0, 255) || null;
  const payloadResumido = JSON.stringify(auditPayload.payload_resumido || {});

  await queryWithRetry(
    connection,
    `INSERT INTO product_enrichment_logs
      (produto_id, barcode, provider, status, mensagem, payload_resumido)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      toNumber(auditPayload.produto_id, 0) || null,
      barcode,
      provider || null,
      status || 'pendente',
      mensagem,
      payloadResumido
    ]
  );
}

async function applyEligibleItem(pool, evaluated, context) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const productId = evaluated.product_id;
    const barcodeOriginal = evaluated.barcode_original_report;
    const barcodeCandidate = evaluated.candidate_barcode_rule;

    const [result] = await queryWithRetry(
      connection,
      `UPDATE produtos
          SET codigo_barras = ?,
              enrichment_status = 'pendente',
              enrichment_provider = ?,
              enrichment_last_attempt_at = NULL,
              enrichment_updated_at = NULL,
              enrichment_last_error = NULL
        WHERE id = ?
          AND ativo = TRUE
          AND COALESCE(codigo_barras, '') = ?
          AND COALESCE(enrichment_status, 'pendente') = 'erro'
          AND LOWER(COALESCE(enrichment_last_error, '')) LIKE '%tamanho nao suportado para ean/gtin%'`,
      [barcodeCandidate, DECISION_SOURCE, productId, barcodeOriginal]
    );

    if (toNumber(result?.affectedRows, 0) <= 0) {
      await connection.rollback();

      return {
        ...evaluated,
        result_type: 'skipped',
        reason: 'already_processed',
        reason_detail: 'Nenhuma linha atualizada; estado mudou entre revalidacao e persistencia.',
        apply: {
          attempted: true,
          changed: false,
          affected_rows: toNumber(result?.affectedRows, 0)
        }
      };
    }

    await insertDecisionAuditLog(connection, {
      produto_id: productId,
      barcode: barcodeCandidate,
      provider: DECISION_SOURCE,
      status: 'pendente',
      mensagem: 'Aplicado PAD_LEFT_ZERO_SAFE com revalidacao obrigatoria; pronto para reprocessamento.',
      payload_resumido: {
        run_id: context.runId,
        mode: context.mode,
        regra_aplicada: DECISION_RULE,
        origem_decisao: DECISION_SOURCE,
        arquivo_input: context.inputFile,
        barcode_anterior: barcodeOriginal,
        barcode_novo: barcodeCandidate,
        motivo_bucket_final_report: evaluated.motivo_bucket_final_report,
        grupo_origem: evaluated.grupo_origem
      }
    });

    await connection.commit();

    return {
      ...evaluated,
      result_type: 'changed',
      reason: 'changed',
      reason_detail: 'Barcode atualizado com sucesso e marcado para reprocessamento.',
      apply: {
        attempted: true,
        changed: true,
        affected_rows: toNumber(result?.affectedRows, 0),
        before: barcodeOriginal,
        after: barcodeCandidate
      }
    };
  } catch (error) {
    await connection.rollback();

    return {
      ...evaluated,
      result_type: 'revalidation_failed',
      reason: 'revalidation_failed',
      reason_detail: `Falha ao persistir alteracao: ${error?.message || 'erro nao detalhado'}`,
      apply: {
        attempted: true,
        changed: false,
        error_message: error?.message || 'erro_nao_detalhado'
      }
    };
  } finally {
    connection.release();
  }
}

async function processOneSafeRecord(pool, record, context) {
  const current = await fetchCurrentProduct(pool, record.product_id);

  const originalBarcode = normalizarBarcode(record.barcode_original || '');
  const candidateRule = originalBarcode ? normalizarBarcode(`0${originalBarcode}`) : '';

  let collisionInfo = {
    status: 'nao_avaliado',
    total_detectado: 0,
    total_mesmo_produto: 0,
    total_outros_produtos: 0,
    outros_produtos: []
  };

  if (candidateRule) {
    collisionInfo = await fetchCollisionInfo(pool, candidateRule, record.product_id);
  }

  const evaluated = evaluateRevalidation(record, current, collisionInfo);

  if (context.mode === 'dry-run') {
    if (evaluated.result_type === 'eligible') {
      return {
        ...evaluated,
        result_type: 'dry_run_candidate',
        reason: 'would_apply',
        reason_detail: 'Dry-run: item passaria para aplicacao real.',
        apply: {
          attempted: false,
          changed: false
        }
      };
    }

    return {
      ...evaluated,
      apply: {
        attempted: false,
        changed: false
      }
    };
  }

  if (evaluated.result_type !== 'eligible') {
    return {
      ...evaluated,
      apply: {
        attempted: false,
        changed: false
      }
    };
  }

  return applyEligibleItem(pool, evaluated, context);
}

async function reprocessChangedIds(pool, changedIds, options = {}) {
  const ids = Array.from(
    new Set(
      (Array.isArray(changedIds) ? changedIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  const result = {
    executed: false,
    total_input_ids: ids.length,
    total_reprocessed: 0,
    total_failed: 0,
    reprocessed_ids: [],
    failed_ids: [],
    detalhes_lotes: []
  };

  if (!ids.length) {
    return result;
  }

  const batchSize = parsePositiveInt(options.batchSize, DEFAULT_BATCH_SIZE, { min: 1, max: 1000 });
  const concurrency = parsePositiveInt(options.reprocessConcurrency, DEFAULT_REPROCESS_CONCURRENCY, { min: 1, max: 12 });

  const barcodeLookupService = createDefaultBarcodeLookupService({ pool, logger: console });
  const batches = chunkArray(ids, batchSize);

  result.executed = true;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];

    try {
      const reprocess = await enriquecerProdutosPendentes(pool, barcodeLookupService, {
        selectedIds: batch,
        concurrency,
        force: false,
        preferSpreadsheet: true,
        overwriteImageMode: 'if_empty'
      });

      const itens = Array.isArray(reprocess?.itens) ? reprocess.itens : [];
      const itensPorId = new Map();
      for (const item of itens) {
        const id = Number(item?.produto_id);
        if (Number.isFinite(id) && id > 0) {
          itensPorId.set(id, item);
        }
      }

      const loteInfo = {
        lote_index: i + 1,
        total_ids: batch.length,
        processados: 0,
        reprocessados: 0,
        falhos: 0,
        ids_reprocessados: [],
        ids_falhos: []
      };

      for (const id of batch) {
        const item = itensPorId.get(id);
        if (!item) {
          loteInfo.falhos += 1;
          loteInfo.ids_falhos.push({ id, motivo: 'reprocess_result_missing' });
          result.failed_ids.push({ id, motivo: 'reprocess_result_missing' });
          continue;
        }

        loteInfo.processados += 1;
        const status = normalizeTextComparable(item.status || '');

        if (status === 'erro') {
          loteInfo.falhos += 1;
          loteInfo.ids_falhos.push({
            id,
            motivo: toText(item.mensagem, 'erro_no_reprocessamento')
          });
          result.failed_ids.push({
            id,
            motivo: toText(item.mensagem, 'erro_no_reprocessamento')
          });
        } else {
          loteInfo.reprocessados += 1;
          loteInfo.ids_reprocessados.push(id);
          result.reprocessed_ids.push(id);
        }
      }

      result.detalhes_lotes.push(loteInfo);
    } catch (error) {
      const loteInfo = {
        lote_index: i + 1,
        total_ids: batch.length,
        processados: 0,
        reprocessados: 0,
        falhos: batch.length,
        ids_reprocessados: [],
        ids_falhos: batch.map((id) => ({ id, motivo: error?.message || 'falha_lote_reprocessamento' }))
      };

      result.detalhes_lotes.push(loteInfo);
      for (const id of batch) {
        result.failed_ids.push({ id, motivo: error?.message || 'falha_lote_reprocessamento' });
      }
    }
  }

  result.total_reprocessed = result.reprocessed_ids.length;
  result.total_failed = result.failed_ids.length;

  return result;
}

function countByReason(items, key = 'reason') {
  const map = new Map();

  for (const item of items) {
    const reason = toText(item?.[key], 'indefinido');
    map.set(reason, toNumber(map.get(reason), 0) + 1);
  }

  return Array.from(map.entries())
    .map(([reason, total]) => ({ reason, total }))
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.reason.localeCompare(b.reason);
    });
}

function pickExamples(items, limit = DEFAULT_EXAMPLES) {
  const size = parsePositiveInt(limit, DEFAULT_EXAMPLES, { min: 1, max: 50 });

  return items.slice(0, size).map((item) => ({
    product_id: item.product_id,
    grupo_origem: item.grupo_origem,
    barcode_original_report: item.barcode_original_report,
    barcode_candidato: item.candidate_barcode_rule,
    enrichment_status_atual: toText(item?.current_product?.enrichment_status, ''),
    status_checksum: item?.candidate_validation?.checksum_ok ? 'valido' : 'invalido_ou_nao_avaliado',
    status_colisao: toText(item?.collision?.status, ''),
    result_type: item.result_type,
    reason: item.reason,
    reason_detail: item.reason_detail
  }));
}

function buildMarkdown(summary, details) {
  const lines = [];
  lines.push('# FASE 3 - APPLY CONTROLADO PAD_LEFT_ZERO_SAFE');
  lines.push('');
  lines.push(`Gerado em: ${summary.generated_at}`);
  lines.push(`Modo: ${summary.modo_execucao}`);
  lines.push(`Arquivo SAFE usado: ${summary.arquivo_input_usado}`);
  lines.push('');

  lines.push('## Resumo');
  lines.push(`- total_ids_carregados: ${summary.total_ids_carregados}`);
  lines.push(`- total_processados: ${summary.total_processados}`);
  lines.push(`- total_dry_run_candidates: ${summary.total_dry_run_candidates}`);
  lines.push(`- total_alterados: ${summary.total_alterados}`);
  lines.push(`- total_pulados: ${summary.total_pulados}`);
  lines.push(`- total_revalidation_failed: ${summary.total_revalidation_failed}`);
  lines.push(`- total_reprocessados: ${summary.total_reprocessados}`);
  lines.push(`- total_reprocess_failed: ${summary.total_reprocess_failed}`);
  lines.push(`- batch_size: ${summary.batch_size}`);
  lines.push(`- limit_aplicado: ${summary.limit_aplicado}`);
  lines.push('');

  lines.push('## Motivos De Skip');
  for (const row of summary.distribuicao_motivos_skip) {
    lines.push(`- ${row.reason}: ${row.total}`);
  }
  lines.push('');

  lines.push('## Motivos De Revalidacao Falha');
  for (const row of summary.distribuicao_motivos_revalidation_failed) {
    lines.push(`- ${row.reason}: ${row.total}`);
  }
  lines.push('');

  lines.push('## Exemplos Dry-Run Candidates');
  for (const example of summary.exemplos.dry_run_candidates) {
    lines.push(`- id=${example.product_id} | original=${example.barcode_original_report} | candidato=${example.barcode_candidato} | reason=${example.reason}`);
  }
  lines.push('');

  lines.push('## Exemplos Alterados');
  for (const example of summary.exemplos.alterados) {
    lines.push(`- id=${example.product_id} | original=${example.barcode_original_report} | candidato=${example.barcode_candidato} | reason=${example.reason}`);
  }
  lines.push('');

  lines.push('## Exemplos Pulados');
  for (const example of summary.exemplos.pulados) {
    lines.push(`- id=${example.product_id} | original=${example.barcode_original_report} | candidato=${example.barcode_candidato} | reason=${example.reason}`);
  }
  lines.push('');

  lines.push('## Exemplos Revalidation Failed');
  for (const example of summary.exemplos.revalidation_failed) {
    lines.push(`- id=${example.product_id} | original=${example.barcode_original_report} | candidato=${example.barcode_candidato} | reason=${example.reason}`);
  }
  lines.push('');

  lines.push('## Arquivos');
  lines.push(`- summary: ${details.files.summary}`);
  lines.push(`- details: ${details.files.details}`);
  lines.push(`- changed ids: ${details.files.changed_ids}`);
  lines.push(`- skipped ids: ${details.files.skipped_ids}`);
  lines.push(`- revalidation failed ids: ${details.files.revalidation_failed_ids}`);
  lines.push(`- reprocessed ids: ${details.files.reprocessed_ids}`);
  lines.push(`- reprocess failed ids: ${details.files.reprocess_failed_ids}`);
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function runApplyFlow(args) {
  const mode = normalizeMode(args.mode);
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const limit = parsePositiveInt(args.limit, 0, { min: 0, max: 500000 });
  const batchSize = parsePositiveInt(args.batch_size, DEFAULT_BATCH_SIZE, { min: 1, max: 1000 });
  const examples = parsePositiveInt(args.examples, DEFAULT_EXAMPLES, { min: 1, max: 50 });
  const reprocessConcurrency = parsePositiveInt(args.reprocess_concurrency, DEFAULT_REPROCESS_CONCURRENCY, {
    min: 1,
    max: 12
  });

  const inputResolution = resolveInputFile(args);
  const safeData = loadSafeRecords(inputResolution.filePath, { limit });

  const runBaseName = buildRunBaseName();
  const files = buildOutputPaths(outputDir, runBaseName);

  const pool = createMysqlPool();

  try {
    if (mode === 'execute') {
      await ensureAdminCatalogSchema(pool);
    }

    const records = safeData.records;
    const batches = chunkArray(records, batchSize);
    const processedItems = [];

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];

      for (const record of batch) {
        const item = await processOneSafeRecord(pool, record, {
          mode,
          runId: runBaseName,
          inputFile: inputResolution.filePath
        });

        processedItems.push({
          ...item,
          lote_index: i + 1
        });
      }
    }

    const dryRunCandidates = processedItems.filter((item) => item.result_type === 'dry_run_candidate');
    const changed = processedItems.filter((item) => item.result_type === 'changed');
    const skipped = processedItems.filter((item) => item.result_type === 'skipped');
    const revalidationFailed = processedItems.filter((item) => item.result_type === 'revalidation_failed');

    let reprocessResult = {
      executed: false,
      total_input_ids: 0,
      total_reprocessed: 0,
      total_failed: 0,
      reprocessed_ids: [],
      failed_ids: [],
      detalhes_lotes: []
    };

    if (mode === 'execute' && changed.length > 0) {
      reprocessResult = await reprocessChangedIds(
        pool,
        changed.map((item) => item.product_id),
        {
          batchSize,
          reprocessConcurrency
        }
      );
    }

    const changedIdsPayload = {
      generated_at: nowIso(),
      mode,
      decision_source: DECISION_SOURCE,
      total_ids: changed.length,
      ids: changed.map((item) => item.product_id)
    };

    const skippedIdsPayload = {
      generated_at: nowIso(),
      mode,
      total_ids: skipped.length,
      ids: skipped.map((item) => item.product_id),
      items: skipped.map((item) => ({
        id: item.product_id,
        reason: item.reason,
        reason_detail: item.reason_detail
      }))
    };

    const revalidationFailedPayload = {
      generated_at: nowIso(),
      mode,
      total_ids: revalidationFailed.length,
      ids: revalidationFailed.map((item) => item.product_id),
      items: revalidationFailed.map((item) => ({
        id: item.product_id,
        reason: item.reason,
        reason_detail: item.reason_detail
      }))
    };

    const reprocessedIdsPayload = {
      generated_at: nowIso(),
      mode,
      total_ids: reprocessResult.reprocessed_ids.length,
      ids: reprocessResult.reprocessed_ids,
      detalhes_lotes: reprocessResult.detalhes_lotes
    };

    const reprocessFailedIdsPayload = {
      generated_at: nowIso(),
      mode,
      total_ids: reprocessResult.failed_ids.length,
      ids: reprocessResult.failed_ids.map((item) => item.id),
      items: reprocessResult.failed_ids
    };

    const summary = {
      generated_at: nowIso(),
      modo_execucao: mode,
      sem_mutacao_de_dados: mode !== 'execute',
      regras_seguranca: {
        somente_bucket_safe: true,
        sem_recalculo_silent_safe: true,
        regra_unica_prefixo_zero: true,
        revalidacao_obrigatoria_por_item: true,
        sem_toque_dv_inconsistente: true,
        sem_toque_assisted_rejected: true,
        reprocessar_somente_alterados: true
      },
      decision_source: DECISION_SOURCE,
      decision_rule: DECISION_RULE,
      arquivo_input_usado: inputResolution.filePath,
      origem_arquivo_input: inputResolution.source,
      bucket_name_input: safeData.bucket_name,
      total_ids_arquivo_input: safeData.total_ids_arquivo,
      total_ids_carregados: records.length,
      total_processados: processedItems.length,
      total_dry_run_candidates: dryRunCandidates.length,
      total_alterados: changed.length,
      total_pulados: skipped.length,
      total_revalidation_failed: revalidationFailed.length,
      total_reprocessados: reprocessResult.reprocessed_ids.length,
      total_reprocess_failed: reprocessResult.failed_ids.length,
      batch_size: batchSize,
      limit_aplicado: limit,
      reprocess_concurrency: reprocessConcurrency,
      distribuicao_motivos_skip: countByReason(skipped),
      distribuicao_motivos_revalidation_failed: countByReason(revalidationFailed),
      exemplos: {
        dry_run_candidates: pickExamples(dryRunCandidates, examples),
        alterados: pickExamples(changed, examples),
        pulados: pickExamples(skipped, examples),
        revalidation_failed: pickExamples(revalidationFailed, examples)
      },
      arquivos: files
    };

    const details = {
      generated_at: nowIso(),
      mode,
      input: {
        file: inputResolution.filePath,
        source: inputResolution.source,
        total_ids_arquivo: safeData.total_ids_arquivo,
        total_itens_arquivo: safeData.total_itens_arquivo,
        ids_processados: records.map((item) => item.product_id)
      },
      files,
      results: {
        dry_run_candidates: dryRunCandidates,
        changed,
        skipped,
        revalidation_failed: revalidationFailed,
        reprocessing: reprocessResult
      },
      items: processedItems
    };

    writeJsonFile(files.summary, summary);
    writeJsonFile(files.details, details);
    writeJsonFile(files.changed_ids, changedIdsPayload);
    writeJsonFile(files.skipped_ids, skippedIdsPayload);
    writeJsonFile(files.revalidation_failed_ids, revalidationFailedPayload);
    writeJsonFile(files.reprocessed_ids, reprocessedIdsPayload);
    writeJsonFile(files.reprocess_failed_ids, reprocessFailedIdsPayload);

    const markdown = buildMarkdown(summary, { files });
    writeTextFile(files.markdown, markdown);

    copyAsLatest(files.summary, files.latest_summary);
    copyAsLatest(files.details, files.latest_details);
    copyAsLatest(files.markdown, files.latest_markdown);
    copyAsLatest(files.changed_ids, files.latest_changed_ids);
    copyAsLatest(files.skipped_ids, files.latest_skipped_ids);
    copyAsLatest(files.revalidation_failed_ids, files.latest_revalidation_failed_ids);
    copyAsLatest(files.reprocessed_ids, files.latest_reprocessed_ids);
    copyAsLatest(files.reprocess_failed_ids, files.latest_reprocess_failed_ids);

    process.stdout.write('\n=== PAD LEFT ZERO SAFE APPLY (FASE 3) ===\n');
    process.stdout.write(`Modo: ${mode}\n`);
    process.stdout.write(`Arquivo input SAFE: ${inputResolution.filePath}\n`);
    process.stdout.write(`Total IDs carregados: ${records.length}\n`);
    process.stdout.write(`Total processados: ${processedItems.length}\n`);
    process.stdout.write(`Total dry-run candidates: ${dryRunCandidates.length}\n`);
    process.stdout.write(`Total alterados: ${changed.length}\n`);
    process.stdout.write(`Total pulados: ${skipped.length}\n`);
    process.stdout.write(`Total revalidation failed: ${revalidationFailed.length}\n`);
    process.stdout.write(`Total reprocessados: ${reprocessResult.reprocessed_ids.length}\n`);
    process.stdout.write(`Total reprocess failed: ${reprocessResult.failed_ids.length}\n`);
    process.stdout.write(`Summary: ${files.summary}\n`);
    process.stdout.write(`Details: ${files.details}\n`);
    process.stdout.write(`Markdown: ${files.markdown}\n`);
    process.stdout.write(`IDs alterados: ${files.changed_ids}\n`);

    return {
      summary,
      details,
      files
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (parseBoolean(args.help, false)) {
    printUsage();
    return;
  }

  await runApplyFlow(args);
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('[enrichment-barcode-pad-left-zero-apply] falha:', error?.message || error);
    process.exitCode = 1;
  });
