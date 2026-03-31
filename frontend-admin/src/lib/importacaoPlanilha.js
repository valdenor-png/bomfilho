let xlsxModulePromise = null;

async function carregarXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }

  const module = await xlsxModulePromise;
  return module?.default || module;
}

export const EXTENSOES_IMPORTACAO_ACEITAS = Object.freeze(['.xls', '.xlsx', '.csv']);
export const MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO = 'Formato de arquivo não suportado. Envie .xls, .xlsx ou .csv.';

const MIME_IMPORTACAO_ACEITOS = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/excel',
  'application/x-excel',
  'application/x-msexcel',
  'application/xls',
  'application/x-xls',
  'application/vnd.ms-office',
  'application/csv',
  'text/csv',
  'text/plain',
  'application/octet-stream'
]);

const CAMPOS_IMPORTACAO = Object.freeze([
  'codigo_interno',
  'codigo_barras',
  'nome',
  'descricao',
  'imagem',
  'preco',
  'preco_promocional',
  'estoque',
  'unidade',
  'ativo',
  'categoria'
]);

export const CAMPOS_IMPORTACAO_LABEL = Object.freeze({
  codigo_interno: 'Codigo interno',
  codigo_barras: 'Codigo de barras',
  nome: 'Nome do produto',
  descricao: 'Descricao',
  imagem: 'Imagem (URL)',
  preco: 'Preco',
  preco_promocional: 'Preco promocional',
  estoque: 'Estoque',
  unidade: 'Unidade',
  ativo: 'Ativo',
  categoria: 'Categoria'
});

const ALIASES_COLUNA = Object.freeze({
  codigo_interno: ['codigo', 'cod', 'codigo interno', 'id produto', 'sku', 'referencia'],
  codigo_barras: ['codigo de barras', 'codigo barras', 'cod barras', 'barcode', 'ean', 'gtin', 'upc'],
  nome: ['nome', 'nome produto', 'produto', 'item', 'titulo', 'descricao'],
  descricao: ['descricao', 'descricao produto', 'detalhes', 'descricao item'],
  imagem: ['imagem', 'imagem_url', 'image', 'url imagem', 'url foto', 'foto'],
  preco: ['preco', 'venda', 'venda 1', 'venda1', 'preco venda', 'preco venda 1', 'valor venda', 'valor venda 1', 'preco final', 'valor'],
  preco_promocional: ['promocao', 'promocional', 'preco promocional', 'preco oferta'],
  estoque: ['estoque', 'saldo', 'quantidade', 'qtd', 'qtde'],
  unidade: ['unidade', 'unid', 'und', 'un'],
  ativo: ['ativo', 'status', 'situacao', 'inativo'],
  categoria: ['categoria', 'departamento', 'setor', 'secao']
});

function normalizarTexto(valor) {
  return String(valor ?? '').trim();
}

