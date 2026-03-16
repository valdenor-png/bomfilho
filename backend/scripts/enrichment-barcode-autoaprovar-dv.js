'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { normalizarBarcode, validarBarcode } = require('../services/barcode/utils/barcodeUtils');
const { createDefaultBarcodeLookupService } = require('../services/barcode/BarcodeLookupService');
const { enriquecerProdutosPendentes } = require('../services/admin/catalogoAdminService');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const GTIN_TAMANHOS_VALIDOS = new Set([8, 12, 13, 14]);
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-autoaprovar-dv');
const DEFAULT_EXAMPLES = 10;

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

function writeJsonFile(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function copyAsLatest(sourceFile, latestFile) {
  ensureDirectory(path.dirname(latestFile));
  fs.copyFileSync(sourceFile, latestFile);
}

function buildRunId(prefix = 'barcode_dv_autoapprove') {
  const stamp = formatDateForId(new Date());
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${prefix}_${stamp}_${suffix}`;
}

function normalizeTextComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeMode(value) {
  const normalized = normalizeTextComparable(value || 'dry-run');
  if (['dry_run', 'dry-run', 'dryrun'].includes(normalized)) {
    return 'dry-run';
  }
  if (normalized === 'apply') {
    return 'apply';
  }
  if (normalized === 'reprocess') {
    return 'reprocess';
  }
  return 'dry-run';
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-barcode-autoaprovar-dv.js [opcoes]',
    '',
    'Modos:',
    '  --mode dry-run    Apenas analisa e gera relatorio (padrao).',
    '  --mode apply      Analisa e aplica apenas se --apply=true.',
    '  --mode reprocess  Reprocessa somente IDs autoaprovados/aplicados.',
    '',
    'Opcoes gerais:',
    '  --output-dir <pasta>      Pasta de saida dos artefatos.',
    '  --limit <n>               Limite de linhas para analise (padrao: sem limite).',
    '  --examples <n>            Quantidade de exemplos no relatorio (padrao: 10).',
    '',
    'Opcoes do modo apply:',
    '  --apply true|false        Chave de seguranca para aplicar no banco (padrao: false).',
    '  --reprocess-autoaprovados Reprocessa IDs aplicados no mesmo comando.',
    '  --concurrency <n>         Concorrencia do reprocessamento (padrao: 3).',
    '  --force true|false        Forca lookup externo no reprocessamento (padrao: false).',
    '',
    'Opcoes do modo reprocess:',
    '  --ids-file <arquivo.json> Arquivo com campo ids[] (padrao: latest.autoaprovados_aplicados.ids.json).',
    '  --concurrency <n>         Concorrencia (padrao: 3).',
    '  --force true|false        Forca lookup externo no reprocessamento (padrao: false).',
    '',
    'Exemplos:',
    '  node scripts/enrichment-barcode-autoaprovar-dv.js --mode dry-run',
    '  node scripts/enrichment-barcode-autoaprovar-dv.js --mode apply --apply',
    '  node scripts/enrichment-barcode-autoaprovar-dv.js --mode apply --apply --reprocess-autoaprovados',
    '  node scripts/enrichment-barcode-autoaprovar-dv.js --mode reprocess'
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

async function getExistingProductColumns(pool) {
  const [rows] = await pool.query(
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
    const normalized = String(name || '').toLowerCase();
    if (columnSet.has(normalized)) {
      return name;
    }
  }

  return '';
}

function isMensagemDigitoInconsistente(mensagem) {
  const normalized = normalizeTextComparable(mensagem || '');
  if (!normalized) {
    return false;
  }

  return normalized.includes('digito verificador inconsistente')
    || normalized.includes('barcode_invalido_digito');
}

function calcularDigitoVerificadorGtin(codigoSemDigito) {
  const body = String(codigoSemDigito || '').replace(/\D/g, '');
  if (!body) {
    return null;
  }

  let soma = 0;
  let peso = 3;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    soma += Number(body[i]) * peso;
    peso = peso === 3 ? 1 : 3;
  }

  return (10 - (soma % 10)) % 10;
}

function sugerirBarcodeComDigitoCorreto(codigoAtualNormalizado) {
  const digits = String(codigoAtualNormalizado || '').replace(/\D/g, '');
  if (!GTIN_TAMANHOS_VALIDOS.has(digits.length)) {
    return '';
  }

  const corpo = digits.slice(0, -1);
  const digito = calcularDigitoVerificadorGtin(corpo);
  if (!Number.isFinite(digito)) {
    return '';
  }

  return `${corpo}${digito}`;
}

function difereApenasDigitoFinal(atual, sugerido) {
  const a = String(atual || '');
  const b = String(sugerido || '');

  if (!a || !b || a.length !== b.length) {
    return false;
  }

  if (a.length < 2) {
    return false;
  }

  if (a.slice(0, -1) !== b.slice(0, -1)) {
    return false;
  }

  return a.slice(-1) !== b.slice(-1);
}

function avaliarElegibilidadeDv(item) {
  const motivos = [];

  const barcodeAtualBruto = toText(item.barcode_atual, '');
  const barcodeAtualNormalizado = normalizarBarcode(barcodeAtualBruto);

  if (!isMensagemDigitoInconsistente(item.mensagem_erro)) {
    motivos.push('classe_erro_nao_digito_inconsistente');
  }

  if (!barcodeAtualNormalizado) {
    motivos.push('barcode_atual_ausente');
  }

  const validacaoAtual = validarBarcode(barcodeAtualNormalizado);
  if (validacaoAtual.ok) {
    motivos.push('barcode_atual_ja_valido');
  } else if (!String(validacaoAtual.message || '').toLowerCase().includes('digito verificador')) {
    motivos.push('falha_atual_nao_equivale_a_digito');
  }

  const sugestaoDv = sugerirBarcodeComDigitoCorreto(barcodeAtualNormalizado);
  if (!sugestaoDv) {
    motivos.push('sem_sugestao_dv_disponivel');
  }

  if (sugestaoDv && barcodeAtualNormalizado.length !== sugestaoDv.length) {
    motivos.push('comprimento_sugestao_diverge_do_atual');
  }

  if (sugestaoDv && barcodeAtualNormalizado.length === 13 && barcodeAtualNormalizado.slice(0, 12) !== sugestaoDv.slice(0, 12)) {
    motivos.push('ean13_primeiros_12_digitos_divergem');
  }

  if (sugestaoDv && !difereApenasDigitoFinal(barcodeAtualNormalizado, sugestaoDv)) {
    motivos.push('sugestao_nao_difere_apenas_dv_final');
  }

  const validacaoSugestao = validarBarcode(sugestaoDv);
  if (sugestaoDv && !validacaoSugestao.ok) {
    motivos.push('sugestao_nao_passa_validacao_gtin');
  }

  const elegivel = motivos.length === 0;

  return {
    ...item,
    barcode_atual_normalizado: barcodeAtualNormalizado,
    sugestao_barcode_dv: sugestaoDv,
    elegivel_autoaprovacao: elegivel,
    motivos_pulo_seguranca: motivos,
    tipo_barcode: validacaoAtual?.type || 'DESCONHECIDO'
  };
}

async function listarItensErroDigito(pool, { limit = 0 } = {}) {
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
    textColumnExpr(columnSet, 'codigo_barras', 'barcode_atual'),
    textColumnExpr(columnSet, 'enrichment_status', 'enrichment_status'),
    textColumnExpr(columnSet, 'enrichment_last_error', 'mensagem_erro'),
    textColumnExpr(columnSet, 'categoria', 'categoria'),
    textColumnExpr(columnSet, 'marca', 'marca'),
    numberColumnExpr(columnSet, 'estoque', 'estoque', 0),
    vendasColumn ? numberColumnExpr(columnSet, vendasColumn, 'vendas', 0) : '0 AS vendas'
  ];

  let sql = `
    SELECT
      ${selectFields.join(',\n      ')}
    FROM produtos
    WHERE ativo = TRUE
      AND COALESCE(enrichment_status, 'pendente') = 'erro'
      AND (
        LOWER(COALESCE(enrichment_last_error, '')) LIKE '%digito verificador inconsistente%'
        OR LOWER(COALESCE(enrichment_last_error, '')) LIKE '%dígito verificador inconsistente%'
        OR LOWER(COALESCE(enrichment_last_error, '')) LIKE '%barcode_invalido_digito%'
      )
    ORDER BY id ASC
  `;

  const params = [];
  const safeLimit = parsePositiveInt(limit, 0, { min: 0, max: 500000 });
  if (safeLimit > 0) {
    sql += '\nLIMIT ?';
    params.push(safeLimit);
  }

  const [rows] = await pool.query(sql, params);

  return rows.map((row) => ({
    id: toNumber(row.id, 0),
    nome: toText(row.nome, ''),
    barcode_atual: toText(row.barcode_atual, ''),
    enrichment_status: toText(row.enrichment_status, 'erro'),
    mensagem_erro: toText(row.mensagem_erro, ''),
    categoria: toText(row.categoria, ''),
    marca: toText(row.marca, ''),
    estoque: toNumber(row.estoque, 0),
    vendas: toNumber(row.vendas, 0)
  }));
}

function pickExamples(items, limit = DEFAULT_EXAMPLES) {
  const safeLimit = parsePositiveInt(limit, DEFAULT_EXAMPLES, { min: 1, max: 50 });

  return items.slice(0, safeLimit).map((item) => ({
    id: item.id,
    nome: item.nome,
    barcode_atual: item.barcode_atual,
    barcode_atual_normalizado: item.barcode_atual_normalizado,
    sugestao_barcode_dv: item.sugestao_barcode_dv,
    mensagem_erro: item.mensagem_erro,
    motivos_pulo_seguranca: item.motivos_pulo_seguranca,
    categoria: item.categoria,
    marca: item.marca,
    estoque: item.estoque,
    vendas: item.vendas
  }));
}

function buildOutputPaths(outputDir, runId) {
  return {
    report_json: path.join(outputDir, `${runId}.autoapprove_dv.report.json`),
    elegiveis_json: path.join(outputDir, `${runId}.autoapprove_dv.elegiveis.json`),
    pulados_json: path.join(outputDir, `${runId}.autoapprove_dv.pulados_seguranca.json`),
    candidatos_ids_json: path.join(outputDir, `${runId}.autoapprove_dv.candidatos.ids.json`),
    aplicados_ids_json: path.join(outputDir, `${runId}.autoapprove_dv.aplicados.ids.json`),
    reprocess_summary_json: path.join(outputDir, `${runId}.autoapprove_dv.reprocess.summary.json`),
    latest_report_json: path.join(outputDir, 'latest.autoapprove_dv.report.json'),
    latest_elegiveis_json: path.join(outputDir, 'latest.autoapprove_dv.elegiveis.json'),
    latest_pulados_json: path.join(outputDir, 'latest.autoapprove_dv.pulados_seguranca.json'),
    latest_candidatos_ids_json: path.join(outputDir, 'latest.autoapprove_dv.candidatos.ids.json'),
    latest_aplicados_ids_json: path.join(outputDir, 'latest.autoaprovados_aplicados.ids.json'),
    latest_reprocess_summary_json: path.join(outputDir, 'latest.autoapprove_dv.reprocess.summary.json')
  };
}

async function aplicarAutoaprovacao(pool, elegiveis = [], { apply = false } = {}) {
  if (!apply) {
    return {
      apply_realizado: false,
      total_elegivel: elegiveis.length,
      total_aplicado: 0,
      total_pulado_apply: 0,
      ids_aplicados: [],
      ids_pulados_apply: []
    };
  }

  if (!elegiveis.length) {
    return {
      apply_realizado: true,
      total_elegivel: 0,
      total_aplicado: 0,
      total_pulado_apply: 0,
      ids_aplicados: [],
      ids_pulados_apply: []
    };
  }

  const connection = await pool.getConnection();
  const idsAplicados = [];
  const idsPuladosApply = [];

  try {
    await connection.beginTransaction();

    for (const item of elegiveis) {
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
            AND COALESCE(enrichment_status, 'pendente') = 'erro'
            AND COALESCE(codigo_barras, '') = ?
            AND (
              LOWER(COALESCE(enrichment_last_error, '')) LIKE '%digito verificador inconsistente%'
              OR LOWER(COALESCE(enrichment_last_error, '')) LIKE '%dígito verificador inconsistente%'
              OR LOWER(COALESCE(enrichment_last_error, '')) LIKE '%barcode_invalido_digito%'
            )`,
        [item.sugestao_barcode_dv, item.id, item.barcode_atual]
      );

      if (toNumber(result?.affectedRows, 0) > 0) {
        idsAplicados.push(item.id);
      } else {
        idsPuladosApply.push(item.id);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    apply_realizado: true,
    total_elegivel: elegiveis.length,
    total_aplicado: idsAplicados.length,
    total_pulado_apply: idsPuladosApply.length,
    ids_aplicados: idsAplicados,
    ids_pulados_apply: idsPuladosApply
  };
}

