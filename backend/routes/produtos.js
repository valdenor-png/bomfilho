'use strict';

const express = require('express');
const { queryWithRetry } = require('../lib/db');
const logger = require('../lib/logger');
const { DB_DIALECT, IS_PRODUCTION } = require('../lib/config');
const {
  enriquecerProdutoParaCatalogo,
  resolveVisibilidadePublica
} = require('../lib/produtoCatalogoRules');

const CERVEJA_MATCHERS = [
  'cerveja',
  'heineken',
  'brahma',
  'skol',
  'itaipava',
  'antarctica',
  'budweiser',
  'stella',
  'corona',
  'amstel',
  'chopp',
  'puro malte',
  'long neck',
  'longneck',
  'pilsen',
  'lager'
];

const BEBIDAS_ALCOOLICAS_MATCHERS = [
  'cerveja',
  'chopp',
  'pilsen',
  'lager',
  'ipa',
  'stout',
  'heineken',
  'brahma',
  'skol',
  'budweiser',
  'vinho',
  'espumante',
  'whisky',
  'vodka',
  'gin',
  'rum',
  'tequila',
  'licor',
  'conhaque',
  'cachaca',
  'cachaca',
  'aperitivo',
  'vermouth',
  'vermute',
  'campari',
  'sidra',
  'cooler',
  'ice'
];

const CATEGORIA_EQUIVALENCIAS = {
  bebidas: ['bebidas', 'agua', 'refrigerantes'],
  'bebidas-alcoolicas': ['bebidas'],
  frios: ['frios', 'frios e laticinios', 'derivados_lacteos', 'leites_fermentados'],
  mercearia: ['mercearia', 'alimentos basicos', 'outros'],
  limpeza: ['limpeza', 'higiene e perfumaria'],
  descartaveis: ['descartaveis', 'bazar e utilidades'],
  hortifruti: ['hortifruti'],
  acougue: ['acougue', 'acougue e aves', 'carnes']
};
const LIKE_ESCAPE_SQL = DB_DIALECT === 'postgres' ? " ESCAPE E'\\\\'" : " ESCAPE '\\\\'";
const SQL_PARAM_LOG_MAX_LENGTH = 180;

function sanitizeParamsForLog(params = []) {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.map((param) => {
    if (param === null || param === undefined) {
      return param;
    }

    if (typeof param === 'number' || typeof param === 'boolean') {
      return param;
    }

    if (typeof param === 'string') {
      const texto = param.replace(/\s+/g, ' ').trim();
      if (texto.length <= SQL_PARAM_LOG_MAX_LENGTH) {
        return texto;
      }
      return `${texto.slice(0, SQL_PARAM_LOG_MAX_LENGTH)}...`;
    }

    return String(param);
  });
}

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBooleanQuery(value) {
  const normalizado = String(value || '').trim().toLowerCase();
  return normalizado === '1' || normalizado === 'true' || normalizado === 'yes';
}

function buildProdutoTextoBuscaExpr(colunas, alias = '') {
  const prefixo = alias ? `${alias}.` : '';
  const partes = [`COALESCE(${prefixo}nome, '')`];

  if (colunas.has('nome_externo')) {
    partes.push(`COALESCE(${prefixo}nome_externo, '')`);
  }

  if (colunas.has('descricao')) {
    partes.push(`COALESCE(${prefixo}descricao, '')`);
  }

  if (colunas.has('marca')) {
    partes.push(`COALESCE(${prefixo}marca, '')`);
  }

  return `LOWER(CONCAT(${partes.join(", ' ', ")}))`;
}

function buildProdutoTextoTokenExpr(colunas, alias = '') {
  const textoExpr = buildProdutoTextoBuscaExpr(colunas, alias);
  return `CONCAT(' ', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${textoExpr}, '-', ' '), '/', ' '), '.', ' '), ',', ' '), ';', ' '), ':', ' '), ' ')`;
}

function isMatcherCurtoComRiscoColisao(matcher) {
  const token = String(matcher || '').trim().toLowerCase();
  return token.length > 0 && token.length <= 3;
}

function buildCategoriaExpr(colunas, alias = '') {
  const prefixo = alias ? `${alias}.` : '';
  if (colunas.has('departamento')) {
    return `LOWER(COALESCE(NULLIF(TRIM(${prefixo}departamento), ''), ${prefixo}categoria, ''))`;
  }

  return `LOWER(COALESCE(${prefixo}categoria, ''))`;
}

function montarFiltrosCatalogoPublicoSql(colunas, alias = '') {
  const prefixo = alias ? `${alias}.` : '';
  const filtros = [];

  if (colunas.has('visivel_no_site')) {
    filtros.push(`COALESCE(${prefixo}visivel_no_site, TRUE) = TRUE`);
  }

  if (colunas.has('oculto_catalogo')) {
    filtros.push(`COALESCE(${prefixo}oculto_catalogo, FALSE) = FALSE`);
  }

  if (colunas.has('produto_controlado')) {
    filtros.push(`LOWER(COALESCE(${prefixo}produto_controlado, '')) <> 'tabaco'`);
  }

  if (colunas.has('estoque')) {
    filtros.push(`COALESCE(${prefixo}estoque, 0) > 0`);
  }

  const categoriaExpr = buildCategoriaExpr(colunas, alias);
  const textoProdutoExpr = buildProdutoTextoBuscaExpr(colunas, alias);
  filtros.push(
    `NOT (
      ${categoriaExpr} LIKE '%tabaco%'
      OR ${categoriaExpr} LIKE '%cigar%'
      OR ${textoProdutoExpr} LIKE '%tabaco%'
      OR ${textoProdutoExpr} LIKE '%cigar%'
    )`
  );

  return filtros;
}

