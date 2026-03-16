'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { normalizarBarcode, validarBarcode } = require('../services/barcode/utils/barcodeUtils');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'logs', 'enrichment-barcode-invalid-length');
const DEFAULT_EXAMPLES_PER_GROUP = 12;
const TARGET_ERROR_MESSAGE = 'Codigo de barras invalido. Tamanho nao suportado para EAN/GTIN.';
const VALID_GTIN_LENGTHS = new Set([8, 12, 13, 14]);

const GROUP_DEFINITIONS = {
  sem_digitos_ou_vazio: {
    nome: 'Sem digitos ou vazio',
    criterio: 'Valor bruto vazio ou sem nenhum digito extraivel.',
    causa_provavel: 'Campo barcode vazio, sobrescrito por texto invalido ou valor nulo.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'irrecuperavel'
  },
  notacao_estranha_ou_truncado: {
    nome: 'Notacao estranha ou truncamento',
    criterio: 'Valor com notacao numerica fora do padrao (cientifica/decimal) ou marcador de truncamento.',
    causa_provavel: 'Exportacao de planilha, transformacao indevida de tipo ou corte de campo na integracao.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'manual_obrigatorio'
  },
  contaminacao_texto_no_campo: {
    nome: 'Contaminacao de texto no campo barcode',
    criterio: 'Presenca de letras/palavras no valor de barcode sem formato confiavel de codigo.',
    causa_provavel: 'Campo barcode usado para observacao textual ou concatenado com descricao.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'manual_obrigatorio'
  },
  possivel_codigo_interno_ou_fornecedor: {
    nome: 'Possivel codigo interno ou do fornecedor',
    criterio: 'Valor alfanumerico com cara de codigo interno (prefixo textual + numeros).',
    causa_provavel: 'Cadastro usando SKU interno/fornecedor no lugar de GTIN.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'manual_obrigatorio'
  },
  mascara_ou_separadores: {
    nome: 'Mascara ou separadores',
    criterio: 'Valor com separadores decorativos e comprimento invalido mesmo apos limpeza.',
    causa_provavel: 'Formato de entrada com pontuacao/mascara sem padrao GTIN valido.',
    risco_automacao: 'medio',
    recomendacao_objetiva: 'revisao_assistida'
  },
  menor_que_esperado_ate_6_digitos: {
    nome: 'Menor que o esperado (ate 6 digitos)',
    criterio: 'Quantidade de digitos extraidos entre 1 e 6.',
    causa_provavel: 'Codigo interno curto, referencia parcial ou dado incompleto.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'irrecuperavel'
  },
  menor_que_esperado_7_digitos: {
    nome: 'Menor que o esperado (7 digitos)',
    criterio: 'Quantidade de digitos igual a 7.',
    causa_provavel: 'Possivel perda de zero a esquerda para padrao EAN-8.',
    risco_automacao: 'medio',
    recomendacao_objetiva: 'revisao_assistida'
  },
  menor_que_esperado_9_10_digitos: {
    nome: 'Menor que o esperado (9 ou 10 digitos)',
    criterio: 'Quantidade de digitos entre 9 e 10.',
    causa_provavel: 'Truncamento parcial ou codigo intermediario nao GTIN.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'manual_obrigatorio'
  },
  menor_que_esperado_11_digitos: {
    nome: 'Menor que o esperado (11 digitos)',
    criterio: 'Quantidade de digitos igual a 11.',
    causa_provavel: 'Possivel perda de zero a esquerda para padrao UPC-A/EAN-12.',
    risco_automacao: 'medio',
    recomendacao_objetiva: 'revisao_assistida'
  },
  maior_que_esperado_15_19_digitos: {
    nome: 'Maior que o esperado (15 a 19 digitos)',
    criterio: 'Quantidade de digitos acima do padrao GTIN, entre 15 e 19.',
    causa_provavel: 'Concatenacao de codigos, sufixos extras ou campo incorreto no cadastro.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'manual_obrigatorio'
  },
  maior_que_esperado_20_ou_mais_digitos: {
    nome: 'Maior que o esperado (20+ digitos)',
    criterio: 'Quantidade de digitos muito acima de GTIN.',
    causa_provavel: 'Concatenacao massiva, contaminacao por outro identificador ou erro de importacao.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'irrecuperavel'
  },
  outros_padroes_relevantes: {
    nome: 'Outros padroes relevantes',
    criterio: 'Casos que nao encaixam nos grupos principais com regra segura.',
    causa_provavel: 'Origem heterogenea do erro em bases antigas ou integrações diversas.',
    risco_automacao: 'alto',
    recomendacao_objetiva: 'manual_obrigatorio'
  }
};

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