function normalizarCabecalho(valor) {
  return normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function extrairExtensaoArquivo(nomeArquivo) {
  const nome = normalizarTexto(nomeArquivo).toLowerCase();
  const ponto = nome.lastIndexOf('.');
  if (ponto <= 0 || ponto === nome.length - 1) {
    return '';
  }
  return nome.slice(ponto);
}

function temValor(valor) {
  if (valor === null || valor === undefined) {
    return false;
  }

  return normalizarTexto(valor) !== '';
}

function linhaVazia(linha) {
  return !Array.isArray(linha) || linha.every((celula) => !temValor(celula));
}

const PALAVRAS_METADADOS_RELATORIO = /cnpj|pagina|página|grupo|empresa|relatorio|emissao|emitido|filial|telefone|endereco|endereço|total\s+de\s+registros|sistema|data\s+de\s+emissao/i;

const ALIASES_CABECALHO_DETECCAO = Object.freeze({
  identificador: [
    ...ALIASES_COLUNA.codigo_interno,
    ...ALIASES_COLUNA.codigo_barras,
    'codigo',
    'cod',
    'ean',
    'gtin',
    'upc'
  ],
  nome: [
    ...ALIASES_COLUNA.nome,
    ...ALIASES_COLUNA.descricao,
    'descricao'
  ],
  preco: [
    ...ALIASES_COLUNA.preco,
    'venda1',
    'venda2',
    'preco1',
    'preco2',
    'valorvenda1',
    'valorvenda2',
    'custo'
  ],
  complementares: [
    ...ALIASES_COLUNA.preco_promocional,
    ...ALIASES_COLUNA.estoque,
    ...ALIASES_COLUNA.unidade,
    ...ALIASES_COLUNA.categoria,
    ...ALIASES_COLUNA.ativo,
    ...ALIASES_COLUNA.imagem
  ]
});

function pontuarCompatibilidadeCabecalho(celulaNormalizada, aliasNormalizado) {
  if (!celulaNormalizada || !aliasNormalizado) {
    return 0;
  }

  if (celulaNormalizada === aliasNormalizado) {
    return 4;
  }

  if (celulaNormalizada.startsWith(aliasNormalizado) || celulaNormalizada.endsWith(aliasNormalizado)) {
    return 3;
  }

  if (celulaNormalizada.includes(aliasNormalizado) || aliasNormalizado.includes(celulaNormalizada)) {
    return 2;
  }

  const distancia = calcularDistanciaLevenshteinLimitada(celulaNormalizada, aliasNormalizado, 2);
  if (distancia <= 1) {
    return 2;
  }

  if (distancia === 2 && Math.min(celulaNormalizada.length, aliasNormalizado.length) >= 6) {
    return 1;
  }

  return 0;
}

function calcularDistanciaLevenshteinLimitada(origem, destino, limite = 2) {
  const textoOrigem = String(origem || '');
  const textoDestino = String(destino || '');

  if (textoOrigem === textoDestino) {
    return 0;
  }

  const tamanhoOrigem = textoOrigem.length;
  const tamanhoDestino = textoDestino.length;

  if (!tamanhoOrigem || !tamanhoDestino) {
    return Math.max(tamanhoOrigem, tamanhoDestino);
  }

  if (Math.abs(tamanhoOrigem - tamanhoDestino) > limite) {
    return limite + 1;
  }

  let anterior = new Array(tamanhoDestino + 1);
  let atual = new Array(tamanhoDestino + 1);

  for (let j = 0; j <= tamanhoDestino; j += 1) {
    anterior[j] = j;
  }

  for (let i = 1; i <= tamanhoOrigem; i += 1) {
    atual[0] = i;
    let menorNaLinha = atual[0];

    for (let j = 1; j <= tamanhoDestino; j += 1) {
      const custoSubstituicao = textoOrigem[i - 1] === textoDestino[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + custoSubstituicao
      );

      if (atual[j] < menorNaLinha) {
        menorNaLinha = atual[j];
      }
    }

    if (menorNaLinha > limite) {
      return limite + 1;
    }

    const troca = anterior;
    anterior = atual;
    atual = troca;
  }

  return anterior[tamanhoDestino];
}

function possuiValorNumericoIsolado(valor) {
  return /^[-+]?\d+(?:[.,]\d+)?$/.test(normalizarTexto(valor));
}

function pontuarLinhaCabecalho(linha = []) {
  if (!Array.isArray(linha)) {
    return -999;
  }

  const celulasBrutas = linha
    .map((item) => normalizarTexto(item))
    .filter(Boolean);

  if (celulasBrutas.length < 2) {
    return -999;
  }

  const celulasNormalizadas = celulasBrutas
    .map((item) => normalizarCabecalho(item))
    .filter(Boolean);

  if (!celulasNormalizadas.length) {
    return -999;
  }

  let pontuacao = 0;
  const gruposEncontrados = new Set();

  for (const celula of celulasNormalizadas) {
    for (const [grupo, aliases] of Object.entries(ALIASES_CABECALHO_DETECCAO)) {
      for (const alias of aliases) {
        const aliasNormalizado = normalizarCabecalho(alias);
        const score = pontuarCompatibilidadeCabecalho(celula, aliasNormalizado);

        if (score > 0) {
          pontuacao += score;
          gruposEncontrados.add(grupo);
          break;
        }
      }
    }
  }

  if (gruposEncontrados.has('identificador') && gruposEncontrados.has('nome')) {
    pontuacao += 6;
  }

  if (gruposEncontrados.has('preco')) {
    pontuacao += 5;
  }

  if (gruposEncontrados.size >= 3) {
    pontuacao += 4;
  }

  const linhaTexto = celulasBrutas.join(' ');
  if (PALAVRAS_METADADOS_RELATORIO.test(linhaTexto)) {
    pontuacao -= 10;
  }

  const totalNumericas = celulasBrutas.filter((valor) => possuiValorNumericoIsolado(valor)).length;
  if (totalNumericas >= celulasBrutas.length - 1) {
    pontuacao -= 5;
  }

  if (celulasNormalizadas.some((item) => /venda1|valorvenda1|precodevenda1/.test(item))) {
    pontuacao += 5;
  }

  if (
    celulasNormalizadas.some((item) => /custo|precocusto/.test(item))
    && celulasNormalizadas.some((item) => /venda|preco|valor/.test(item))
  ) {
    pontuacao += 2;
  }

  return pontuacao;
}

function linhaContemAliasCabecalho(celulasNormalizadas = [], aliases = []) {
  if (!Array.isArray(celulasNormalizadas) || !Array.isArray(aliases) || !aliases.length) {
    return false;
  }

  for (const celula of celulasNormalizadas) {
    for (const alias of aliases) {
      if (pontuarCompatibilidadeCabecalho(celula, normalizarCabecalho(alias)) > 0) {
        return true;
      }
    }
  }

  return false;
}

function linhaPareceMetadadoRelatorio(celulasBrutas = []) {
  const texto = celulasBrutas.join(' ');
  if (PALAVRAS_METADADOS_RELATORIO.test(texto)) {
    return true;
  }

  const totalNumericas = celulasBrutas.filter((valor) => possuiValorNumericoIsolado(valor)).length;
  return totalNumericas >= celulasBrutas.length - 1;
}

function encontrarLinhaCabecalho(rows) {
  const limite = Math.min(Array.isArray(rows) ? rows.length : 0, 80);

  for (let i = 0; i < limite; i += 1) {
    const linha = Array.isArray(rows[i]) ? rows[i] : [];
    const celulasBrutas = linha
      .map((item) => normalizarTexto(item))
      .filter(Boolean);

    if (celulasBrutas.length < 3 || linhaPareceMetadadoRelatorio(celulasBrutas)) {
      continue;
    }

    const celulasNormalizadas = celulasBrutas
      .map((item) => normalizarCabecalho(item))
      .filter(Boolean);

    const temIdentificador = linhaContemAliasCabecalho(celulasNormalizadas, ALIASES_CABECALHO_DETECCAO.identificador);
    const temNomeDescricao = linhaContemAliasCabecalho(celulasNormalizadas, ALIASES_CABECALHO_DETECCAO.nome);
    const temPreco = linhaContemAliasCabecalho(celulasNormalizadas, ALIASES_CABECALHO_DETECCAO.preco);

    if (temIdentificador && temNomeDescricao && temPreco) {
      return i;
    }
  }

  let melhorIndice = -1;
  let melhorPontuacao = -999;

  for (let i = 0; i < limite; i += 1) {
    const score = pontuarLinhaCabecalho(rows[i]);
    if (score > melhorPontuacao) {
      melhorPontuacao = score;
      melhorIndice = i;
    }
  }

  if (melhorIndice >= 0 && melhorPontuacao >= 8) {
    return melhorIndice;
  }

  for (let i = 0; i < rows.length; i += 1) {
    if (!linhaVazia(rows[i])) {
      return i;
    }
  }

  return -1;
}

function construirCabecalhosUnicos(cabecalhosRaw = []) {
  const usados = new Map();

  return cabecalhosRaw.map((cabecalho, indice) => {
    const valor = normalizarTexto(cabecalho).replace(/^\uFEFF/, '');
    const base = valor || `coluna_${indice + 1}`;
    const chaveBase = normalizarCabecalho(base) || `coluna_${indice + 1}`;
    const repeticoes = usados.get(chaveBase) || 0;
    usados.set(chaveBase, repeticoes + 1);

    if (!repeticoes) {
      return base;
    }

    return `${base}_${repeticoes + 1}`;
  });
}

function bonusCampoPorCabecalho(campo, headerNorm) {
  if (!headerNorm) {
    return 0;
  }

  if (campo === 'preco') {
    if (/venda1|valorvenda1|precovenda1/.test(headerNorm)) {
      return 12;
    }

    if (/venda/.test(headerNorm)) {
      return 8;
    }

    if (/custo|compra|cmv/.test(headerNorm)) {
      return -12;
    }

    if (/promoc|oferta/.test(headerNorm)) {
      return -3;
    }
  }

  if (campo === 'codigo_interno') {
    if (/codigo|cod|sku|referencia/.test(headerNorm) && !/ean|barras|gtin|upc/.test(headerNorm)) {
      return 6;
    }

    if (/ean|barras|gtin|upc/.test(headerNorm)) {
      return -8;
    }
  }

  if (campo === 'codigo_barras') {
    if (/ean|barras|barcode|gtin|upc/.test(headerNorm)) {
      return 8;
    }

    if (/sku|referencia|interno/.test(headerNorm)) {
      return -6;
    }
  }

  if (campo === 'nome' && /descricao/.test(headerNorm)) {
    return 5;
  }

  return 0;
}

function melhorIndicePorAlias(cabecalhos, aliases, campo = '') {
  const cabecalhosNorm = cabecalhos.map((item) => normalizarCabecalho(item));

  let melhorIndice = -1;
  let melhorScore = -Infinity;

  for (let i = 0; i < cabecalhosNorm.length; i += 1) {
    const cabecalhoAtual = cabecalhosNorm[i];
    if (!cabecalhoAtual) {
      continue;
    }

    let scoreCabecalho = bonusCampoPorCabecalho(campo, cabecalhoAtual);

    for (const alias of aliases) {
      const aliasNorm = normalizarCabecalho(alias);
      if (!aliasNorm) {
        continue;
      }

      const score = pontuarCompatibilidadeCabecalho(cabecalhoAtual, aliasNorm);

      if (score > 0) {
        scoreCabecalho += score;
      }
    }

    if (scoreCabecalho > melhorScore) {
      melhorScore = scoreCabecalho;
      melhorIndice = i;
    }
  }

  return melhorScore > 0 ? melhorIndice : -1;
}

function parseDecimal(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }

  let texto = String(valor)
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!texto) {
    return null;
  }

  texto = texto
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!texto) {
    return null;
  }

  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    if (ultimaVirgula > ultimoPonto) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      texto = texto.replace(/,/g, '');
    }
  } else if (ultimaVirgula >= 0) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if ((texto.match(/\./g) || []).length > 1) {
    texto = texto.replace(/\./g, '');
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function truncarTexto(valor, max = 200) {
  const texto = normalizarTexto(valor);
  if (!texto) {
    return '';
  }

  if (texto.length <= max) {
    return texto;
  }

  return `${texto.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function resolverIndiceCabecalho(cabecalhos, valorMapeamento) {
  const valor = normalizarTexto(valorMapeamento);
  if (!valor) {
    return -1;
  }

  const alvo = normalizarCabecalho(valor);
  if (!alvo) {
    return -1;
  }

  for (let i = 0; i < cabecalhos.length; i += 1) {
    if (normalizarCabecalho(cabecalhos[i]) === alvo) {
      return i;
    }
  }

  return -1;
}

function obterValorLinha(linha, indice) {
  if (!Array.isArray(linha)) {
    return '';
  }

  if (!Number.isFinite(indice) || indice < 0 || indice >= linha.length) {
    return '';
  }

  return linha[indice];
}

function serializarCsvCampo(valor, delimitador = ';') {
  const texto = String(valor ?? '');
  const precisaAspas = texto.includes('"') || texto.includes('\n') || texto.includes('\r') || texto.includes(delimitador);

  if (!precisaAspas) {
    return texto;
  }

  return `"${texto.replace(/"/g, '""')}"`;
}