async function reprocessarIds(pool, ids = [], { concurrency = 3, force = false } = {}) {
  const idsValidos = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (!idsValidos.length) {
    return {
      executado: false,
      motivo: 'Nenhum ID autoaprovado/aplicado para reprocessar.',
      total_ids: 0,
      ids: [],
      resumo: null
    };
  }

  const barcodeLookupService = createDefaultBarcodeLookupService({ pool, logger: console });

  const resultado = await enriquecerProdutosPendentes(pool, barcodeLookupService, {
    selectedIds: idsValidos,
    concurrency: parsePositiveInt(concurrency, 3, { min: 1, max: 12 }),
    force: Boolean(force),
    preferSpreadsheet: true,
    overwriteImageMode: 'if_empty'
  });

  return {
    executado: true,
    motivo: '',
    total_ids: idsValidos.length,
    ids: idsValidos,
    resumo: resultado?.resumo || null
  };
}

async function runDryRunOrApply(args) {
  const mode = normalizeMode(args.mode);
  const applyRequested = mode === 'apply' && parseBooleanInput(args.apply, false);
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const examples = parsePositiveInt(args.examples, DEFAULT_EXAMPLES, { min: 1, max: 50 });
  const limit = parsePositiveInt(args.limit, 0, { min: 0, max: 500000 });
  const runId = buildRunId();
  const outputPaths = buildOutputPaths(outputDir, runId);

  const pool = createMysqlPool();

  try {
    const rows = await listarItensErroDigito(pool, { limit });
    const avaliados = rows.map((row) => avaliarElegibilidadeDv(row));

    const elegiveis = avaliados.filter((item) => item.elegivel_autoaprovacao);
    const puladosSeguranca = avaliados.filter((item) => !item.elegivel_autoaprovacao);

    const applyResult = await aplicarAutoaprovacao(pool, elegiveis, { apply: applyRequested });

    const reprocessRequested = parseBooleanInput(args.reprocess_autoaprovados, false);
    const reprocessResult = {
      executado: false,
      motivo: 'Nao solicitado.',
      total_ids: 0,
      ids: [],
      resumo: null
    };

    if (reprocessRequested) {
      const result = await reprocessarIds(pool, applyResult.ids_aplicados, {
        concurrency: parsePositiveInt(args.concurrency, 3, { min: 1, max: 12 }),
        force: parseBooleanInput(args.force, false)
      });
      Object.assign(reprocessResult, result);
    }

    const candidatosIdsPayload = {
      generated_at: nowIso(),
      mode,
      total_ids: elegiveis.length,
      ids: elegiveis.map((item) => item.id)
    };

    const aplicadosIdsPayload = {
      generated_at: nowIso(),
      mode,
      apply_realizado: applyResult.apply_realizado,
      total_ids: applyResult.ids_aplicados.length,
      ids: applyResult.ids_aplicados
    };

    const report = {
      run_id: runId,
      generated_at: nowIso(),
      mode,
      dry_run: !applyRequested,
      regras_obrigatorias: {
        somente_classe_digito_inconsistente: true,
        somente_com_sugestao_dv: true,
        sugestao_mesmo_comprimento: true,
        sugestao_mesmos_12_primeiros_em_ean13: true,
        sugestao_difere_apenas_dv_final: true,
        sugestao_precisa_validar_gtin: true,
        casos_ambiguos_nao_aplicados: true,
        casos_tamanho_invalido_nao_tocados: true
      },
      totais: {
        total_erros_digito_detectados: rows.length,
        total_elegivel_autoaprovacao: elegiveis.length,
        total_aplicado: applyResult.ids_aplicados.length,
        total_pulado_por_seguranca: puladosSeguranca.length + applyResult.ids_pulados_apply.length,
        total_pulado_validacao_seguranca: puladosSeguranca.length,
        total_pulado_em_apply_concorrencia: applyResult.ids_pulados_apply.length
      },
      exemplos: {
        elegiveis: pickExamples(elegiveis, examples),
        pulados_seguranca: pickExamples(puladosSeguranca, examples)
      },
      apply: applyResult,
      reprocessamento: reprocessResult,
      arquivos: outputPaths
    };

    writeJsonFile(outputPaths.report_json, report);
    writeJsonFile(outputPaths.elegiveis_json, elegiveis);
    writeJsonFile(outputPaths.pulados_json, puladosSeguranca);
    writeJsonFile(outputPaths.candidatos_ids_json, candidatosIdsPayload);
    writeJsonFile(outputPaths.aplicados_ids_json, aplicadosIdsPayload);

    if (reprocessResult.executado || reprocessRequested) {
      writeJsonFile(outputPaths.reprocess_summary_json, reprocessResult);
      copyAsLatest(outputPaths.reprocess_summary_json, outputPaths.latest_reprocess_summary_json);
    }

    copyAsLatest(outputPaths.report_json, outputPaths.latest_report_json);
    copyAsLatest(outputPaths.elegiveis_json, outputPaths.latest_elegiveis_json);
    copyAsLatest(outputPaths.pulados_json, outputPaths.latest_pulados_json);
    copyAsLatest(outputPaths.candidatos_ids_json, outputPaths.latest_candidatos_ids_json);
    copyAsLatest(outputPaths.aplicados_ids_json, outputPaths.latest_aplicados_ids_json);

    process.stdout.write('\n=== AUTOAPROVACAO SEGURA - DIGITO VERIFICADOR ===\n');
    process.stdout.write(`Modo: ${mode}\n`);
    process.stdout.write(`Dry-run: ${!applyRequested ? 'sim' : 'nao'}\n`);
    process.stdout.write(`Total erro digito detectado: ${rows.length}\n`);
    process.stdout.write(`Total elegivel: ${elegiveis.length}\n`);
    process.stdout.write(`Total aplicado: ${applyResult.ids_aplicados.length}\n`);
    process.stdout.write(`Total pulado seguranca: ${puladosSeguranca.length + applyResult.ids_pulados_apply.length}\n`);
    process.stdout.write(`- Pulado validacao seguranca: ${puladosSeguranca.length}\n`);
    process.stdout.write(`- Pulado apply concorrencia: ${applyResult.ids_pulados_apply.length}\n`);
    process.stdout.write(`Relatorio: ${outputPaths.report_json}\n`);
    process.stdout.write(`IDs autoaprovados/aplicados: ${outputPaths.aplicados_ids_json}\n`);

    if (reprocessResult.executado) {
      process.stdout.write(`Reprocessamento executado para ${reprocessResult.total_ids} IDs.\n`);
      process.stdout.write(`Resumo reprocessamento: ${outputPaths.reprocess_summary_json}\n`);
    }

    return report;
  } finally {
    await pool.end();
  }
}