function buildRunId() {
  const stamp = formatDateForId(new Date());
  const suffix = crypto.randomBytes(3).toString('hex');
  return `invalid_length_report_${stamp}_${suffix}`;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeTextFile(filePath, content) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, String(content || ''), 'utf8');
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

function stripDecorativeChars(value) {
  return String(value || '').replace(/[\s\-._/\\|()\[\]{}]+/g, '');
}

function extractDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function countBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    map.set(key, toNumber(map.get(key), 0) + 1);
  }

  return map;
}

function mapToSortedArray(map, total = 0, { numericKey = false } = {}) {
  const rows = Array.from(map.entries()).map(([chave, quantidade]) => {
    const percentual = total > 0 ? Number(((quantidade / total) * 100).toFixed(2)) : 0;
    return { chave, quantidade, percentual };
  });

  rows.sort((a, b) => {
    if (b.quantidade !== a.quantidade) {
      return b.quantidade - a.quantidade;
    }

    if (numericKey) {
      return Number(a.chave) - Number(b.chave);
    }

    return String(a.chave).localeCompare(String(b.chave));
  });

  return rows;
}

function formatPercentual(count, total) {
  if (!total) {
    return 0;
  }

  return Number(((count / total) * 100).toFixed(2));
}

function isScientificNotation(value) {
  return /^[+-]?\d+(?:[.,]\d+)?[eE][+-]?\d+$/.test(String(value || '').trim());
}

function isDecimalNotation(value) {
  return /^[+-]?\d+[.,]\d+$/.test(String(value || '').trim());
}

function hasTruncationMarker(value) {
  return /\.\.\.|…|\*+|#+|\btrunc\b/i.test(String(value || '').trim());
}

function isPossibleSupplierCode(value) {
  return /^[A-Za-z]{1,6}[-_\s]?\d{3,}$/.test(String(value || '').trim());
}

function zeroLeftCandidate(digits) {
  const size = String(digits || '').length;
  if (size === 7 || size === 11) {
    return `0${digits}`;
  }

  return '';
}

