'use strict';

const XLSX = require('xlsx');

const TABELA_IMPORT_LOGS = 'product_import_logs';
const TABELA_ENRICHMENT_LOGS = 'product_enrichment_logs';

let schemaReady = false;

function normalizarTexto(value) {
  return String(value || '').trim();
}

function toLowerTrim(value) {
  return normalizarTexto(value).toLowerCase();
}

function parsePositiveInt(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function parseBooleanFilter(value) {
  const normalized = toLowerTrim(value);
  if (!normalized) return null;

  if (['1', 'true', 'sim', 'yes', 'on', 'com'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'não', 'no', 'off', 'sem'].includes(normalized)) {
    return false;
  }

  return null;
}

function parseOverwriteImageMode(value, fallback = 'if_empty') {
  const normalized = toLowerTrim(value);
  if (!normalized) {
    return fallback;
  }

  const map = {
    if_empty: 'if_empty',
    only_if_empty: 'if_empty',
    empty_only: 'if_empty',
    preserve_existing: 'if_empty',
    preservar_existente: 'if_empty',
    always: 'always',
    overwrite: 'always',
    sobrescrever: 'always',
    replace: 'always',
    never: 'never',
    keep: 'never',
    manter: 'never'
  };

  return map[normalized] || fallback;
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  const normalized = String(value)
    .replace(/\s+/g, '')
    .replace('R$', '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&');
}

function toJsonStringSafe(value, fallback = '{}') {
  try {
    return JSON.stringify(value || {});
  } catch {
    return fallback;
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

async function garantirColuna(pool, tabela, coluna, sqlAlter) {
  if (!(await colunaExiste(pool, tabela, coluna))) {
    await pool.query(sqlAlter);
  }
}

async function garantirIndice(pool, tabela, indice, sqlCreate) {
  if (!(await indiceExiste(pool, tabela, indice))) {
    await pool.query(sqlCreate);
  }
}

async function ensureAdminCatalogSchema(pool) {
  if (schemaReady) {
    return;
  }

  await garantirColuna(pool, 'produtos', 'codigo_barras', 'ALTER TABLE produtos ADD COLUMN codigo_barras VARCHAR(32) NULL');
  await garantirColuna(pool, 'produtos', 'imagem_url', 'ALTER TABLE produtos ADD COLUMN imagem_url TEXT NULL');
  await garantirColuna(pool, 'produtos', 'preco_tabela', 'ALTER TABLE produtos ADD COLUMN preco_tabela DECIMAL(10,2) NULL');
  await garantirColuna(pool, 'produtos', 'enrichment_status', "ALTER TABLE produtos ADD COLUMN enrichment_status VARCHAR(30) NOT NULL DEFAULT 'pendente'");
  await garantirColuna(pool, 'produtos', 'enrichment_provider', 'ALTER TABLE produtos ADD COLUMN enrichment_provider VARCHAR(80) NULL');
  await garantirColuna(pool, 'produtos', 'enrichment_last_attempt_at', 'ALTER TABLE produtos ADD COLUMN enrichment_last_attempt_at DATETIME NULL');
  await garantirColuna(pool, 'produtos', 'enrichment_updated_at', 'ALTER TABLE produtos ADD COLUMN enrichment_updated_at DATETIME NULL');
  await garantirColuna(pool, 'produtos', 'enrichment_last_error', 'ALTER TABLE produtos ADD COLUMN enrichment_last_error VARCHAR(255) NULL');
  await garantirColuna(pool, 'produtos', 'ultima_importacao_em', 'ALTER TABLE produtos ADD COLUMN ultima_importacao_em DATETIME NULL');

  await garantirIndice(pool, 'produtos', 'idx_produtos_codigo_barras', 'CREATE INDEX idx_produtos_codigo_barras ON produtos(codigo_barras)');
  await garantirIndice(pool, 'produtos', 'idx_produtos_preco_tabela', 'CREATE INDEX idx_produtos_preco_tabela ON produtos(preco_tabela)');
  await garantirIndice(pool, 'produtos', 'idx_produtos_enrichment_status', 'CREATE INDEX idx_produtos_enrichment_status ON produtos(enrichment_status)');
  await garantirIndice(pool, 'produtos', 'idx_produtos_nome_admin', 'CREATE INDEX idx_produtos_nome_admin ON produtos(nome)');
  await garantirIndice(pool, 'produtos', 'idx_produtos_ultima_importacao_admin', 'CREATE INDEX idx_produtos_ultima_importacao_admin ON produtos(ultima_importacao_em)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABELA_IMPORT_LOGS} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      arquivo_nome VARCHAR(255) NOT NULL,
      total_linhas INT NOT NULL DEFAULT 0,
      linhas_validas INT NOT NULL DEFAULT 0,
      linhas_com_erro INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'concluido',
      resumo LONGTEXT NULL,
      criado_por VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_import_logs_created_at (created_at),
      INDEX idx_product_import_logs_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABELA_ENRICHMENT_LOGS} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NULL,
      barcode VARCHAR(32) NOT NULL,
      provider VARCHAR(80) NULL,
      status VARCHAR(40) NOT NULL,
      mensagem VARCHAR(255) NULL,
      payload_resumido LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_product_enrichment_logs_produto (produto_id),
      INDEX idx_product_enrichment_logs_barcode (barcode),
      INDEX idx_product_enrichment_logs_status (status),
      INDEX idx_product_enrichment_logs_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  schemaReady = true;
}

function montarPaginacao(total, pagina, limite) {
  const totalSeguro = Number.isFinite(total) ? Math.max(0, total) : 0;
  const totalPaginas = totalSeguro > 0 ? Math.ceil(totalSeguro / limite) : 1;
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);

  return {
    pagina: paginaAtual,
    limite,
    total: totalSeguro,
    total_paginas: totalPaginas,
    tem_mais: paginaAtual < totalPaginas
  };
}

function parseEnrichmentStatusFilter(value) {
  const normalized = toLowerTrim(value);
  if (!normalized) {
    return '';
  }

  const mapa = {
    enriched: 'enriquecido',
    enriquecido: 'enriquecido',
    not_found: 'nao_encontrado',
    nao_encontrado: 'nao_encontrado',
    error: 'erro',
    erro: 'erro',
    pending: 'pendente',
    pendente: 'pendente'
  };

  return mapa[normalized] || '';
}

function parseSort(ordenacao, direcao) {
  const sort = toLowerTrim(ordenacao) || 'updated_at';
  const dir = toLowerTrim(direcao) === 'asc' ? 'ASC' : 'DESC';

  const mapa = {
    updated_at: 'atualizado_em',
    created_at: 'criado_em',
    nome: 'nome',
    preco_tabela: 'COALESCE(preco_tabela, preco)',
    codigo_barras: 'codigo_barras',
    enrichment_status: 'enrichment_status'
  };

  return `${mapa[sort] || 'atualizado_em'} ${dir}`;
}

function montarFiltrosProdutos(params = {}) {
  const filtros = ['ativo = TRUE'];
  const sqlParams = [];

  const busca = toLowerTrim(params.search || params.busca);
  if (busca) {
    const termo = `%${escapeLike(busca)}%`;
    filtros.push(`(
      LOWER(COALESCE(nome, '')) LIKE ? ESCAPE '\\\\'
      OR LOWER(COALESCE(descricao, '')) LIKE ? ESCAPE '\\\\'
      OR LOWER(COALESCE(codigo_barras, '')) LIKE ? ESCAPE '\\\\'
    )`);
    sqlParams.push(termo, termo, termo);
  }

  const comImagem = parseBooleanFilter(params.com_imagem ?? params.withImage);
  if (comImagem === true) {
    filtros.push("COALESCE(TRIM(imagem_url), '') <> ''");
  } else if (comImagem === false) {
    filtros.push("COALESCE(TRIM(imagem_url), '') = ''");
  }

  const comErro = parseBooleanFilter(params.com_erro ?? params.withError);
  if (comErro === true) {
    filtros.push("COALESCE(TRIM(enrichment_last_error), '') <> ''");
  } else if (comErro === false) {
    filtros.push("COALESCE(TRIM(enrichment_last_error), '') = ''");
  }

  const comPreco = parseBooleanFilter(params.com_preco ?? params.withPrice);
  if (comPreco === true) {
    filtros.push('COALESCE(preco_tabela, preco, 0) > 0');
  } else if (comPreco === false) {
    filtros.push('COALESCE(preco_tabela, preco, 0) <= 0');
  }

  const enrichmentStatus = parseEnrichmentStatusFilter(params.enrichment_status ?? params.enrichmentStatus);
  if (enrichmentStatus) {
    filtros.push('enrichment_status = ?');
    sqlParams.push(enrichmentStatus);
  }

  return {
    whereSql: filtros.length ? `WHERE ${filtros.join(' AND ')}` : '',
    params: sqlParams
  };
}

async function getAdminProdutosDashboard(pool) {
  await ensureAdminCatalogSchema(pool);

  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS total_produtos,
      SUM(CASE WHEN COALESCE(preco_tabela, preco, 0) > 0 THEN 1 ELSE 0 END) AS produtos_com_preco,
      SUM(CASE WHEN COALESCE(preco_tabela, preco, 0) <= 0 THEN 1 ELSE 0 END) AS produtos_sem_preco,
      SUM(CASE WHEN COALESCE(TRIM(imagem_url), '') <> '' THEN 1 ELSE 0 END) AS produtos_com_imagem,
      SUM(CASE WHEN COALESCE(TRIM(imagem_url), '') = '' THEN 1 ELSE 0 END) AS produtos_sem_imagem,
      SUM(CASE WHEN enrichment_status = 'enriquecido' THEN 1 ELSE 0 END) AS produtos_enriquecidos,
      SUM(CASE WHEN enrichment_status = 'nao_encontrado' THEN 1 ELSE 0 END) AS produtos_nao_encontrados,
      SUM(CASE WHEN enrichment_status = 'erro' OR COALESCE(TRIM(enrichment_last_error), '') <> '' THEN 1 ELSE 0 END) AS produtos_com_erro
    FROM produtos
    WHERE ativo = TRUE
  `);

  const row = rows[0] || {};
  return {
    total_produtos: Number(row.total_produtos || 0),
    produtos_com_preco: Number(row.produtos_com_preco || 0),
    produtos_sem_preco: Number(row.produtos_sem_preco || 0),
    produtos_com_imagem: Number(row.produtos_com_imagem || 0),
    produtos_sem_imagem: Number(row.produtos_sem_imagem || 0),
    produtos_enriquecidos: Number(row.produtos_enriquecidos || 0),
    produtos_nao_encontrados: Number(row.produtos_nao_encontrados || 0),
    produtos_com_erro: Number(row.produtos_com_erro || 0)
  };
}

async function listarProdutosAdmin(pool, filtros = {}) {
  await ensureAdminCatalogSchema(pool);

  const page = parsePositiveInt(filtros.page || filtros.pagina, 1, { min: 1, max: 500000 });
  const limit = parsePositiveInt(filtros.limit || filtros.limite, 60, { min: 1, max: 200 });
  const orderSql = parseSort(filtros.orderBy || filtros.ordenacao, filtros.orderDir || filtros.direcao);
  const { whereSql, params } = montarFiltrosProdutos(filtros);

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM produtos ${whereSql}`,
    params
  );

  const total = Number(countRow?.total || 0);
  const paginacao = montarPaginacao(total, page, limit);
  const offset = (paginacao.pagina - 1) * paginacao.limite;

  const [rows] = await pool.query(
    `SELECT
      id,
      COALESCE(codigo_barras, '') AS codigo_barras,
      COALESCE(nome, '') AS nome,
      COALESCE(descricao, '') AS descricao,
      COALESCE(preco_tabela, preco, 0) AS preco_tabela,
      COALESCE(imagem_url, '') AS imagem_url,
      COALESCE(enrichment_status, 'pendente') AS enrichment_status,
      COALESCE(enrichment_provider, '') AS enrichment_provider,
      enrichment_last_attempt_at,
      enrichment_updated_at,
      COALESCE(enrichment_last_error, '') AS enrichment_last_error,
      criado_em AS created_at,
      atualizado_em AS updated_at
     FROM produtos
     ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?`,
    [...params, paginacao.limite, offset]
  );

  return {
    produtos: rows,
    paginacao
  };
}

async function atualizarProdutoAdmin(pool, produtoId, dados = {}) {
  await ensureAdminCatalogSchema(pool);

  const id = parsePositiveInt(produtoId, 0, { min: 1, max: 2147483647 });
  if (!id) {
    throw new Error('Produto invalido para atualizacao.');
  }

  const updates = [];
  const params = [];

  if (dados.nome !== undefined) {
    updates.push('nome = ?');
    params.push(normalizarTexto(dados.nome).slice(0, 255));
  }

  if (dados.descricao !== undefined) {
    updates.push('descricao = ?');
    params.push(normalizarTexto(dados.descricao).slice(0, 1200) || null);
  }

  if (dados.codigo_barras !== undefined || dados.barcode !== undefined) {
    const barcode = String(dados.codigo_barras ?? dados.barcode ?? '').replace(/\D/g, '').slice(0, 32);
    updates.push('codigo_barras = ?');
    params.push(barcode || null);
  }

  if (dados.imagem_url !== undefined || dados.imagem !== undefined) {
    updates.push('imagem_url = ?');
    params.push(normalizarTexto(dados.imagem_url ?? dados.imagem) || null);
  }

  if (dados.preco_tabela !== undefined || dados.preco !== undefined) {
    const preco = parseDecimal(dados.preco_tabela ?? dados.preco);
    if (!Number.isFinite(preco) || preco < 0) {
      throw new Error('Preco de tabela invalido.');
    }

    updates.push('preco_tabela = ?');
    updates.push('preco = ?');
    params.push(preco, preco);
  }

  if (!updates.length) {
    throw new Error('Nenhum campo valido informado para atualizacao.');
  }

  params.push(id);
  const [updateResult] = await pool.query(
    `UPDATE produtos SET ${updates.join(', ')}, atualizado_em = NOW() WHERE id = ?`,
    params
  );

  if (Number(updateResult?.affectedRows || 0) <= 0) {
    throw new Error('Produto nao encontrado para atualizacao.');
  }

  const [rows] = await pool.query(
    `SELECT
      id,
      COALESCE(codigo_barras, '') AS codigo_barras,
      COALESCE(nome, '') AS nome,
      COALESCE(descricao, '') AS descricao,
      COALESCE(preco_tabela, preco, 0) AS preco_tabela,
      COALESCE(imagem_url, '') AS imagem_url,
      COALESCE(enrichment_status, 'pendente') AS enrichment_status,
      COALESCE(enrichment_provider, '') AS enrichment_provider,
      enrichment_last_attempt_at,
      enrichment_updated_at,
      COALESCE(enrichment_last_error, '') AS enrichment_last_error,
      criado_em AS created_at,
      atualizado_em AS updated_at
     FROM produtos
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function registrarProductImportLog(pool, payload = {}) {
  await ensureAdminCatalogSchema(pool);

  const resumo = toJsonStringSafe(payload.resumo || {});

  await pool.query(
    `INSERT INTO ${TABELA_IMPORT_LOGS}
      (arquivo_nome, total_linhas, linhas_validas, linhas_com_erro, status, resumo, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizarTexto(payload.arquivo_nome || payload.nomeArquivo || 'importacao_sem_nome.csv').slice(0, 255),
      Number(payload.total_linhas || 0),
      Number(payload.linhas_validas || payload.total_validos || 0),
      Number(payload.linhas_com_erro || payload.total_erros || 0),
      normalizarTexto(payload.status || 'concluido').slice(0, 40) || 'concluido',
      resumo,
      normalizarTexto(payload.criado_por || payload.usuario || 'admin').slice(0, 120) || null
    ]
  );
}

async function listarImportLogs(pool, query = {}) {
  await ensureAdminCatalogSchema(pool);

  const page = parsePositiveInt(query.page || query.pagina, 1, { min: 1, max: 500000 });
  const limit = parsePositiveInt(query.limit || query.limite, 20, { min: 1, max: 100 });
  const offset = (page - 1) * limit;

  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM ${TABELA_IMPORT_LOGS}`);
  const total = Number(countRow?.total || 0);
  const paginacao = montarPaginacao(total, page, limit);

  const [rows] = await pool.query(
    `SELECT id, arquivo_nome, total_linhas, linhas_validas, linhas_com_erro, status, resumo, criado_por, created_at
       FROM ${TABELA_IMPORT_LOGS}
      ORDER BY id DESC
      LIMIT ? OFFSET ?`,
    [paginacao.limite, offset]
  );

  return {
    logs: rows.map((row) => {
      let resumo = null;
      try {
        resumo = row.resumo ? JSON.parse(row.resumo) : null;
      } catch {
        resumo = null;
      }

      return {
        id: row.id,
        arquivo_nome: row.arquivo_nome,
        total_linhas: Number(row.total_linhas || 0),
        linhas_validas: Number(row.linhas_validas || 0),
        linhas_com_erro: Number(row.linhas_com_erro || 0),
        status: row.status,
        resumo,
        criado_por: row.criado_por,
        created_at: row.created_at
      };
    }),
    paginacao
  };
}

async function registrarEnrichmentLog(pool, payload = {}) {
  await ensureAdminCatalogSchema(pool);

  await pool.query(
    `INSERT INTO ${TABELA_ENRICHMENT_LOGS}
      (produto_id, barcode, provider, status, mensagem, payload_resumido)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.produto_id ?? null,
      String(payload.barcode || '').replace(/\D/g, '').slice(0, 32),
      normalizarTexto(payload.provider).slice(0, 80) || null,
      normalizarTexto(payload.status || 'pendente').slice(0, 40) || 'pendente',
      normalizarTexto(payload.mensagem).slice(0, 255) || null,
      toJsonStringSafe(payload.payload_resumido || {})
    ]
  );
}

