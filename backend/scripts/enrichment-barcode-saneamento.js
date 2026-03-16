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
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-saneamento');
const DEFAULT_EXAMPLES_PER_CLASS = 5;

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

function writeCsvFile(filePath, rows = [], headers = []) {
  ensureDirectory(path.dirname(filePath));

  const normalizeHeader = Array.isArray(headers) && headers.length
    ? headers
    : (rows[0] ? Object.keys(rows[0]) : []);

  const escaped = [
    normalizeHeader.map((header) => escapeCsvValue(header)).join(','),
    ...rows.map((row) => normalizeHeader.map((header) => escapeCsvValue(row?.[header])).join(','))
  ];

  fs.writeFileSync(filePath, `${escaped.join('\n')}\n`, 'utf8');
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function copyAsLatest(sourceFile, latestFile) {
  ensureDirectory(path.dirname(latestFile));
  fs.copyFileSync(sourceFile, latestFile);
}

function normalizeMode(value) {
  const normalized = String(value || 'report').trim().toLowerCase();
  if (['report', 'apply', 'reprocess'].includes(normalized)) {
    return normalized;
  }

  return 'report';
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-barcode-saneamento.js [opcoes]',
    '',
    'Modos:',
    '  --mode report      Gera relatorio e exportacoes (padrao).',
    '  --mode apply       Gera relatorio e aplica correcoes somente se --apply=true.',
    '  --mode reprocess   Reprocessa apenas IDs de um arquivo .ids.json gerado pelo script.',
    '',
    'Opcoes gerais:',
    '  --output-dir <pasta>          Pasta de saida dos relatarios.',
    '  --limit <n>                   Limite de linhas para auditoria (padrao: sem limite).',
    '  --examples <n>                Exemplos por classe no resumo (padrao: 5).',
    '',
    'Opcoes do modo apply:',
    '  --apply true|false            Efetiva atualizacao no banco (padrao: false).',
    '  --reprocess-corrigidos        Reprocessa os IDs atualizados no mesmo comando.',
    '  --concurrency <n>             Concorrencia no reprocessamento (padrao: 3).',
    '  --force true|false            Forca lookup externo no reprocessamento (padrao: false).',
    '',
    'Opcoes do modo reprocess:',
    '  --ids-file <arquivo.json>     Arquivo com campo ids[] (padrao: latest.corrigidos_aplicados.ids.json).',
    '  --concurrency <n>             Concorrencia no reprocessamento (padrao: 3).',
    '  --force true|false            Forca lookup externo no reprocessamento (padrao: false).',
    '',
    'Exemplos:',
    '  node scripts/enrichment-barcode-saneamento.js --mode report',
    '  node scripts/enrichment-barcode-saneamento.js --mode apply',
    '  node scripts/enrichment-barcode-saneamento.js --mode apply --apply --reprocess-corrigidos',
    '  node scripts/enrichment-barcode-saneamento.js --mode reprocess'
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

function classificarErroOrigem(mensagemErro) {
  const mensagem = String(mensagemErro || '').trim().toLowerCase();

  if (!mensagem || mensagem.includes('sem codigo de barras')) {
    return 'sem_barcode';
  }

  if (mensagem.includes('tamanho nao suportado')) {
    return 'barcode_invalido_tamanho';
  }

  if (mensagem.includes('digito verificador')) {
    return 'barcode_invalido_digito';
  }

  if (mensagem.includes('codigo de barras invalido') || mensagem.includes('barcode invalido')) {
    return 'barcode_invalido_generico';
  }

  if (mensagem.includes('timeout')) {
    return 'timeout';
  }

  return 'outro';
}

function classificarFalhaValidacao(validacao) {
  const mensagem = String(validacao?.message || '').toLowerCase();

  if (validacao?.ok) {
    return 'valido';
  }

  if (validacao?.reason === 'sem_barcode') {
    return 'sem_barcode';
  }

  if (mensagem.includes('tamanho nao suportado')) {
    return 'tamanho_nao_suportado';
  }

  if (mensagem.includes('digito verificador')) {
    return 'digito_verificador_inconsistente';
  }

  return 'invalido_outro';
}

function sanitizarBarcode(rawValue) {
  const bruto = String(rawValue ?? '');
  const trimmed = bruto.trim();
  const semEspacos = trimmed.replace(/\s+/g, '');
  const semHifen = semEspacos.replace(/-/g, '');
  const somenteDigitos = semHifen.replace(/\D/g, '');

  const caracteresRemovidos = trimmed.replace(/[0-9]/g, '');
  const removeuSomenteFormatacao = !caracteresRemovidos || /^[\s\-._/()]+$/.test(caracteresRemovidos);
  const contemLetras = /[A-Za-z]/.test(caracteresRemovidos);

  return {
    bruto,
    trimmed,
    sem_espacos: semEspacos,
    sem_hifen: semHifen,
    somente_digitos: somenteDigitos,
    caracteres_removidos: caracteresRemovidos,
    removeu_somente_formatacao: removeuSomenteFormatacao,
    contem_letras: contemLetras
  };
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

function sugerirBarcodeComDigitoCorreto(codigo) {
  const digits = String(codigo || '').replace(/\D/g, '');
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

function classificarSaneamento(item) {
  const barcodeAtual = String(item?.barcode_atual ?? '');
  const saneamento = sanitizarBarcode(barcodeAtual);
  const barcodeSanitizado = normalizarBarcode(saneamento.somente_digitos);
  const validacaoSanitizada = validarBarcode(barcodeSanitizado);
  const classeErroOrigem = classificarErroOrigem(item?.mensagem_erro);

  let classificacaoSaneamento = 'revisao_manual';
  let motivoClassificacao = 'Necessita revisao manual.';
  let corrigivelAutomaticamente = false;
  let barcodeCorrigido = '';

  if (!saneamento.trimmed || !barcodeSanitizado) {
    classificacaoSaneamento = 'sem_barcode';
    motivoClassificacao = 'Barcode ausente apos trim/saneamento.';
  } else if (validacaoSanitizada.ok) {
    const houveMudanca = barcodeSanitizado !== saneamento.trimmed;

    if (houveMudanca && saneamento.removeu_somente_formatacao && !saneamento.contem_letras) {
      classificacaoSaneamento = 'corrigivel_automaticamente';
      motivoClassificacao = 'Remocao de caracteres de formatacao resultou em GTIN valido.';
      corrigivelAutomaticamente = true;
      barcodeCorrigido = barcodeSanitizado;
    } else if (!houveMudanca) {
      classificacaoSaneamento = 'revisao_manual';
      motivoClassificacao = 'Barcode atual ja e valido apos normalizacao, porem historico registrou erro.';
    } else {
      classificacaoSaneamento = 'revisao_manual';
      motivoClassificacao = 'Mudanca envolveria caracteres alem de formatacao segura.';
    }
  } else {
    const classeValidacao = classificarFalhaValidacao(validacaoSanitizada);

    if (classeValidacao === 'sem_barcode') {
      classificacaoSaneamento = 'sem_barcode';
      motivoClassificacao = 'Sem digits suficientes para validacao.';
    } else if (classeValidacao === 'tamanho_nao_suportado') {
      classificacaoSaneamento = 'invalido_irrecuperavel';
      motivoClassificacao = 'Comprimento fora dos tamanhos GTIN suportados (8, 12, 13, 14).';
    } else if (classeValidacao === 'digito_verificador_inconsistente') {
      classificacaoSaneamento = 'revisao_manual';
      motivoClassificacao = 'Digito verificador inconsistente; nao e seguro corrigir automaticamente.';
    } else {
      classificacaoSaneamento = 'revisao_manual';
      motivoClassificacao = 'Falha de validacao sem criterio de autocorrecao segura.';
    }
  }

  const sugestaoDigito = classificarFalhaValidacao(validacaoSanitizada) === 'digito_verificador_inconsistente'
    ? sugerirBarcodeComDigitoCorreto(barcodeSanitizado)
    : '';

  return {
    ...item,
    classe_erro: classeErroOrigem,
    barcode_sanitizado: barcodeSanitizado,
    validacao_barcode_atual: classificarFalhaValidacao(validacaoSanitizada),
    mensagem_validacao_barcode: String(validacaoSanitizada?.message || ''),
    classificacao_saneamento: classificacaoSaneamento,
    motivo_classificacao: motivoClassificacao,
    corrigivel_automaticamente: corrigivelAutomaticamente,
    barcode_corrigido: barcodeCorrigido,
    sugestao_barcode_digito_correto: sugestaoDigito,
    saneamento_debug: saneamento
  };
}

function countBy(items, selector) {
  const map = {};

  for (const item of items) {
    const key = String(selector(item) || 'nao_informado').trim() || 'nao_informado';
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

function pickExamplesByClass(items, classField, limitPerClass = DEFAULT_EXAMPLES_PER_CLASS) {
  const examples = {};
  const limit = Math.max(1, parsePositiveInt(limitPerClass, DEFAULT_EXAMPLES_PER_CLASS, { min: 1, max: 20 }));

  for (const item of items) {
    const key = String(item?.[classField] || 'nao_informado');
    if (!examples[key]) {
      examples[key] = [];
    }

    if (examples[key].length >= limit) {
      continue;
    }

    examples[key].push({
      id: item.id,
      nome: item.nome,
      barcode_atual: item.barcode_atual,
      barcode_sanitizado: item.barcode_sanitizado,
      barcode_corrigido: item.barcode_corrigido,
      mensagem_erro: item.mensagem_erro,
      classe_erro: item.classe_erro,
      validacao_barcode_atual: item.validacao_barcode_atual,
      classificacao_saneamento: item.classificacao_saneamento,
      motivo_classificacao: item.motivo_classificacao,
      categoria: item.categoria,
      marca: item.marca,
      estoque: item.estoque,
      vendas: item.vendas,
      prioridade: item.prioridade
    });
  }

  return examples;
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

function nullableNumberExpr(columnSet, columnName, alias) {
  const col = String(columnName || '').toLowerCase();
  if (columnSet.has(col)) {
    return `COALESCE(${columnName}, 0) AS ${alias}`;
  }

  return `NULL AS ${alias}`;
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

async function listarProdutosComErroEnrichment(pool, { limit = 0 } = {}) {
  const columnSet = await getExistingProductColumns(pool);

  const vendasColumn = chooseFirstExisting(columnSet, [
    'vendas',
    'total_vendas',
    'qtd_vendas',
    'quantidade_vendida'
  ]);

  const prioridadeColumn = chooseFirstExisting(columnSet, [
    'prioridade',
    'prioridade_enriquecimento',
    'score_prioridade'
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
    vendasColumn ? nullableNumberExpr(columnSet, vendasColumn, 'vendas') : 'NULL AS vendas',
    prioridadeColumn ? nullableNumberExpr(columnSet, prioridadeColumn, 'prioridade') : 'NULL AS prioridade'
  ];

  let sql = `
    SELECT
      ${selectFields.join(',\n      ')}
    FROM produtos
    WHERE ativo = TRUE
      AND COALESCE(enrichment_status, 'pendente') = 'erro'
      AND COALESCE(TRIM(enrichment_last_error), '') <> ''
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
    enrichment_status: toText(row.enrichment_status, 'pendente'),
    mensagem_erro: toText(row.mensagem_erro, ''),
    categoria: toText(row.categoria, ''),
    marca: toText(row.marca, ''),
    estoque: toNumber(row.estoque, 0),
    vendas: row.vendas === null || row.vendas === undefined ? null : toNumber(row.vendas, 0),
    prioridade: row.prioridade === null || row.prioridade === undefined ? null : toNumber(row.prioridade, 0)
  }));
}

function prepararRelatorio(rowsErro, { examplesPerClass = DEFAULT_EXAMPLES_PER_CLASS } = {}) {
  const classificados = rowsErro.map((row) => {
    const classeOrigem = classificarErroOrigem(row.mensagem_erro);
    return {
      ...row,
      classe_erro_origem: classeOrigem
    };
  });

  const origemPorClasse = countBy(classificados, (item) => item.classe_erro_origem);

  const somenteBarcodeInvalido = classificados
    .filter((item) => String(item.classe_erro_origem).startsWith('barcode_invalido'))
    .map((item) => classificarSaneamento(item));

  const saneamentoPorClasse = countBy(somenteBarcodeInvalido, (item) => item.classificacao_saneamento);
  const validacaoAtualPorClasse = countBy(somenteBarcodeInvalido, (item) => item.validacao_barcode_atual);

  const exemplos = pickExamplesByClass(somenteBarcodeInvalido, 'classificacao_saneamento', examplesPerClass);

  const idsCorrigiveis = somenteBarcodeInvalido
    .filter((item) => item.corrigivel_automaticamente && item.barcode_corrigido)
    .map((item) => item.id);

  return {
    rows_erro_total: classificados,
    rows_barcode_invalido: somenteBarcodeInvalido,
    resumo: {
      total_erros_enrichment: classificados.length,
      total_barcode_invalido: somenteBarcodeInvalido.length,
      por_classe_erro_origem: origemPorClasse,
      por_validacao_barcode_atual: validacaoAtualPorClasse,
      por_classificacao_saneamento: saneamentoPorClasse,
      corrigiveis_automaticamente: idsCorrigiveis.length,
      exigem_revisao_manual: somenteBarcodeInvalido.filter((item) => item.classificacao_saneamento === 'revisao_manual').length,
      sem_barcode: somenteBarcodeInvalido.filter((item) => item.classificacao_saneamento === 'sem_barcode').length,
      invalido_irrecuperavel: somenteBarcodeInvalido.filter((item) => item.classificacao_saneamento === 'invalido_irrecuperavel').length
    },
    exemplos_por_classificacao: exemplos,
    ids_corrigiveis: idsCorrigiveis
  };
}

async function aplicarCorrecoesAutomaticas(pool, rowsBarcodeInvalido, { apply = false } = {}) {
  const candidatos = rowsBarcodeInvalido.filter((item) => item.corrigivel_automaticamente && item.barcode_corrigido);

  if (!apply) {
    return {
      apply_realizado: false,
      total_candidatos: candidatos.length,
      total_atualizados: 0,
      ids_atualizados: [],
      ids_nao_atualizados: []
    };
  }

  if (!candidatos.length) {
    return {
      apply_realizado: true,
      total_candidatos: 0,
      total_atualizados: 0,
      ids_atualizados: [],
      ids_nao_atualizados: []
    };
  }

  const connection = await pool.getConnection();
  const idsAtualizados = [];
  const idsNaoAtualizados = [];

  try {
    await connection.beginTransaction();

    for (const item of candidatos) {
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
            AND LOWER(COALESCE(enrichment_last_error, '')) LIKE '%codigo de barras invalido%'`,
        [item.barcode_corrigido, item.id]
      );

      if (toNumber(result?.affectedRows, 0) > 0) {
        idsAtualizados.push(item.id);
      } else {
        idsNaoAtualizados.push(item.id);
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
    total_candidatos: candidatos.length,
    total_atualizados: idsAtualizados.length,
    ids_atualizados: idsAtualizados,
    ids_nao_atualizados: idsNaoAtualizados
  };
}

async function reprocessarIdsCorrigidos(pool, ids = [], { concurrency = 3, force = false } = {}) {
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
      motivo: 'Nenhum ID valido para reprocessar.',
      total_ids: 0,
      resumo: null
    };
  }

  const barcodeLookupService = createDefaultBarcodeLookupService({
    pool,
    logger: console
  });

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

function buildRunId() {
  const stamp = formatDateForId(new Date());
  const suffix = crypto.randomBytes(3).toString('hex');
  return `barcode_saneamento_${stamp}_${suffix}`;
}

function buildOutputPaths(outputDir, runId) {
  const reportJson = path.join(outputDir, `${runId}.report.json`);
  const itensJson = path.join(outputDir, `${runId}.barcode_invalido.json`);
  const itensCsv = path.join(outputDir, `${runId}.barcode_invalido.csv`);
  const corrigiveisIds = path.join(outputDir, `${runId}.corrigiveis.ids.json`);
  const corrigidosAplicadosIds = path.join(outputDir, `${runId}.corrigidos_aplicados.ids.json`);

  return {
    report_json: reportJson,
    itens_json: itensJson,
    itens_csv: itensCsv,
    corrigiveis_ids: corrigiveisIds,
    corrigidos_aplicados_ids: corrigidosAplicadosIds,
    latest_report_json: path.join(outputDir, 'latest.report.json'),
    latest_itens_json: path.join(outputDir, 'latest.barcode_invalido.json'),
    latest_itens_csv: path.join(outputDir, 'latest.barcode_invalido.csv'),
    latest_corrigiveis_ids: path.join(outputDir, 'latest.corrigiveis.ids.json'),
    latest_corrigidos_aplicados_ids: path.join(outputDir, 'latest.corrigidos_aplicados.ids.json')
  };
}

function toCsvRows(rowsBarcodeInvalido) {
  return rowsBarcodeInvalido.map((item) => ({
    id: item.id,
    nome: item.nome,
    barcode_atual: item.barcode_atual,
    barcode_sanitizado: item.barcode_sanitizado,
    enrichment_status: item.enrichment_status,
    classe_erro: item.classe_erro,
    mensagem_erro: item.mensagem_erro,
    categoria: item.categoria,
    marca: item.marca,
    estoque: item.estoque,
    vendas: item.vendas === null ? '' : item.vendas,
    prioridade: item.prioridade === null ? '' : item.prioridade,
    validacao_barcode_atual: item.validacao_barcode_atual,
    classificacao_saneamento: item.classificacao_saneamento,
    corrigivel_automaticamente: item.corrigivel_automaticamente ? 'sim' : 'nao',
    barcode_corrigido: item.barcode_corrigido,
    sugestao_barcode_digito_correto: item.sugestao_barcode_digito_correto,
    motivo_classificacao: item.motivo_classificacao
  }));
}

function printResumoToConsole(payload) {
  const resumo = payload?.resumo || {};
  const porOrigem = Array.isArray(resumo?.por_classe_erro_origem) ? resumo.por_classe_erro_origem : [];
  const porSaneamento = Array.isArray(resumo?.por_classificacao_saneamento) ? resumo.por_classificacao_saneamento : [];

  process.stdout.write('\n=== RESUMO SANEAMENTO BARCODE ===\n');
  process.stdout.write(`Total erros enrichment auditados: ${toNumber(resumo.total_erros_enrichment, 0)}\n`);
  process.stdout.write(`Total barcode_invalido alvo: ${toNumber(resumo.total_barcode_invalido, 0)}\n`);

  const tamanho = porOrigem.find((x) => x.chave === 'barcode_invalido_tamanho')?.total || 0;
  const digito = porOrigem.find((x) => x.chave === 'barcode_invalido_digito')?.total || 0;

  process.stdout.write(`Distincao origem - tamanho: ${tamanho} | digito_verificador: ${digito}\n`);
  process.stdout.write(`Corrigiveis automaticamente: ${toNumber(resumo.corrigiveis_automaticamente, 0)}\n`);
  process.stdout.write(`Exigem revisao manual: ${toNumber(resumo.exigem_revisao_manual, 0)}\n`);
  process.stdout.write(`Sem barcode: ${toNumber(resumo.sem_barcode, 0)}\n`);
  process.stdout.write(`Invalido irrecuperavel: ${toNumber(resumo.invalido_irrecuperavel, 0)}\n`);

  process.stdout.write('\nContagem por classe de erro de origem:\n');
  for (const row of porOrigem) {
    process.stdout.write(`  - ${row.chave}: ${row.total}\n`);
  }

  process.stdout.write('\nContagem por classificacao de saneamento:\n');
  for (const row of porSaneamento) {
    process.stdout.write(`  - ${row.chave}: ${row.total}\n`);
  }

  process.stdout.write('\nExemplos por classificacao:\n');
  const exemplos = payload?.exemplos_por_classificacao || {};
  for (const [classe, lista] of Object.entries(exemplos)) {
    process.stdout.write(`  [${classe}]\n`);
    for (const exemplo of lista) {
      process.stdout.write(`    - id=${exemplo.id} | nome="${exemplo.nome}" | barcode_atual="${exemplo.barcode_atual}" | erro="${exemplo.mensagem_erro}"\n`);
    }
  }

  process.stdout.write('\n');
}

async function runReportOrApply(args) {
  const mode = normalizeMode(args.mode);
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const runId = buildRunId();
  const outputPaths = buildOutputPaths(outputDir, runId);

  const limit = parsePositiveInt(args.limit, 0, { min: 0, max: 500000 });
  const examples = parsePositiveInt(args.examples, DEFAULT_EXAMPLES_PER_CLASS, { min: 1, max: 20 });
  const shouldApply = mode === 'apply' && parseBooleanInput(args.apply, false);
  const shouldReprocess = mode === 'apply' && parseBooleanInput(args.reprocess_corrigidos, false);

  const pool = createMysqlPool();

  try {
    const rowsErro = await listarProdutosComErroEnrichment(pool, { limit });
    const relatorio = prepararRelatorio(rowsErro, { examplesPerClass: examples });

    const csvRows = toCsvRows(relatorio.rows_barcode_invalido);

    const idsCorrigiveisPayload = {
      generated_at: nowIso(),
      mode,
      apply_realizado: false,
      total_ids: relatorio.ids_corrigiveis.length,
      ids: relatorio.ids_corrigiveis
    };

    let applyResult = {
      apply_realizado: false,
      total_candidatos: relatorio.ids_corrigiveis.length,
      total_atualizados: 0,
      ids_atualizados: [],
      ids_nao_atualizados: []
    };

    if (mode === 'apply') {
      applyResult = await aplicarCorrecoesAutomaticas(pool, relatorio.rows_barcode_invalido, {
        apply: shouldApply
      });
    }

    const reprocessResult = {
      executado: false,
      motivo: 'Nao solicitado.',
      total_ids: 0,
      resumo: null
    };

    if (shouldReprocess) {
      const idsParaReprocessar = applyResult.apply_realizado
        ? applyResult.ids_atualizados
        : relatorio.ids_corrigiveis;

      const resultado = await reprocessarIdsCorrigidos(pool, idsParaReprocessar, {
        concurrency: parsePositiveInt(args.concurrency, 3, { min: 1, max: 12 }),
        force: parseBooleanInput(args.force, false)
      });

      Object.assign(reprocessResult, resultado);
    }

    const finalReport = {
      run_id: runId,
      generated_at: nowIso(),
      mode,
      dry_run: mode !== 'apply' || !shouldApply,
      output_dir: outputDir,
      resumo: relatorio.resumo,
      exemplos_por_classificacao: relatorio.exemplos_por_classificacao,
      apply: applyResult,
      reprocessamento: reprocessResult,
      arquivos: outputPaths
    };

    writeJsonFile(outputPaths.report_json, finalReport);
    writeJsonFile(outputPaths.itens_json, relatorio.rows_barcode_invalido);
    writeCsvFile(outputPaths.itens_csv, csvRows);

    writeJsonFile(outputPaths.corrigiveis_ids, idsCorrigiveisPayload);

    const idsAplicadosPayload = {
      generated_at: nowIso(),
      mode,
      apply_realizado: applyResult.apply_realizado,
      total_ids: applyResult.ids_atualizados.length,
      ids: applyResult.ids_atualizados
    };

    writeJsonFile(outputPaths.corrigidos_aplicados_ids, idsAplicadosPayload);

    copyAsLatest(outputPaths.report_json, outputPaths.latest_report_json);
    copyAsLatest(outputPaths.itens_json, outputPaths.latest_itens_json);
    copyAsLatest(outputPaths.itens_csv, outputPaths.latest_itens_csv);
    copyAsLatest(outputPaths.corrigiveis_ids, outputPaths.latest_corrigiveis_ids);
    copyAsLatest(outputPaths.corrigidos_aplicados_ids, outputPaths.latest_corrigidos_aplicados_ids);

    printResumoToConsole(finalReport);

    process.stdout.write('Arquivos gerados:\n');
    process.stdout.write(`- Report JSON: ${outputPaths.report_json}\n`);
    process.stdout.write(`- Itens JSON: ${outputPaths.itens_json}\n`);
    process.stdout.write(`- Itens CSV: ${outputPaths.itens_csv}\n`);
    process.stdout.write(`- IDs corrigiveis: ${outputPaths.corrigiveis_ids}\n`);
    process.stdout.write(`- IDs corrigidos/aplicados: ${outputPaths.corrigidos_aplicados_ids}\n`);

    if (mode === 'apply') {
      process.stdout.write(`\nApply realizado: ${applyResult.apply_realizado ? 'sim' : 'nao'}\n`);
      process.stdout.write(`Total candidatos autocorrecao: ${applyResult.total_candidatos}\n`);
      process.stdout.write(`Total atualizados: ${applyResult.total_atualizados}\n`);
      process.stdout.write(`Total nao atualizados: ${applyResult.ids_nao_atualizados.length}\n`);
    }

    if (reprocessResult.executado) {
      process.stdout.write(`\nReprocessamento executado para ${reprocessResult.total_ids} IDs.\n`);
      process.stdout.write(`Resumo reprocessamento: ${JSON.stringify(reprocessResult.resumo || {}, null, 2)}\n`);
    }
  } finally {
    await pool.end();
  }
}

async function runReprocessOnly(args) {
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const defaultIdsFile = path.join(outputDir, 'latest.corrigidos_aplicados.ids.json');
  const idsFile = path.resolve(String(args.ids_file || defaultIdsFile));

  if (!fs.existsSync(idsFile)) {
    throw new Error(`Arquivo de IDs nao encontrado: ${idsFile}`);
  }

  const raw = fs.readFileSync(idsFile, 'utf8');
  const payload = JSON.parse(raw);
  const ids = Array.isArray(payload?.ids) ? payload.ids : [];

  const pool = createMysqlPool();
  try {
    const resultado = await reprocessarIdsCorrigidos(pool, ids, {
      concurrency: parsePositiveInt(args.concurrency, 3, { min: 1, max: 12 }),
      force: parseBooleanInput(args.force, false)
    });

    process.stdout.write('=== REPROCESSAMENTO SOMENTE CORRIGIDOS ===\n');
    process.stdout.write(`Arquivo IDs: ${idsFile}\n`);
    process.stdout.write(`Total IDs no arquivo: ${ids.length}\n`);
    process.stdout.write(`Executado: ${resultado.executado ? 'sim' : 'nao'}\n`);
    process.stdout.write(`Total IDs reprocessados: ${resultado.total_ids}\n`);
    process.stdout.write(`Resumo: ${JSON.stringify(resultado.resumo || {}, null, 2)}\n`);
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

  await runReportOrApply(args);
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error('[enrichment-barcode-saneamento] falha:', error?.message || error);
    process.exitCode = 1;
  });