function escolherGrupo(analysis) {
  if (analysis.comprimento_digitos === 0) {
    return {
      key: 'sem_digitos_ou_vazio',
      motivo: 'Nao foi possivel extrair digitos do valor bruto.'
    };
  }

  if (analysis.sinal_notacao_estranha || analysis.sinal_truncamento_marcador) {
    return {
      key: 'notacao_estranha_ou_truncado',
      motivo: 'Valor apresenta notacao estranha ou marcador de truncamento.'
    };
  }

  if (analysis.sinal_contem_texto) {
    if (analysis.sinal_possivel_codigo_fornecedor) {
      return {
        key: 'possivel_codigo_interno_ou_fornecedor',
        motivo: 'Valor alfanumerico no formato de possivel codigo interno/fornecedor.'
      };
    }

    return {
      key: 'contaminacao_texto_no_campo',
      motivo: 'Valor contem texto contaminando o campo de barcode.'
    };
  }

  if (analysis.sinal_mascara_ou_separadores) {
    return {
      key: 'mascara_ou_separadores',
      motivo: 'Valor contem mascara/separadores e segue com tamanho invalido apos limpeza.'
    };
  }

  if (analysis.comprimento_digitos <= 6) {
    return {
      key: 'menor_que_esperado_ate_6_digitos',
      motivo: 'Quantidade de digitos muito abaixo do minimo GTIN.'
    };
  }

  if (analysis.comprimento_digitos === 7) {
    return {
      key: 'menor_que_esperado_7_digitos',
      motivo: 'Quantidade de digitos indica possivel perda de zero a esquerda para EAN-8.'
    };
  }

  if (analysis.comprimento_digitos === 9 || analysis.comprimento_digitos === 10) {
    return {
      key: 'menor_que_esperado_9_10_digitos',
      motivo: 'Quantidade de digitos intermediaria sem correspondencia direta a GTIN valido.'
    };
  }

  if (analysis.comprimento_digitos === 11) {
    return {
      key: 'menor_que_esperado_11_digitos',
      motivo: 'Quantidade de digitos indica possivel perda de zero a esquerda para UPC-A/EAN-12.'
    };
  }

  if (analysis.comprimento_digitos >= 20) {
    return {
      key: 'maior_que_esperado_20_ou_mais_digitos',
      motivo: 'Quantidade de digitos muito acima do padrao GTIN.'
    };
  }

  if (analysis.comprimento_digitos >= 15) {
    return {
      key: 'maior_que_esperado_15_19_digitos',
      motivo: 'Quantidade de digitos acima do padrao GTIN (15 a 19).'
    };
  }

  return {
    key: 'outros_padroes_relevantes',
    motivo: 'Padrao nao coberto pelas regras principais.'
  };
}

function escolherEstrategia(analysis) {
  if (analysis.grupo_key === 'menor_que_esperado_7_digitos' || analysis.grupo_key === 'menor_que_esperado_11_digitos') {
    if (analysis.candidato_zero_esquerda && analysis.candidato_zero_esquerda_valido && !analysis.candidato_zero_esquerda_colide) {
      return 'potencialmente_automatizavel_com_seguranca';
    }
    return 'revisao_assistida';
  }

  if (analysis.grupo_key === 'menor_que_esperado_ate_6_digitos' || analysis.grupo_key === 'sem_digitos_ou_vazio' || analysis.grupo_key === 'maior_que_esperado_20_ou_mais_digitos') {
    return 'irrecuperavel';
  }

  if (analysis.grupo_key === 'mascara_ou_separadores') {
    return 'revisao_assistida';
  }

  return 'manual_obrigatorio';
}