async function registrarEnrichmentLogSafe(pool, payload = {}) {
  try {
    await registrarEnrichmentLog(pool, payload);
  } catch (error) {
    console.error('Falha ao registrar log de enriquecimento:', error);
  }
}

async function listarEnrichmentLogs(pool, query = {}) {
  await ensureAdminCatalogSchema(pool);

  const page = parsePositiveInt(query.page || query.pagina, 1, { min: 1, max: 500000 });
  const limit = parsePositiveInt(query.limit || query.limite, 30, { min: 1, max: 100 });
  const offset = (page - 1) * limit;

  const filtros = [];
  const params = [];

  const status = normalizarTexto(query.status).toLowerCase();
  if (status) {
    filtros.push('status = ?');
    params.push(status);
  }

  const provider = normalizarTexto(query.provider).toLowerCase();
  if (provider) {
    filtros.push('provider = ?');
    params.push(provider);
  }

  const barcode = String(query.barcode || '').replace(/\D/g, '').slice(0, 32);
  if (barcode) {
    filtros.push('barcode = ?');
    params.push(barcode);
  }

  const whereSql = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABELA_ENRICHMENT_LOGS} ${whereSql}`,
    params
  );

  const total = Number(countRow?.total || 0);
  const paginacao = montarPaginacao(total, page, limit);

  const [rows] = await pool.query(
    `SELECT id, produto_id, barcode, provider, status, mensagem, payload_resumido, created_at
       FROM ${TABELA_ENRICHMENT_LOGS}
       ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?`,
    [...params, paginacao.limite, offset]
  );

  return {
    logs: rows.map((row) => {
      let payload = null;
      try {
        payload = row.payload_resumido ? JSON.parse(row.payload_resumido) : null;
      } catch {
        payload = null;
      }

      return {
        id: row.id,
        produto_id: row.produto_id,
        barcode: row.barcode,
        provider: row.provider,
        status: row.status,
        mensagem: row.mensagem,
        payload_resumido: payload,
        created_at: row.created_at
      };
    }),
    paginacao
  };
}

async function enriquecerProdutoPorId(pool, barcodeLookupService, produtoId, options = {}) {
  await ensureAdminCatalogSchema(pool);

  const id = parsePositiveInt(produtoId, 0, { min: 1, max: 2147483647 });
  if (!id) {
    throw new Error('Produto invalido para enriquecimento.');
  }

  const [rows] = await pool.query(
    `SELECT
      id,
      COALESCE(nome, '') AS nome,
      COALESCE(descricao, '') AS descricao,
      COALESCE(imagem_url, '') AS imagem_url,
      COALESCE(codigo_barras, '') AS codigo_barras
     FROM produtos
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  const produto = rows[0];
  if (!produto) {
    throw new Error('Produto nao encontrado para enriquecimento.');
  }

  const preferSpreadsheet = options.preferSpreadsheet !== false;
  const overwriteImageMode = parseOverwriteImageMode(options.overwriteImageMode, 'if_empty');
  const barcode = String(produto.codigo_barras || '').replace(/\D/g, '').slice(0, 32);
  if (!barcode) {
    const mensagemSemBarcode = 'Produto sem codigo de barras para enriquecimento.';

    await pool.query(
      `UPDATE produtos
          SET enrichment_status = 'erro',
              enrichment_provider = NULL,
              enrichment_last_attempt_at = NOW(),
              enrichment_last_error = ?
        WHERE id = ?`,
      [mensagemSemBarcode, id]
    );

    await registrarEnrichmentLogSafe(pool, {
      produto_id: id,
      barcode: '',
      provider: null,
      status: 'erro',
      mensagem: mensagemSemBarcode,
      payload_resumido: {
        motivo: 'missing-barcode',
        status_operacional: 'sem_codigo_barras',
        overwrite_image_mode: overwriteImageMode,
        prefer_spreadsheet: preferSpreadsheet
      }
    });

    return {
      produto_id: id,
      barcode: '',
      status: 'erro',
      status_operacional: 'sem_codigo_barras',
      mensagem: mensagemSemBarcode,
      overwrite_image_mode: overwriteImageMode,
      atualizado: false
    };
  }

  const lookup = await barcodeLookupService.lookup(barcode, {
    force: Boolean(options.force)
  });

  let status = 'nao_encontrado';
  let provider = lookup?.provider || null;
  let mensagem = lookup?.message || null;
  let atualizado = false;
  let statusOperacional = 'nao_encontrado';
  let imagemAtualizada = false;
  let imagemPreservada = false;

  if (lookup?.status === 'found' && lookup?.product) {
    const nomeAtual = normalizarTexto(produto.nome);
    const descricaoAtual = normalizarTexto(produto.descricao);
    const imagemAtual = normalizarTexto(produto.imagem_url);

    const nomeNovo = normalizarTexto(lookup.product.nome);
    const descricaoNova = normalizarTexto(lookup.product.descricao);
    const imagemNova = normalizarTexto(lookup.product.imagem);

    const nomeAplicado = preferSpreadsheet ? (nomeAtual || nomeNovo) : (nomeNovo || nomeAtual);
    const descricaoAplicada = preferSpreadsheet ? (descricaoAtual || descricaoNova) : (descricaoNova || descricaoAtual);

    let imagemAplicada = imagemAtual;
    if (imagemNova) {
      if (overwriteImageMode === 'always') {
        imagemAplicada = imagemNova;
        imagemAtualizada = imagemAplicada !== imagemAtual;
      } else if (overwriteImageMode === 'if_empty') {
        if (!imagemAtual) {
          imagemAplicada = imagemNova;
          imagemAtualizada = true;
        } else {
          imagemPreservada = true;
        }
      } else {
        imagemPreservada = Boolean(imagemAtual);
      }
    }

    const nomeFinal = nomeAplicado || produto.nome;
    const descricaoFinal = descricaoAplicada || produto.descricao;
    const imagemFinal = imagemAplicada || produto.imagem_url || null;

    const nomeAlterado = normalizarTexto(nomeFinal) !== nomeAtual;
    const descricaoAlterada = normalizarTexto(descricaoFinal) !== descricaoAtual;
    const houveAtualizacaoCampos = Boolean(nomeAlterado || descricaoAlterada || imagemAtualizada);

    await pool.query(
      `UPDATE produtos
          SET nome = ?,
              descricao = ?,
              imagem_url = ?,
              enrichment_status = 'enriquecido',
              enrichment_provider = ?,
              enrichment_last_attempt_at = NOW(),
              enrichment_updated_at = CASE WHEN ? = 1 THEN NOW() ELSE enrichment_updated_at END,
              enrichment_last_error = NULL,
              atualizado_em = CASE WHEN ? = 1 THEN NOW() ELSE atualizado_em END
        WHERE id = ?`,
      [
        nomeFinal,
        descricaoFinal,
        imagemFinal,
        provider,
        houveAtualizacaoCampos ? 1 : 0,
        houveAtualizacaoCampos ? 1 : 0,
        id
      ]
    );

    atualizado = houveAtualizacaoCampos;
    status = 'enriquecido';
    if (imagemAtualizada) {
      statusOperacional = 'enriquecido_imagem';
      mensagem = 'Imagem enriquecida com sucesso.';
    } else if (!imagemNova) {
      statusOperacional = 'enriquecido_sem_imagem_provider';
      mensagem = 'Produto encontrado, mas sem imagem valida no provider.';
    } else if (imagemPreservada) {
      statusOperacional = 'imagem_preservada';
      mensagem = 'Imagem externa encontrada, preservando imagem existente conforme politica.';
    } else if (houveAtualizacaoCampos) {
      statusOperacional = 'enriquecido_dados';
      mensagem = 'Dados enriquecidos com sucesso.';
    } else {
      statusOperacional = 'sem_alteracao';
      mensagem = 'Consulta concluida sem alteracoes necessarias.';
    }
  } else if (lookup?.status === 'error' || lookup?.status === 'invalid_barcode' || lookup?.status === 'missing_barcode') {
    status = 'erro';
    if (lookup?.status === 'invalid_barcode') {
      statusOperacional = 'barcode_invalido';
      mensagem = mensagem || 'Codigo de barras invalido para consulta externa.';
    } else if (lookup?.status === 'missing_barcode') {
      statusOperacional = 'sem_codigo_barras';
      mensagem = mensagem || 'Codigo de barras ausente para consulta externa.';
    } else {
      statusOperacional = 'erro_provider';
      mensagem = mensagem || 'Falha ao consultar catalogo externo.';
    }

    await pool.query(
      `UPDATE produtos
          SET enrichment_status = 'erro',
              enrichment_provider = ?,
              enrichment_last_attempt_at = NOW(),
              enrichment_last_error = ?
        WHERE id = ?`,
      [provider, mensagem, id]
    );
  } else {
    status = 'nao_encontrado';
    statusOperacional = 'nao_encontrado';
    mensagem = mensagem || 'Produto nao encontrado nas APIs externas configuradas.';

    await pool.query(
      `UPDATE produtos
          SET enrichment_status = 'nao_encontrado',
              enrichment_provider = ?,
              enrichment_last_attempt_at = NOW(),
              enrichment_last_error = ?
        WHERE id = ?`,
      [provider, mensagem, id]
    );
  }

  await registrarEnrichmentLogSafe(pool, {
    produto_id: id,
    barcode,
    provider,
    status,
    mensagem,
    payload_resumido: {
      lookup,
      status_operacional: statusOperacional,
      prefer_spreadsheet: preferSpreadsheet,
      overwrite_image_mode: overwriteImageMode,
      imagem_atualizada: imagemAtualizada,
      imagem_preservada: imagemPreservada
    }
  });

  return {
    produto_id: id,
    barcode,
    status,
    status_operacional: statusOperacional,
    provider,
    mensagem,
    atualizado,
    imagem_atualizada: imagemAtualizada,
    imagem_preservada: imagemPreservada,
    overwrite_image_mode: overwriteImageMode,
    lookup
  };
}

