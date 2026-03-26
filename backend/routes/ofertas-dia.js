'use strict';

const express = require('express');
const { pool, queryWithRetry } = require('../lib/db');
const logger = require('../lib/logger');
const {
  enriquecerProdutoParaCatalogo,
  resolveVisibilidadePublica
} = require('../lib/produtoCatalogoRules');

/**
 * Rotas de Ofertas do Dia
 * - GET /api/ofertas-dia (público)
 * - GET /api/admin/ofertas-dia (admin)
 * - POST /api/admin/ofertas-dia (admin)
 * - DELETE /api/admin/ofertas-dia/:id (admin)
 * - PUT /api/admin/ofertas-dia/ordenar (admin)
 */
module.exports = function createOfertasDiaRoutes({ autenticarAdminToken, exigirAcessoLocalAdmin }) {
  const router = express.Router();
  const adminGuard = [exigirAcessoLocalAdmin, autenticarAdminToken];
  let escalaPrecoCache = 1;
  let escalaPrecoCacheExpiraEm = 0;
  const ESCALA_PRECO_CACHE_TTL_MS = 5 * 60 * 1000;

  function montarExprPrecoSql(exprBase, escala, alias) {
    if (Number(escala || 1) > 1) {
      return `ROUND((${exprBase}) / ${Number(escala)}, 2) AS ${alias}`;
    }
    return `${exprBase} AS ${alias}`;
  }

  async function obterEscalaPreco() {
    const agora = Date.now();
    if (agora < escalaPrecoCacheExpiraEm) {
      return escalaPrecoCache;
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

      escalaPrecoCache = datasetComCaraDeCentavos ? 100 : 1;
    } catch (erroEscala) {
      logger.warn('Falha ao detectar escala de preco em ofertas do dia. Mantendo escala padrao.', {
        code: erroEscala?.code,
        message: erroEscala?.message
      });
      escalaPrecoCache = 1;
    } finally {
      escalaPrecoCacheExpiraEm = agora + ESCALA_PRECO_CACHE_TTL_MS;
    }

    return escalaPrecoCache;
  }

  // ── Público: listar ofertas do dia ──
  router.get('/api/ofertas-dia', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=60');
      const escalaPreco = await obterEscalaPreco();
      const precoExpr = montarExprPrecoSql('p.preco', escalaPreco, 'preco');
      const precoPromocionalExpr = montarExprPrecoSql('p.preco_promocional', escalaPreco, 'preco_promocional');

      const [rows] = await queryWithRetry(
        `SELECT p.id, COALESCE(NULLIF(TRIM(p.nome_externo), ''), p.nome) AS nome,
                p.nome_externo, ${precoExpr}, ${precoPromocionalExpr}, p.estoque,
                p.categoria, p.departamento, p.imagem_url AS imagem,
                p.marca, p.unidade, p.emoji,
                od.ordem
         FROM ofertas_dia od
         INNER JOIN produtos p ON p.id = od.produto_id
         WHERE od.ativo = 1 AND p.ativo = 1
           AND COALESCE(p.estoque, 0) > 0
           AND LOWER(COALESCE(p.categoria, '')) NOT LIKE '%tabaco%'
           AND LOWER(COALESCE(p.categoria, '')) NOT LIKE '%cigar%'
           AND LOWER(CONCAT(COALESCE(p.nome, ''), ' ', COALESCE(p.nome_externo, ''), ' ', COALESCE(p.descricao, ''))) NOT LIKE '%tabaco%'
           AND LOWER(CONCAT(COALESCE(p.nome, ''), ' ', COALESCE(p.nome_externo, ''), ' ', COALESCE(p.descricao, ''))) NOT LIKE '%cigar%'
         ORDER BY od.ordem ASC, p.nome ASC`
      );

      const ofertas = rows
        .map((item) => {
          const enriquecido = enriquecerProdutoParaCatalogo(item);
          const visibilidade = resolveVisibilidadePublica(enriquecido);
          return {
            ...enriquecido,
            _visivel_publico: Boolean(visibilidade?.visivel_publico)
          };
        })
        .filter((item) => item?._visivel_publico)
        .map((item) => {
          const { _visivel_publico, ...resto } = item;
          return resto;
        });

      return res.json({ ofertas });
    } catch (err) {
      if (String(err?.code || '').trim().toUpperCase() === '42P01') {
        return res.json({ ofertas: [] });
      }
      logger.error('Erro ao buscar ofertas do dia:', err);
      return res.status(500).json({ error: 'Erro ao buscar ofertas do dia' });
    }
  });

  // ── Admin: listar ofertas do dia (com mais detalhes) ──
  router.get('/api/admin/ofertas-dia', ...adminGuard, async (req, res) => {
    try {
      const escalaPreco = await obterEscalaPreco();
      const precoExpr = montarExprPrecoSql('p.preco', escalaPreco, 'preco');
      const precoPromocionalExpr = montarExprPrecoSql('p.preco_promocional', escalaPreco, 'preco_promocional');

      const [rows] = await pool.query(
        `SELECT od.id, od.produto_id, od.ordem, od.ativo, od.criado_em,
                COALESCE(NULLIF(TRIM(p.nome_externo), ''), p.nome) AS nome,
                ${precoExpr}, ${precoPromocionalExpr}, p.estoque, p.imagem_url AS imagem,
                p.categoria, p.departamento
         FROM ofertas_dia od
         INNER JOIN produtos p ON p.id = od.produto_id
         ORDER BY od.ordem ASC`
      );

      return res.json({ ofertas: rows });
    } catch (err) {
      logger.error('Erro admin ofertas-dia GET:', err);
      return res.status(500).json({ error: 'Erro ao listar ofertas' });
    }
  });

  // ── Admin: adicionar produto às ofertas do dia ──
  router.post('/api/admin/ofertas-dia', ...adminGuard, async (req, res) => {
    try {
      const { produto_id } = req.body;
      const produtoIdNum = Number(produto_id);
      if (!Number.isInteger(produtoIdNum) || produtoIdNum <= 0) {
        return res.status(400).json({ error: 'produto_id é obrigatório' });
      }

      // Verificar se produto existe e está ativo
      const [[prod]] = await pool.query(
        'SELECT id FROM produtos WHERE id = ? AND ativo = 1',
        [produtoIdNum]
      );
      if (!prod) {
        return res.status(404).json({ error: 'Produto não encontrado ou inativo' });
      }

      // Obter próxima ordem
      const [[{ maxOrdem }]] = await pool.query(
        'SELECT COALESCE(MAX(ordem), 0) AS maxOrdem FROM ofertas_dia WHERE ativo = 1'
      );

      await pool.query(
        'INSERT INTO ofertas_dia (produto_id, ordem, ativo) VALUES (?, ?, 1) ON CONFLICT (produto_id) DO UPDATE SET ativo = EXCLUDED.ativo, ordem = EXCLUDED.ordem',
        [produtoIdNum, maxOrdem + 1]
      );

      logger.info(`Oferta do dia adicionada: produto_id=${produto_id} por admin`);
      return res.json({ ok: true });
    } catch (err) {
      logger.error('Erro admin ofertas-dia POST:', err);
      return res.status(500).json({ error: 'Erro ao adicionar oferta' });
    }
  });

  // ── Admin: remover produto das ofertas do dia ──
  router.delete('/api/admin/ofertas-dia/:id', ...adminGuard, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      await pool.query('DELETE FROM ofertas_dia WHERE id = ?', [id]);

      logger.info(`Oferta do dia removida: id=${id} por admin`);
      return res.json({ ok: true });
    } catch (err) {
      logger.error('Erro admin ofertas-dia DELETE:', err);
      return res.status(500).json({ error: 'Erro ao remover oferta' });
    }
  });

  // ── Admin: reordenar ofertas ──
  router.put('/api/admin/ofertas-dia/ordenar', ...adminGuard, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids é obrigatório (array de IDs na nova ordem)' });
      }

      if (ids.length > 500) {
        return res.status(400).json({ error: 'ids excede o limite máximo de 500 itens por requisição' });
      }

      const idsNormalizados = ids.map((id) => Number(id));
      if (idsNormalizados.some((id) => !Number.isInteger(id) || id <= 0)) {
        return res.status(400).json({ error: 'ids deve conter apenas IDs numéricos positivos' });
      }

      const idsUnicos = new Set(idsNormalizados);
      if (idsUnicos.size !== idsNormalizados.length) {
        return res.status(400).json({ error: 'ids contém valores duplicados' });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (let i = 0; i < idsNormalizados.length; i++) {
          await conn.query(
            'UPDATE ofertas_dia SET ordem = ? WHERE id = ?',
            [i + 1, idsNormalizados[i]]
          );
        }
        await conn.commit();
      } catch (txErr) {
        await conn.rollback();
        throw txErr;
      } finally {
        conn.release();
      }

      return res.json({ ok: true });
    } catch (err) {
      logger.error('Erro admin ofertas-dia PUT ordenar:', err);
      return res.status(500).json({ error: 'Erro ao reordenar ofertas' });
    }
  });

  return router;
};
