'use strict';

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');

function generateId() {
  return crypto.randomBytes(4).toString('hex'); // 8 chars
}

module.exports = function createSharedCartsRoutes({ autenticarToken }) {
  const router = express.Router();

  // POST /api/shared-cart — criar carrinho compartilhado
  router.post('/api/shared-cart', async (req, res) => {
    try {
      const { items, total, item_count } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ erro: 'Carrinho vazio.' });
      }

      const id = generateId();
      const userId = req.usuario?.id || null;

      await pool.query(
        `INSERT INTO shared_carts (id, items, total, item_count, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, JSON.stringify(items), total || 0, item_count || items.length, userId]
      );

      logger.info(`Carrinho compartilhado criado: ${id} (${items.length} itens, R$${total})`);
      res.json({ id });
    } catch (err) {
      logger.error('Erro ao criar carrinho compartilhado:', err);
      res.status(500).json({ erro: 'Erro ao compartilhar carrinho.' });
    }
  });

  // GET /api/shared-cart/:id — buscar carrinho compartilhado
  router.get('/api/shared-cart/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id || id.length !== 8) {
        return res.status(400).json({ erro: 'ID invalido.' });
      }

      const [rows] = await pool.query(
        `SELECT * FROM shared_carts WHERE id = $1 AND expires_at > NOW()`,
        [id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ erro: 'Carrinho expirado ou nao encontrado.' });
      }

      // Increment views
      await pool.query(
        `UPDATE shared_carts SET views = views + 1 WHERE id = $1`,
        [id]
      );

      const cart = rows[0];
      res.json({
        id: cart.id,
        items: cart.items,
        total: Number(cart.total),
        item_count: cart.item_count,
        created_at: cart.created_at,
      });
    } catch (err) {
      logger.error('Erro ao buscar carrinho compartilhado:', err);
      res.status(500).json({ erro: 'Erro ao buscar carrinho.' });
    }
  });

  // POST /api/shared-cart/:id/load — registrar que alguem carregou
  router.post('/api/shared-cart/:id/load', async (req, res) => {
    try {
      await pool.query(
        `UPDATE shared_carts SET loads = loads + 1 WHERE id = $1`,
        [req.params.id]
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ erro: 'Erro.' });
    }
  });

  return router;
};