export function formatarTamanhoArquivo(bytes) {
  const valor = Number(bytes || 0);
  if (!Number.isFinite(valor) || valor <= 0) {
    return '0 KB';
  }

  if (valor < 1024) {
    return `${valor} B`;
  }

  if (valor < 1024 * 1024) {
    return `${(valor / 1024).toFixed(1)} KB`;
  }

  return `${(valor / (1024 * 1024)).toFixed(2)} MB`;
}

export function sugerirMapeamentoColunas(cabecalhos = []) {
  const mapeamento = {};

  for (const campo of CAMPOS_IMPORTACAO) {
    const aliases = ALIASES_COLUNA[campo] || [];
    const indice = melhorIndicePorAlias(cabecalhos, aliases, campo);
    if (indice >= 0) {
      mapeamento[campo] = cabecalhos[indice];
    }
  }

  if (!mapeamento.nome && mapeamento.descricao) {
    mapeamento.nome = mapeamento.descricao;
  }

  if (!mapeamento.descricao && mapeamento.nome) {
    mapeamento.descricao = mapeamento.nome;
  }

  if (!mapeamento.codigo_interno) {
    const indiceCodigo = melhorIndicePorAlias(cabecalhos, ['codigo', 'cod', 'sku', 'referencia'], 'codigo_interno');
    if (indiceCodigo >= 0) {
      mapeamento.codigo_interno = cabecalhos[indiceCodigo];
    }
  }

  if (!mapeamento.codigo_barras) {
    const indiceEan = melhorIndicePorAlias(cabecalhos, ['ean', 'codigo barras', 'codigo de barras', 'gtin'], 'codigo_barras');
    if (indiceEan >= 0) {
      mapeamento.codigo_barras = cabecalhos[indiceEan];
    }
  }

  if (!mapeamento.preco) {
    const indiceVenda = melhorIndicePorAlias(cabecalhos, ['venda 1', 'venda1', 'preco venda 1', 'valor venda 1', 'venda'], 'preco');
    if (indiceVenda >= 0) {
      mapeamento.preco = cabecalhos[indiceVenda];
    }
  }

  return mapeamento;
}