async function runReprocessOnly(args) {
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const idsFileDefault = path.join(outputDir, 'latest.autoaprovados_aplicados.ids.json');
  const idsFile = path.resolve(String(args.ids_file || idsFileDefault));

  if (!fs.existsSync(idsFile)) {
    throw new Error(`Arquivo de IDs autoaprovados nao encontrado: ${idsFile}`);
  }

  const raw = fs.readFileSync(idsFile, 'utf8');
  const payload = JSON.parse(raw);
  const ids = Array.isArray(payload?.ids) ? payload.ids : [];

  const runId = buildRunId('barcode_dv_reprocess');
  const outputPaths = buildOutputPaths(outputDir, runId);

  const pool = createMysqlPool();
  try {
    const resultado = await reprocessarIds(pool, ids, {
      concurrency: parsePositiveInt(args.concurrency, 3, { min: 1, max: 12 }),
      force: parseBooleanInput(args.force, false)
    });

    writeJsonFile(outputPaths.reprocess_summary_json, {
      run_id: runId,
      generated_at: nowIso(),
      ids_file: idsFile,
      ...resultado
    });
    copyAsLatest(outputPaths.reprocess_summary_json, outputPaths.latest_reprocess_summary_json);

    process.stdout.write('\n=== REPROCESSAMENTO AUTOAPROVADOS DV ===\n');
    process.stdout.write(`Arquivo IDs: ${idsFile}\n`);
    process.stdout.write(`Total IDs no arquivo: ${ids.length}\n`);
    process.stdout.write(`Executado: ${resultado.executado ? 'sim' : 'nao'}\n`);
    process.stdout.write(`Total IDs reprocessados: ${resultado.total_ids}\n`);
    process.stdout.write(`Resumo: ${outputPaths.reprocess_summary_json}\n`);

    return resultado;
  } finally {
    await pool.end();
  }
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  if (parseBooleanInput(args.help, false)) {
    printUsage();
    return;
  }

  const mode = normalizeMode(args.mode);

  if (mode === 'reprocess') {
    await runReprocessOnly(args);
    return;
  }

  await runDryRunOrApply(args);
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('[enrichment-barcode-autoaprovar-dv] falha:', error?.message || error);
    process.exitCode = 1;
  });
