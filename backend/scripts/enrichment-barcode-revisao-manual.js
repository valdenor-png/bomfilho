'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const { validarBarcode, normalizarBarcode } = require('../services/barcode/utils/barcodeUtils');
const { createDefaultBarcodeLookupService } = require('../services/barcode/BarcodeLookupService');
const { enriquecerProdutosPendentes } = require('../services/admin/catalogoAdminService');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const DEFAULT_SANEAMENTO_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-saneamento');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-revisao-manual');
const DEFAULT_CATEGORY_PRIORITY = [
  'mercearia',
  'bebidas',
  'higiene',
  'limpeza',
  'frios',
  'laticinios',
  'carnes',
  'padaria',
  'hortifruti',
  'congelados'
];

const STATUS_REVISAO_VALUES = new Set(['pendente', 'aprovado', 'rejeitado', 'ambigua']);

function toArgKey(rawKey) {
  return String(rawKey || '')
    .trim()
    .replace(/^--?/, '')
    .replace(/-/g, '_');
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

function parseBooleanInput(value, fallback = false) {
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

function parsePositiveInt(value, fallback, { min = 1, max = 1000000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
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

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function writeJsonFile(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsvFile(filePath, rows = [], headers = []) {
  ensureDirectory(path.dirname(filePath));

  const csvHeaders = Array.isArray(headers) && headers.length
    ? headers
    : (rows[0] ? Object.keys(rows[0]) : []);

  const lines = [
    csvHeaders.map((h) => escapeCsvValue(h)).join(',')
  ];

  for (const row of rows) {
    lines.push(csvHeaders.map((h) => escapeCsvValue(row?.[h])).join(','));
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function copyAsLatest(sourceFile, latestFile) {
  ensureDirectory(path.dirname(latestFile));
  fs.copyFileSync(sourceFile, latestFile);
}

function normalizeTextComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeHeaderKey(value) {
  return normalizeTextComparable(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeCategory(value) {
  return normalizeTextComparable(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeMode(value) {
  const normalized = normalizeTextComparable(value || 'export-queue');
  const map = {
    export: 'export-queue',
    export_queue: 'export-queue',
    export_queue_: 'export-queue',
    export_fila: 'export-queue',
    export_queue_manual: 'export-queue',
    export_queue_priorizada: 'export-queue',
    import: 'import-corrections',
    import_corrections: 'import-corrections',
    importar: 'import-corrections',
    importar_correcoes: 'import-corrections',
    reprocess: 'reprocess-approved',
    reprocess_approved: 'reprocess-approved',
    reprocessar_aprovados: 'reprocess-approved'
  };

  if (['export-queue', 'import-corrections', 'reprocess-approved'].includes(normalized)) {
    return normalized;
  }

  return map[normalized] || 'export-queue';
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-barcode-revisao-manual.js [opcoes]',
    '',
    'Modos:',
    '  --mode export-queue       Exporta fila priorizada de revisao manual (padrao).',
    '  --mode import-corrections Importa arquivo preenchido pela equipe e aplica correcoes validas.',
    '  --mode reprocess-approved Reprocessa somente IDs aprovados e aplicados.',
    '',
    'Export queue:',
    '  --report-file <json>      Arquivo de resumo do saneamento (padrao: latest.report.json).',
    '  --items-file <json>       Arquivo de itens do saneamento (padrao: latest.barcode_invalido.json).',
    '  --category-priority <csv> Lista de categorias prioritarias separadas por virgula.',
    '  --output-dir <pasta>      Pasta de saida dos artefatos.',
    '',
    'Import corrections:',
    '  --input-file <csv|xlsx|json> Arquivo preenchido pela equipe.',
    '  --apply true|false            Aplicar no banco (padrao: false).',
    '  --reviewer <texto>            Identificacao do operador/auditoria.',
    '  --output-dir <pasta>          Pasta de saida dos artefatos.',
    '',
    'Reprocess approved:',
    '  --ids-file <json>         Arquivo de IDs aprovados/aplicados.',
    '  --concurrency <n>         Concorrencia (padrao: 3).',
    '  --force true|false        Forcar consulta externa (padrao: false).',
    '',
    'Exemplos:',
    '  node scripts/enrichment-barcode-revisao-manual.js --mode export-queue',
    '  node scripts/enrichment-barcode-revisao-manual.js --mode import-corrections --input-file backend/logs/enrichment-barcode-revisao-manual/latest.fila_revisao_manual.csv',
    '  node scripts/enrichment-barcode-revisao-manual.js --mode import-corrections --input-file backend/logs/enrichment-barcode-revisao-manual/latest.fila_revisao_manual.csv --apply --reviewer equipe_catalogo',
    '  node scripts/enrichment-barcode-revisao-manual.js --mode reprocess-approved'
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
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

function buildRunId(prefix) {
  const stamp = formatDateForId(new Date());
  const random = crypto.randomBytes(3).toString('hex');
  return `${prefix}_${stamp}_${random}`;
}

function buildOutputPaths(outputDir, runId) {
  return {
    queue_json: path.join(outputDir, `${runId}.fila_revisao_manual.json`),
    queue_csv: path.join(outputDir, `${runId}.fila_revisao_manual.csv`),
    queue_summary_json: path.join(outputDir, `${runId}.fila_revisao_manual.summary.json`),
    import_summary_json: path.join(outputDir, `${runId}.import_correcoes.summary.json`),
    approved_ids_json: path.join(outputDir, `${runId}.aprovados_aplicados.ids.json`),
    reprocess_summary_json: path.join(outputDir, `${runId}.reprocess_aprovados.summary.json`),
    latest_queue_json: path.join(outputDir, 'latest.fila_revisao_manual.json'),
    latest_queue_csv: path.join(outputDir, 'latest.fila_revisao_manual.csv'),
    latest_queue_summary_json: path.join(outputDir, 'latest.fila_revisao_manual.summary.json'),
    latest_import_summary_json: path.join(outputDir, 'latest.import_correcoes.summary.json'),
    latest_approved_ids_json: path.join(outputDir, 'latest.aprovados_aplicados.ids.json'),
    latest_reprocess_summary_json: path.join(outputDir, 'latest.reprocess_aprovados.summary.json')
  };
}

function parseCategoryPriority(rawValue) {
  const raw = String(rawValue || '').trim();
  const values = raw
    ? raw.split(',').map((item) => normalizeCategory(item)).filter(Boolean)
    : DEFAULT_CATEGORY_PRIORITY.map((item) => normalizeCategory(item));

  const unique = [];
  const seen = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function getCategoryPriorityIndex(categoriaNormalizada, categoryPriorityList) {
  const idx = categoryPriorityList.indexOf(categoriaNormalizada);
  return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
}

function getPriorityLabel(level) {
  const map = {
    1: 'P1_vendas',
    2: 'P2_estoque',
    3: 'P3_relevancia_operacional',
    4: 'P4_categoria_prioritaria',
    5: 'P5_restante'
  };

  return map[level] || 'P5_restante';
}

function getReviewObservation(item) {
  const classeErro = toText(item.classe_erro, '');
  const sugestaoDigito = toText(item.sugestao_barcode_digito_correto, '');

  if (classeErro.includes('digito')) {
    if (sugestaoDigito) {
      return `Conferir codigo na embalagem/fiscal. Sugestao de DV: ${sugestaoDigito}.`;
    }

    return 'Conferir digito verificador no cadastro fiscal e na embalagem.';
  }

  if (classeErro.includes('tamanho')) {
    return 'Comprimento GTIN invalido. Confirmar codigo oficial do produto.';
  }

  return 'Revisar manualmente o barcode com fonte oficial antes de aprovar.';
}

function calculateOperationalRelevance(item) {
  const prioridadeValor = Math.max(0, toNumber(item.prioridade, 0));
  if (!prioridadeValor) {
    return 0;
  }

  return Number(prioridadeValor.toFixed(4));
}

function classifyPriority(item, categoryPriorityList) {
  const vendas = Math.max(0, toNumber(item.vendas, 0));
  const estoque = Math.max(0, toNumber(item.estoque, 0));
  const relevancia = calculateOperationalRelevance(item);
  const categoriaNormalizada = normalizeCategory(item.categoria || '');
  const categoriaIndice = getCategoryPriorityIndex(categoriaNormalizada, categoryPriorityList);

  let prioridadeNivel = 5;

  if (vendas > 0) {
    prioridadeNivel = 1;
  } else if (estoque > 0) {
    prioridadeNivel = 2;
  } else if (relevancia > 0) {
    prioridadeNivel = 3;
  } else if (Number.isFinite(categoriaIndice)) {
    prioridadeNivel = 4;
  }

  return {
    prioridade_nivel: prioridadeNivel,
    prioridade: getPriorityLabel(prioridadeNivel),
    vendas,
    estoque,
    relevancia_operacional: relevancia,
    categoria_normalizada: categoriaNormalizada,
    categoria_prioridade_indice: categoriaIndice
  };
}

function sortManualQueue(rows) {
  return [...rows].sort((a, b) => {
    if (a.prioridade_nivel !== b.prioridade_nivel) {
      return a.prioridade_nivel - b.prioridade_nivel;
    }

    if (b.vendas !== a.vendas) {
      return b.vendas - a.vendas;
    }

    if (b.estoque !== a.estoque) {
      return b.estoque - a.estoque;
    }

    if (b.relevancia_operacional !== a.relevancia_operacional) {
      return b.relevancia_operacional - a.relevancia_operacional;
    }

    if (a.categoria_prioridade_indice !== b.categoria_prioridade_indice) {
      return a.categoria_prioridade_indice - b.categoria_prioridade_indice;
    }

    return toNumber(a.id, 0) - toNumber(b.id, 0);
  });
}

function parseReviewStatus(value) {
  const normalized = normalizeTextComparable(value || 'pendente').replace(/[^a-z0-9]+/g, '_');
  const map = {
    pendente: 'pendente',
    pending: 'pendente',
    aprovado: 'aprovado',
    aprovada: 'aprovado',
    approved: 'aprovado',
    ok: 'aprovado',
    rejeitado: 'rejeitado',
    rejeitada: 'rejeitado',
    rejected: 'rejeitado',
    ambiguo: 'ambigua',
    ambigua: 'ambigua',
    duvida: 'ambigua',
    duvidoso: 'ambigua'
  };

  const parsed = map[normalized] || 'pendente';
  return STATUS_REVISAO_VALUES.has(parsed) ? parsed : 'pendente';
}

function countByKey(items, selector) {
  const map = {};

  for (const item of items) {
    const key = toText(selector(item), 'nao_informado');
    map[key] = toNumber(map[key], 0) + 1;
  }

  return Object.entries(map)
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.chave.localeCompare(b.chave);
    });
}

function loadSaneamentoSources(reportFile, itemsFile) {
  if (!fs.existsSync(reportFile)) {
    throw new Error(`Arquivo de resumo do saneamento nao encontrado: ${reportFile}`);
  }

  if (!fs.existsSync(itemsFile)) {
    throw new Error(`Arquivo de itens do saneamento nao encontrado: ${itemsFile}`);
  }

  const report = readJsonFile(reportFile);
  const itemsPayload = readJsonFile(itemsFile);

  if (!Array.isArray(itemsPayload)) {
    throw new Error(`Formato invalido em ${itemsFile}. Esperado array JSON.`);
  }

  return {
    report,
    items: itemsPayload
  };
}

function buildManualQueue(items, categoryPriorityList) {
  const revisaoManual = items
    .filter((item) => toText(item.classificacao_saneamento, '') === 'revisao_manual')
    .map((item) => {
      const prioridadeInfo = classifyPriority(item, categoryPriorityList);

      return {
        prioridade: prioridadeInfo.prioridade,
        prioridade_nivel: prioridadeInfo.prioridade_nivel,
        id: toNumber(item.id, 0),
        nome: toText(item.nome, ''),
        barcode_atual: toText(item.barcode_atual, ''),
        classe_erro: toText(item.classe_erro, ''),
        mensagem_erro: toText(item.mensagem_erro, ''),
        categoria: toText(item.categoria, ''),
        marca: toText(item.marca, ''),
        estoque: prioridadeInfo.estoque,
        vendas: prioridadeInfo.vendas,
        relevancia_operacional: prioridadeInfo.relevancia_operacional,
        categoria_prioridade_indice: Number.isFinite(prioridadeInfo.categoria_prioridade_indice)
          ? prioridadeInfo.categoria_prioridade_indice + 1
          : null,
        observacao_revisao: getReviewObservation(item),
        barcode_corrigido_manual: '',
        status_revisao: 'pendente',
        sugestao_barcode_digito_correto: toText(item.sugestao_barcode_digito_correto, '')
      };
    });

  const ordenada = sortManualQueue(revisaoManual).map((item, index) => ({
    ...item,
    ordem_prioridade: index + 1
  }));

  return ordenada;
}

function getQueueCsvColumns() {
  return [
    'prioridade',
    'id',
    'nome',
    'barcode_atual',
    'classe_erro',
    'mensagem_erro',
    'categoria',
    'marca',
    'estoque',
    'vendas',
    'observacao_revisao',
    'barcode_corrigido_manual',
    'status_revisao'
  ];
}

function normalizeRowKeys(row = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeaderKey(key)] = value;
  }

  return normalized;
}

function pickFirstValue(row, candidates = [], fallback = '') {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
  }

  return fallback;
}

function readCorrectionsFile(inputFile) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Arquivo de correcoes nao encontrado: ${inputFile}`);
  }

  const ext = path.extname(inputFile).toLowerCase();
  if (ext === '.json') {
    const payload = readJsonFile(inputFile);
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.itens)) {
      return payload.itens;
    }

    throw new Error(`JSON invalido em ${inputFile}. Esperado array ou objeto com itens[].`);
  }

  const workbook = XLSX.readFile(inputFile, { raw: false, cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows;
}

function normalizeCorrectionRow(rawRow = {}) {
  const row = normalizeRowKeys(rawRow);

  return {
    prioridade: toText(pickFirstValue(row, ['prioridade']), ''),
    id: toNumber(pickFirstValue(row, ['id', 'produto_id']), 0),
    nome: toText(pickFirstValue(row, ['nome']), ''),
    barcode_atual: toText(pickFirstValue(row, ['barcode_atual', 'codigo_barras', 'barcode']), ''),
    classe_erro: toText(pickFirstValue(row, ['classe_erro']), ''),
    mensagem_erro: toText(pickFirstValue(row, ['mensagem_erro']), ''),
    categoria: toText(pickFirstValue(row, ['categoria']), ''),
    marca: toText(pickFirstValue(row, ['marca']), ''),
    estoque: toNumber(pickFirstValue(row, ['estoque']), 0),
    vendas: toNumber(pickFirstValue(row, ['vendas']), 0),
    observacao_revisao: toText(pickFirstValue(row, ['observacao_revisao', 'observacao']), ''),
    barcode_corrigido_manual: toText(
      pickFirstValue(row, [
        'barcode_corrigido_manual',
        'barcode_corrigido',
        'novo_barcode',
        'codigo_barras_novo'
      ]),
      ''
    ),
    status_revisao: parseReviewStatus(
      pickFirstValue(row, ['status_revisao', 'status', 'status_revisao_manual'], 'pendente')
    )
  };
}

async function ensureManualAuditTable(connectionOrPool) {
  await connectionOrPool.query(`
    CREATE TABLE IF NOT EXISTS product_barcode_manual_review_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NOT NULL,
      barcode_anterior VARCHAR(32) NULL,
      barcode_novo VARCHAR(32) NULL,
      status_revisao VARCHAR(20) NOT NULL,
      resultado VARCHAR(40) NOT NULL,
      motivo VARCHAR(255) NULL,
      observacao_revisao VARCHAR(500) NULL,
      classe_erro VARCHAR(80) NULL,
      mensagem_erro VARCHAR(255) NULL,
      prioridade VARCHAR(30) NULL,
      origem_arquivo VARCHAR(255) NULL,
      executado_por VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_barcode_manual_review_logs_produto_id (produto_id),
      INDEX idx_product_barcode_manual_review_logs_resultado (resultado),
      INDEX idx_product_barcode_manual_review_logs_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function logAuditRow(connection, payload = {}) {
  await connection.query(
    `INSERT INTO product_barcode_manual_review_logs
      (produto_id, barcode_anterior, barcode_novo, status_revisao, resultado, motivo, observacao_revisao, classe_erro, mensagem_erro, prioridade, origem_arquivo, executado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toNumber(payload.produto_id, 0),
      toText(payload.barcode_anterior, '') || null,
      toText(payload.barcode_novo, '') || null,
      toText(payload.status_revisao, 'pendente').slice(0, 20),
      toText(payload.resultado, 'ignorado').slice(0, 40),
      toText(payload.motivo, '').slice(0, 255) || null,
      toText(payload.observacao_revisao, '').slice(0, 500) || null,
      toText(payload.classe_erro, '').slice(0, 80) || null,
      toText(payload.mensagem_erro, '').slice(0, 255) || null,
      toText(payload.prioridade, '').slice(0, 30) || null,
      toText(payload.origem_arquivo, '').slice(0, 255) || null,
      toText(payload.executado_por, '').slice(0, 120) || null
    ]
  );
}

async function runExportQueue(args) {
  const reportFile = path.resolve(String(args.report_file || path.join(DEFAULT_SANEAMENTO_DIR, 'latest.report.json')));
  const itemsFile = path.resolve(String(args.items_file || path.join(DEFAULT_SANEAMENTO_DIR, 'latest.barcode_invalido.json')));
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const runId = buildRunId('barcode_revisao_manual');
  const outputPaths = buildOutputPaths(outputDir, runId);

  const categoryPriorityList = parseCategoryPriority(args.category_priority || process.env.BARCODE_REVIEW_CATEGORY_PRIORITY || '');

  const { report, items } = loadSaneamentoSources(reportFile, itemsFile);
  const manualQueue = buildManualQueue(items, categoryPriorityList);

  const reportManualCount = toNumber(report?.resumo?.exigem_revisao_manual, 0);

  const summary = {
    run_id: runId,
    generated_at: nowIso(),
    origem_report_file: reportFile,
    origem_items_file: itemsFile,
    total_itens_saneamento: items.length,
    total_revisao_manual_report: reportManualCount,
    total_revisao_manual_fila: manualQueue.length,
    total_revisao_manual_consistente: reportManualCount === manualQueue.length,
    category_priority: categoryPriorityList,
    por_prioridade: countByKey(manualQueue, (item) => item.prioridade),
    por_categoria: countByKey(manualQueue, (item) => item.categoria || 'sem_categoria'),
    por_classe_erro: countByKey(manualQueue, (item) => item.classe_erro || 'nao_informado'),
    arquivos: outputPaths
  };

  writeJsonFile(outputPaths.queue_json, manualQueue);
  writeCsvFile(outputPaths.queue_csv, manualQueue, getQueueCsvColumns());
  writeJsonFile(outputPaths.queue_summary_json, summary);

  copyAsLatest(outputPaths.queue_json, outputPaths.latest_queue_json);
  copyAsLatest(outputPaths.queue_csv, outputPaths.latest_queue_csv);
  copyAsLatest(outputPaths.queue_summary_json, outputPaths.latest_queue_summary_json);

  process.stdout.write('=== FILA DE REVISAO MANUAL PRIORIZADA ===\n');
  process.stdout.write(`Total revisao_manual no report: ${reportManualCount}\n`);
  process.stdout.write(`Total revisao_manual na fila: ${manualQueue.length}\n`);
  process.stdout.write(`Consistencia report x fila: ${summary.total_revisao_manual_consistente ? 'ok' : 'divergente'}\n`);
  process.stdout.write(`Top prioridade: ${summary.por_prioridade.map((x) => `${x.chave}:${x.total}`).join(' | ')}\n`);
  process.stdout.write(`CSV fila: ${outputPaths.queue_csv}\n`);
  process.stdout.write(`JSON fila: ${outputPaths.queue_json}\n`);
  process.stdout.write(`Resumo: ${outputPaths.queue_summary_json}\n`);

  return {
    queue: manualQueue,
    summary,
    outputPaths
  };
}

async function runImportCorrections(args) {
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const runId = buildRunId('barcode_revisao_import');
  const outputPaths = buildOutputPaths(outputDir, runId);
  const inputFile = path.resolve(String(args.input_file || outputPaths.latest_queue_csv));
  const reviewer = toText(args.reviewer || process.env.ADMIN_USER || 'operacao_manual', 'operacao_manual');
  const apply = parseBooleanInput(args.apply, false);

  const rawRows = readCorrectionsFile(inputFile);
  const rows = rawRows.map((row) => normalizeCorrectionRow(row));

  const summary = {
    run_id: runId,
    generated_at: nowIso(),
    input_file: inputFile,
    apply,
    reviewer,
    total_linhas_arquivo: rows.length,
    total_id_invalido: 0,
    total_status_pendente: 0,
    total_status_rejeitado: 0,
    total_status_ambigua: 0,
    total_aprovado_sem_barcode: 0,
    total_aprovado_barcode_invalido: 0,
    total_aprovado_barcode_valido: 0,
    total_aprovado_pronto_para_aplicar: 0,
    total_aprovado_aplicado: 0,
    total_aprovado_ignorado_por_estado_atual: 0,
    total_aprovado_erro_execucao: 0,
    ids_aprovados_prontos_para_aplicar: [],
    ids_aprovados_aplicados: [],
    itens_com_erro: []
  };

  const candidateRows = [];

  for (const row of rows) {
    if (!row.id) {
      summary.total_id_invalido += 1;
      continue;
    }

    if (row.status_revisao === 'pendente') {
      summary.total_status_pendente += 1;
      continue;
    }

    if (row.status_revisao === 'rejeitado') {
      summary.total_status_rejeitado += 1;
      continue;
    }

    if (row.status_revisao === 'ambigua') {
      summary.total_status_ambigua += 1;
      continue;
    }

    const barcodeManual = normalizarBarcode(row.barcode_corrigido_manual || '');

    if (!barcodeManual) {
      summary.total_aprovado_sem_barcode += 1;
      summary.itens_com_erro.push({
        id: row.id,
        motivo: 'aprovado_sem_barcode',
        mensagem: 'Linha aprovada sem barcode_corrigido_manual preenchido.'
      });
      continue;
    }

    const validacao = validarBarcode(barcodeManual);
    if (!validacao.ok) {
      summary.total_aprovado_barcode_invalido += 1;
      summary.itens_com_erro.push({
        id: row.id,
        motivo: 'barcode_manual_invalido',
        mensagem: validacao.message || 'Barcode manual invalido.'
      });
      continue;
    }

    summary.total_aprovado_barcode_valido += 1;
    summary.ids_aprovados_prontos_para_aplicar.push(row.id);
    candidateRows.push({
      ...row,
      barcode_corrigido_manual: validacao.normalized
    });
  }

  summary.total_aprovado_pronto_para_aplicar = candidateRows.length;

  const approvedIdsPayload = {
    run_id: runId,
    generated_at: nowIso(),
    apply,
    total_ids: 0,
    ids: []
  };

  if (!candidateRows.length || !apply) {
    writeJsonFile(outputPaths.import_summary_json, summary);
    writeJsonFile(outputPaths.approved_ids_json, approvedIdsPayload);

    copyAsLatest(outputPaths.import_summary_json, outputPaths.latest_import_summary_json);
    copyAsLatest(outputPaths.approved_ids_json, outputPaths.latest_approved_ids_json);

    process.stdout.write('=== IMPORTACAO DE CORRECOES MANUAIS ===\n');
    process.stdout.write(`Arquivo: ${inputFile}\n`);
    process.stdout.write(`Apply: ${apply ? 'sim' : 'nao'}\n`);
    process.stdout.write(`Aprovados prontos para aplicar: ${summary.total_aprovado_pronto_para_aplicar}\n`);
    process.stdout.write(`Aprovados aplicados: ${summary.total_aprovado_aplicado}\n`);
    process.stdout.write(`Resumo: ${outputPaths.import_summary_json}\n`);
    process.stdout.write(`IDs aprovados/aplicados: ${outputPaths.approved_ids_json}\n`);

    return {
      summary,
      approvedIdsPayload,
      outputPaths
    };
  }

  const pool = createMysqlPool();
  const connection = await pool.getConnection();

  try {
    await ensureManualAuditTable(connection);
    await connection.beginTransaction();

    for (const item of candidateRows) {
      try {
        const [currentRows] = await connection.query(
          `SELECT id, COALESCE(codigo_barras, '') AS codigo_barras, COALESCE(enrichment_status, 'pendente') AS enrichment_status, COALESCE(enrichment_last_error, '') AS enrichment_last_error
             FROM produtos
            WHERE id = ?
            LIMIT 1`,
          [item.id]
        );

        const current = currentRows[0];
        if (!current) {
          summary.total_aprovado_ignorado_por_estado_atual += 1;
          await logAuditRow(connection, {
            produto_id: item.id,
            barcode_anterior: '',
            barcode_novo: item.barcode_corrigido_manual,
            status_revisao: 'aprovado',
            resultado: 'ignorado_nao_encontrado',
            motivo: 'Produto nao encontrado.',
            observacao_revisao: item.observacao_revisao,
            classe_erro: item.classe_erro,
            mensagem_erro: item.mensagem_erro,
            prioridade: item.prioridade,
            origem_arquivo: inputFile,
            executado_por: reviewer
          });
          continue;
        }

        if (toText(current.enrichment_status, 'pendente') !== 'erro') {
          summary.total_aprovado_ignorado_por_estado_atual += 1;
          await logAuditRow(connection, {
            produto_id: item.id,
            barcode_anterior: current.codigo_barras,
            barcode_novo: item.barcode_corrigido_manual,
            status_revisao: 'aprovado',
            resultado: 'ignorado_status_atual',
            motivo: `Status atual ${current.enrichment_status}; esperado erro para ajuste manual.`,
            observacao_revisao: item.observacao_revisao,
            classe_erro: item.classe_erro,
            mensagem_erro: item.mensagem_erro,
            prioridade: item.prioridade,
            origem_arquivo: inputFile,
            executado_por: reviewer
          });
          continue;
        }

        const [result] = await connection.query(
          `UPDATE produtos
              SET codigo_barras = ?,
                  enrichment_status = 'pendente',
                  enrichment_provider = NULL,
                  enrichment_last_attempt_at = NULL,
                  enrichment_updated_at = NULL,
                  enrichment_last_error = NULL
            WHERE id = ?
              AND ativo = TRUE
              AND COALESCE(enrichment_status, 'pendente') = 'erro'`,
          [item.barcode_corrigido_manual, item.id]
        );

        if (toNumber(result?.affectedRows, 0) > 0) {
          summary.total_aprovado_aplicado += 1;
          summary.ids_aprovados_aplicados.push(item.id);

          await logAuditRow(connection, {
            produto_id: item.id,
            barcode_anterior: current.codigo_barras,
            barcode_novo: item.barcode_corrigido_manual,
            status_revisao: 'aprovado',
            resultado: 'aplicado',
            motivo: 'Correcao manual validada e aplicada.',
            observacao_revisao: item.observacao_revisao,
            classe_erro: item.classe_erro,
            mensagem_erro: item.mensagem_erro,
            prioridade: item.prioridade,
            origem_arquivo: inputFile,
            executado_por: reviewer
          });
        } else {
          summary.total_aprovado_ignorado_por_estado_atual += 1;
          await logAuditRow(connection, {
            produto_id: item.id,
            barcode_anterior: current.codigo_barras,
            barcode_novo: item.barcode_corrigido_manual,
            status_revisao: 'aprovado',
            resultado: 'ignorado_sem_update',
            motivo: 'Nenhuma linha atualizada; estado atual nao elegivel.',
            observacao_revisao: item.observacao_revisao,
            classe_erro: item.classe_erro,
            mensagem_erro: item.mensagem_erro,
            prioridade: item.prioridade,
            origem_arquivo: inputFile,
            executado_por: reviewer
          });
        }
      } catch (error) {
        summary.total_aprovado_erro_execucao += 1;
        summary.itens_com_erro.push({
          id: item.id,
          motivo: 'erro_execucao',
          mensagem: error?.message || 'Erro nao detalhado.'
        });

        await logAuditRow(connection, {
          produto_id: item.id,
          barcode_anterior: item.barcode_atual,
          barcode_novo: item.barcode_corrigido_manual,
          status_revisao: 'aprovado',
          resultado: 'erro_execucao',
          motivo: error?.message || 'Erro nao detalhado.',
          observacao_revisao: item.observacao_revisao,
          classe_erro: item.classe_erro,
          mensagem_erro: item.mensagem_erro,
          prioridade: item.prioridade,
          origem_arquivo: inputFile,
          executado_por: reviewer
        });
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }

  approvedIdsPayload.total_ids = summary.ids_aprovados_aplicados.length;
  approvedIdsPayload.ids = summary.ids_aprovados_aplicados;

  writeJsonFile(outputPaths.import_summary_json, summary);
  writeJsonFile(outputPaths.approved_ids_json, approvedIdsPayload);

  copyAsLatest(outputPaths.import_summary_json, outputPaths.latest_import_summary_json);
  copyAsLatest(outputPaths.approved_ids_json, outputPaths.latest_approved_ids_json);

  process.stdout.write('=== IMPORTACAO DE CORRECOES MANUAIS ===\n');
  process.stdout.write(`Arquivo: ${inputFile}\n`);
  process.stdout.write(`Apply: ${apply ? 'sim' : 'nao'}\n`);
  process.stdout.write(`Aprovados prontos para aplicar: ${summary.total_aprovado_pronto_para_aplicar}\n`);
  process.stdout.write(`Aprovados aplicados: ${summary.total_aprovado_aplicado}\n`);
  process.stdout.write(`Aprovados ignorados por estado atual: ${summary.total_aprovado_ignorado_por_estado_atual}\n`);
  process.stdout.write(`Aprovados erro de execucao: ${summary.total_aprovado_erro_execucao}\n`);
  process.stdout.write(`Resumo: ${outputPaths.import_summary_json}\n`);
  process.stdout.write(`IDs aprovados/aplicados: ${outputPaths.approved_ids_json}\n`);

  return {
    summary,
    approvedIdsPayload,
    outputPaths
  };
}

async function runReprocessApproved(args) {
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const runId = buildRunId('barcode_revisao_reprocess');
  const outputPaths = buildOutputPaths(outputDir, runId);

  const idsFileDefault = outputPaths.latest_approved_ids_json;
  const idsFile = path.resolve(String(args.ids_file || idsFileDefault));
  if (!fs.existsSync(idsFile)) {
    throw new Error(`Arquivo de IDs aprovados nao encontrado: ${idsFile}`);
  }

  const idsPayload = readJsonFile(idsFile);
  const ids = Array.isArray(idsPayload?.ids)
    ? idsPayload.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  const uniqueIds = Array.from(new Set(ids));

  const summary = {
    run_id: runId,
    generated_at: nowIso(),
    ids_file: idsFile,
    total_ids_arquivo: uniqueIds.length,
    executado: false,
    motivo: '',
    resumo_reprocessamento: null
  };

  if (!uniqueIds.length) {
    summary.executado = false;
    summary.motivo = 'Nenhum ID aprovado/aplicado para reprocessar.';

    writeJsonFile(outputPaths.reprocess_summary_json, summary);
    copyAsLatest(outputPaths.reprocess_summary_json, outputPaths.latest_reprocess_summary_json);

    process.stdout.write('=== REPROCESSAR APROVADOS ===\n');
    process.stdout.write(`${summary.motivo}\n`);
    process.stdout.write(`Resumo: ${outputPaths.reprocess_summary_json}\n`);

    return {
      summary,
      outputPaths
    };
  }

  const pool = createMysqlPool();

  try {
    const barcodeLookupService = createDefaultBarcodeLookupService({ pool, logger: console });
    const resultado = await enriquecerProdutosPendentes(pool, barcodeLookupService, {
      selectedIds: uniqueIds,
      concurrency: parsePositiveInt(args.concurrency, 3, { min: 1, max: 12 }),
      force: parseBooleanInput(args.force, false),
      preferSpreadsheet: true,
      overwriteImageMode: 'if_empty'
    });

    summary.executado = true;
    summary.motivo = '';
    summary.resumo_reprocessamento = resultado?.resumo || {};
  } finally {
    await pool.end();
  }

  writeJsonFile(outputPaths.reprocess_summary_json, summary);
  copyAsLatest(outputPaths.reprocess_summary_json, outputPaths.latest_reprocess_summary_json);

  process.stdout.write('=== REPROCESSAR APROVADOS ===\n');
  process.stdout.write(`IDs reprocessados: ${uniqueIds.length}\n`);
  process.stdout.write(`Resumo: ${outputPaths.reprocess_summary_json}\n`);

  return {
    summary,
    outputPaths
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (parseBooleanInput(args.help, false)) {
    printUsage();
    return;
  }

  const mode = normalizeMode(args.mode);

  if (mode === 'export-queue') {
    await runExportQueue(args);
    return;
  }

  if (mode === 'import-corrections') {
    await runImportCorrections(args);
    return;
  }

  if (mode === 'reprocess-approved') {
    await runReprocessApproved(args);
    return;
  }

  throw new Error(`Modo nao suportado: ${mode}`);
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('[enrichment-barcode-revisao-manual] falha:', error?.message || error);
    process.exitCode = 1;
  });
