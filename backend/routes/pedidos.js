'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');

/**
 * Customer-facing pedido read routes (list + detail).
 * POST /api/pedidos (creation) remains in server.js due to complex dependencies.
 *
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.parsePositiveInt
 * @param {Function} deps.montarPaginacao
 */
module.exports = function createPedidosRoutes({ autenticarToken, parsePositiveInt, montarPaginacao }) {
  const router = express.Router();

  // Listar pedidos do usuário
  router.get('/api/pedidos', autenticarToken, async (req, res) => {
    try {
      const usarPaginacao = ['page', 'pagina', 'limit', 'limite']
        .some((chave) => req.query?.[chave] !== undefined);

      if (!usarPaginacao) {
        const [pedidos] = await pool.query(
          `SELECT id, usuario_id, total, taxa_servico, status, forma_pagamento, tipo_entrega,
                  pix_codigo, pix_qrcode, pix_id, pix_status,
                  frete_cobrado_cliente, frete_real_uber, margem_pedido,
                  uber_delivery_id, uber_tracking_url, uber_vehicle_type, uber_eta_seconds, entrega_status,
                  criado_em, atualizado_em
             FROM pedidos
            WHERE usuario_id = ?
            ORDER BY criado_em DESC`,
          [req.usuario.id]
        );

        const pedidosNormalizados = pedidos.map((pedido) => ({
          ...pedido,
          tipo_entrega: String(pedido?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
            ? 'retirada'
            : 'entrega'
        }));

        return res.json({
          pedidos: pedidosNormalizados,
          total: pedidosNormalizados.length
        });
      }

      const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 20, { min: 1, max: 100 });
      const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

      const [[countRow]] = await pool.query(
        'SELECT COUNT(*) AS total FROM pedidos WHERE usuario_id = ?',
        [req.usuario.id]
      );
      const total = Number(countRow?.total || 0);
      const paginacao = montarPaginacao(total, paginaSolicitada, limite);
      const offset = (paginacao.pagina - 1) * paginacao.limite;

      const [pedidos] = await pool.query(
        `SELECT id, usuario_id, total, taxa_servico, status, forma_pagamento, tipo_entrega,
                pix_codigo, pix_qrcode, pix_id, pix_status,
                frete_cobrado_cliente, frete_real_uber, margem_pedido,
                uber_delivery_id, uber_tracking_url, uber_vehicle_type, uber_eta_seconds, entrega_status,
                criado_em, atualizado_em
           FROM pedidos
          WHERE usuario_id = ?
          ORDER BY criado_em DESC
          LIMIT ? OFFSET ?`,
        [req.usuario.id, paginacao.limite, offset]
      );

      const pedidosNormalizados = pedidos.map((pedido) => ({
        ...pedido,
        tipo_entrega: String(pedido?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
          ? 'retirada'
          : 'entrega'
      }));

      return res.json({
        pedidos: pedidosNormalizados,
        paginacao
      });
    } catch (erro) {
      logger.error('Erro ao buscar pedidos:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar seus pedidos.' });
    }
  });

  // Detalhes de um pedido
  router.get('/api/pedidos/:id', autenticarToken, async (req, res) => {
    try {
      const [pedidos] = await pool.query(
        `SELECT id, usuario_id, total, taxa_servico, status, forma_pagamento, tipo_entrega,
                pix_codigo, pix_qrcode, pix_id, pix_status,
                frete_cobrado_cliente, frete_real_uber, margem_pedido,
                uber_delivery_id, uber_tracking_url, uber_vehicle_type, uber_eta_seconds, entrega_status,
                criado_em, atualizado_em
           FROM pedidos
          WHERE id = ? AND usuario_id = ?`,
        [req.params.id, req.usuario.id]
      );

      if (pedidos.length === 0) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }

      // Buscar itens com informações do produto (incluindo emoji)
      const [itens] = await pool.query(`
        SELECT 
          pi.*,
          p.emoji,
          p.nome
        FROM pedido_itens pi
        LEFT JOIN produtos p ON pi.produto_id = p.id
        WHERE pi.pedido_id = ?
      `, [req.params.id]);

      res.json({
        pedido: {
          ...pedidos[0],
          tipo_entrega: String(pedidos[0]?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
            ? 'retirada'
            : 'entrega'
        },
        itens: itens
      });
    } catch (erro) {
      logger.error('Erro ao buscar pedido:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os detalhes do pedido.' });
    }
  });

  // Consultar status em tempo real (polling leve — sem itens, só status)
  router.get('/api/pedidos/:id/status', autenticarToken, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT id, status, tipo_entrega, forma_pagamento,
          uber_delivery_id, uber_tracking_url, uber_vehicle_type, uber_eta_seconds,
          entrega_status, frete_cobrado_cliente, frete_real_uber, margem_pedido,
                pago_em, em_preparo_em, pronto_em, saiu_entrega_em, entregue_em, retirado_em, cancelado_em,
                atualizado_em
         FROM pedidos WHERE id = ? AND usuario_id = ? LIMIT 1`,
        [req.params.id, req.usuario.id]
      );
      if (!rows.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }
      res.json(rows[0]);
    } catch (erro) {
      logger.error('Erro ao buscar status do pedido:', erro);
      res.status(500).json({ erro: 'Não foi possível consultar o status.' });
    }
  });

  // Cliente confirma recebimento do pedido
  router.put('/api/pedidos/:id/confirmar-recebimento', autenticarToken, async (req, res) => {
    try {
      const pedidoId = req.params.id;
      const [rows] = await pool.query(
        'SELECT id, status, usuario_id FROM pedidos WHERE id = ? AND usuario_id = ? LIMIT 1',
        [pedidoId, req.usuario.id]
      );
      if (!rows.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }
      if (rows[0].status !== 'enviado') {
        return res.status(400).json({ erro: 'Só é possível confirmar recebimento de pedidos em entrega.' });
      }
      await pool.query(
        'UPDATE pedidos SET status = ?, entregue_em = COALESCE(entregue_em, NOW()) WHERE id = ?',
        ['entregue', pedidoId]
      );
      logger.info(`Cliente ${req.usuario.id} confirmou recebimento do pedido #${pedidoId}`);
      res.json({ mensagem: 'Recebimento confirmado com sucesso!', status: 'entregue' });
    } catch (erro) {
      logger.error('Erro ao confirmar recebimento:', erro);
      res.status(500).json({ erro: 'Não foi possível confirmar o recebimento.' });
    }
  });

  return router;
};
