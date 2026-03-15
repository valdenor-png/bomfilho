'use strict';

const path = require('path');
const XLSX = require('xlsx');
const fetch = global.fetch || require('node-fetch');

const EXTENSOES_IMPORTACAO_ACEITAS = Object.freeze(['.csv', '.xls', '.xlsx']);
const MIME_IMPORTACAO_ACEITOS = Object.freeze(new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
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
]));
const MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO = 'Formato de arquivo não suportado. Envie .xls, .xlsx ou .csv.';
const LIMITE_PREVIEW_LOGS = 120;
const LIMITE_PREVIEW_LINHAS_AMOSTRA = 200;
const LIMITE_LINHAS_IMPORTACAO = 50000;
const INTERVALO_CEDER_EVENT_LOOP = 600;

const TAMANHO_LOTE_INSERCAO = (() => {
  const valor = Number.parseInt(process.env.IMPORTACAO_TAMANHO_LOTE_INSERCAO || '300', 10);
  return Number.isFinite(valor) ? Math.max(100, Math.min(valor, 1200)) : 300;
})();

const TAMANHO_LOTE_ATUALIZACAO = (() => {
  const valor = Number.parseInt(process.env.IMPORTACAO_TAMANHO_LOTE_ATUALIZACAO || '250', 10);
  return Number.isFinite(valor) ? Math.max(100, Math.min(valor, 1000)) : 250;
})();

const TAMANHO_LOTE_PRE_CARGA_CHAVES = (() => {
  const valor = Number.parseInt(process.env.IMPORTACAO_TAMANHO_LOTE_PRE_CARGA_CHAVES || '1000', 10);
  return Number.isFinite(valor) ? Math.max(200, Math.min(valor, 2000)) : 1000;
})();

const COLUNAS_ALIAS = {
  codigo_interno: [
    'codigo',
    'cod',
    'codigointerno',
    'codigointernoproduto',
    'codinterno',
    'codproduto',
    'idproduto',
    'sku',
    'referencia'
  ],
  codigo_barras: [
    'codigodebarras',
    'codigobarras',
    'codbarras',
    'barras',
    'barcode',
    'ean',
    'ean13',
    'gtin',
    'upc'
  ],
  nome: [
    'nome',
    'nomeproduto',
    'produto',
    'item',
    'titulo'
  ],
  descricao: [
    'descricao',
    'descricaoproduto',
    'detalhes',
    'descricaoitem',
    'descricaoerp',
    'informacoes'
  ],
  imagem: [
    'imagem',
    'foto',
    'imagemurl',
    'imagem_url',
    'urlimagem',
    'urlfoto',
    'image',
    'imageurl',
    'picture'
  ],
  preco: [
    'venda',
    'preco',
    'precovenda',
    'valordevenda',
    'valorvenda',
    'precofinal',
    'valor'
  ],
  preco_promocional: [
    'promocao',
    'promocional',
    'precopromocional',
    'precodepromocao',
    'valorpromocional',
    'precooferta',
    'oferta'
  ],
  estoque: [
    'estoque',
    'saldo',
    'qtd',
    'qtde',
    'quantidade',
    'quantidadeestoque'
  ],
  unidade: [
    'unidade',
    'unid',
    'und',
    'un'
  ],
  ativo: [
    'ativo',
    'situacao',
    'status',
    'statusativo',
    'inativo'
  ],
  categoria: [
    'categoria',
    'departamento',
    'setor',
    'secao'
  ]
};

let estruturaImportacaoGarantida = false;

function criarErroImportacao(status, mensagem, extra) {
  const erro = new Error(String(mensagem || 'Erro na importacao.'));
  erro.httpStatus = Number.isFinite(Number(status)) ? Number(status) : 500;
  if (extra && typeof extra === 'object') {
    erro.extra = extra;
  }
  return erro;
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function normalizarCabecalho(valor) {
  const texto = normalizarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return texto.replace(/[^a-z0-9]+/g, '');
}

function serializarCsvCampo(valor, delimitador = ';') {
  const texto = String(valor ?? '');
  const precisaAspas = texto.includes('"') || texto.includes('\n') || texto.includes('\r') || texto.includes(delimitador);
  if (!precisaAspas) {
    return texto;
  }
  return `"${texto.replace(/"/g, '""')}"`;
}

function construirModeloImportacaoProdutosCsv() {
  const linhas = [
    ['codigo', 'codigo de barras', 'nome', 'descricao', 'imagem', 'venda', 'promocao'],
    ['10001', '7894900011517', 'Arroz tipo 1 5kg', 'Pacote 5kg', '', '34,90', '29,90'],
    ['10002', '7891910000197', 'Leite integral 1L', '', '', '6,95', ''],
    ['10003', '7891025301514', 'Feijao carioca 1kg', '', '', '9,90', '0']
  ];

  return linhas
    .map((linha) => linha.map((campo) => serializarCsvCampo(campo, ';')).join(';'))
    .join('\n');
}

function detectarExtensaoArquivo(nomeArquivo) {
  return path.extname(String(nomeArquivo || '')).toLowerCase();
}

function validarArquivoImportacao({ nomeArquivo, mimeType } = {}) {
  const extensao = detectarExtensaoArquivo(nomeArquivo);
  if (!EXTENSOES_IMPORTACAO_ACEITAS.includes(extensao)) {
    throw criarErroImportacao(400, MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO);
  }

  const mimeNormalizado = normalizarTexto(mimeType).toLowerCase();
  if (!mimeNormalizado) {
    return {
      extensao,
      mimeType: ''
    };
  }

  if (MIME_IMPORTACAO_ACEITOS.has(mimeNormalizado)) {
    return {
      extensao,
      mimeType: mimeNormalizado
    };
  }

  // Alguns navegadores/ERPs enviam MIME não padronizado para planilhas; aceita variantes que indiquem Excel/CSV.
  const mimeCompativelPlanilha = /(excel|spreadsheet|csv|comma-separated|ms-office|octet-stream|plain)/i.test(mimeNormalizado);
  if (!mimeCompativelPlanilha) {
    throw criarErroImportacao(400, MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO);
  }

  return {
    extensao,
    mimeType: mimeNormalizado
  };
}

function temValorPreenchido(valor) {
  if (valor === null || valor === undefined) {
    return false;
  }

  return normalizarTexto(valor) !== '';
}

function linhaVazia(linha) {
  return !Array.isArray(linha) || linha.every((celula) => !temValorPreenchido(celula));
}

function decodificarCsvBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    return '';
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3).toString('utf8');
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.slice(2).toString('utf16le');
  }

  const utf8 = buffer.toString('utf8');
  const sinaisMojibake = (utf8.match(/Ã.|Â./g) || []).length;
  if (utf8.includes('�') || sinaisMojibake > 2) {
    return buffer.toString('latin1');
  }

  return utf8;
}

function contarDelimitadorForaAspas(linha, delimitador) {
  let inQuotes = false;
  let total = 0;

  for (let i = 0; i < linha.length; i += 1) {
    const char = linha[i];

    if (char === '"') {
      const proximo = linha[i + 1];
      if (inQuotes && proximo === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimitador) {
      total += 1;
    }
  }

  return total;
}

function detectarDelimitadorCsv(texto) {
  const linhasAmostra = String(texto || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (!linhasAmostra.length) {
    return ';';
  }

  const scorePontoVirgula = linhasAmostra.reduce((acc, linha) => acc + contarDelimitadorForaAspas(linha, ';'), 0);
  const scoreVirgula = linhasAmostra.reduce((acc, linha) => acc + contarDelimitadorForaAspas(linha, ','), 0);

  return scoreVirgula > scorePontoVirgula ? ',' : ';';
}

function parseCsv(texto, delimitador) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < texto.length; i += 1) {
    const char = texto[i];

    if (char === '"') {
      const proximo = texto[i + 1];
      if (inQuotes && proximo === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimitador) {
      row.push(value);
      value = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && texto[i + 1] === '\n') {
        i += 1;
      }

      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function lerArquivoTabular({ buffer, nomeArquivo }) {
  const { extensao } = validarArquivoImportacao({ nomeArquivo });

  if (extensao === '.xlsx' || extensao === '.xls') {
    try {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false,
        raw: false,
        dense: true
      });

      if (!Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
        throw criarErroImportacao(400, 'Nao foi possivel localizar abas na planilha enviada.');
      }

      const primeiraAba = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeiraAba];
      const linhas = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false
      });

      return {
        extensao,
        delimitador: null,
        linhas
      };
    } catch (erroLeitura) {
      if (erroLeitura?.httpStatus) {
        throw erroLeitura;
      }

      throw criarErroImportacao(400, 'Nao foi possivel ler a planilha. Verifique se o arquivo esta integro e em formato Excel/CSV valido.');
    }
  }

  try {
    const conteudo = decodificarCsvBuffer(buffer);
    const delimitador = detectarDelimitadorCsv(conteudo);
    const linhas = parseCsv(conteudo, delimitador);

    return {
      extensao,
      delimitador,
      linhas
    };
  } catch {
    throw criarErroImportacao(400, 'Nao foi possivel ler a planilha. Verifique se o arquivo esta integro e em formato Excel/CSV valido.');
  }
}

