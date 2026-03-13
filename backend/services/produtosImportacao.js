'use strict';

const path = require('path');
const XLSX = require('xlsx');
const fetch = global.fetch || require('node-fetch');

const EXTENSOES_IMPORTACAO_ACEITAS = Object.freeze(['.csv', '.xlsx']);
const LIMITE_PREVIEW_LOGS = 120;
const LIMITE_LINHAS_IMPORTACAO = 50000;

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
  const extensao = detectarExtensaoArquivo(nomeArquivo);

  if (!EXTENSOES_IMPORTACAO_ACEITAS.includes(extensao)) {
    throw criarErroImportacao(400, 'Arquivo invalido. Envie uma planilha .xlsx ou .csv.');
  }

  if (extensao === '.xlsx') {
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
  }

  const conteudo = decodificarCsvBuffer(buffer);
  const delimitador = detectarDelimitadorCsv(conteudo);
  const linhas = parseCsv(conteudo, delimitador);

  return {
    extensao,
    delimitador,
    linhas
  };
}

function encontrarLinhaCabecalho(linhas) {
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

function mapearColunas(cabecalhos) {
  const cabecalhosNorm = cabecalhos.map((cabecalho) => normalizarCabecalho(cabecalho));
  const usados = new Set();

  function localizarIndice(aliases, permitirReuso = false) {
    let melhorIndice = -1;
    let melhorScore = 0;

    for (let i = 0; i < cabecalhosNorm.length; i += 1) {
      if (!permitirReuso && usados.has(i)) {
        continue;
      }

      const header = cabecalhosNorm[i];
      if (!header) {
        continue;
      }

      for (const alias of aliases) {
        const aliasNorm = normalizarCabecalho(alias);
        if (!aliasNorm) {
          continue;
        }

        let score = 0;
        if (header === aliasNorm) {
          score = 4;
        } else if (header.startsWith(aliasNorm) || header.endsWith(aliasNorm)) {
          score = 3;
        } else if (header.includes(aliasNorm) || aliasNorm.includes(header)) {
          score = 2;
        }

        if (score > melhorScore) {
          melhorScore = score;
          melhorIndice = i;
        }
      }
    }

    if (melhorIndice >= 0 && !permitirReuso) {
      usados.add(melhorIndice);
    }

    return melhorIndice;
  }

  const indices = {
    codigo_interno: localizarIndice(COLUNAS_ALIAS.codigo_interno),
    codigo_barras: localizarIndice(COLUNAS_ALIAS.codigo_barras),
    nome: localizarIndice(COLUNAS_ALIAS.nome),
    descricao: localizarIndice(COLUNAS_ALIAS.descricao),
    imagem: localizarIndice(COLUNAS_ALIAS.imagem),
    preco: localizarIndice(COLUNAS_ALIAS.preco),
    preco_promocional: localizarIndice(COLUNAS_ALIAS.preco_promocional),
    estoque: localizarIndice(COLUNAS_ALIAS.estoque),
    unidade: localizarIndice(COLUNAS_ALIAS.unidade),
    ativo: localizarIndice(COLUNAS_ALIAS.ativo),
    categoria: localizarIndice(COLUNAS_ALIAS.categoria)
  };

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

async function buscarDadosProdutoPorCodigoBarras(codigoBarras, cacheBarcode = new Map()) {
  const codigo = normalizarCodigoBarras(codigoBarras);
  if (!codigo) {
    return null;
  }

  if (cacheBarcode.has(codigo)) {
    return cacheBarcode.get(codigo);
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

async function buscarProdutoPorCampo(connection, cache, campo, valor) {
  if (!valor) {
    return null;
  }

  const chave = String(valor);
  if (cache.has(chave)) {
    return cache.get(chave);
  }

  const [rows] = await connection.query(
    `SELECT id, nome, unidade FROM produtos WHERE ${campo} = ? ORDER BY id ASC LIMIT 1`,
    [valor]
  );

  const produto = rows[0] || null;
  cache.set(chave, produto);
  return produto;
}

async function buscarProdutoPorNome(connection, cache, nome) {
  const nomeNormalizado = normalizarCabecalho(nome);
  if (!nomeNormalizado) {
    return null;
  }

  if (cache.has(nomeNormalizado)) {
    return cache.get(nomeNormalizado);
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
  adminUser = 'admin',
  adminUserId = null
}) {
  if (!pool || typeof pool.getConnection !== 'function') {
    throw criarErroImportacao(500, 'Conexao com banco indisponivel para importacao.');
  }

  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) {
    throw criarErroImportacao(400, 'Arquivo vazio. Selecione uma planilha valida para importar.');
  }

  const nomeArquivo = normalizarTexto(originalName) || `importacao_${Date.now()}.csv`;

  await garantirEstruturaImportacaoProdutos(pool);

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

  const cabecalhos = construirCabecalhosUnicos(arquivo.linhas[linhaCabecalho]);
  const { indices, colunasMapeadas } = mapearColunas(cabecalhos);

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
    total_ignorados: 0,
    total_erros: 0,
    logs: {
      erros: [],
      ignorados: [],
      avisos: []
    }
  };

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

    for (let idx = 0; idx < linhasDados.length; idx += 1) {
      const linha = linhasDados[idx];

      if (linhaVazia(linha)) {
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

      if ((!nomeProduto || !descricaoProduto || !imagemProduto) && codigoBarras) {
        const dadosBarcode = await buscarDadosProdutoPorCodigoBarras(codigoBarras, cacheDadosBarcode);
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
      }

      if (!codigoInterno && !codigoBarras) {
        resumo.total_erros += 1;
        registrarPreview(resumo.logs.erros, {
          linha: numeroLinha,
          motivo: 'Linha sem identificador. Informe codigo interno ou codigo de barras.'
        });
        continue;
      }

      if (!nomeProduto) {
        resumo.total_erros += 1;
        registrarPreview(resumo.logs.erros, {
          linha: numeroLinha,
          motivo: 'Linha sem descricao/nome do produto.'
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
          motivo: 'Preco de venda invalido. O item foi ignorado.'
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
              motivo: 'Preco promocional vazio/zero/invalido. Definido como null.'
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
              motivo: 'Estoque invalido na planilha. Mantida a quantidade atual no site.'
            });
          } else if (estoqueNumero < 0) {
            estoqueConvertido = 0;
            registrarPreview(resumo.logs.avisos, {
              linha: numeroLinha,
              motivo: `Estoque negativo (${estoqueNumero}). Ajustado para 0 no site.`
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
              motivo: 'Valor de ativo/inativo invalido. Mantido status atual do produto.'
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
        produtoExistente = await buscarProdutoPorCampo(connection, cacheCodigoInterno, 'codigo_interno', codigoInterno);
        if (produtoExistente) {
          chaveMatch = 'codigo_interno';
        }
      }

      if (!produtoExistente && codigoBarras && colunasProdutos.has('codigo_barras')) {
        produtoExistente = await buscarProdutoPorCampo(connection, cacheCodigoBarras, 'codigo_barras', codigoBarras);
        if (produtoExistente) {
          chaveMatch = 'codigo_barras';
        }
      }

      if (produtoExistente) {
        const updates = ['preco = ?'];
        const params = [Number(precoVenda.toFixed(2))];

        if (colunasProdutos.has('nome') && nomeProduto) {
          updates.push('nome = ?');
          params.push(nomeProduto);
        }

        if (colunasProdutos.has('descricao') && descricaoProduto) {
          updates.push('descricao = ?');
          params.push(descricaoProduto);
        }

        if (colunasProdutos.has('imagem_url') && imagemProduto) {
          updates.push('imagem_url = ?');
          params.push(imagemProduto);
        }

        if (possuiColunaPromocao && colunasProdutos.has('preco_promocional')) {
          updates.push('preco_promocional = ?');
          params.push(precoPromocional);
        }

        if (updateStock && indices.estoque >= 0 && colunasProdutos.has('estoque') && Number.isInteger(estoqueConvertido)) {
          updates.push('estoque = ?');
          params.push(estoqueConvertido);
        }

        if (colunasProdutos.has('codigo_interno') && codigoInterno) {
          updates.push('codigo_interno = ?');
          params.push(codigoInterno);
        }

        if (colunasProdutos.has('codigo_barras') && codigoBarras) {
          updates.push('codigo_barras = ?');
          params.push(codigoBarras);
        }

        if (colunasProdutos.has('ultima_importacao_em')) {
          updates.push('ultima_importacao_em = NOW()');
        }

        if (colunasProdutos.has('ultima_atualizacao_preco_em')) {
          updates.push('ultima_atualizacao_preco_em = NOW()');
        }

        params.push(produtoExistente.id);
        if (!simulate) {
          await connection.query(
            `UPDATE produtos SET ${updates.join(', ')} WHERE id = ?`,
            params
          );
        }

        resumo.total_atualizados += 1;

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
          identificador: codigoInterno || codigoBarras
        });
        continue;
      }

      const duplicadoNome = await buscarProdutoPorNome(connection, cacheNome, nomeProduto);
      if (duplicadoNome) {
        resumo.total_ignorados += 1;
        registrarPreview(resumo.logs.ignorados, {
          linha: numeroLinha,
          motivo: 'Produto com mesmo nome ja existe. Item ignorado para evitar duplicidade.',
          identificador: codigoInterno || codigoBarras
        });
        continue;
      }

      const campos = ['nome', 'preco'];
      const valores = [nomeProduto, Number(precoVenda.toFixed(2))];

      if (colunasProdutos.has('descricao')) {
        campos.push('descricao');
        valores.push(descricaoProduto || nomeProduto);
      }

      if (colunasProdutos.has('imagem_url')) {
        campos.push('imagem_url');
        valores.push(imagemProduto || null);
      }

      if (colunasProdutos.has('unidade')) {
        campos.push('unidade');
        valores.push(unidade || 'un');
      }

      if (colunasProdutos.has('categoria')) {
        campos.push('categoria');
        valores.push(categoria || inferirCategoria(nomeProduto));
      }

      if (colunasProdutos.has('estoque')) {
        campos.push('estoque');
        valores.push(updateStock && Number.isInteger(estoqueConvertido) ? estoqueConvertido : 0);
      }

      if (colunasProdutos.has('ativo')) {
        campos.push('ativo');
        valores.push(ativo === null ? 1 : (ativo ? 1 : 0));
      }

      if (colunasProdutos.has('codigo_interno') && codigoInterno) {
        campos.push('codigo_interno');
        valores.push(codigoInterno);
      }

      if (colunasProdutos.has('codigo_barras') && codigoBarras) {
        campos.push('codigo_barras');
        valores.push(codigoBarras);
      }

      if (colunasProdutos.has('preco_promocional') && possuiColunaPromocao) {
        campos.push('preco_promocional');
        valores.push(precoPromocional);
      }

      if (colunasProdutos.has('ultima_importacao_em')) {
        campos.push('ultima_importacao_em');
        valores.push(new Date());
      }

      if (colunasProdutos.has('ultima_atualizacao_preco_em')) {
        campos.push('ultima_atualizacao_preco_em');
        valores.push(new Date());
      }

      let novoProdutoId = -(resumo.total_criados + 1);
      if (!simulate) {
        const placeholders = campos.map(() => '?').join(', ');
        const [insertResult] = await connection.query(
          `INSERT INTO produtos (${campos.join(', ')}) VALUES (${placeholders})`,
          valores
        );
        novoProdutoId = insertResult.insertId;
      }

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

      if (chaveMatch) {
        registrarPreview(resumo.logs.avisos, {
          linha: numeroLinha,
          motivo: `Produto atualizado por ${chaveMatch}.`
        });
      }
    }

    if (resumo.total_linhas === 0) {
      throw criarErroImportacao(400, 'A planilha nao possui linhas de dados para importacao.');
    }

    if (simulate) {
      return {
        mensagem: 'Simulacao concluida com sucesso. Nenhuma alteracao foi gravada no banco.',
        ...resumo,
        status: 'simulado',
        simulacao: true
      };
    }

    await connection.commit();

    const statusImportacao = resumo.total_erros > 0 ? 'concluido_com_erros' : 'concluido';
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

    return {
      mensagem: 'Importacao concluida com sucesso.',
      ...resumo,
      status: statusImportacao
    };
  } catch (erro) {
    if (!simulate && connection) {
      try {
        await connection.rollback();
      } catch {
        // ignora falha de rollback
      }
    }

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
            erro_fatal: erro?.message || 'Erro inesperado na importacao.'
          }
        });
      } catch {
        // se log falhar, mantem o erro original
      }
    }

    if (erro?.httpStatus) {
      throw erro;
    }

    throw criarErroImportacao(500, 'Nao foi possivel concluir a importacao da planilha.');
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  EXTENSOES_IMPORTACAO_ACEITAS,
  construirModeloImportacaoProdutosCsv,
  garantirEstruturaImportacaoProdutos,
  importarProdutosPlanilha,
  listarImportacoesProdutos,
  criarErroImportacao
};