export function validarMapeamentoObrigatorio(mapeamento = {}) {
  const temIdentificador = temValor(mapeamento.codigo_interno) || temValor(mapeamento.codigo_barras);
  const temNomeOuDescricao = temValor(mapeamento.nome) || temValor(mapeamento.descricao);
  const temPreco = temValor(mapeamento.preco);

  const pendencias = [];

  if (!temIdentificador) {
    pendencias.push('Selecione ao menos Codigo interno ou Codigo de barras.');
  }

  if (!temNomeOuDescricao) {
    pendencias.push('Selecione Nome do produto ou Descricao.');
  }

  if (!temPreco) {
    pendencias.push('Selecione a coluna de Preco.');
  }

  return {
    ok: pendencias.length === 0,
    pendencias
  };
}

export async function lerEValidarArquivoImportacao(file) {
  const isFile = typeof File !== 'undefined' && file instanceof File;
  const isBlob = typeof Blob !== 'undefined' && file instanceof Blob;
  if (!isFile && !isBlob) {
    throw new Error('Selecione uma planilha para continuar.');
  }

  const nomeArquivo = normalizarTexto(file.name || 'planilha');
  const extensao = extrairExtensaoArquivo(nomeArquivo);
  const mimeType = normalizarTexto(file.type || '').toLowerCase();

  if (!EXTENSOES_IMPORTACAO_ACEITAS.includes(extensao)) {
    throw new Error(MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO);
  }

  if (mimeType && !MIME_IMPORTACAO_ACEITOS.has(mimeType)) {
    const mimeCompativelPlanilha = /(excel|spreadsheet|csv|comma-separated|ms-office|octet-stream|plain)/i.test(mimeType);
    if (!mimeCompativelPlanilha) {
      throw new Error(MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO);
    }
  }

  const tamanho = Number(file.size || 0);
  if (!Number.isFinite(tamanho) || tamanho <= 0) {
    throw new Error('Arquivo vazio. Selecione uma planilha com dados para importar.');
  }

  let workbook;
  let XLSX;
  try {
    XLSX = await carregarXlsx();
    const arrayBuffer = await file.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      raw: false,
      dense: true,
      cellDates: false
    });
  } catch {
    throw new Error('Nao foi possivel ler a planilha. Verifique se o arquivo esta integro e em formato Excel/CSV valido.');
  }

  if (!Array.isArray(workbook?.SheetNames) || workbook.SheetNames.length === 0) {
    throw new Error('Nao foi possivel localizar abas na planilha enviada.');
  }

  const nomeAba = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[nomeAba];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Arquivo vazio. Nao encontramos linhas para importacao.');
  }

  const indiceCabecalho = encontrarLinhaCabecalho(rows);
  if (indiceCabecalho < 0) {
    throw new Error('Nao foi possivel identificar o cabecalho da planilha.');
  }

  const cabecalhos = construirCabecalhosUnicos(rows[indiceCabecalho]);
  const linhasDados = rows.slice(indiceCabecalho + 1).filter((linha) => !linhaVazia(linha));

  if (!cabecalhos.length) {
    throw new Error('Planilha sem colunas reconheciveis no cabecalho.');
  }

  if (!linhasDados.length) {
    throw new Error('Planilha sem linhas de dados para importacao.');
  }

  return {
    nomeArquivo,
    mimeType,
    extensao,
    tamanho,
    tamanhoFormatado: formatarTamanhoArquivo(tamanho),
    nomeAba,
    indiceCabecalho,
    cabecalhos,
    totalLinhas: linhasDados.length,
    linhasDados,
    colunasDetectadas: cabecalhos.length,
    mapeamentoSugerido: sugerirMapeamentoColunas(cabecalhos)
  };
}