/**
 * @param {object} deps
 * @param {Function} deps.obterColunasProdutos
 * @param {Function} deps.toLowerTrim
 * @param {Function} deps.parsePositiveInt
 * @param {Function} deps.escapeLike
 * @param {Function} deps.montarPaginacao
 * @param {Function} deps.montarChaveCacheProdutos
 * @param {Function} deps.obterCacheProdutos
 * @param {Function} deps.salvarCacheProdutos
 * @param {Function} deps.obterCacheLeitura
 * @param {Function} deps.salvarCacheLeitura
 */
module.exports = function createProdutosPublicRoutes({
  obterColunasProdutos,
  toLowerTrim,
  parsePositiveInt,
  escapeLike,
  montarPaginacao,
  montarChaveCacheProdutos,
  obterCacheProdutos,
  salvarCacheProdutos,
  obterCacheLeitura,
  salvarCacheLeitura
}) {
  const router = express.Router();
  let escalaPrecoVitrineCache = 1;
  let escalaPrecoVitrineCacheExpiraEm = 0;
  const ESCALA_PRECO_CACHE_TTL_MS = 30 * 60 * 1000;

  function possuiTaxonomiaEstruturada(colunas) {
    return colunas.has('categoria_principal_id') && colunas.has('subcategoria_id');
  }

  function montarExprPrecoSql(exprBase, escala, alias) {
    if (Number(escala || 1) > 1) {
      return `ROUND((${exprBase}) / ${Number(escala)}, 2) AS ${alias}`;
    }
    return `${exprBase} AS ${alias}`;
  }

  async function obterEscalaPrecoVitrine() {
    const agora = Date.now();
    if (agora < escalaPrecoVitrineCacheExpiraEm) {
      return escalaPrecoVitrineCache;
    }

    try {
      const [[stats]] = await queryWithRetry(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN preco >= 100 THEN 1 ELSE 0 END) AS ge_100,
           SUM(CASE WHEN ABS(preco - ROUND(preco)) <= 0.0001 THEN 1 ELSE 0 END) AS inteiros,
           AVG(preco) AS avg_preco
         FROM produtos
         WHERE ativo = TRUE`
      );

      const total = Number(stats?.total || 0);
      const ge100 = Number(stats?.ge_100 || 0);
      const inteiros = Number(stats?.inteiros || 0);
      const avgPreco = Number(stats?.avg_preco || 0);
      const ratioGe100 = total > 0 ? (ge100 / total) : 0;
      const ratioInteiros = total > 0 ? (inteiros / total) : 0;
      const datasetComCaraDeCentavos = (
        total >= 100
        && avgPreco >= 200
        && ratioGe100 >= 0.9
        && ratioInteiros >= 0.95
      );

      escalaPrecoVitrineCache = datasetComCaraDeCentavos ? 100 : 1;
    } catch (erroEscala) {
      logger.warn('Falha ao detectar escala de preco da vitrine. Mantendo escala padrao.', {
        code: erroEscala?.code,
        message: erroEscala?.message
      });
      escalaPrecoVitrineCache = 1;
    } finally {
      escalaPrecoVitrineCacheExpiraEm = agora + ESCALA_PRECO_CACHE_TTL_MS;
    }

    return escalaPrecoVitrineCache;
  }

  async function obterCategoriasEstruturadasComFallback() {
    const colunas = await obterColunasProdutos();
    const filtrosPublicos = montarFiltrosCatalogoPublicoSql(colunas, 'p');
    const filtrosJoinSql = filtrosPublicos.length ? ` AND ${filtrosPublicos.join(' AND ')}` : '';

    const [rowsCategorias] = await queryWithRetry(
      `SELECT
         c.id,
         c.nome,
         c.slug,
         c.ordem_exibicao,
         c.ativo,
         c.icone_url,
         c.imagem_url,
         COUNT(p.id) AS total_produtos,
         COUNT(CASE WHEN p.subcategoria_id IS NULL THEN 1 END) AS total_sem_subcategoria
       FROM catalogo_categorias c
       LEFT JOIN produtos p
         ON p.categoria_principal_id = c.id
        AND p.ativo = TRUE
        ${filtrosJoinSql}
       WHERE c.ativo = TRUE
       GROUP BY c.id, c.nome, c.slug, c.ordem_exibicao, c.ativo, c.icone_url, c.imagem_url
       ORDER BY c.ordem_exibicao ASC, c.nome ASC`
    );

    const [rowsSubcategorias] = await queryWithRetry(
      `SELECT
         s.id,
         s.categoria_id,
         s.nome,
         s.slug,
         s.ordem_exibicao,
         s.ativo,
         s.icone_url,
         s.imagem_url,
         COUNT(p.id) AS total_produtos
       FROM catalogo_subcategorias s
       LEFT JOIN produtos p
         ON p.subcategoria_id = s.id
        AND p.ativo = TRUE
        ${filtrosJoinSql}
       WHERE s.ativo = TRUE
       GROUP BY s.id, s.categoria_id, s.nome, s.slug, s.ordem_exibicao, s.ativo, s.icone_url, s.imagem_url
       ORDER BY s.ordem_exibicao ASC, s.nome ASC`
    );

    const subcategoriasByCategoria = new Map();
    rowsSubcategorias.forEach((row) => {
      const categoriaId = Number(row?.categoria_id || 0);
      if (!categoriaId) {
        return;
      }

      if (!subcategoriasByCategoria.has(categoriaId)) {
        subcategoriasByCategoria.set(categoriaId, []);
      }

      subcategoriasByCategoria.get(categoriaId).push({
        id: Number(row?.id || 0),
        nome: String(row?.nome || '').trim(),
        slug: String(row?.slug || '').trim(),
        ordem_exibicao: Number(row?.ordem_exibicao || 0),
        ativo: Boolean(row?.ativo),
        icone_url: row?.icone_url || null,
        imagem_url: row?.imagem_url || null,
        total_produtos: Number(row?.total_produtos || 0)
      });
    });

    return rowsCategorias.map((row) => {
      const categoriaId = Number(row?.id || 0);
      return {
        id: categoriaId,
        nome: String(row?.nome || '').trim(),
        slug: String(row?.slug || '').trim(),
        ordem_exibicao: Number(row?.ordem_exibicao || 0),
        ativo: Boolean(row?.ativo),
        icone_url: row?.icone_url || null,
        imagem_url: row?.imagem_url || null,
        total_produtos: Number(row?.total_produtos || 0),
        total_sem_subcategoria: Number(row?.total_sem_subcategoria || 0),
        subcategorias: subcategoriasByCategoria.get(categoriaId) || []
      };
    });
  }

  /**
   * @swagger
   * /api/produtos:
   *   get:
   *     summary: Listar produtos ativos do catálogo
   *     tags: [Produtos]
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Termo de busca por nome do produto
   *       - in: query
   *         name: categoria
   *         schema:
   *           type: string
   *         description: Filtrar por slug da categoria
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Itens por página
   *     responses:
   *       200:
   *         description: Lista paginada de produtos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 produtos:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                       nome:
   *                         type: string
   *                       preco:
   *                         type: number
   *                       categoria:
   *                         type: string
   *                       imagem_url:
   *                         type: string
   *                 paginacao:
   *                   type: object
   *                   properties:
   *                     pagina:
   *                       type: integer
   *                     totalPaginas:
   *                       type: integer
   *                     totalItens:
   *                       type: integer
   *       400:
   *         description: Parâmetros inválidos
   */
  // Listar todos os produtos ativos
  router.get('/api/produtos', async (req, res) => {
    const requestId = String(req.requestId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    const inicioRotaMs = Date.now();
    let etapa = 'entrada';
    let duracaoCountMs = 0;
    let duracaoListaMs = 0;
    let duracaoSerializacaoMs = 0;

    try {
      logger.info('[PRODUTOS][IN]', {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl || req.url
      });
      logger.info('[PRODUTOS][QUERY]', {
        request_id: requestId,
        raw_query: req.query || {}
      });

      res.set('Cache-Control', 'public, max-age=30');
      etapa = 'obter_colunas';
      const colunas = await obterColunasProdutos();
      const taxonomiaEstruturadaDisponivel = possuiTaxonomiaEstruturada(colunas);
      etapa = 'detectar_escala_preco';
      const escalaPrecoVitrine = await obterEscalaPrecoVitrine();
      const nomeExpr = colunas.has('nome_externo')
        ? "COALESCE(NULLIF(TRIM(p.nome_externo), ''), p.nome) AS nome"
        : 'p.nome AS nome';
      const precoBaseExpr = colunas.has('preco_tabela')
        ? 'COALESCE(p.preco_tabela, p.preco)'
        : 'p.preco';
      const precoOrdenacaoExpr = precoBaseExpr;

      const fromSqlBase = taxonomiaEstruturadaDisponivel
        ? `FROM produtos p
           LEFT JOIN catalogo_categorias cc ON cc.id = p.categoria_principal_id
           LEFT JOIN catalogo_subcategorias cs ON cs.id = p.subcategoria_id`
        : 'FROM produtos p';

      const campos = [
        'p.id',
        nomeExpr,
        colunas.has('descricao') ? 'p.descricao' : 'NULL AS descricao',
        colunas.has('marca') ? 'p.marca' : 'NULL AS marca',
        montarExprPrecoSql(precoBaseExpr, escalaPrecoVitrine, 'preco'),
        colunas.has('unidade') ? 'p.unidade' : "'un' AS unidade",
        colunas.has('categoria') ? 'p.categoria' : "'geral' AS categoria",
        colunas.has('emoji') ? 'p.emoji' : "'📦' AS emoji",
        colunas.has('estoque') ? 'p.estoque' : '0 AS estoque',
        colunas.has('validade') ? 'p.validade' : 'NULL AS validade'
      ];

      campos.push(colunas.has('unidade_venda') ? 'p.unidade_venda' : 'NULL AS unidade_venda');
      campos.push(colunas.has('tipo_venda') ? 'p.tipo_venda' : 'NULL AS tipo_venda');
      campos.push(colunas.has('vendido_por_peso') ? 'p.vendido_por_peso' : 'NULL AS vendido_por_peso');
      campos.push(colunas.has('categoria_operacional') ? 'p.categoria_operacional' : 'NULL AS categoria_operacional');
      campos.push(colunas.has('peso_min_gramas') ? 'p.peso_min_gramas' : 'NULL AS peso_min_gramas');
      campos.push(colunas.has('peso_step_gramas') ? 'p.peso_step_gramas' : 'NULL AS peso_step_gramas');
      campos.push(colunas.has('peso_padrao_gramas') ? 'p.peso_padrao_gramas' : 'NULL AS peso_padrao_gramas');
      campos.push(colunas.has('permite_fracionado') ? 'p.permite_fracionado' : 'NULL AS permite_fracionado');
      campos.push(colunas.has('requer_maioridade') ? 'p.requer_maioridade' : 'NULL AS requer_maioridade');
      campos.push(colunas.has('visivel_no_site') ? 'p.visivel_no_site' : 'NULL AS visivel_no_site');
      campos.push(colunas.has('oculto_catalogo') ? 'p.oculto_catalogo' : 'NULL AS oculto_catalogo');
      campos.push(colunas.has('produto_controlado') ? 'p.produto_controlado' : 'NULL AS produto_controlado');

      if (colunas.has('nome_externo')) {
        campos.push('p.nome_externo');
      }

      if (colunas.has('codigo_barras')) {
        campos.push('p.codigo_barras');
      }

      if (colunas.has('imagem_url')) {
        campos.push('p.imagem_url AS imagem');
        campos.push('p.imagem_url');
      }

      if (colunas.has('preco_promocional')) {
        campos.push(montarExprPrecoSql('p.preco_promocional', escalaPrecoVitrine, 'preco_promocional'));
      }

      if (colunas.has('departamento')) {
        campos.push('p.departamento');
      }

      if (colunas.has('secao_exibicao')) {
        campos.push('p.secao_exibicao');
      }

      if (taxonomiaEstruturadaDisponivel) {
        campos.push('p.categoria_principal_id');
        campos.push('p.subcategoria_id');
        campos.push('cc.nome AS categoria_principal_nome');
        campos.push('cc.slug AS categoria_principal_slug');
        campos.push('cs.nome AS subcategoria_nome');
        campos.push('cs.slug AS subcategoria_slug');
      }


      const busca = (toLowerTrim(req.query?.busca) || '').slice(0, 200);
      const categoriaRaw = toLowerTrim(req.query?.categoria);
      const categoria = categoriaRaw && categoriaRaw !== 'todas' ? categoriaRaw : '';
      const categoriaSlug = toSlug(req.query?.categoria_slug || req.query?.categoriaSlug || '');
      const subcategoriaSlug = toSlug(req.query?.subcategoria_slug || req.query?.subcategoriaSlug || '');
      const ordenacaoRaw = toLowerTrim(req.query?.sort || req.query?.ordenacao);
      const skipCount = parseBooleanQuery(req.query?.skip_count || req.query?.skipCount);
      const ordenacaoMaisVendidos = ['mais-vendidos', 'mais_vendidos', 'maisvendidos', 'mais-comprados'].includes(ordenacaoRaw);
      const chaveOrdenacao = ordenacaoMaisVendidos ? 'mais-vendidos' : ordenacaoRaw;
      const criterioOfertaMaisVendidos = colunas.has('preco_promocional')
        ? 'CASE WHEN p.preco_promocional IS NOT NULL AND p.preco_promocional > 0 AND p.preco_promocional < p.preco THEN 1 ELSE 0 END'
        : '0';
      const fromSql = ordenacaoMaisVendidos
        ? `${fromSqlBase}
           LEFT JOIN (
             SELECT
               pi.produto_id,
               COUNT(DISTINCT pi.pedido_id) AS total_pedidos,
               COALESCE(SUM(pi.quantidade), 0) AS total_quantidade,
               MAX(ped.criado_em) AS ultima_venda_em
             FROM pedido_itens pi
             INNER JOIN pedidos ped ON ped.id = pi.pedido_id
             WHERE ped.status <> 'cancelado'
             GROUP BY pi.produto_id
           ) vendas_produtos ON vendas_produtos.produto_id = p.id`
        : fromSqlBase;
      const ordenacaoMap = {
        'mais-vendidos': `COALESCE(vendas_produtos.total_pedidos, 0) DESC, COALESCE(vendas_produtos.total_quantidade, 0) DESC, ${criterioOfertaMaisVendidos} DESC, p.estoque DESC, nome ASC`,
        nome_asc: 'p.categoria ASC, nome ASC',
        nome_desc: 'p.categoria DESC, nome DESC',
        preco_asc: `${precoOrdenacaoExpr} ASC, nome ASC`,
        preco_desc: `${precoOrdenacaoExpr} DESC, nome ASC`,
        recentes: 'p.id DESC',
        estoque: 'p.estoque DESC, nome ASC'
      };
      const ordenacaoSql = ordenacaoMap[chaveOrdenacao] || 'p.estoque DESC, p.categoria ASC, nome ASC';

      if (ordenacaoMaisVendidos) {
        campos.push('COALESCE(vendas_produtos.total_pedidos, 0) AS frequencia_pedidos');
        campos.push('COALESCE(vendas_produtos.total_quantidade, 0) AS quantidade_vendida');
        campos.push('vendas_produtos.ultima_venda_em');
      }

      const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 60, { min: 1, max: 200 });
      const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });
      logger.info('[PRODUTOS][QUERY]', {
        request_id: requestId,
        query_normalizada: {
          busca,
          categoria,
          categoria_slug: categoriaSlug,
          subcategoria_slug: subcategoriaSlug,
          sort: chaveOrdenacao || '',
          skip_count: skipCount,
          page: paginaSolicitada,
          limit: limite
        },
        taxonomia_estruturada_disponivel: taxonomiaEstruturadaDisponivel,
        total_colunas_produtos: colunas.size
      });

      const filtros = ['p.ativo = TRUE', ...montarFiltrosCatalogoPublicoSql(colunas, 'p')];
      const params = [];

      if (categoriaSlug && taxonomiaEstruturadaDisponivel) {
        filtros.push('cc.slug = ?');
        params.push(categoriaSlug);
      } else if (categoria) {
        const categoriaExpr = colunas.has('departamento')
          ? "LOWER(COALESCE(NULLIF(TRIM(p.departamento), ''), p.categoria))"
          : 'LOWER(p.categoria)';

        if (categoria === 'bebidas-alcoolicas') {
          const textoProdutoExpr = buildProdutoTextoBuscaExpr(colunas, 'p');
          const textoProdutoTokenExpr = buildProdutoTextoTokenExpr(colunas, 'p');
          const subcats = CATEGORIA_EQUIVALENCIAS[categoria] || ['bebidas'];
          const placeholders = subcats.map(() => '?').join(', ');
          const filtrosTextoAlcool = BEBIDAS_ALCOOLICAS_MATCHERS.map((matcher) => (
            isMatcherCurtoComRiscoColisao(matcher)
              ? `${textoProdutoTokenExpr} LIKE ?${LIKE_ESCAPE_SQL}`
              : `${textoProdutoExpr} LIKE ?${LIKE_ESCAPE_SQL}`
          ));

          filtros.push(
            `(${categoriaExpr} IN (${placeholders}) AND (${filtrosTextoAlcool.join(' OR ')}))`
          );
          params.push(...subcats);
          BEBIDAS_ALCOOLICAS_MATCHERS.forEach((matcher) => {
            const matcherNormalizado = String(matcher || '').trim().toLowerCase();
            if (!matcherNormalizado) {
              return;
            }

            if (isMatcherCurtoComRiscoColisao(matcherNormalizado)) {
              params.push(`% ${escapeLike(matcherNormalizado)} %`);
              return;
            }

            params.push(`%${escapeLike(matcherNormalizado)}%`);
          });
        } else if (categoria === 'cervejas' || categoria === 'cerveja') {
          const textoProdutoExpr = buildProdutoTextoBuscaExpr(colunas, 'p');
          const filtrosTextoCerveja = CERVEJA_MATCHERS.map(() => `${textoProdutoExpr} LIKE ?${LIKE_ESCAPE_SQL}`);

          filtros.push(`(${categoriaExpr} = ? OR (${filtrosTextoCerveja.join(' OR ')}))`);
          params.push('cervejas');
          CERVEJA_MATCHERS.forEach((matcher) => {
            params.push(`%${escapeLike(matcher)}%`);
          });
        } else {
          const subcats = CATEGORIA_EQUIVALENCIAS[categoria];
          if (subcats) {
            const placeholders = subcats.map(() => '?').join(', ');
            filtros.push(`(${categoriaExpr} IN (${placeholders}))`);
            params.push(...subcats);
          } else {
            filtros.push(`(${categoriaExpr} = ?)`);
            params.push(categoria);
          }
        }

        if (categoriaSlug && !taxonomiaEstruturadaDisponivel) {
          filtros.push(`REPLACE(${categoriaExpr}, '_', '-') = ?`);
          params.push(categoriaSlug);
        }
      }

      if (subcategoriaSlug) {
        if (taxonomiaEstruturadaDisponivel) {
          if (subcategoriaSlug === 'todas') {
            // Nao filtra: modo todos dentro da categoria
          } else if (subcategoriaSlug === 'sem-subcategoria') {
            filtros.push('p.subcategoria_id IS NULL');
          } else {
            filtros.push('cs.slug = ?');
            params.push(subcategoriaSlug);
          }
        } else if (colunas.has('secao_exibicao') && subcategoriaSlug !== 'todas') {
          filtros.push(`REPLACE(LOWER(TRIM(COALESCE(p.secao_exibicao, ''))), '_', '-') = ?`);
          params.push(subcategoriaSlug);
        }
      }

      if (busca) {
        const termo = `%${escapeLike(busca)}%`;
        const filtrosBusca = [
          `LOWER(p.nome) LIKE ?${LIKE_ESCAPE_SQL}`
        ];
        params.push(termo);

        if (colunas.has('nome_externo')) {
          filtrosBusca.push(`LOWER(COALESCE(p.nome_externo, '')) LIKE ?${LIKE_ESCAPE_SQL}`);
          params.push(termo);
        }

        if (colunas.has('descricao')) {
          filtrosBusca.push(`LOWER(COALESCE(p.descricao, '')) LIKE ?${LIKE_ESCAPE_SQL}`);
          params.push(termo);
        }

        if (colunas.has('marca')) {
          filtrosBusca.push(`LOWER(COALESCE(p.marca, '')) LIKE ?${LIKE_ESCAPE_SQL}`);
          params.push(termo);
        }

        filtros.push(`(${filtrosBusca.join(' OR ')})`);
      }

      const whereSql = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

      const chaveCache = montarChaveCacheProdutos({
        pagina: paginaSolicitada,
        limite,
        busca,
        categoria: `${categoriaSlug || categoria || 'todas'}|sub:${subcategoriaSlug || 'todas'}|skip_count:${skipCount ? '1' : '0'}`,
        ordenacao: `${chaveOrdenacao || 'padrao'}|${ordenacaoSql}`
      });
      const cachePayload = obterCacheProdutos(chaveCache);
      if (cachePayload) {
        const totalCache = Number(cachePayload?.paginacao?.total || 0);
        const itensCache = Array.isArray(cachePayload?.produtos) ? cachePayload.produtos.length : 0;
        const payloadBytesCache = Buffer.byteLength(JSON.stringify(cachePayload), 'utf8');
        const duracaoTotalMs = Date.now() - inicioRotaMs;
        logger.info('[PRODUTOS][OUT]', {
          request_id: requestId,
          cache: true,
          total: totalCache,
          itens_retorno: itensCache,
          duracao_total_ms: duracaoTotalMs,
          duracao_count_ms: 0,
          duracao_lista_ms: 0,
          duracao_serializacao_ms: 0,
          payload_bytes: payloadBytesCache
        });
        return res.json({
          ...cachePayload,
          cache: true
        });
      }

      let total = 0;
      let paginacao = null;
      let offset = 0;

      if (skipCount) {
        const paginaNormalizada = Math.max(1, Number(paginaSolicitada || 1));
        const limiteNormalizado = Math.max(1, Number(limite || 1));
        paginacao = {
          pagina: paginaNormalizada,
          limite: limiteNormalizado,
          total: 0,
          total_paginas: 0,
          tem_mais: false
        };
        offset = (paginaNormalizada - 1) * limiteNormalizado;
      } else {
        const countSql = `SELECT COUNT(*) AS total ${fromSql} ${whereSql}`;
        logger.info('[PRODUTOS][SQL]', {
          request_id: requestId,
          etapa: 'count',
          sql: countSql
        });
        logger.info('[PRODUTOS][PARAMS]', {
          request_id: requestId,
          etapa: 'count',
          params: sanitizeParamsForLog(params)
        });
        etapa = 'query_count';
        const inicioCountMs = Date.now();
        const [[countRow]] = await queryWithRetry(countSql, params);
        duracaoCountMs = Date.now() - inicioCountMs;
        total = Number(countRow?.total || 0);
        paginacao = montarPaginacao(total, paginaSolicitada, limite);
        offset = (paginacao.pagina - 1) * paginacao.limite;
      }

      const limiteConsulta = skipCount ? paginacao.limite + 1 : paginacao.limite;
      const listaSql = `SELECT ${campos.join(', ')}
         ${fromSql}
         ${whereSql}
         ORDER BY ${ordenacaoSql}
         LIMIT ? OFFSET ?`;
      const paramsLista = [...params, limiteConsulta, offset];
      logger.info('[PRODUTOS][SQL]', {
        request_id: requestId,
        etapa: 'lista',
        sql: listaSql
      });
      logger.info('[PRODUTOS][PARAMS]', {
        request_id: requestId,
        etapa: 'lista',
        params: sanitizeParamsForLog(paramsLista)
      });
      etapa = 'query_lista';
      const inicioListaMs = Date.now();
      const [produtosRows] = await queryWithRetry(listaSql, paramsLista);
      duracaoListaMs = Date.now() - inicioListaMs;

      const produtosLista = Array.isArray(produtosRows) ? produtosRows : [];
      let produtosPaginados = produtosLista;

      if (skipCount) {
        const temMais = produtosLista.length > paginacao.limite;
        if (temMais) {
          produtosPaginados = produtosLista.slice(0, paginacao.limite);
        }

        total = temMais
          ? (offset + produtosPaginados.length + 1)
          : (offset + produtosPaginados.length);
        const totalPaginas = paginacao.limite > 0 ? Math.max(1, Math.ceil(total / paginacao.limite)) : 1;

        paginacao = {
          ...paginacao,
          total,
          total_paginas: totalPaginas,
          tem_mais: temMais
        };
      }

      etapa = 'serializacao_resposta';
      const inicioSerializacaoMs = Date.now();
      const produtosEnriquecidos = produtosPaginados
        .map((produto) => {
          const enriquecido = enriquecerProdutoParaCatalogo(produto);
          const visibilidade = resolveVisibilidadePublica(enriquecido);
          return {
            ...enriquecido,
            _visivel_publico: Boolean(visibilidade?.visivel_publico)
          };
        })
        .filter((produto) => produto?._visivel_publico)
        .map((produto) => {
          const { _visivel_publico, ...resto } = produto;
          return resto;
        });

      const payload = {
        produtos: produtosEnriquecidos,
        paginacao
      };
      duracaoSerializacaoMs = Date.now() - inicioSerializacaoMs;
      const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      const duracaoTotalMs = Date.now() - inicioRotaMs;
      salvarCacheProdutos(chaveCache, payload);

      logger.info('[PRODUTOS][OUT]', {
        request_id: requestId,
        cache: false,
        total,
        pagina: paginacao.pagina,
        limite: paginacao.limite,
        itens_retorno: payload.produtos.length,
        duracao_total_ms: duracaoTotalMs,
        duracao_count_ms: duracaoCountMs,
        duracao_lista_ms: duracaoListaMs,
        duracao_serializacao_ms: duracaoSerializacaoMs,
        payload_bytes: payloadBytes
      });

      return res.json(payload);
    } catch (erro) {
      const erroInfo = {
        request_id: requestId,
        etapa,
        message: String(erro?.message || 'Erro desconhecido'),
        stack: String(erro?.stack || ''),
        code: erro?.code || null,
        sqlMessage: erro?.sqlMessage || null,
        sqlState: erro?.sqlState || null,
        errno: erro?.errno || null
      };
      logger.error('[PRODUTOS][ERRO]', erroInfo);

      if (res.headersSent) {
        return;
      }

      const respostaErro = {
        erro: 'Falha ao listar produtos',
        codigo: erroInfo.code || 'PRODUTOS_LISTAR_FALHA',
        request_id: requestId
      };

      if (!IS_PRODUCTION) {
        respostaErro.detalhe = erroInfo.message;
      }

      return res.status(500).json(respostaErro);
    }
  });

  router.get('/api/categorias/navegacao', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=30');
      const chaveCacheLeitura = 'categorias:navegacao:v1';
      const cacheLeitura = obterCacheLeitura(chaveCacheLeitura);
      if (cacheLeitura) {
        return res.json({
          categorias: cacheLeitura,
          cache: true
        });
      }

      let categorias = [];
      try {
        categorias = await obterCategoriasEstruturadasComFallback();
      } catch (erroEstruturado) {
        logger.warn('Taxonomia estruturada indisponivel. Fallback para categorias legadas.', {
          code: erroEstruturado?.code,
          message: erroEstruturado?.message
        });

        const colunas = await obterColunasProdutos();
        const filtrosPublicos = montarFiltrosCatalogoPublicoSql(colunas, '');
        const categoriaExpr = colunas.has('departamento')
          ? "LOWER(COALESCE(NULLIF(TRIM(departamento), ''), categoria))"
          : 'LOWER(categoria)';

        const [rows] = await queryWithRetry(
          `SELECT ${categoriaExpr} AS categoria, COUNT(*) AS total_produtos
             FROM produtos
            WHERE ativo = TRUE
              ${filtrosPublicos.length ? `AND ${filtrosPublicos.join(' AND ')}` : ''}
              AND ${categoriaExpr} IS NOT NULL
              AND ${categoriaExpr} <> ''
            GROUP BY ${categoriaExpr}
            ORDER BY ${categoriaExpr} ASC`
        );

        categorias = rows.map((row, index) => {
          const slug = toSlug(row?.categoria);
          return {
            id: index + 1,
            nome: String(row?.categoria || '').trim(),
            slug,
            ordem_exibicao: index,
            ativo: true,
            icone_url: null,
            imagem_url: null,
            total_produtos: Number(row?.total_produtos || 0),
            total_sem_subcategoria: Number(row?.total_produtos || 0),
            subcategorias: []
          };
        });
      }

      salvarCacheLeitura(chaveCacheLeitura, categorias);
      return res.json({ categorias });
    } catch (erro) {
      logger.error('Erro ao buscar navegacao de categorias:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel carregar a navegacao de categorias.' });
    }
  });

  router.get('/api/categorias/:categoriaSlug/subcategorias', async (req, res) => {
    try {
      const categoriaSlug = toSlug(req.params?.categoriaSlug || '');
      if (!categoriaSlug) {
        return res.status(400).json({ erro: 'Categoria invalida.' });
      }

      const colunas = await obterColunasProdutos();
      const filtrosPublicosJoin = montarFiltrosCatalogoPublicoSql(colunas, 'p');
      const filtrosPublicosWhere = montarFiltrosCatalogoPublicoSql(colunas, '');

      const [rowsCategoria] = await queryWithRetry(
        `SELECT id, nome, slug
           FROM catalogo_categorias
          WHERE ativo = TRUE
            AND slug = ?
          LIMIT 1`,
        [categoriaSlug]
      );

      if (!rowsCategoria.length) {
        return res.status(404).json({ erro: 'Categoria nao encontrada.' });
      }

      const categoria = rowsCategoria[0];

      const [rowsSubcategorias] = await queryWithRetry(
        `SELECT
           s.id,
           s.nome,
           s.slug,
           s.ordem_exibicao,
           s.ativo,
           s.icone_url,
           s.imagem_url,
           COUNT(p.id) AS total_produtos
         FROM catalogo_subcategorias s
         LEFT JOIN produtos p
           ON p.subcategoria_id = s.id
          AND p.ativo = TRUE
          ${filtrosPublicosJoin.length ? `AND ${filtrosPublicosJoin.join(' AND ')}` : ''}
         WHERE s.categoria_id = ?
           AND s.ativo = TRUE
         GROUP BY s.id, s.nome, s.slug, s.ordem_exibicao, s.ativo, s.icone_url, s.imagem_url
         ORDER BY s.ordem_exibicao ASC, s.nome ASC`,
        [categoria.id]
      );

      const [rowsSemSubcategoria] = await queryWithRetry(
        `SELECT COUNT(*) AS total
           FROM produtos
          WHERE ativo = TRUE
            AND categoria_principal_id = ?
            AND subcategoria_id IS NULL
            ${filtrosPublicosWhere.length ? `AND ${filtrosPublicosWhere.join(' AND ')}` : ''}`,
        [categoria.id]
      );

      return res.json({
        categoria: {
          id: Number(categoria.id),
          nome: String(categoria.nome || '').trim(),
          slug: String(categoria.slug || '').trim()
        },
        subcategorias: rowsSubcategorias.map((row) => ({
          id: Number(row.id || 0),
          nome: String(row.nome || '').trim(),
          slug: String(row.slug || '').trim(),
          ordem_exibicao: Number(row.ordem_exibicao || 0),
          ativo: Boolean(row.ativo),
          icone_url: row.icone_url || null,
          imagem_url: row.imagem_url || null,
          total_produtos: Number(row.total_produtos || 0)
        })),
        total_sem_subcategoria: Number(rowsSemSubcategoria?.[0]?.total || 0)
      });
    } catch (erro) {
      logger.error('Erro ao buscar subcategorias da categoria:', erro);
      return res.status(500).json({ erro: 'Nao foi possivel carregar subcategorias agora.' });
    }
  });

  // Listar categorias ativas (cache em memória por 30s)
  router.get('/api/categorias', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=30');
      const chaveCacheLeitura = 'categorias:ativas';
      const cacheLeitura = obterCacheLeitura(chaveCacheLeitura);
      if (cacheLeitura) {
        return res.json({
          categorias: cacheLeitura,
          cache: true
        });
      }

      const colunas = await obterColunasProdutos();
      const filtrosPublicos = montarFiltrosCatalogoPublicoSql(colunas, '');
      const categoriaExpr = colunas.has('departamento')
        ? "LOWER(COALESCE(NULLIF(TRIM(departamento), ''), categoria))"
        : 'LOWER(categoria)';
      const categoriaNotNullFilter = colunas.has('departamento')
        ? "COALESCE(NULLIF(TRIM(departamento), ''), categoria) IS NOT NULL"
        : 'categoria IS NOT NULL';
      const categoriaNotEmptyFilter = colunas.has('departamento')
        ? "COALESCE(NULLIF(TRIM(departamento), ''), categoria) <> ''"
        : "categoria <> ''";

      const [rows] = await queryWithRetry(
        `SELECT DISTINCT ${categoriaExpr} AS categoria
         FROM produtos
         WHERE ativo = TRUE
           ${filtrosPublicos.length ? `AND ${filtrosPublicos.join(' AND ')}` : ''}
           AND ${categoriaNotNullFilter}
           AND ${categoriaNotEmptyFilter}
         ORDER BY categoria ASC`
      );

      const categorias = rows
        .map((item) => String(item?.categoria || '').trim())
        .filter(Boolean);

      salvarCacheLeitura(chaveCacheLeitura, categorias);

      return res.json({ categorias });
    } catch (erro) {
      logger.error('Erro ao buscar categorias:', erro);
      return res.status(500).json({ erro: 'Erro ao buscar categorias' });
    }
  });

  // Listar banners ativos (cache em memória por 30s)
  router.get('/api/banners', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=30');
      const chaveCacheLeitura = 'banners:ativos';
      const cacheLeitura = obterCacheLeitura(chaveCacheLeitura);
      if (cacheLeitura) {
        return res.json({
          banners: cacheLeitura,
          cache: true
        });
      }

      let banners = [];
      try {
        const [rows] = await queryWithRetry(
          `SELECT id, titulo, imagem_url, link_url, ordem
           FROM banners
           WHERE ativo = TRUE
           ORDER BY ordem ASC, id DESC`
        );
        banners = rows;
      } catch (erroTabela) {
        if (erroTabela?.code !== 'ER_NO_SUCH_TABLE') {
          throw erroTabela;
        }
      }

      salvarCacheLeitura(chaveCacheLeitura, banners);

      return res.json({ banners });
    } catch (erro) {
      logger.error('Erro ao buscar banners:', erro);
      return res.status(500).json({ erro: 'Erro ao buscar banners' });
    }
  });

  return router;
};