function montarAnaliseRegistro(row, existingBarcodeCountMap) {
  const barcodeBruto = toText(row.barcode_bruto, '');
  const barcodeTrim = String(barcodeBruto || '').trim();
  const barcodeSemDecorativos = stripDecorativeChars(barcodeTrim);
  const barcodeDigitos = extractDigits(barcodeTrim);
  const barcodeNormalizadoLegado = normalizarBarcode(barcodeTrim);

  const comprimentoBruto = barcodeTrim.length;
  const comprimentoSemDecorativos = barcodeSemDecorativos.length;
  const comprimentoDigitos = barcodeDigitos.length;
  const comprimentoNormalizadoLegado = barcodeNormalizadoLegado.length;

  const sinalContemCaracteresNaoNumericos = /[^0-9]/.test(barcodeTrim);
  const sinalMascaraOuSeparadores = /[\s\-._/\\|()\[\]{}]/.test(barcodeTrim);
  const sinalContemTexto = /[A-Za-z]/.test(barcodeTrim);
  const sinalNotacaoEstranha = isScientificNotation(barcodeTrim) || isDecimalNotation(barcodeTrim);
  const sinalTruncamentoMarcador = hasTruncationMarker(barcodeTrim);
  const sinalPossivelCodigoFornecedor = isPossibleSupplierCode(barcodeTrim);

  const candidatoZeroEsquerda = zeroLeftCandidate(barcodeDigitos);
  const candidatoZeroEsquerdaValido = Boolean(candidatoZeroEsquerda && validarBarcode(candidatoZeroEsquerda).ok);
  const candidatoZeroEsquerdaColide = Boolean(candidatoZeroEsquerda && toNumber(existingBarcodeCountMap.get(candidatoZeroEsquerda), 0) > 0);

  const grupoInfo = escolherGrupo({
    comprimento_digitos: comprimentoDigitos,
    sinal_notacao_estranha: sinalNotacaoEstranha,
    sinal_truncamento_marcador: sinalTruncamentoMarcador,
    sinal_contem_texto: sinalContemTexto,
    sinal_mascara_ou_separadores: sinalMascaraOuSeparadores,
    sinal_possivel_codigo_fornecedor: sinalPossivelCodigoFornecedor
  });

  const analise = {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    marca: row.marca,
    estoque: row.estoque,
    vendas: row.vendas,
    enrichment_last_error: row.enrichment_last_error,
    barcode_bruto: barcodeBruto,
    barcode_trim: barcodeTrim,
    barcode_sem_decorativos: barcodeSemDecorativos,
    barcode_digitos: barcodeDigitos,
    barcode_normalizado_legado: barcodeNormalizadoLegado,
    comprimento_bruto: comprimentoBruto,
    comprimento_sem_decorativos: comprimentoSemDecorativos,
    comprimento_digitos: comprimentoDigitos,
    comprimento_normalizado_legado: comprimentoNormalizadoLegado,
    sinal_contem_caracteres_nao_numericos: sinalContemCaracteresNaoNumericos,
    sinal_mascara_ou_separadores: sinalMascaraOuSeparadores,
    sinal_contem_texto: sinalContemTexto,
    sinal_notacao_estranha: sinalNotacaoEstranha,
    sinal_truncamento_marcador: sinalTruncamentoMarcador,
    sinal_possivel_codigo_fornecedor: sinalPossivelCodigoFornecedor,
    candidato_zero_esquerda: candidatoZeroEsquerda,
    candidato_zero_esquerda_valido: candidatoZeroEsquerdaValido,
    candidato_zero_esquerda_colide: candidatoZeroEsquerdaColide,
    grupo_key: grupoInfo.key,
    grupo_motivo: grupoInfo.motivo,
    tipo_gtin_esperado_se_valido: VALID_GTIN_LENGTHS.has(comprimentoDigitos) ? comprimentoDigitos : null
  };

  analise.estrategia_sugerida = escolherEstrategia(analise);

  return analise;
}

function criarDistribuicaoComprimento(items, selector) {
  const map = countBy(items, (item) => selector(item));
  return mapToSortedArray(map, items.length, { numericKey: true }).map((row) => ({
    comprimento: Number(row.chave),
    total: row.quantidade,
    percentual: row.percentual
  }));
}

function criarResumoPorGrupo(items, examplesPerGroup) {
  const map = new Map();

  for (const item of items) {
    const key = item.grupo_key;
    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(item);
  }

  const groups = [];
  const safeExamples = parsePositiveInt(examplesPerGroup, DEFAULT_EXAMPLES_PER_GROUP, { min: 1, max: 30 });

  for (const [groupKey, groupItems] of map.entries()) {
    const meta = GROUP_DEFINITIONS[groupKey] || GROUP_DEFINITIONS.outros_padroes_relevantes;
    const total = groupItems.length;
    const percentual = formatPercentual(total, items.length);

    const estrategiaCount = mapToSortedArray(
      countBy(groupItems, (item) => item.estrategia_sugerida),
      total,
      { numericKey: false }
    ).map((row) => ({
      estrategia: row.chave,
      total: row.quantidade,
      percentual: row.percentual
    }));

    const examples = groupItems.slice(0, safeExamples).map((item) => ({
      id: item.id,
      barcode_bruto: item.barcode_bruto,
      barcode_normalizado_para_analise: item.barcode_digitos,
      classificacao_atribuida: item.grupo_key,
      motivo_classificacao: item.grupo_motivo,
      estrategia_sugerida: item.estrategia_sugerida
    }));

    groups.push({
      grupo_key: groupKey,
      nome_grupo: meta.nome,
      contagem_total: total,
      percentual_sobre_total: percentual,
      criterio_classificacao: meta.criterio,
      causa_provavel: meta.causa_provavel,
      risco_automacao: meta.risco_automacao,
      recomendacao_objetiva: meta.recomendacao_objetiva,
      distribuicao_estrategia: estrategiaCount,
      exemplos_reais: examples
    });
  }

  groups.sort((a, b) => {
    if (b.contagem_total !== a.contagem_total) {
      return b.contagem_total - a.contagem_total;
    }

    return String(a.grupo_key).localeCompare(String(b.grupo_key));
  });

  return groups;
}

