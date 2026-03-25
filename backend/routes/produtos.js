'use strict';

const express = require('express');
const { queryWithRetry } = require('../lib/db');
const logger = require('../lib/logger');

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

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

  function possuiTaxonomiaEstruturada(colunas) {
    return colunas.has('categoria_principal_id') && colunas.has('subcategoria_id');
  }

  async function obterCategoriasEstruturadasComFallback() {
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

  // Listar todos os produtos ativos
  router.get('/api/produtos', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=30');
      const colunas = await obterColunasProdutos();
      const taxonomiaEstruturadaDisponivel = possuiTaxonomiaEstruturada(colunas);
      const nomeExpr = colunas.has('nome_externo')
        ? "COALESCE(NULLIF(TRIM(p.nome_externo), ''), p.nome) AS nome"
        : 'p.nome AS nome';

      const fromSql = taxonomiaEstruturadaDisponivel
        ? `FROM produtos p
           LEFT JOIN catalogo_categorias cc ON cc.id = p.categoria_principal_id
           LEFT JOIN catalogo_subcategorias cs ON cs.id = p.subcategoria_id`
        : 'FROM produtos p';

      const campos = [
        'p.id',
        nomeExpr,
        colunas.has('descricao') ? 'p.descricao' : 'NULL AS descricao',
        colunas.has('marca') ? 'p.marca' : 'NULL AS marca',
        'p.preco',
        colunas.has('unidade') ? 'p.unidade' : "'un' AS unidade",
        colunas.has('categoria') ? 'p.categoria' : "'geral' AS categoria",
        colunas.has('emoji') ? 'p.emoji' : "'📦' AS emoji",
        colunas.has('estoque') ? 'p.estoque' : '0 AS estoque',
        colunas.has('validade') ? 'p.validade' : 'NULL AS validade'
      ];

      if (colunas.has('nome_externo')) {
        campos.push('p.nome_externo');
      }

      if (colunas.has('codigo_barras')) {
        campos.push('p.codigo_barras');
      }

      if (colunas.has('imagem_url')) {
        campos.push('p.imagem_url AS imagem');
      }

      if (colunas.has('preco_promocional')) {
        campos.push('p.preco_promocional');
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
      const ordenacaoMap = {
        nome_asc: 'p.categoria ASC, nome ASC',
        nome_desc: 'p.categoria DESC, nome DESC',
        preco_asc: 'p.preco ASC, nome ASC',
        preco_desc: 'p.preco DESC, nome ASC',
        recentes: 'p.id DESC',
        estoque: 'p.estoque DESC, nome ASC'
      };
      const ordenacaoSql = ordenacaoMap[ordenacaoRaw] || 'p.estoque DESC, p.categoria ASC, nome ASC';

      const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 60, { min: 1, max: 200 });
      const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

      const filtros = ['p.ativo = TRUE'];
      const params = [];

      // Super-categorias: bebidas inclui agua+refrigerantes, frios inclui derivados_lacteos+leites_fermentados
      const SUPER_CATEGORIAS = {
        bebidas: ['bebidas', 'agua', 'refrigerantes'],
        frios: ['frios', 'derivados_lacteos', 'leites_fermentados']
      };

      if (categoriaSlug && taxonomiaEstruturadaDisponivel) {
        filtros.push('cc.slug = ?');
        params.push(categoriaSlug);
      } else if (categoria) {
        const categoriaExpr = colunas.has('departamento')
          ? "LOWER(COALESCE(NULLIF(TRIM(p.departamento), ''), p.categoria))"
          : 'LOWER(p.categoria)';

        if (categoria === 'cervejas' || categoria === 'cerveja') {
          const textoProdutoExpr = buildProdutoTextoBuscaExpr(colunas, 'p');
          const filtrosTextoCerveja = CERVEJA_MATCHERS.map(() => `${textoProdutoExpr} LIKE ? ESCAPE '\\\\'`);

          filtros.push(`(${categoriaExpr} = ? OR (${filtrosTextoCerveja.join(' OR ')}))`);
          params.push('cervejas');
          CERVEJA_MATCHERS.forEach((matcher) => {
            params.push(`%${escapeLike(matcher)}%`);
          });
        } else {
          const subcats = SUPER_CATEGORIAS[categoria];
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
          `LOWER(p.nome) LIKE ? ESCAPE '\\\\'`
        ];
        params.push(termo);

        if (colunas.has('nome_externo')) {
          filtrosBusca.push(`LOWER(COALESCE(p.nome_externo, '')) LIKE ? ESCAPE '\\\\'`);
          params.push(termo);
        }

        if (colunas.has('descricao')) {
          filtrosBusca.push(`LOWER(COALESCE(p.descricao, '')) LIKE ? ESCAPE '\\\\'`);
          params.push(termo);
        }

        if (colunas.has('marca')) {
          filtrosBusca.push(`LOWER(COALESCE(p.marca, '')) LIKE ? ESCAPE '\\\\'`);
          params.push(termo);
        }

        filtros.push(`(${filtrosBusca.join(' OR ')})`);
      }

      const whereSql = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

      const chaveCache = montarChaveCacheProdutos({
        pagina: paginaSolicitada,
        limite,
        busca,
        categoria: categoriaSlug || categoria,
        ordenacao: ordenacaoSql
      });
      const cachePayload = obterCacheProdutos(chaveCache);
      if (cachePayload) {
        return res.json({
          ...cachePayload,
          cache: true
        });
      }

      const [[countRow]] = await queryWithRetry(
        `SELECT COUNT(*) AS total ${fromSql} ${whereSql}`,
        params
      );
      const total = Number(countRow?.total || 0);
      const paginacao = montarPaginacao(total, paginaSolicitada, limite);
      const offset = (paginacao.pagina - 1) * paginacao.limite;

      const [produtos] = await queryWithRetry(
        `SELECT ${campos.join(', ')}
         ${fromSql}
         ${whereSql}
         ORDER BY ${ordenacaoSql}
         LIMIT ? OFFSET ?`,
        [...params, paginacao.limite, offset]
      );

      const payload = {
        produtos,
        paginacao
      };
      salvarCacheProdutos(chaveCache, payload);

      return res.json(payload);
    } catch (erro) {
      logger.error('Erro ao buscar produtos:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os produtos no momento.' });
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
        const categoriaExpr = colunas.has('departamento')
          ? "LOWER(COALESCE(NULLIF(TRIM(departamento), ''), categoria))"
          : 'LOWER(categoria)';

        const [rows] = await queryWithRetry(
          `SELECT ${categoriaExpr} AS categoria, COUNT(*) AS total_produtos
             FROM produtos
            WHERE ativo = TRUE
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
            AND subcategoria_id IS NULL`,
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
