'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.rateLimit
 * @param {object}  deps.rateLimitValidateOptions
 */
module.exports = function createAvaliacoesRoutes({ autenticarToken, rateLimit, rateLimitValidateOptions }) {
  const router = express.Router();

  // Listar avaliações de um produto
  router.get('/api/avaliacoes/:produto_id', async (req, res) => {
    try {
      const [avaliacoes] = await pool.query(
        `SELECT a.*, u.nome as usuario_nome 
         FROM avaliacoes a 
         LEFT JOIN usuarios u ON a.usuario_id = u.id 
         WHERE a.produto_id = ? 
         ORDER BY a.criado_em DESC`,
        [req.params.produto_id]
      );

      res.json({ avaliacoes });
    } catch (error) {
      logger.error('Erro ao carregar avaliações:', error);
      res.status(500).json({ erro: 'Não foi possível carregar as avaliações.' });
    }
  });

  // Criar avaliação
  const avaliacoesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    validate: rateLimitValidateOptions,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas avaliações em sequência. Aguarde alguns minutos.' }
  });

  router.post('/api/avaliacoes', autenticarToken, avaliacoesLimiter, async (req, res) => {
    try {
      const { produto_id, nota, comentario } = req.body;

      const produtoIdNum = Number(produto_id);
      const notaNum = Number(nota);
      if (!Number.isInteger(produtoIdNum) || produtoIdNum <= 0 || !Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
        return res.status(400).json({ erro: 'Informe uma nota válida entre 1 e 5.' });
      }

      // Verificar se o usuário comprou este produto (pedido entregue ou retirado)
      const [compras] = await pool.query(
        `SELECT pi.id FROM pedido_itens pi
         JOIN pedidos p ON pi.pedido_id = p.id
         WHERE p.usuario_id = ? AND pi.produto_id = ? AND p.status IN ('entregue', 'retirado')
         LIMIT 1`,
        [req.usuario.id, produtoIdNum]
      );

      if (compras.length === 0) {
        return res.status(403).json({ erro: 'Você só pode avaliar produtos que já comprou e recebeu.' });
      }

      const comentarioLimpo = comentario ? String(comentario).trim().slice(0, 500) : null;

      // Verificar se já existe avaliação
      const [existente] = await pool.query(
        'SELECT id FROM avaliacoes WHERE usuario_id = ? AND produto_id = ?',
        [req.usuario.id, produtoIdNum]
      );

      if (existente.length > 0) {
        // Atualizar avaliação existente
        await pool.query(
          'UPDATE avaliacoes SET nota = ?, comentario = ? WHERE id = ?',
          [notaNum, comentarioLimpo, existente[0].id]
        );
      } else {
        // Criar nova avaliação
        await pool.query(
          'INSERT INTO avaliacoes (usuario_id, produto_id, nota, comentario) VALUES (?, ?, ?, ?)',
          [req.usuario.id, produtoIdNum, notaNum, comentarioLimpo]
        );
      }

      res.json({ mensagem: 'Avaliação registrada com sucesso.' });
    } catch (error) {
      logger.error('Erro ao salvar avaliação:', error);
      res.status(500).json({ erro: 'Não foi possível salvar sua avaliação.' });
    }
  });

  return router;
};