export function construirPreviewImportacao({
  cabecalhos = [],
  linhasDados = [],
  mapeamento = {},
  maxLinhas = 20
} = {}) {
  const indices = {};
  CAMPOS_IMPORTACAO.forEach((campo) => {
    indices[campo] = resolverIndiceCabecalho(cabecalhos, mapeamento[campo]);
  });

  const previewRows = [];
  const duplicados = new Set();
  const vistos = new Set();

  const contadores = {
    total_lidas: Number(linhasDados.length || 0),
    validas: 0,
    com_erro: 0,
    duplicadas: 0,
    ignoradas: 0,
    prontas_importar: 0
  };

  for (let i = 0; i < linhasDados.length; i += 1) {
    const linha = linhasDados[i];
    const numeroLinha = i + 1;

    const codigoInterno = truncarTexto(obterValorLinha(linha, indices.codigo_interno), 80);
    let codigoBarras = String(obterValorLinha(linha, indices.codigo_barras) || '').replace(/\D/g, '').slice(0, 32);
    const nome = truncarTexto(obterValorLinha(linha, indices.nome), 200);
    const descricao = truncarTexto(obterValorLinha(linha, indices.descricao), 200);
    const preco = parseDecimal(obterValorLinha(linha, indices.preco));
    const imagem = truncarTexto(obterValorLinha(linha, indices.imagem), 200);

    const motivos = [];
    let status = 'pre_validado';
    let statusLabel = 'Valido na pre-analise local';

    if (!codigoBarras && /^\d{8,}$/.test(codigoInterno)) {
      codigoBarras = String(codigoInterno).replace(/\D/g, '').slice(0, 32);
    }

    const identificador = codigoInterno || codigoBarras;

    if (!identificador) {
      status = 'erro';
      statusLabel = 'Erro de validacao';
      motivos.push('Linha sem identificador (codigo interno ou codigo de barras).');
    }

    if (!nome && !descricao) {
      status = 'erro';
      statusLabel = 'Erro de validacao';
      motivos.push('Linha sem nome/descricao do produto.');
    }

    if (!Number.isFinite(preco) || preco <= 0) {
      status = 'erro';
      statusLabel = 'Erro de validacao';
      motivos.push('Preco invalido ou menor/igual a zero.');
    }

    if (imagem && !/^https?:\/\//i.test(imagem)) {
      motivos.push('Imagem sem URL valida (http/https).');
    }

    const chaveDuplicidade = normalizarCabecalho(`${identificador}|${nome || descricao}`);
    if (identificador && vistos.has(chaveDuplicidade)) {
      status = 'ignorado';
      statusLabel = 'Ignorado (duplicado na planilha)';
      motivos.push('Linha duplicada na propria planilha.');
      duplicados.add(chaveDuplicidade);
    } else if (identificador) {
      vistos.add(chaveDuplicidade);
    }

    if (status === 'erro') {
      contadores.com_erro += 1;
    } else if (status === 'ignorado') {
      contadores.duplicadas += 1;
      contadores.ignoradas += 1;
    } else {
      contadores.validas += 1;
      contadores.prontas_importar += 1;
    }

    if (previewRows.length < maxLinhas) {
      previewRows.push({
        numeroLinha,
        status,
        statusLabel,
        motivos,
        produto: {
          codigo_interno: codigoInterno,
          codigo_barras: codigoBarras,
          nome: nome || descricao || '-',
          preco: Number.isFinite(preco) ? preco : null,
          imagem
        }
      });
    }
  }

  if (duplicados.size > 0) {
    contadores.duplicadas = Math.max(contadores.duplicadas, duplicados.size);
  }

  return {
    rows: previewRows,
    contadores
  };
}