const PALAVRAS_METADADOS_RELATORIO = /cnpj|pagina|página|grupo|empresa|relatorio|emissao|emitido|filial|telefone|endereco|endereço|total\s+de\s+registros|sistema|data\s+de\s+emissao/i;

const ALIASES_CABECALHO_DETECCAO = Object.freeze({
  identificador: [
    ...COLUNAS_ALIAS.codigo_interno,
    ...COLUNAS_ALIAS.codigo_barras,
    'codigo',
    'cod',
    'ean',
    'gtin',
    'upc'
  ],
  nome: [
    ...COLUNAS_ALIAS.nome,
    ...COLUNAS_ALIAS.descricao,
    'descricao'
  ],
  preco: [
    ...COLUNAS_ALIAS.preco,
    'venda1',
    'venda2',
    'preco1',
    'preco2',
    'valorvenda1',
    'valorvenda2',
    'custo'
  ],
  complementares: [
    ...COLUNAS_ALIAS.preco_promocional,
    ...COLUNAS_ALIAS.estoque,
    ...COLUNAS_ALIAS.unidade,
    ...COLUNAS_ALIAS.categoria,
    ...COLUNAS_ALIAS.ativo,
    ...COLUNAS_ALIAS.imagem
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

function encontrarLinhaCabecalho(linhas) {
  const limite = Math.min(Array.isArray(linhas) ? linhas.length : 0, 80);

  for (let i = 0; i < limite; i += 1) {
    const linha = Array.isArray(linhas[i]) ? linhas[i] : [];
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
    const score = pontuarLinhaCabecalho(linhas[i]);
    if (score > melhorPontuacao) {
      melhorPontuacao = score;
      melhorIndice = i;
    }
  }

  if (melhorIndice >= 0 && melhorPontuacao >= 8) {
    return melhorIndice;
  }

  for (let i = 0; i < linhas.length; i += 1) {
    if (!linhaVazia(linhas[i])) {
      return i;
    }
  }

  return -1;
}

function construirCabecalhosUnicos(cabecalhosRaw) {
  const usados = new Map();

  return cabecalhosRaw.map((cabecalho, indice) => {
    const valor = normalizarTexto(cabecalho).replace(/^\uFEFF/, '');
    const base = valor || `coluna_${indice + 1}`;
    const chave = normalizarCabecalho(base) || `coluna_${indice + 1}`;
    const repeticoes = usados.get(chave) || 0;
    usados.set(chave, repeticoes + 1);

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
    if (/venda1|valorvenda1|precovenda1|precodevenda1/.test(headerNorm)) {
      return 12;
    }

    if (/venda|precovenda|valorvenda/.test(headerNorm)) {
      return 8;
    }

    if (/custo|compra|cmv|precocusto/.test(headerNorm)) {
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

function mapearColunas(cabecalhos) {
  const cabecalhosNorm = cabecalhos.map((cabecalho) => normalizarCabecalho(cabecalho));
  const usados = new Set();

  function localizarIndice(campo, aliases, permitirReuso = false) {
    let melhorIndice = -1;
    let melhorScore = -Infinity;

    for (let i = 0; i < cabecalhosNorm.length; i += 1) {
      if (!permitirReuso && usados.has(i)) {
        continue;
      }

      const header = cabecalhosNorm[i];
      if (!header) {
        continue;
      }

      let scoreCabecalho = bonusCampoPorCabecalho(campo, header);

      for (const alias of aliases) {
        const aliasNorm = normalizarCabecalho(alias);
        if (!aliasNorm) {
          continue;
        }

        const score = pontuarCompatibilidadeCabecalho(header, aliasNorm);

        if (score > 0) {
          scoreCabecalho += score;
        }
      }

      if (scoreCabecalho > melhorScore) {
        melhorScore = scoreCabecalho;
        melhorIndice = i;
      }
    }

    if (melhorIndice >= 0 && melhorScore > 0 && !permitirReuso) {
      usados.add(melhorIndice);
    }

    return melhorScore > 0 ? melhorIndice : -1;
  }

  const indices = {
    codigo_interno: localizarIndice('codigo_interno', COLUNAS_ALIAS.codigo_interno),
    codigo_barras: localizarIndice('codigo_barras', COLUNAS_ALIAS.codigo_barras),
    nome: localizarIndice('nome', COLUNAS_ALIAS.nome),
    descricao: localizarIndice('descricao', COLUNAS_ALIAS.descricao),
    imagem: localizarIndice('imagem', COLUNAS_ALIAS.imagem),
    preco: localizarIndice('preco', COLUNAS_ALIAS.preco),
    preco_promocional: localizarIndice('preco_promocional', COLUNAS_ALIAS.preco_promocional),
    estoque: localizarIndice('estoque', COLUNAS_ALIAS.estoque),
    unidade: localizarIndice('unidade', COLUNAS_ALIAS.unidade),
    ativo: localizarIndice('ativo', COLUNAS_ALIAS.ativo),
    categoria: localizarIndice('categoria', COLUNAS_ALIAS.categoria)
  };

  const colunasMapeadas = {};
  Object.entries(indices).forEach(([chave, indice]) => {
    if (indice >= 0) {
      colunasMapeadas[chave] = cabecalhos[indice];
    }
  });

  return {
    indices,
    colunasMapeadas
  };
}

function validarIndicesObrigatorios(indices) {
  const faltantes = [];
  if (indices.codigo_interno < 0 && indices.codigo_barras < 0) {
    faltantes.push('identificador (codigo ou codigo de barras)');
  }
  if (indices.nome < 0 && indices.descricao < 0) {
    faltantes.push('descricao/nome');
  }
  if (indices.preco < 0) {
    faltantes.push('preco de venda');
  }

  if (faltantes.length) {
    throw criarErroImportacao(
      400,
      `Nao encontramos colunas obrigatorias na planilha: ${faltantes.join(', ')}.`
    );
  }
}

function resolverIndiceColunaManual(cabecalhos, valorMapeamento) {
  if (typeof valorMapeamento === 'number' && Number.isFinite(valorMapeamento)) {
    const indice = Math.trunc(valorMapeamento) - 1;
    if (indice >= 0 && indice < cabecalhos.length) {
      return indice;
    }
    return -1;
  }

  const texto = normalizarTexto(valorMapeamento);
  if (!texto) {
    return -1;
  }

  const alvo = normalizarCabecalho(texto);
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

function aplicarMapeamentoColunasManual({ indices, colunasMapeadas, cabecalhos, mapeamento }) {
  if (!mapeamento || typeof mapeamento !== 'object') {
    return {
      indices,
      colunasMapeadas,
      avisos: []
    };
  }

  const indicesAtualizados = { ...indices };
  const colunasMapeadasAtualizadas = { ...colunasMapeadas };
  const avisos = [];

  for (const [campo, valorMapeamento] of Object.entries(mapeamento)) {
    if (!Object.prototype.hasOwnProperty.call(indicesAtualizados, campo)) {
      continue;
    }

    const indiceManual = resolverIndiceColunaManual(cabecalhos, valorMapeamento);
    if (indiceManual < 0) {
      avisos.push(`Mapeamento manual ignorado para ${campo}: coluna ${valorMapeamento} nao encontrada.`);
      continue;
    }

    indicesAtualizados[campo] = indiceManual;
    colunasMapeadasAtualizadas[campo] = cabecalhos[indiceManual];
  }

  return {
    indices: indicesAtualizados,
    colunasMapeadas: colunasMapeadasAtualizadas,
    avisos
  };
}

function parseDecimalBrasileiro(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? Number(valor) : null;
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
  } else {
    const pontos = (texto.match(/\./g) || []).length;
    if (pontos > 1) {
      texto = texto.replace(/\./g, '');
    }
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function parseBooleanoPlanilha(valor) {
  const texto = normalizarCabecalho(valor);
  if (!texto) {
    return null;
  }

  if (['1', 'true', 'sim', 's', 'ativo', 'ativado', 'yes'].includes(texto)) {
    return true;
  }

  if (['0', 'false', 'nao', 'n', 'inativo', 'desativado', 'no'].includes(texto)) {
    return false;
  }

  return null;
}

function normalizarCodigoInterno(valor) {
  const codigo = normalizarTexto(valor);
  if (!codigo) {
    return '';
  }

  return codigo.slice(0, 64);
}

function normalizarCodigoBarras(valor) {
  const digits = String(valor || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  return digits.slice(0, 32);
}

function isHttpUrlValida(url) {
  const valor = normalizarTexto(url);
  if (!valor) {
    return false;
  }

  return /^https?:\/\//i.test(valor);
}

function truncarTexto(valor, max = 1200) {
  const texto = normalizarTexto(valor);
  if (!texto) {
    return '';
  }

  if (texto.length <= max) {
    return texto;
  }

  return `${texto.slice(0, Math.max(0, max - 1)).trim()}…`;
}

async function fetchComTimeout(url, { timeoutMs = 4500, ...options } = {}) {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizarPayloadBarcode(dados) {
  const nome = truncarTexto(dados?.nome || '', 255);
  const descricao = truncarTexto(dados?.descricao || '', 1200);
  const imagem = isHttpUrlValida(dados?.imagem) ? normalizarTexto(dados.imagem) : '';

  return {
    nome,
    descricao,
    imagem
  };
}

async function buscarDadosOpenFoodFacts(codigoBarras) {
  try {
    const response = await fetchComTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${codigoBarras}.json`,
      {
        headers: {
          'User-Agent': 'BomFilhoImportador/1.0'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const dados = await response.json().catch(() => null);
    const produto = dados?.product;

    if (!produto || dados?.status !== 1) {
      return null;
    }

    return normalizarPayloadBarcode({
      nome: produto.product_name_pt || produto.product_name || produto.generic_name,
      descricao: produto.ingredients_text_pt || produto.ingredients_text || produto.quantity,
      imagem: produto.image_front_url || produto.image_url
    });
  } catch {
    return null;
  }
}

async function buscarDadosUpcItemDb(codigoBarras) {
  try {
    const response = await fetchComTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigoBarras}`);
    if (!response.ok) {
      return null;
    }

    const dados = await response.json().catch(() => null);
    const item = Array.isArray(dados?.items) ? dados.items[0] : null;
    if (!item) {
      return null;
    }

    return normalizarPayloadBarcode({
      nome: item.title || item.description,
      descricao: item.description,
      imagem: Array.isArray(item.images) ? item.images[0] : ''
    });
  } catch {
    return null;
  }
}

async function buscarDadosProdutoPorCodigoBarras(codigoBarras, cacheBarcode = new Map(), barcodeLookupService = null) {
  const codigo = normalizarCodigoBarras(codigoBarras);
  if (!codigo) {
    return null;
  }

  if (cacheBarcode.has(codigo)) {
    return cacheBarcode.get(codigo);
  }

  if (barcodeLookupService && typeof barcodeLookupService.lookup === 'function') {
    try {
      const lookup = await barcodeLookupService.lookup(codigo);
      const dadosLookup = lookup?.status === 'found' && lookup?.product
        ? normalizarPayloadBarcode(lookup.product)
        : null;

      cacheBarcode.set(codigo, dadosLookup);
      return dadosLookup;
    } catch {
      // fallback para estrategia legada desta rotina
    }
  }

  const dadosOpenFoodFacts = await buscarDadosOpenFoodFacts(codigo);
  if (dadosOpenFoodFacts && (dadosOpenFoodFacts.nome || dadosOpenFoodFacts.descricao || dadosOpenFoodFacts.imagem)) {
    cacheBarcode.set(codigo, dadosOpenFoodFacts);
    return dadosOpenFoodFacts;
  }

  const dadosUpcItemDb = await buscarDadosUpcItemDb(codigo);
  const resultado = dadosUpcItemDb && (dadosUpcItemDb.nome || dadosUpcItemDb.descricao || dadosUpcItemDb.imagem)
    ? dadosUpcItemDb
    : null;
  cacheBarcode.set(codigo, resultado);
  return resultado;
}

function inferirCategoria(nomeProduto) {
  const valor = normalizarCabecalho(nomeProduto);

  if (/agua|suco|refrigerante|cerveja|bebida|cafe|cha|leite/.test(valor)) return 'bebidas';
  if (/alface|tomate|banana|maca|batata|fruta|verdura|legume|hortifruti/.test(valor)) return 'hortifruti';
  if (/sabao|detergente|desinfetante|limpeza|amaciante|alvejante/.test(valor)) return 'limpeza';
  return 'mercearia';
}

function registrarPreview(lista, item) {
  if (!Array.isArray(lista)) {
    return;
  }

  if (lista.length < LIMITE_PREVIEW_LOGS) {
    lista.push(item);
  }
}

function registrarLinhaAmostraPreview(resumo, item) {
  if (!Array.isArray(resumo?.preview_linhas)) {
    return;
  }

  if (resumo.preview_linhas.length >= LIMITE_PREVIEW_LINHAS_AMOSTRA) {
    return;
  }

  resumo.preview_linhas.push(item);
}

function construirLinhaAmostraBase({
  numeroLinha,
  identificador,
  nome,
  preco,
  motivo = '',
  campo = '',
  valorRecebido = '',
  acaoSugerida = ''
}) {
  return {
    linha: numeroLinha,
    identificador: identificador || '',
    nome: nome || '',
    preco: Number.isFinite(Number(preco)) ? Number(preco) : null,
    motivo,
    campo,
    valor_recebido: valorRecebido,
    acao_sugerida: acaoSugerida
  };
}

async function cederEventLoop() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function colunaExiste(pool, tabela, coluna) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [tabela, coluna]
  );

  return Number(rows?.[0]?.total || 0) > 0;
}

async function indiceExiste(pool, tabela, indice) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?`,
    [tabela, indice]
  );

  return Number(rows?.[0]?.total || 0) > 0;
}

async function garantirEstruturaImportacaoProdutos(pool, { force = false } = {}) {
  if (estruturaImportacaoGarantida && !force) {
    return;
  }

  const alteracoes = [
    {
      coluna: 'descricao',
      sql: 'ALTER TABLE produtos ADD COLUMN descricao TEXT NULL'
    },
    {
      coluna: 'imagem_url',
      sql: 'ALTER TABLE produtos ADD COLUMN imagem_url TEXT NULL'
    },
    {
      coluna: 'codigo_interno',
      sql: 'ALTER TABLE produtos ADD COLUMN codigo_interno VARCHAR(64) NULL'
    },
    {
      coluna: 'preco_promocional',
      sql: 'ALTER TABLE produtos ADD COLUMN preco_promocional DECIMAL(10,2) NULL'
    },
    {
      coluna: 'ultima_importacao_em',
      sql: 'ALTER TABLE produtos ADD COLUMN ultima_importacao_em DATETIME NULL'
    },
    {
      coluna: 'ultima_atualizacao_preco_em',
      sql: 'ALTER TABLE produtos ADD COLUMN ultima_atualizacao_preco_em DATETIME NULL'
    }
  ];

  for (const alteracao of alteracoes) {
    const existe = await colunaExiste(pool, 'produtos', alteracao.coluna);
    if (!existe) {
      await pool.query(alteracao.sql);
    }
  }

  if (!(await indiceExiste(pool, 'produtos', 'idx_produtos_codigo_interno'))) {
    await pool.query('CREATE INDEX idx_produtos_codigo_interno ON produtos(codigo_interno)');
  }

  if (!(await indiceExiste(pool, 'produtos', 'idx_produtos_ultima_importacao'))) {
    await pool.query('CREATE INDEX idx_produtos_ultima_importacao ON produtos(ultima_importacao_em)');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS importacoes_produtos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_arquivo VARCHAR(255) NOT NULL,
      total_linhas INT NOT NULL DEFAULT 0,
      total_atualizados INT NOT NULL DEFAULT 0,
      total_criados INT NOT NULL DEFAULT 0,
      total_ignorados INT NOT NULL DEFAULT 0,
      total_erros INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'concluido',
      resumo_json LONGTEXT NULL,
      usuario_id INT NULL,
      usuario_nome VARCHAR(120) NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_importacoes_produtos_criado_em (criado_em),
      INDEX idx_importacoes_produtos_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  estruturaImportacaoGarantida = true;
}

async function registrarHistoricoImportacao(pool, payload) {
  const resumoString = JSON.stringify(payload.resumo || {});

  await pool.query(
    `INSERT INTO importacoes_produtos (
      nome_arquivo,
      total_linhas,
      total_atualizados,
      total_criados,
      total_ignorados,
      total_erros,
      status,
      resumo_json,
      usuario_id,
      usuario_nome
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.nomeArquivo,
      Number(payload.totalLinhas || 0),
      Number(payload.totalAtualizados || 0),
      Number(payload.totalCriados || 0),
      Number(payload.totalIgnorados || 0),
      Number(payload.totalErros || 0),
      String(payload.status || 'concluido'),
      resumoString,
      payload.usuarioId ?? null,
      payload.usuarioNome || null
    ]
  );
}

async function listarImportacoesProdutos({ pool, page = 1, limit = 20 }) {
  await garantirEstruturaImportacaoProdutos(pool);

  const pagina = Math.max(1, Number.parseInt(page, 10) || 1);
  const limite = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const offset = (pagina - 1) * limite;

  const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM importacoes_produtos');
  const total = Number(countRow?.total || 0);
  const totalPaginas = total > 0 ? Math.ceil(total / limite) : 1;

  const [rows] = await pool.query(
    `SELECT
      id,
      nome_arquivo,
      total_linhas,
      total_atualizados,
      total_criados,
      total_ignorados,
      total_erros,
      status,
      resumo_json,
      usuario_id,
      usuario_nome,
      criado_em
    FROM importacoes_produtos
    ORDER BY id DESC
    LIMIT ? OFFSET ?`,
    [limite, offset]
  );

  const importacoes = rows.map((row) => {
    let resumo = null;
    try {
      resumo = row?.resumo_json ? JSON.parse(row.resumo_json) : null;
    } catch {
      resumo = null;
    }

    return {
      id: row.id,
      nome_arquivo: row.nome_arquivo,
      total_linhas: Number(row.total_linhas || 0),
      total_atualizados: Number(row.total_atualizados || 0),
      total_criados: Number(row.total_criados || 0),
      total_ignorados: Number(row.total_ignorados || 0),
      total_erros: Number(row.total_erros || 0),
      status: row.status,
      usuario_id: row.usuario_id,
      usuario_nome: row.usuario_nome,
      criado_em: row.criado_em,
      resumo
    };
  });

  return {
    importacoes,
    paginacao: {
      pagina,
      limite,
      total,
      total_paginas: totalPaginas,
      tem_mais: pagina < totalPaginas
    }
  };
}

async function buscarProdutoPorCampo(connection, cache, campo, valor, options = {}) {
  if (!valor) {
    return null;
  }

  const chave = String(valor);
  if (cache.has(chave)) {
    return cache.get(chave);
  }

  if (options?.usarApenasCache) {
    cache.set(chave, null);
    return null;
  }

  const [rows] = await connection.query(
    `SELECT id, nome, unidade FROM produtos WHERE ${campo} = ? ORDER BY id ASC LIMIT 1`,
    [valor]
  );

  const produto = rows[0] || null;
  cache.set(chave, produto);
  return produto;
}

async function buscarProdutoPorNome(connection, cache, nome, options = {}) {
  const nomeNormalizado = normalizarCabecalho(nome);
  if (!nomeNormalizado) {
    return null;
  }

  if (cache.has(nomeNormalizado)) {
    return cache.get(nomeNormalizado);
  }

  if (options?.usarApenasCache) {
    cache.set(nomeNormalizado, null);
    return null;
  }

  const [rows] = await connection.query(
    `SELECT id, nome, unidade
       FROM produtos
      WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?))
      ORDER BY id ASC
      LIMIT 1`,
    [nome]
  );

  const produto = rows[0] || null;
  cache.set(nomeNormalizado, produto);
  return produto;
}

function quebrarEmLotes(lista = [], tamanhoLote = 1000) {
  const resultado = [];
  const tamanho = Math.max(1, Number(tamanhoLote) || 1);

  for (let i = 0; i < lista.length; i += tamanho) {
    resultado.push(lista.slice(i, i + tamanho));
  }

  return resultado;
}

function coletarChavesBuscaPlanilha({ linhasDados = [], indices = {} } = {}) {
  const codigosInternos = new Set();
  const codigosBarras = new Set();
  const nomesNormalizados = new Set();

  for (const linha of linhasDados) {
    if (linhaVazia(linha)) {
      continue;
    }

    const codigoInterno = normalizarCodigoInterno(obterValorLinha(linha, indices.codigo_interno));
    let codigoBarras = normalizarCodigoBarras(obterValorLinha(linha, indices.codigo_barras));

    if (!codigoBarras && /^\d{8,}$/.test(codigoInterno)) {
      codigoBarras = normalizarCodigoBarras(codigoInterno);
    }

    if (codigoInterno) {
      codigosInternos.add(codigoInterno);
    }

    if (codigoBarras) {
      codigosBarras.add(codigoBarras);
    }

    const nomeOuDescricao = normalizarTexto(
      obterValorLinha(linha, indices.nome) || obterValorLinha(linha, indices.descricao)
    );
    if (nomeOuDescricao) {
      nomesNormalizados.add(nomeOuDescricao.toLowerCase());
    }
  }

  return {
    codigosInternos: Array.from(codigosInternos),
    codigosBarras: Array.from(codigosBarras),
    nomesNormalizados: Array.from(nomesNormalizados)
  };
}

async function preCarregarCacheProdutosExistentesPorChaves({
  connection,
  colunasProdutos,
  cacheCodigoInterno,
  cacheCodigoBarras,
  cacheNome,
  chavesBusca
}) {
  const codigosInternos = Array.isArray(chavesBusca?.codigosInternos) ? chavesBusca.codigosInternos : [];
  const codigosBarras = Array.isArray(chavesBusca?.codigosBarras) ? chavesBusca.codigosBarras : [];
  const nomesNormalizados = Array.isArray(chavesBusca?.nomesNormalizados) ? chavesBusca.nomesNormalizados : [];

  if (colunasProdutos.has('codigo_interno') && codigosInternos.length) {
    const lotes = quebrarEmLotes(codigosInternos, TAMANHO_LOTE_PRE_CARGA_CHAVES);

    for (const lote of lotes) {
      const placeholders = lote.map(() => '?').join(', ');
      const [rows] = await connection.query(
        `SELECT id, nome, unidade, codigo_interno
           FROM produtos
          WHERE codigo_interno IN (${placeholders})`,
        lote
      );

      for (const row of rows) {
        const codigoInterno = normalizarCodigoInterno(row.codigo_interno);
        if (!codigoInterno) {
          continue;
        }

        cacheCodigoInterno.set(codigoInterno, {
          id: row.id,
          nome: row.nome || '',
          unidade: row.unidade || 'un'
        });
      }
    }
  }

  if (colunasProdutos.has('codigo_barras') && codigosBarras.length) {
    const lotes = quebrarEmLotes(codigosBarras, TAMANHO_LOTE_PRE_CARGA_CHAVES);

    for (const lote of lotes) {
      const placeholders = lote.map(() => '?').join(', ');
      const [rows] = await connection.query(
        `SELECT id, nome, unidade, codigo_barras
           FROM produtos
          WHERE codigo_barras IN (${placeholders})`,
        lote
      );

      for (const row of rows) {
        const codigoBarras = normalizarCodigoBarras(row.codigo_barras);
        if (!codigoBarras) {
          continue;
        }

        cacheCodigoBarras.set(codigoBarras, {
          id: row.id,
          nome: row.nome || '',
          unidade: row.unidade || 'un'
        });
      }
    }
  }

  if (nomesNormalizados.length) {
    const lotes = quebrarEmLotes(nomesNormalizados, TAMANHO_LOTE_PRE_CARGA_CHAVES);

    for (const lote of lotes) {
      const placeholders = lote.map(() => '?').join(', ');
      const [rows] = await connection.query(
        `SELECT id, nome, unidade
           FROM produtos
          WHERE LOWER(TRIM(nome)) IN (${placeholders})`,
        lote
      );

      for (const row of rows) {
        const nomeNormalizado = normalizarCabecalho(row.nome);
        if (!nomeNormalizado) {
          continue;
        }

        cacheNome.set(nomeNormalizado, {
          id: row.id,
          nome: row.nome || '',
          unidade: row.unidade || 'un'
        });
      }
    }
  }
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

async function importarProdutosPlanilha({
  pool,
  fileBuffer,
  originalName,
  createMissing = false,
  updateStock = false,
  simulate = false,
  columnMapping = null,
  barcodeLookupService = null,
  adminUser = 'admin',
  adminUserId = null
}) {
  const inicioTotalMs = Date.now();
  const inicioLeituraMs = Date.now();
  let etapaAtual = 'validacao_arquivo';
  let duracaoLeituraMs = 0;
  let duracaoPreCargaMs = 0;
  let duracaoProcessamentoMs = 0;
  let duracaoPersistenciaInsercaoMs = 0;
  let duracaoPersistenciaAtualizacaoMs = 0;
  let lotesInsercaoProcessados = 0;
  let lotesAtualizacaoProcessados = 0;
  let rollbackAplicado = false;

  if (!pool || typeof pool.getConnection !== 'function') {
    throw criarErroImportacao(500, 'Conexao com banco indisponivel para importacao.');
  }

  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) {
    throw criarErroImportacao(400, 'Arquivo vazio. Selecione uma planilha valida para importar.');
  }

  const nomeArquivo = normalizarTexto(originalName) || `importacao_${Date.now()}.csv`;

  await garantirEstruturaImportacaoProdutos(pool);

  etapaAtual = 'leitura_arquivo';
  const arquivo = lerArquivoTabular({
    buffer: fileBuffer,
    nomeArquivo
  });

  if (!Array.isArray(arquivo.linhas) || !arquivo.linhas.length) {
    throw criarErroImportacao(400, 'A planilha nao possui dados para importar.');
  }

  const linhaCabecalho = encontrarLinhaCabecalho(arquivo.linhas);
  if (linhaCabecalho < 0) {
    throw criarErroImportacao(400, 'Nao foi possivel identificar o cabecalho da planilha.');
  }

  duracaoLeituraMs = Date.now() - inicioLeituraMs;

  const cabecalhos = construirCabecalhosUnicos(arquivo.linhas[linhaCabecalho]);
  let { indices, colunasMapeadas } = mapearColunas(cabecalhos);

  const mappingResult = aplicarMapeamentoColunasManual({
    indices,
    colunasMapeadas,
    cabecalhos,
    mapeamento: columnMapping
  });

  indices = mappingResult.indices;
  colunasMapeadas = mappingResult.colunasMapeadas;
  validarIndicesObrigatorios(indices);

  const linhasDados = arquivo.linhas.slice(linhaCabecalho + 1);
  if (linhasDados.length > LIMITE_LINHAS_IMPORTACAO) {
    throw criarErroImportacao(400, `A planilha excede o limite de ${LIMITE_LINHAS_IMPORTACAO} linhas por importacao.`);
  }

  const resumo = {
    arquivo: nomeArquivo,
    formato: arquivo.extensao,
    delimitador: arquivo.delimitador,
    colunas_mapeadas: colunasMapeadas,
    configuracao: {
      criar_novos: Boolean(createMissing),
      atualizar_estoque: Boolean(updateStock),
      simulacao: Boolean(simulate)
    },
    total_linhas: 0,
    total_atualizados: 0,
    total_criados: 0,
    total_validos: 0,
    total_ignorados: 0,
    total_erros: 0,
    preview_linhas: [],
    logs: {
      erros: [],
      ignorados: [],
      avisos: []
    },
    performance: {
      inicio_iso: new Date(inicioTotalMs).toISOString(),
      duracao_total_ms: 0,
      duracao_leitura_ms: 0,
      duracao_pre_carga_ms: 0,
      duracao_processamento_ms: 0,
      duracao_persistencia_ms: 0,
      lotes_insercao: 0,
      lotes_atualizacao: 0,
      lotes_processados: 0,
      linhas_vazias_ignoradas: 0,
      etapa_falha: null
    }
  };

  if (Array.isArray(mappingResult?.avisos) && mappingResult.avisos.length) {
    mappingResult.avisos.forEach((aviso) => {
      registrarPreview(resumo.logs.avisos, {
        linha: 'cabecalho',
        campo: 'mapeamento_colunas',
        valor_recebido: '',
        motivo: aviso,
        acao_sugerida: 'Revise o mapeamento manual para colunas nao reconhecidas.'
      });
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    if (!simulate) {
      await connection.beginTransaction();
    }

    const [colunasRows] = await connection.query('SHOW COLUMNS FROM produtos');
    const colunasProdutos = new Set(colunasRows.map((coluna) => String(coluna.Field || '').toLowerCase()));

    const cacheCodigoInterno = new Map();
    const cacheCodigoBarras = new Map();
    const cacheNome = new Map();
    const cacheDadosBarcode = new Map();
    const pendentesAtualizacaoPorId = new Map();
    let usarSomenteCacheParaBusca = false;

    const chavesBuscaPlanilha = coletarChavesBuscaPlanilha({
      linhasDados,
      indices
    });

    etapaAtual = 'pre_carga_existentes';
    const inicioPreCargaMs = Date.now();

    if (colunasProdutos.has('codigo_interno') || colunasProdutos.has('codigo_barras') || createMissing) {
      await preCarregarCacheProdutosExistentesPorChaves({
        connection,
        colunasProdutos,
        cacheCodigoInterno,
        cacheCodigoBarras,
        cacheNome,
        chavesBusca: chavesBuscaPlanilha
      });
      usarSomenteCacheParaBusca = true;
    }

    duracaoPreCargaMs = Date.now() - inicioPreCargaMs;

    const incluirPrecoPromocionalInsert = colunasProdutos.has('preco_promocional') && indices.preco_promocional >= 0;
    const camposInsertPadrao = ['nome', 'preco'];

    if (colunasProdutos.has('descricao')) {
      camposInsertPadrao.push('descricao');
    }

    if (colunasProdutos.has('imagem_url')) {
      camposInsertPadrao.push('imagem_url');
    }

    if (colunasProdutos.has('unidade')) {
      camposInsertPadrao.push('unidade');
    }

    if (colunasProdutos.has('categoria')) {
      camposInsertPadrao.push('categoria');
    }

    if (colunasProdutos.has('estoque')) {
      camposInsertPadrao.push('estoque');
    }

    if (colunasProdutos.has('ativo')) {
      camposInsertPadrao.push('ativo');
    }

    if (colunasProdutos.has('codigo_interno')) {
      camposInsertPadrao.push('codigo_interno');
    }

    if (colunasProdutos.has('codigo_barras')) {
      camposInsertPadrao.push('codigo_barras');
    }

    if (incluirPrecoPromocionalInsert) {
      camposInsertPadrao.push('preco_promocional');
    }

    if (colunasProdutos.has('ultima_importacao_em')) {
      camposInsertPadrao.push('ultima_importacao_em');
    }

    if (colunasProdutos.has('ultima_atualizacao_preco_em')) {
      camposInsertPadrao.push('ultima_atualizacao_preco_em');
    }

    const pendentesCriacao = [];

    async function flushAtualizacoesPendentes() {
      if (simulate || !pendentesAtualizacaoPorId.size) {
        return;
      }

      const inicioFlushMs = Date.now();
      const loteAtualizacoes = Array.from(pendentesAtualizacaoPorId.values());
      const selects = [];
      const params = [];

      for (const item of loteAtualizacoes) {
        selects.push(`SELECT
          ? AS id,
          ? AS preco,
          ? AS nome,
          ? AS descricao,
          ? AS imagem_url,
          ? AS aplicar_imagem,
          ? AS preco_promocional,
          ? AS aplicar_preco_promocional,
          ? AS estoque,
          ? AS aplicar_estoque,
          ? AS codigo_interno,
          ? AS aplicar_codigo_interno,
          ? AS codigo_barras,
          ? AS aplicar_codigo_barras`);

        params.push(
          item.id,
          item.preco,
          item.nome,
          item.descricao,
          item.imagem_url,
          item.aplicar_imagem,
          item.preco_promocional,
          item.aplicar_preco_promocional,
          item.estoque,
          item.aplicar_estoque,
          item.codigo_interno,
          item.aplicar_codigo_interno,
          item.codigo_barras,
          item.aplicar_codigo_barras
        );
      }

      const setClauses = ['p.preco = u.preco'];

      if (colunasProdutos.has('nome')) {
        setClauses.push('p.nome = u.nome');
      }

      if (colunasProdutos.has('descricao')) {
        setClauses.push('p.descricao = u.descricao');
      }

      if (colunasProdutos.has('imagem_url')) {
        setClauses.push('p.imagem_url = CASE WHEN u.aplicar_imagem = 1 THEN u.imagem_url ELSE p.imagem_url END');
      }

      if (colunasProdutos.has('preco_promocional')) {
        setClauses.push('p.preco_promocional = CASE WHEN u.aplicar_preco_promocional = 1 THEN u.preco_promocional ELSE p.preco_promocional END');
      }

      if (colunasProdutos.has('estoque')) {
        setClauses.push('p.estoque = CASE WHEN u.aplicar_estoque = 1 THEN u.estoque ELSE p.estoque END');
      }

      if (colunasProdutos.has('codigo_interno')) {
        setClauses.push('p.codigo_interno = CASE WHEN u.aplicar_codigo_interno = 1 THEN u.codigo_interno ELSE p.codigo_interno END');
      }

      if (colunasProdutos.has('codigo_barras')) {
        setClauses.push('p.codigo_barras = CASE WHEN u.aplicar_codigo_barras = 1 THEN u.codigo_barras ELSE p.codigo_barras END');
      }

      if (colunasProdutos.has('ultima_importacao_em')) {
        setClauses.push('p.ultima_importacao_em = NOW()');
      }

      if (colunasProdutos.has('ultima_atualizacao_preco_em')) {
        setClauses.push('p.ultima_atualizacao_preco_em = NOW()');
      }

      await connection.query(
        `UPDATE produtos p
            INNER JOIN (
              ${selects.join('\nUNION ALL\n')}
            ) u ON p.id = u.id
          SET ${setClauses.join(',\n              ')}`,
        params
      );

      pendentesAtualizacaoPorId.clear();
      lotesAtualizacaoProcessados += 1;
      duracaoPersistenciaAtualizacaoMs += Date.now() - inicioFlushMs;
    }

    async function flushInsercoesPendentes() {
      if (simulate || !pendentesCriacao.length) {
        return;
      }

      const inicioFlushMs = Date.now();

      const placeholdersLinha = `(${camposInsertPadrao.map(() => '?').join(', ')})`;
      const placeholdersLote = pendentesCriacao.map(() => placeholdersLinha).join(', ');
      const valoresFlat = [];

      for (const item of pendentesCriacao) {
        valoresFlat.push(...item.valores);
      }

      const [insertResult] = await connection.query(
        `INSERT INTO produtos (${camposInsertPadrao.join(', ')}) VALUES ${placeholdersLote}`,
        valoresFlat
      );

      const primeiroId = Number(insertResult?.insertId || 0);
      for (let i = 0; i < pendentesCriacao.length; i += 1) {
        const item = pendentesCriacao[i];
        if (primeiroId > 0) {
          item.produtoCache.id = primeiroId + i;
        }
      }

      pendentesCriacao.length = 0;
      lotesInsercaoProcessados += 1;
      duracaoPersistenciaInsercaoMs += Date.now() - inicioFlushMs;
    }

    etapaAtual = 'processamento_linhas';
    const inicioProcessamentoMs = Date.now();

    for (let idx = 0; idx < linhasDados.length; idx += 1) {
      if (idx > 0 && idx % INTERVALO_CEDER_EVENT_LOOP === 0) {
        await cederEventLoop();
      }

      const linha = linhasDados[idx];

      if (linhaVazia(linha)) {
        resumo.performance.linhas_vazias_ignoradas += 1;
        continue;
      }

      resumo.total_linhas += 1;
      const numeroLinha = linhaCabecalho + 2 + idx;

      const codigoInterno = normalizarCodigoInterno(obterValorLinha(linha, indices.codigo_interno));
      let codigoBarras = normalizarCodigoBarras(obterValorLinha(linha, indices.codigo_barras));
      const nomePlanilha = truncarTexto(obterValorLinha(linha, indices.nome), 255);
      let descricaoProduto = truncarTexto(obterValorLinha(linha, indices.descricao), 1200);
      let nomeProduto = nomePlanilha || descricaoProduto;
      let imagemProduto = normalizarTexto(obterValorLinha(linha, indices.imagem));

      if (imagemProduto && !isHttpUrlValida(imagemProduto)) {
        imagemProduto = '';
      }

      if (!codigoBarras && /^\d{8,}$/.test(codigoInterno)) {
        codigoBarras = normalizarCodigoBarras(codigoInterno);
      }

      if (!descricaoProduto && nomeProduto) {
        descricaoProduto = nomeProduto;
      }

      const identificadorLinha = codigoInterno || codigoBarras || '';
      const nomeReferenciaLinha = nomeProduto || descricaoProduto || nomePlanilha || '';

      // Lookup externo so e necessario quando ainda faltam dados essenciais para validar/importar.
      if ((!nomeProduto || !descricaoProduto) && codigoBarras) {
        const dadosBarcode = await buscarDadosProdutoPorCodigoBarras(codigoBarras, cacheDadosBarcode, barcodeLookupService);
        if (dadosBarcode) {
          if (!nomeProduto && dadosBarcode.nome) {
            nomeProduto = truncarTexto(dadosBarcode.nome, 255);
          }

          if (!descricaoProduto && dadosBarcode.descricao) {
            descricaoProduto = truncarTexto(dadosBarcode.descricao, 1200);
          }

          if (!imagemProduto && dadosBarcode.imagem && isHttpUrlValida(dadosBarcode.imagem)) {
            imagemProduto = normalizarTexto(dadosBarcode.imagem);
          }
        }

        if (!descricaoProduto && nomeProduto) {
          descricaoProduto = nomeProduto;
        }
      }

      if (!codigoInterno && !codigoBarras) {
        resumo.total_erros += 1;
        registrarPreview(resumo.logs.erros, {
          linha: numeroLinha,
          identificador: '',
          campo: 'codigo_interno/codigo_barras',
          valor_recebido: `${normalizarTexto(obterValorLinha(linha, indices.codigo_interno))} | ${normalizarTexto(obterValorLinha(linha, indices.codigo_barras))}`,
          motivo: 'Linha sem identificador. Informe codigo interno ou codigo de barras.',
          acao_sugerida: 'Preencha ao menos uma das colunas: codigo interno ou codigo de barras.'
        });
        registrarLinhaAmostraPreview(resumo, {
          ...construirLinhaAmostraBase({
            numeroLinha,
            identificador: '',
            nome: nomeReferenciaLinha,
            preco: null,
            motivo: 'Linha sem identificador. Informe codigo interno ou codigo de barras.',
            campo: 'codigo_interno/codigo_barras',
            valorRecebido: `${normalizarTexto(obterValorLinha(linha, indices.codigo_interno))} | ${normalizarTexto(obterValorLinha(linha, indices.codigo_barras))}`,
            acaoSugerida: 'Preencha ao menos uma das colunas: codigo interno ou codigo de barras.'
          }),
          status: 'erro'
        });
        continue;
      }

      if (!nomeProduto) {
        resumo.total_erros += 1;
        registrarPreview(resumo.logs.erros, {
          linha: numeroLinha,
          identificador: identificadorLinha,
          campo: 'nome/descricao',
          valor_recebido: `${normalizarTexto(obterValorLinha(linha, indices.nome))} | ${normalizarTexto(obterValorLinha(linha, indices.descricao))}`,
          motivo: 'Linha sem descricao/nome do produto.',
          acao_sugerida: 'Preencha nome ou descricao para o produto.'
        });
        registrarLinhaAmostraPreview(resumo, {
          ...construirLinhaAmostraBase({
            numeroLinha,
            identificador: identificadorLinha,
            nome: '',
            preco: null,
            motivo: 'Linha sem descricao/nome do produto.',
            campo: 'nome/descricao',
            valorRecebido: `${normalizarTexto(obterValorLinha(linha, indices.nome))} | ${normalizarTexto(obterValorLinha(linha, indices.descricao))}`,
            acaoSugerida: 'Preencha nome ou descricao para o produto.'
          }),
          status: 'erro'
        });
        continue;
      }

      if (!descricaoProduto && nomeProduto) {
        descricaoProduto = nomeProduto;
      }

      const precoVenda = parseDecimalBrasileiro(obterValorLinha(linha, indices.preco));
      if (!Number.isFinite(precoVenda) || precoVenda <= 0) {
        resumo.total_erros += 1;
        registrarPreview(resumo.logs.erros, {
          linha: numeroLinha,
          identificador: identificadorLinha,
          campo: 'preco',
          valor_recebido: normalizarTexto(obterValorLinha(linha, indices.preco)),
          motivo: 'Preco de venda invalido. O item foi ignorado.',
          acao_sugerida: 'Use preco de venda maior que zero (ex.: 14,90).' 
        });
        registrarLinhaAmostraPreview(resumo, {
          ...construirLinhaAmostraBase({
            numeroLinha,
            identificador: identificadorLinha,
            nome: nomeProduto,
            preco: null,
            motivo: 'Preco de venda invalido. O item foi ignorado.',
            campo: 'preco',
            valorRecebido: normalizarTexto(obterValorLinha(linha, indices.preco)),
            acaoSugerida: 'Use preco de venda maior que zero (ex.: 14,90).'
          }),
          status: 'erro'
        });
        continue;
      }

      const possuiColunaPromocao = indices.preco_promocional >= 0;
      let precoPromocional = null;
      if (possuiColunaPromocao) {
        const valorPromocionalRaw = obterValorLinha(linha, indices.preco_promocional);
        if (temValorPreenchido(valorPromocionalRaw)) {
          const promocionalConvertido = parseDecimalBrasileiro(valorPromocionalRaw);
          if (!Number.isFinite(promocionalConvertido) || promocionalConvertido <= 0 || promocionalConvertido >= precoVenda) {
            registrarPreview(resumo.logs.avisos, {
              linha: numeroLinha,
              identificador: identificadorLinha,
              campo: 'preco_promocional',
              valor_recebido: normalizarTexto(valorPromocionalRaw),
              motivo: 'Preco promocional vazio/zero/invalido. Definido como null.',
              acao_sugerida: 'Informe promocao maior que zero e menor que o preco de venda.'
            });
            precoPromocional = null;
          } else {
            precoPromocional = Number(promocionalConvertido.toFixed(2));
          }
        }
      }

      let estoqueConvertido = null;
      if (updateStock && indices.estoque >= 0) {
        const estoqueRaw = obterValorLinha(linha, indices.estoque);
        if (temValorPreenchido(estoqueRaw)) {
          const estoqueNumero = parseDecimalBrasileiro(estoqueRaw);

          if (!Number.isFinite(estoqueNumero)) {
            registrarPreview(resumo.logs.avisos, {
              linha: numeroLinha,
              identificador: identificadorLinha,
              campo: 'estoque',
              valor_recebido: normalizarTexto(estoqueRaw),
              motivo: 'Estoque invalido na planilha. Mantida a quantidade atual no site.',
              acao_sugerida: 'Use quantidade inteira maior ou igual a zero para estoque.'
            });
          } else if (estoqueNumero < 0) {
            estoqueConvertido = 0;
            registrarPreview(resumo.logs.avisos, {
              linha: numeroLinha,
              identificador: identificadorLinha,
              campo: 'estoque',
              valor_recebido: String(estoqueNumero),
              motivo: `Estoque negativo (${estoqueNumero}). Ajustado para 0 no site.`,
              acao_sugerida: 'Envie estoque nao negativo para manter o valor original.'
            });
          } else {
            estoqueConvertido = Math.trunc(estoqueNumero);
          }
        }
      }

      let ativo = null;
      if (indices.ativo >= 0) {
        const ativoRaw = obterValorLinha(linha, indices.ativo);
        if (temValorPreenchido(ativoRaw)) {
          ativo = parseBooleanoPlanilha(ativoRaw);
          if (ativo === null) {
            registrarPreview(resumo.logs.avisos, {
              linha: numeroLinha,
              identificador: identificadorLinha,
              campo: 'ativo',
              valor_recebido: normalizarTexto(ativoRaw),
              motivo: 'Valor de ativo/inativo invalido. Mantido status atual do produto.',
              acao_sugerida: 'Use valores como 1, 0, sim, nao, ativo ou inativo.'
            });
          }
        }
      }

      const unidadeRaw = normalizarTexto(obterValorLinha(linha, indices.unidade));
      const unidade = unidadeRaw ? unidadeRaw.slice(0, 10) : '';
      const categoriaRaw = normalizarTexto(obterValorLinha(linha, indices.categoria));
      const categoria = categoriaRaw ? categoriaRaw.toLowerCase().slice(0, 50) : '';

      let produtoExistente = null;
      let chaveMatch = '';

      if (codigoInterno && colunasProdutos.has('codigo_interno')) {
        produtoExistente = await buscarProdutoPorCampo(
          connection,
          cacheCodigoInterno,
          'codigo_interno',
          codigoInterno,
          { usarApenasCache: usarSomenteCacheParaBusca }
        );
        if (produtoExistente) {
          chaveMatch = 'codigo_interno';
        }
      }

      if (!produtoExistente && codigoBarras && colunasProdutos.has('codigo_barras')) {
        produtoExistente = await buscarProdutoPorCampo(
          connection,
          cacheCodigoBarras,
          'codigo_barras',
          codigoBarras,
          { usarApenasCache: usarSomenteCacheParaBusca }
        );
        if (produtoExistente) {
          chaveMatch = 'codigo_barras';
        }
      }

      if (produtoExistente) {
        if (!simulate && produtoExistente.id < 0) {
          await flushInsercoesPendentes();
        }

        const payloadAtualizacao = {
          id: Number(produtoExistente.id),
          preco: Number(precoVenda.toFixed(2)),
          nome: nomeProduto,
          descricao: descricaoProduto || nomeProduto,
          imagem_url: imagemProduto || null,
          aplicar_imagem: colunasProdutos.has('imagem_url') && Boolean(imagemProduto) ? 1 : 0,
          preco_promocional: precoPromocional,
          aplicar_preco_promocional: possuiColunaPromocao && colunasProdutos.has('preco_promocional') ? 1 : 0,
          estoque: Number.isInteger(estoqueConvertido) ? estoqueConvertido : 0,
          aplicar_estoque: updateStock && indices.estoque >= 0 && colunasProdutos.has('estoque') && Number.isInteger(estoqueConvertido) ? 1 : 0,
          codigo_interno: codigoInterno || null,
          aplicar_codigo_interno: colunasProdutos.has('codigo_interno') && Boolean(codigoInterno) ? 1 : 0,
          codigo_barras: codigoBarras || null,
          aplicar_codigo_barras: colunasProdutos.has('codigo_barras') && Boolean(codigoBarras) ? 1 : 0
        };

        if (!simulate) {
          pendentesAtualizacaoPorId.set(payloadAtualizacao.id, payloadAtualizacao);
          if (pendentesAtualizacaoPorId.size >= TAMANHO_LOTE_ATUALIZACAO) {
            await flushAtualizacoesPendentes();
          }
        }

        resumo.total_atualizados += 1;
        registrarLinhaAmostraPreview(resumo, {
          ...construirLinhaAmostraBase({
            numeroLinha,
            identificador: identificadorLinha,
            nome: nomeProduto,
            preco: Number(precoVenda.toFixed(2)),
            motivo: `Produto existente localizado por ${chaveMatch}.`,
            campo: chaveMatch,
            valorRecebido: identificadorLinha,
            acaoSugerida: 'Atualizacao prevista para produto existente.'
          }),
          status: 'atualizar'
        });

        if (codigoInterno && colunasProdutos.has('codigo_interno')) {
          cacheCodigoInterno.set(codigoInterno, {
            id: produtoExistente.id,
            nome: nomeProduto,
            unidade: unidade || produtoExistente.unidade || 'un'
          });
        }

        if (codigoBarras && colunasProdutos.has('codigo_barras')) {
          cacheCodigoBarras.set(codigoBarras, {
            id: produtoExistente.id,
            nome: nomeProduto,
            unidade: unidade || produtoExistente.unidade || 'un'
          });
        }

        cacheNome.set(normalizarCabecalho(nomeProduto), {
          id: produtoExistente.id,
          nome: nomeProduto,
          unidade: unidade || produtoExistente.unidade || 'un'
        });

        continue;
      }

      if (!createMissing) {
        resumo.total_ignorados += 1;
        registrarPreview(resumo.logs.ignorados, {
          linha: numeroLinha,
          motivo: 'Produto nao encontrado. Configuracao atual ignora itens novos.',
          identificador: identificadorLinha,
          campo: 'criar_novos',
          valor_recebido: 'false',
          acao_sugerida: 'Ative criar_novos para incluir produtos inexistentes.'
        });
        registrarLinhaAmostraPreview(resumo, {
          ...construirLinhaAmostraBase({
            numeroLinha,
            identificador: identificadorLinha,
            nome: nomeProduto,
            preco: Number(precoVenda.toFixed(2)),
            motivo: 'Produto nao encontrado. Configuracao atual ignora itens novos.',
            campo: 'criar_novos',
            valorRecebido: 'false',
            acaoSugerida: 'Ative criar_novos para incluir produtos inexistentes.'
          }),
          status: 'ignorado'
        });
        continue;
      }

      const duplicadoNome = await buscarProdutoPorNome(
        connection,
        cacheNome,
        nomeProduto,
        { usarApenasCache: usarSomenteCacheParaBusca }
      );
      if (duplicadoNome) {
        resumo.total_ignorados += 1;
        registrarPreview(resumo.logs.ignorados, {
          linha: numeroLinha,
          motivo: 'Produto com mesmo nome ja existe. Item ignorado para evitar duplicidade.',
          identificador: identificadorLinha,
          campo: 'nome',
          valor_recebido: nomeProduto,
          acao_sugerida: 'Ajuste o nome ou use identificador unico para evitar duplicidade.'
        });
        registrarLinhaAmostraPreview(resumo, {
          ...construirLinhaAmostraBase({
            numeroLinha,
            identificador: identificadorLinha,
            nome: nomeProduto,
            preco: Number(precoVenda.toFixed(2)),
            motivo: 'Produto com mesmo nome ja existe. Item ignorado para evitar duplicidade.',
            campo: 'nome',
            valorRecebido: nomeProduto,
            acaoSugerida: 'Ajuste o nome ou use identificador unico para evitar duplicidade.'
          }),
          status: 'ignorado'
        });
        continue;
      }

      const valoresInsert = [nomeProduto, Number(precoVenda.toFixed(2))];

      if (colunasProdutos.has('descricao')) {
        valoresInsert.push(descricaoProduto || nomeProduto);
      }

      if (colunasProdutos.has('imagem_url')) {
        valoresInsert.push(imagemProduto || null);
      }

      if (colunasProdutos.has('unidade')) {
        valoresInsert.push(unidade || 'un');
      }

      if (colunasProdutos.has('categoria')) {
        valoresInsert.push(categoria || inferirCategoria(nomeProduto));
      }

      if (colunasProdutos.has('estoque')) {
        valoresInsert.push(updateStock && Number.isInteger(estoqueConvertido) ? estoqueConvertido : 0);
      }

      if (colunasProdutos.has('ativo')) {
        valoresInsert.push(ativo === null ? 1 : (ativo ? 1 : 0));
      }

      if (colunasProdutos.has('codigo_interno')) {
        valoresInsert.push(codigoInterno || null);
      }

      if (colunasProdutos.has('codigo_barras')) {
        valoresInsert.push(codigoBarras || null);
      }

      if (incluirPrecoPromocionalInsert) {
        valoresInsert.push(possuiColunaPromocao ? precoPromocional : null);
      }

      if (colunasProdutos.has('ultima_importacao_em')) {
        valoresInsert.push(new Date());
      }

      if (colunasProdutos.has('ultima_atualizacao_preco_em')) {
        valoresInsert.push(new Date());
      }

      const novoProdutoId = -(resumo.total_criados + pendentesCriacao.length + 1);

      resumo.total_criados += 1;

      const novoProdutoCache = {
        id: novoProdutoId,
        nome: nomeProduto,
        unidade: unidade || 'un'
      };

      if (codigoInterno && colunasProdutos.has('codigo_interno')) {
        cacheCodigoInterno.set(codigoInterno, novoProdutoCache);
      }

      if (codigoBarras && colunasProdutos.has('codigo_barras')) {
        cacheCodigoBarras.set(codigoBarras, novoProdutoCache);
      }

      cacheNome.set(normalizarCabecalho(nomeProduto), novoProdutoCache);

      if (!simulate) {
        pendentesCriacao.push({
          valores: valoresInsert,
          produtoCache: novoProdutoCache
        });

        if (pendentesCriacao.length >= TAMANHO_LOTE_INSERCAO) {
          await flushInsercoesPendentes();
        }
      }

      registrarLinhaAmostraPreview(resumo, {
        ...construirLinhaAmostraBase({
          numeroLinha,
          identificador: identificadorLinha,
          nome: nomeProduto,
          preco: Number(precoVenda.toFixed(2)),
          motivo: 'Produto novo validado para criacao.',
          campo: 'create',
          valorRecebido: identificadorLinha,
          acaoSugerida: 'Criacao prevista para item inexistente.'
        }),
        status: 'criar'
      });
    }

    if (resumo.total_linhas === 0) {
      throw criarErroImportacao(400, 'A planilha nao possui linhas de dados para importacao.');
    }

    etapaAtual = 'persistencia_final';
    await flushAtualizacoesPendentes();
    await flushInsercoesPendentes();

    duracaoProcessamentoMs = Date.now() - inicioProcessamentoMs;
    resumo.performance.duracao_leitura_ms = duracaoLeituraMs;
    resumo.performance.duracao_pre_carga_ms = duracaoPreCargaMs;
    resumo.performance.duracao_processamento_ms = duracaoProcessamentoMs;
    resumo.performance.duracao_persistencia_ms = duracaoPersistenciaInsercaoMs + duracaoPersistenciaAtualizacaoMs;
    resumo.performance.lotes_insercao = lotesInsercaoProcessados;
    resumo.performance.lotes_atualizacao = lotesAtualizacaoProcessados;
    resumo.performance.lotes_processados = lotesInsercaoProcessados + lotesAtualizacaoProcessados;

    resumo.total_validos = resumo.total_atualizados + resumo.total_criados;

    if (simulate) {
      resumo.performance.duracao_total_ms = Date.now() - inicioTotalMs;
      return {
        mensagem: 'Simulacao concluida com sucesso. Nenhuma alteracao foi gravada no banco.',
        ...resumo,
        status: 'simulado',
        simulacao: true
      };
    }

    etapaAtual = 'commit';
    await connection.commit();
    resumo.performance.duracao_total_ms = Date.now() - inicioTotalMs;

    const statusImportacao = resumo.total_erros > 0 ? 'concluido_com_erros' : 'concluido';
    let avisoHistorico = '';
    try {
      await registrarHistoricoImportacao(pool, {
        nomeArquivo,
        totalLinhas: resumo.total_linhas,
        totalAtualizados: resumo.total_atualizados,
        totalCriados: resumo.total_criados,
        totalIgnorados: resumo.total_ignorados,
        totalErros: resumo.total_erros,
        status: statusImportacao,
        usuarioId: adminUserId,
        usuarioNome: adminUser,
        resumo
      });
    } catch (erroHistorico) {
      console.error('Falha ao registrar historico de importacao:', erroHistorico);
      avisoHistorico = 'Importacao concluida, mas nao foi possivel registrar no historico.';
    }

    const payloadRetorno = {
      mensagem: 'Importacao concluida com sucesso.',
      ...resumo,
      status: statusImportacao
    };

    if (avisoHistorico) {
      payloadRetorno.aviso_historico = avisoHistorico;
    }

    return payloadRetorno;
  } catch (erro) {
    if (!simulate && connection) {
      try {
        await connection.rollback();
        rollbackAplicado = true;
      } catch {
        // ignora falha de rollback
      }
    }

    resumo.performance.duracao_leitura_ms = duracaoLeituraMs;
    resumo.performance.duracao_pre_carga_ms = duracaoPreCargaMs;
    resumo.performance.duracao_processamento_ms = duracaoProcessamentoMs;
    resumo.performance.duracao_persistencia_ms = duracaoPersistenciaInsercaoMs + duracaoPersistenciaAtualizacaoMs;
    resumo.performance.duracao_total_ms = Date.now() - inicioTotalMs;
    resumo.performance.lotes_insercao = lotesInsercaoProcessados;
    resumo.performance.lotes_atualizacao = lotesAtualizacaoProcessados;
    resumo.performance.lotes_processados = lotesInsercaoProcessados + lotesAtualizacaoProcessados;
    resumo.performance.etapa_falha = etapaAtual;

    const statusFalha = 'erro';

    if (!simulate) {
      try {
        await registrarHistoricoImportacao(pool, {
          nomeArquivo,
          totalLinhas: resumo.total_linhas,
          totalAtualizados: resumo.total_atualizados,
          totalCriados: resumo.total_criados,
          totalIgnorados: resumo.total_ignorados,
          totalErros: resumo.total_erros + 1,
          status: statusFalha,
          usuarioId: adminUserId,
          usuarioNome: adminUser,
          resumo: {
            ...resumo,
            etapa_falha: etapaAtual,
            rollback_aplicado: rollbackAplicado,
            erro_fatal: erro?.message || 'Erro inesperado na importacao.'
          }
        });
      } catch {
        // se log falhar, mantem o erro original
      }
    }

    const detalhesFalha = {
      etapa_falha: etapaAtual,
      rollback_aplicado: rollbackAplicado,
      lotes_insercao: lotesInsercaoProcessados,
      lotes_atualizacao: lotesAtualizacaoProcessados,
      lotes_processados: lotesInsercaoProcessados + lotesAtualizacaoProcessados,
      duracao_total_ms: Date.now() - inicioTotalMs
    };

    if (erro?.httpStatus) {
      erro.extra = {
        ...(erro.extra && typeof erro.extra === 'object' ? erro.extra : {}),
        ...detalhesFalha
      };
      throw erro;
    }

    const causaInterna = String(erro?.message || 'Erro inesperado na importacao.');
    console.error('Falha interna durante importarProdutosPlanilha:', erro);
    throw criarErroImportacao(500, 'Nao foi possivel concluir a importacao da planilha.', {
      causa: causaInterna,
      ...detalhesFalha
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  EXTENSOES_IMPORTACAO_ACEITAS,
  MIME_IMPORTACAO_ACEITOS,
  MENSAGEM_FORMATO_ARQUIVO_IMPORTACAO_INVALIDO,
  validarArquivoImportacao,
  construirModeloImportacaoProdutosCsv,
  garantirEstruturaImportacaoProdutos,
  importarProdutosPlanilha,
  listarImportacoesProdutos,
  criarErroImportacao
};