function incrementarContador(obj, chave) {
  const key = normalizarTexto(chave || 'indefinido').toLowerCase() || 'indefinido';
  obj[key] = Number(obj[key] || 0) + 1;
}

function construirResumoBatchEnriquecimento(resultados = []) {
  const resumoOperacional = {};

  for (const item of resultados) {
    incrementarContador(resumoOperacional, item?.status_operacional || item?.status || 'indefinido');
  }

  return {
    total_processados: resultados.length,
    total_enriquecidos: resultados.filter((item) => item.status === 'enriquecido').length,
    total_nao_encontrados: resultados.filter((item) => item.status === 'nao_encontrado').length,
    total_erros: resultados.filter((item) => item.status === 'erro').length,
    total_atualizados: resultados.filter((item) => Boolean(item.atualizado)).length,
    total_imagem_atualizada: resultados.filter((item) => Boolean(item.imagem_atualizada)).length,
    total_imagem_preservada: resultados.filter((item) => Boolean(item.imagem_preservada)).length,
    status_operacional: resumoOperacional
  };
}

async function processarBatchEnriquecimentoPorIds(pool, barcodeLookupService, produtoIds = [], options = {}) {
  const fila = Array.isArray(produtoIds)
    ? produtoIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (!fila.length) {
    return {
      resumo: construirResumoBatchEnriquecimento([]),
      itens: []
    };
  }

  const concurrency = parsePositiveInt(options.concurrency, 3, { min: 1, max: 10 });
  const resultados = [];

  async function worker() {
    while (fila.length > 0) {
      const id = fila.shift();
      if (!id) {
        continue;
      }

      try {
        const resultado = await enriquecerProdutoPorId(pool, barcodeLookupService, id, {
          force: Boolean(options.force),
          preferSpreadsheet: options.preferSpreadsheet !== false,
          overwriteImageMode: options.overwriteImageMode
        });
        resultados.push(resultado);
      } catch (error) {
        resultados.push({
          produto_id: id,
          status: 'erro',
          status_operacional: 'erro_execucao',
          mensagem: error?.message || 'Falha no processamento do lote.',
          atualizado: false,
          imagem_atualizada: false,
          imagem_preservada: false
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, fila.length) }, () => worker());
  await Promise.all(workers);

  return {
    resumo: construirResumoBatchEnriquecimento(resultados),
    itens: resultados
  };
}

async function reprocessarFalhasEnriquecimento(pool, barcodeLookupService, options = {}) {
  await ensureAdminCatalogSchema(pool);

  const limit = parsePositiveInt(options.limit, 30, { min: 1, max: 200 });
  const concurrency = parsePositiveInt(options.concurrency, 3, { min: 1, max: 10 });

  const [rows] = await pool.query(
    `SELECT id
       FROM produtos
      WHERE ativo = TRUE
        AND COALESCE(codigo_barras, '') <> ''
        AND (enrichment_status IN ('erro', 'nao_encontrado') OR COALESCE(TRIM(enrichment_last_error), '') <> '')
      ORDER BY enrichment_last_attempt_at ASC, id ASC
      LIMIT ?`,
    [limit]
  );

  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const resultadoLote = await processarBatchEnriquecimentoPorIds(pool, barcodeLookupService, ids, {
    force: true,
    preferSpreadsheet: true,
    overwriteImageMode: parseOverwriteImageMode(options.overwriteImageMode, 'if_empty'),
    concurrency
  });

  return {
    resumo: {
      ...resultadoLote.resumo,
      total_selecionados: ids.length,
      escopo: 'falhas'
    },
    itens: resultadoLote.itens
  };
}

async function enriquecerProdutosSemImagem(pool, barcodeLookupService, options = {}) {
  await ensureAdminCatalogSchema(pool);

  const limit = parsePositiveInt(options.limit, 80, { min: 1, max: 500 });
  const concurrency = parsePositiveInt(options.concurrency, 3, { min: 1, max: 10 });

  const [rows] = await pool.query(
    `SELECT id
       FROM produtos
      WHERE ativo = TRUE
        AND COALESCE(codigo_barras, '') <> ''
        AND COALESCE(TRIM(imagem_url), '') = ''
      ORDER BY COALESCE(enrichment_last_attempt_at, '1970-01-01 00:00:00') ASC, id ASC
      LIMIT ?`,
    [limit]
  );

  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const resultadoLote = await processarBatchEnriquecimentoPorIds(pool, barcodeLookupService, ids, {
    force: Boolean(options.force),
    preferSpreadsheet: options.preferSpreadsheet !== false,
    overwriteImageMode: parseOverwriteImageMode(options.overwriteImageMode, 'if_empty'),
    concurrency
  });

  return {
    resumo: {
      ...resultadoLote.resumo,
      total_selecionados: ids.length,
      escopo: 'sem_imagem'
    },
    itens: resultadoLote.itens
  };
}

async function enriquecerProdutosImportacaoRecente(pool, barcodeLookupService, options = {}) {
  await ensureAdminCatalogSchema(pool);

  const limit = parsePositiveInt(options.limit, 120, { min: 1, max: 800 });
  const concurrency = parsePositiveInt(options.concurrency, 3, { min: 1, max: 10 });
  const somenteSemImagem = options.somenteSemImagem !== false;
  const windowMinutes = parsePositiveInt(options.windowMinutes ?? options.janelaMinutos, 180, {
    min: 5,
    max: 43200
  });

  let dataCorte = options.sinceDate instanceof Date ? options.sinceDate : null;
  if (!(dataCorte instanceof Date) || Number.isNaN(dataCorte.getTime())) {
    dataCorte = new Date(Date.now() - (windowMinutes * 60 * 1000));
  }

  const where = [
    'ativo = TRUE',
    "COALESCE(codigo_barras, '') <> ''",
    'ultima_importacao_em IS NOT NULL',
    'ultima_importacao_em >= ?'
  ];
  const params = [dataCorte];

  if (somenteSemImagem) {
    where.push("COALESCE(TRIM(imagem_url), '') = ''");
  }

  const [rows] = await pool.query(
    `SELECT id
       FROM produtos
      WHERE ${where.join(' AND ')}
      ORDER BY ultima_importacao_em DESC, id DESC
      LIMIT ?`,
    [...params, limit]
  );

  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const resultadoLote = await processarBatchEnriquecimentoPorIds(pool, barcodeLookupService, ids, {
    force: Boolean(options.force),
    preferSpreadsheet: options.preferSpreadsheet !== false,
    overwriteImageMode: parseOverwriteImageMode(options.overwriteImageMode, 'if_empty'),
    concurrency
  });

  return {
    resumo: {
      ...resultadoLote.resumo,
      total_selecionados: ids.length,
      escopo: 'importacao_recente',
      somente_sem_imagem: somenteSemImagem,
      janela_minutos: windowMinutes,
      data_corte: dataCorte.toISOString()
    },
    itens: resultadoLote.itens
  };
}

async function exportarProdutosParaExcel(pool, filtros = {}) {
  await ensureAdminCatalogSchema(pool);

  const { whereSql, params } = montarFiltrosProdutos(filtros);
  const orderSql = parseSort(filtros.orderBy || 'updated_at', filtros.orderDir || 'desc');

  const [rows] = await pool.query(
    `SELECT
      COALESCE(codigo_barras, '') AS codigo_barras,
      COALESCE(nome, '') AS nome,
      COALESCE(descricao, '') AS descricao,
      COALESCE(preco_tabela, preco, 0) AS preco_tabela,
      COALESCE(imagem_url, '') AS imagem_url,
      COALESCE(enrichment_status, 'pendente') AS enrichment_status,
      atualizado_em AS updated_at,
      enrichment_last_attempt_at
     FROM produtos
     ${whereSql}
     ORDER BY ${orderSql}`,
    params
  );

  const linhas = rows.map((row) => ({
    codigo_barras: row.codigo_barras,
    nome: row.nome,
    descricao: row.descricao,
    preco_tabela: Number(row.preco_tabela || 0),
    imagem_url: row.imagem_url,
    enrichment_status: row.enrichment_status,
    ultima_atualizacao: row.updated_at ? new Date(row.updated_at).toISOString() : '',
    ultima_tentativa_enriquecimento: row.enrichment_last_attempt_at
      ? new Date(row.enrichment_last_attempt_at).toISOString()
      : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  const date = new Date();
  const fileName = `produtos_admin_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.xlsx`;

  return {
    buffer,
    fileName
  };
}

module.exports = {
  ensureAdminCatalogSchema,
  getAdminProdutosDashboard,
  listarProdutosAdmin,
  atualizarProdutoAdmin,
  enriquecerProdutoPorId,
  reprocessarFalhasEnriquecimento,
  enriquecerProdutosSemImagem,
  enriquecerProdutosImportacaoRecente,
  registrarEnrichmentLog,
  listarEnrichmentLogs,
  registrarProductImportLog,
  listarImportLogs,
  exportarProdutosParaExcel
};