export function extrairMapeamentoNormalizado(mapeamento = {}) {
  const resultado = {};

  Object.entries(mapeamento || {}).forEach(([campo, valor]) => {
    const texto = normalizarTexto(valor);
    if (!texto) {
      return;
    }

    if (CAMPOS_IMPORTACAO.includes(campo)) {
      resultado[campo] = texto;
    }
  });

  return resultado;
}

export function gerarCsvRelatorioImportacao(resultadoImportacao, nomeArquivo = 'relatorio-importacao-erros.csv') {
  const erros = Array.isArray(resultadoImportacao?.logs?.erros) ? resultadoImportacao.logs.erros : [];
  const ignorados = Array.isArray(resultadoImportacao?.logs?.ignorados) ? resultadoImportacao.logs.ignorados : [];
  const avisos = Array.isArray(resultadoImportacao?.logs?.avisos) ? resultadoImportacao.logs.avisos : [];

  const linhas = [['tipo', 'linha', 'identificador', 'campo', 'valor_recebido', 'motivo', 'acao_sugerida']];

  erros.forEach((item) => {
    linhas.push([
      'erro',
      item?.linha || '',
      item?.identificador || '',
      item?.campo || '',
      item?.valor_recebido || '',
      item?.motivo || '',
      item?.acao_sugerida || ''
    ]);
  });

  ignorados.forEach((item) => {
    linhas.push([
      'ignorado',
      item?.linha || '',
      item?.identificador || '',
      item?.campo || '',
      item?.valor_recebido || '',
      item?.motivo || '',
      item?.acao_sugerida || ''
    ]);
  });

  avisos.forEach((item) => {
    linhas.push([
      'aviso',
      item?.linha || '',
      item?.identificador || '',
      item?.campo || '',
      item?.valor_recebido || '',
      item?.motivo || '',
      item?.acao_sugerida || ''
    ]);
  });

  const csv = linhas
    .map((linha) => linha.map((campo) => serializarCsvCampo(campo)).join(';'))
    .join('\n');

  return {
    fileName: normalizarTexto(nomeArquivo) || 'relatorio-importacao-erros.csv',
    blob: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  };
}