function criarSecaoCausaRaiz(groups, totalAnalisado) {
  const groupsByKey = new Map(groups.map((group) => [group.grupo_key, group.contagem_total]));

  const hipoteses = [
    {
      chave: 'perda_zero_esquerda_origem',
      descricao: 'Perda de zero a esquerda na origem (importacao/cadastro) para comprimentos 7 e 11.',
      grupos_relacionados: ['menor_que_esperado_7_digitos', 'menor_que_esperado_11_digitos']
    },
    {
      chave: 'uso_codigo_interno_no_barcode',
      descricao: 'Uso de codigo interno/SKU/codigo de fornecedor no campo de barcode.',
      grupos_relacionados: ['menor_que_esperado_ate_6_digitos', 'possivel_codigo_interno_ou_fornecedor']
    },
    {
      chave: 'truncamento_ou_concatenacao_integracao',
      descricao: 'Truncamento/corte de campo ou concatenacao indevida em integracao externa.',
      grupos_relacionados: ['menor_que_esperado_9_10_digitos', 'maior_que_esperado_15_19_digitos', 'maior_que_esperado_20_ou_mais_digitos', 'notacao_estranha_ou_truncado']
    },
    {
      chave: 'contaminacao_textual_e_formato',
      descricao: 'Contaminacao do campo com texto, mascara ou notacao nao numerica.',
      grupos_relacionados: ['contaminacao_texto_no_campo', 'mascara_ou_separadores', 'notacao_estranha_ou_truncado', 'sem_digitos_ou_vazio']
    }
  ];

  return hipoteses.map((hipotese) => {
    const totalImpactado = hipotese.grupos_relacionados
      .map((groupKey) => toNumber(groupsByKey.get(groupKey), 0))
      .reduce((sum, value) => sum + value, 0);

    return {
      ...hipotese,
      total_impactado: totalImpactado,
      percentual_sobre_total: formatPercentual(totalImpactado, totalAnalisado)
    };
  }).sort((a, b) => b.total_impactado - a.total_impactado);
}

function criarSecaoProximosPassos() {
  return [
    {
      prioridade: 1,
      acao: 'Atacar origem dos dados para grupos de maior volume antes de qualquer automacao.',
      detalhe: 'Bloquear importacao/cadastro de barcode com tamanho fora de 8/12/13/14 no ponto de entrada.'
    },
    {
      prioridade: 2,
      acao: 'Avaliar piloto controlado para casos 7/11 com candidato zero-a-esquerda valido e sem colisao.',
      detalhe: 'Executar somente com amostra pequena, dupla validacao e trilha de auditoria antes de escalar.'
    },
    {
      prioridade: 3,
      acao: 'Manter fluxo manual assistido para grupos ambiguos.',
      detalhe: 'Aplicar fila priorizada para casos com risco medio/alto e sem heuristica deterministica segura.'
    },
    {
      prioridade: 4,
      acao: 'Classificar irrecuperaveis para saneamento na origem cadastral.',
      detalhe: 'Casos sem digitos, codigos muito curtos e valores altamente contaminados devem ser corrigidos no cadastro fonte.'
    }
  ];
}

