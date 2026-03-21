'use strict';

const express = require('express');
const { queryWithRetry } = require('../lib/db');
const logger = require('../lib/logger');

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

  // Listar todos os produtos ativos
  router.get('/api/produtos', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=30');
      const colunas = await obterColunasProdutos();
      const nomeExpr = colunas.has('nome_externo')
        ? "COALESCE(NULLIF(TRIM(nome_externo), ''), nome) AS nome"
        : 'nome';
      const campos = [
        'id',
        nomeExpr,
        colunas.has('descricao') ? 'descricao' : 'NULL AS descricao',
        colunas.has('marca') ? 'marca' : 'NULL AS marca',
        'preco',
        colunas.has('unidade') ? 'unidade' : "'un' AS unidade",
        colunas.has('categoria') ? 'categoria' : "'geral' AS categoria",
        colunas.has('emoji') ? 'emoji' : "'📦' AS emoji",
        colunas.has('estoque') ? 'estoque' : '0 AS estoque',
        colunas.has('validade') ? 'validade' : 'NULL AS validade'
      ];

      if (colunas.has('nome_externo')) {
        campos.push('nome_externo');
      }

      if (colunas.has('codigo_barras')) {
        campos.push('codigo_barras');
      }

      if (colunas.has('imagem_url')) {
        campos.push('imagem_url AS imagem');
      }

      if (colunas.has('preco_promocional')) {
        campos.push('preco_promocional');
      }

      if (colunas.has('departamento')) {
        campos.push('departamento');
      }

      if (colunas.has('secao_exibicao')) {
        campos.push('secao_exibicao');
      }

      const busca = (toLowerTrim(req.query?.busca) || '').slice(0, 200);
      const categoriaRaw = toLowerTrim(req.query?.categoria);
      const categoria = categoriaRaw && categoriaRaw !== 'todas' ? categoriaRaw : '';
      const ordenacaoRaw = toLowerTrim(req.query?.sort || req.query?.ordenacao);
      const ordenacaoMap = {
        nome_asc: 'categoria ASC, nome ASC',
        nome_desc: 'categoria DESC, nome DESC',
        preco_asc: 'preco ASC, nome ASC',
        preco_desc: 'preco DESC, nome ASC',
        recentes: 'id DESC',
        estoque: 'estoque DESC, nome ASC'
      };
      const ordenacaoSql = ordenacaoMap[ordenacaoRaw] || 'estoque DESC, categoria ASC, nome ASC';

      const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 60, { min: 1, max: 200 });
      const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

      const filtros = ['ativo = TRUE'];
      const params = [];

      if (categoria) {
        if (colunas.has('departamento')) {
          // Usa departamento (IA) quando disponível, senão categoria (ERP)
          filtros.push('(LOWER(COALESCE(NULLIF(TRIM(departamento), \'\'), categoria)) = ?)');
        } else {
          filtros.push('LOWER(categoria) = ?');
        }
        params.push(categoria);
      }

      if (busca) {
        const termo = `%${escapeLike(busca)}%`;
        const filtrosBusca = [
          `LOWER(nome) LIKE ? ESCAPE '\\\\'`
        ];
        params.push(termo);

        if (colunas.has('nome_externo')) {
          filtrosBusca.push(`LOWER(COALESCE(nome_externo, '')) LIKE ? ESCAPE '\\\\'`);
          params.push(termo);
        }

        if (colunas.has('descricao')) {
          filtrosBusca.push(`LOWER(COALESCE(descricao, '')) LIKE ? ESCAPE '\\\\'`);
          params.push(termo);
        }

        if (colunas.has('marca')) {
          filtrosBusca.push(`LOWER(COALESCE(marca, '')) LIKE ? ESCAPE '\\\\'`);
          params.push(termo);
        }

        filtros.push(`(${filtrosBusca.join(' OR ')})`);
      }

      const whereSql = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

      const chaveCache = montarChaveCacheProdutos({
        pagina: paginaSolicitada,
        limite,
        busca,
        categoria,
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
        `SELECT COUNT(*) AS total FROM produtos ${whereSql}`,
        params
      );
      const total = Number(countRow?.total || 0);
      const paginacao = montarPaginacao(total, paginaSolicitada, limite);
      const offset = (paginacao.pagina - 1) * paginacao.limite;

      const [produtos] = await queryWithRetry(
        `SELECT ${campos.join(', ')}
         FROM produtos
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

      const [rows] = await queryWithRetry(
        `SELECT DISTINCT categoria
         FROM produtos
         WHERE ativo = TRUE
           AND categoria IS NOT NULL
           AND categoria <> ''
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
