'use strict';

const express = require('express');
const { pool, queryWithRetry } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * Rotas de Ofertas do Dia
 * - GET /api/ofertas-dia (público)
 * - GET /api/admin/ofertas-dia (admin)
 * - POST /api/admin/ofertas-dia (admin)
 * - DELETE /api/admin/ofertas-dia/:id (admin)
 * - PUT /api/admin/ofertas-dia/ordenar (admin)
 */
module.exports = function createOfertasDiaRoutes({ autenticarAdminToken }) {
  const router = express.Router();

  // ── Público: listar ofertas do dia ──
  router.get('/api/ofertas-dia', async (req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=60');

      const [rows] = await queryWithRetry(
        `SELECT p.id, COALESCE(NULLIF(TRIM(p.nome_externo), ''), p.nome) AS nome,
                p.nome_externo, p.preco, p.preco_promocional, p.estoque,
                p.categoria, p.departamento, p.imagem_url AS imagem,
                p.marca, p.unidade, p.emoji,
                od.ordem
         FROM ofertas_dia od
         INNER JOIN produtos p ON p.id = od.produto_id
         WHERE od.ativo = 1 AND p.ativo = 1
         ORDER BY od.ordem ASC, p.nome ASC`
      );

      return res.json({ ofertas: rows });
    } catch (err) {
      logger.error('Erro ao buscar ofertas do dia:', err);
      return res.status(500).json({ error: 'Erro ao buscar ofertas do dia' });
    }
  });

  // ── Admin: listar ofertas do dia (com mais detalhes) ──
  router.get('/api/admin/ofertas-dia', autenticarAdminToken, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT od.id, od.produto_id, od.ordem, od.ativo, od.criado_em,
                COALESCE(NULLIF(TRIM(p.nome_externo), ''), p.nome) AS nome,
                p.preco, p.preco_promocional, p.estoque, p.imagem_url AS imagem,
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
  router.post('/api/admin/ofertas-dia', autenticarAdminToken, async (req, res) => {
    try {
      const { produto_id } = req.body;
      if (!produto_id || !Number.isFinite(Number(produto_id))) {
        return res.status(400).json({ error: 'produto_id é obrigatório' });
      }

      // Verificar se produto existe e está ativo
      const [[prod]] = await pool.query(
        'SELECT id FROM produtos WHERE id = ? AND ativo = 1',
        [Number(produto_id)]
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
        [Number(produto_id), maxOrdem + 1]
      );

      logger.info(`Oferta do dia adicionada: produto_id=${produto_id} por admin`);
      return res.json({ ok: true });
    } catch (err) {
      logger.error('Erro admin ofertas-dia POST:', err);
      return res.status(500).json({ error: 'Erro ao adicionar oferta' });
    }
  });

  // ── Admin: remover produto das ofertas do dia ──
  router.delete('/api/admin/ofertas-dia/:id', autenticarAdminToken, async (req, res) => {
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
  router.put('/api/admin/ofertas-dia/ordenar', autenticarAdminToken, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids é obrigatório (array de IDs na nova ordem)' });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i++) {
          await conn.query(
            'UPDATE ofertas_dia SET ordem = ? WHERE id = ?',
            [i + 1, Number(ids[i])]
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