function gerarMarkdownReport({ summary, groups, rootCause, nextSteps }) {
  const lines = [];

  lines.push('# Relatorio de Analise - Barcode Invalido por Tamanho');
  lines.push('');
  lines.push(`Gerado em: ${summary.gerado_em}`);
  lines.push(`Mensagem alvo: ${summary.filtro_mensagem_alvo}`);
  lines.push(`Total analisado: ${summary.total_analisado}`);
  lines.push('');

  lines.push('## SECAO A - RESUMO EXECUTIVO');
  lines.push(`- Total analisado: ${summary.total_analisado}`);
  lines.push(`- Total de grupos encontrados: ${summary.total_grupos_encontrados}`);
  lines.push('- Top grupos por volume:');
  for (const group of summary.top_grupos_por_volume) {
    lines.push(`  - ${group.nome_grupo}: ${group.contagem_total} (${group.percentual_sobre_total}%)`);
  }
  lines.push('- Estimativa por estrategia:');
  for (const item of summary.estimativa_estrategia) {
    lines.push(`  - ${item.estrategia}: ${item.total} (${item.percentual}%)`);
  }
  lines.push('');

  lines.push('## SECAO B - DISTRIBUICAO POR TAMANHO');
  lines.push('- Comprimento bruto:');
  for (const row of summary.distribuicao_tamanho_bruto) {
    lines.push(`  - len=${row.comprimento}: ${row.total} (${row.percentual}%)`);
  }
  lines.push('- Comprimento apos remover caracteres decorativos:');
  for (const row of summary.distribuicao_tamanho_sem_decorativos) {
    lines.push(`  - len=${row.comprimento}: ${row.total} (${row.percentual}%)`);
  }
  lines.push('- Comprimento somente digitos:');
  for (const row of summary.distribuicao_tamanho_digitos) {
    lines.push(`  - len=${row.comprimento}: ${row.total} (${row.percentual}%)`);
  }
  lines.push('');

  lines.push('## SECAO C - GRUPOS DE ERRO');
  for (const group of groups) {
    lines.push(`### ${group.nome_grupo}`);
    lines.push(`- Grupo key: ${group.grupo_key}`);
    lines.push(`- Contagem: ${group.contagem_total} (${group.percentual_sobre_total}%)`);
    lines.push(`- Criterio: ${group.criterio_classificacao}`);
    lines.push(`- Causa provavel: ${group.causa_provavel}`);
    lines.push(`- Risco de automacao: ${group.risco_automacao}`);
    lines.push(`- Recomendacao objetiva: ${group.recomendacao_objetiva}`);
    lines.push('- Distribuicao de estrategia:');
    for (const estrategia of group.distribuicao_estrategia) {
      lines.push(`  - ${estrategia.estrategia}: ${estrategia.total} (${estrategia.percentual}%)`);
    }
    lines.push('- Exemplos reais:');
    for (const example of group.exemplos_reais) {
      lines.push(`  - id=${example.id} | bruto="${example.barcode_bruto}" | normalizado="${example.barcode_normalizado_para_analise}" | classificacao=${example.classificacao_atribuida} | motivo=${example.motivo_classificacao}`);
    }
    lines.push('');
  }

  lines.push('## SECAO D - CAUSA RAIZ PROVAVEL');
  for (const causa of rootCause) {
    lines.push(`- ${causa.descricao} => ${causa.total_impactado} (${causa.percentual_sobre_total}%)`);
  }
  lines.push('');

  lines.push('## SECAO E - PROXIMOS PASSOS');
  for (const step of nextSteps) {
    lines.push(`- [P${step.prioridade}] ${step.acao}`);
    lines.push(`  - ${step.detalhe}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function printUsage() {
  const lines = [
    'Uso: node scripts/enrichment-barcode-invalid-length-report.js [opcoes]',
    '',
    'Modos:',
    '  --mode report      Executa analise e gera relatorios (padrao).',
    '',
    'Opcoes:',
    '  --output-dir <pasta>       Pasta de saida dos artefatos.',
    '  --limit <n>                Limite de linhas para analise (padrao: sem limite).',
    '  --examples <n>             Exemplos por grupo no relatorio (padrao: 12).',
    '',
    'Observacao: este script e somente leitura (nao altera dados, nao reprocessa).'
  ];

  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
}

async function listarCasosErroTamanho(pool, { limit = 0 } = {}) {
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
    textColumnExpr(columnSet, 'codigo_barras', 'barcode_bruto'),
    textColumnExpr(columnSet, 'enrichment_last_error', 'enrichment_last_error'),
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
      AND LOWER(COALESCE(enrichment_last_error, '')) LIKE '%tamanho nao suportado para ean/gtin%'
    ORDER BY id ASC
  `;

  const params = [];
  const safeLimit = parsePositiveInt(limit, 0, { min: 0, max: 500000 });
  if (safeLimit > 0) {
    sql += '\nLIMIT ?';
    params.push(safeLimit);
  }

  const [rows] = await pool.query(sql, params);

  const targetNormalized = normalizeMessage(TARGET_ERROR_MESSAGE);

  return rows.filter((row) => normalizeMessage(row.enrichment_last_error) === targetNormalized).map((row) => ({
    id: toNumber(row.id, 0),
    nome: toText(row.nome, ''),
    barcode_bruto: toText(row.barcode_bruto, ''),
    enrichment_last_error: toText(row.enrichment_last_error, ''),
    categoria: toText(row.categoria, ''),
    marca: toText(row.marca, ''),
    estoque: toNumber(row.estoque, 0),
    vendas: toNumber(row.vendas, 0)
  }));
}

async function carregarContagemBarcodesAtivos(pool) {
  const [rows] = await pool.query(
    `SELECT COALESCE(codigo_barras, '') AS codigo_barras
       FROM produtos
      WHERE ativo = TRUE
        AND COALESCE(TRIM(codigo_barras), '') <> ''`
  );

  const map = new Map();
  for (const row of rows) {
    const normalized = normalizarBarcode(row.codigo_barras);
    if (!normalized) {
      continue;
    }
    map.set(normalized, toNumber(map.get(normalized), 0) + 1);
  }

  return map;
}

function construirArtefatosPaths(outputDir, runId, groupKeys = []) {
  const baseName = runId.replace(/_[0-9a-f]{6}$/i, '');
  const summaryFile = path.join(outputDir, `${baseName}.summary.json`);
  const detailsFile = path.join(outputDir, `${baseName}.details.json`);
  const markdownFile = path.join(outputDir, `${baseName}.md`);

  const groupFiles = {};
  for (const groupKey of groupKeys) {
    groupFiles[groupKey] = path.join(outputDir, `${baseName}.group.${groupKey}.json`);
  }

  return {
    summary_file: summaryFile,
    details_file: detailsFile,
    markdown_file: markdownFile,
    group_files: groupFiles,
    latest_summary_file: path.join(outputDir, 'latest.summary.json'),
    latest_details_file: path.join(outputDir, 'latest.details.json'),
    latest_markdown_file: path.join(outputDir, 'latest.md')
  };
}

async function runReport(args) {
  const outputDir = path.resolve(String(args.output_dir || DEFAULT_OUTPUT_DIR));
  const limit = parsePositiveInt(args.limit, 0, { min: 0, max: 500000 });
  const examplesPerGroup = parsePositiveInt(args.examples, DEFAULT_EXAMPLES_PER_GROUP, { min: 1, max: 30 });

  const runId = buildRunId();
  const pool = createMysqlPool();

  try {
    const targetRows = await listarCasosErroTamanho(pool, { limit });
    const barcodeCountMap = await carregarContagemBarcodesAtivos(pool);

    const analyzed = targetRows.map((row) => montarAnaliseRegistro(row, barcodeCountMap));
    const groupSummary = criarResumoPorGrupo(analyzed, examplesPerGroup);

    const groupKeys = groupSummary.map((group) => group.grupo_key);
    const artifacts = construirArtefatosPaths(outputDir, runId, groupKeys);

    const strategySummary = mapToSortedArray(countBy(analyzed, (item) => item.estrategia_sugerida), analyzed.length, { numericKey: false }).map((row) => ({
      estrategia: row.chave,
      total: row.quantidade,
      percentual: row.percentual
    }));

    const secaoBBruto = criarDistribuicaoComprimento(analyzed, (item) => item.comprimento_bruto);
    const secaoBSemDecorativos = criarDistribuicaoComprimento(analyzed, (item) => item.comprimento_sem_decorativos);
    const secaoBDigitos = criarDistribuicaoComprimento(analyzed, (item) => item.comprimento_digitos);

    const topGroups = groupSummary.slice(0, 5).map((group) => ({
      grupo_key: group.grupo_key,
      nome_grupo: group.nome_grupo,
      contagem_total: group.contagem_total,
      percentual_sobre_total: group.percentual_sobre_total
    }));

    const rootCause = criarSecaoCausaRaiz(groupSummary, analyzed.length);
    const nextSteps = criarSecaoProximosPassos();

    const summary = {
      gerado_em: nowIso(),
      modo: 'report',
      sem_mutacao_de_dados: true,
      sem_autoaprovacao: true,
      sem_reprocessamento: true,
      filtro_status: 'erro',
      filtro_mensagem_alvo: TARGET_ERROR_MESSAGE,
      total_analisado: analyzed.length,
      total_grupos_encontrados: groupSummary.length,
      top_grupos_por_volume: topGroups,
      estimativa_estrategia: strategySummary,
      distribuicao_tamanho_bruto: secaoBBruto,
      distribuicao_tamanho_sem_decorativos: secaoBSemDecorativos,
      distribuicao_tamanho_digitos: secaoBDigitos,
      grupos: groupSummary,
      causa_raiz_provavel: rootCause,
      proximos_passos: nextSteps,
      artefatos: artifacts
    };

    const details = {
      gerado_em: nowIso(),
      mensagem_alvo: TARGET_ERROR_MESSAGE,
      total_analisado: analyzed.length,
      itens: analyzed
    };

    writeJsonFile(artifacts.summary_file, summary);
    writeJsonFile(artifacts.details_file, details);

    for (const group of groupSummary) {
      const groupItems = analyzed.filter((item) => item.grupo_key === group.grupo_key);
      writeJsonFile(artifacts.group_files[group.grupo_key], {
        grupo: group,
        total_itens: groupItems.length,
        itens: groupItems
      });
    }

    const markdown = gerarMarkdownReport({
      summary,
      groups: groupSummary,
      rootCause,
      nextSteps
    });
    writeTextFile(artifacts.markdown_file, markdown);

    copyAsLatest(artifacts.summary_file, artifacts.latest_summary_file);
    copyAsLatest(artifacts.details_file, artifacts.latest_details_file);
    copyAsLatest(artifacts.markdown_file, artifacts.latest_markdown_file);

    process.stdout.write('\n=== ANALISE BARCODE INVALIDO POR TAMANHO ===\n');
    process.stdout.write(`Mensagem alvo: ${TARGET_ERROR_MESSAGE}\n`);
    process.stdout.write(`Total analisado: ${analyzed.length}\n`);
    process.stdout.write(`Total grupos: ${groupSummary.length}\n`);
    process.stdout.write(`Summary: ${artifacts.summary_file}\n`);
    process.stdout.write(`Details: ${artifacts.details_file}\n`);
    process.stdout.write(`Markdown: ${artifacts.markdown_file}\n`);

    return { summary, details, artifacts };
  } finally {
    await pool.end();
  }
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
    console.error('[enrichment-barcode-invalid-length-report] falha:', error?.message || error);
    process.exitCode = 1;
  });
