'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');

async function getPedidosColumns() {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'pedidos'`
  );

  return new Set(
    (rows || [])
      .map((row) => String(row?.COLUMN_NAME || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

function selectOptional(columns, columnName, alias, tableAlias = 'p') {
  const normalized = String(columnName || '').trim().toLowerCase();
  return columns.has(normalized)
    ? `${tableAlias}.${columnName} AS ${alias}`
    : `NULL AS ${alias}`;
}

function getOrderByClause(columns, tableAlias = 'p') {
  if (columns.has('criado_em')) {
    return `${tableAlias}.criado_em DESC`;
  }

  if (columns.has('atualizado_em')) {
    return `${tableAlias}.atualizado_em DESC`;
  }

  return `${tableAlias}.id DESC`;
}

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
      const columns = await getPedidosColumns();
      const selectPedidosList = [
        'p.id',
        'p.usuario_id',
        'p.total',
        selectOptional(columns, 'taxa_servico', 'taxa_servico'),
        'p.status',
        selectOptional(columns, 'forma_pagamento', 'forma_pagamento'),
        selectOptional(columns, 'tipo_entrega', 'tipo_entrega'),
        selectOptional(columns, 'pix_codigo', 'pix_codigo'),
        selectOptional(columns, 'pix_qrcode', 'pix_qrcode'),
        selectOptional(columns, 'pix_id', 'pix_id'),
        selectOptional(columns, 'pix_status', 'pix_status'),
        selectOptional(columns, 'frete_cobrado_cliente', 'frete_cobrado_cliente'),
        selectOptional(columns, 'frete_real_uber', 'frete_real_uber'),
        selectOptional(columns, 'margem_pedido', 'margem_pedido'),
        selectOptional(columns, 'uber_delivery_id', 'uber_delivery_id'),
        selectOptional(columns, 'uber_tracking_url', 'uber_tracking_url'),
        selectOptional(columns, 'uber_vehicle_type', 'uber_vehicle_type'),
        selectOptional(columns, 'uber_eta_seconds', 'uber_eta_seconds'),
        selectOptional(columns, 'entrega_status', 'entrega_status'),
        selectOptional(columns, 'criado_em', 'criado_em'),
        selectOptional(columns, 'atualizado_em', 'atualizado_em')
      ].join(',\n                ');
      const orderByClause = getOrderByClause(columns);

      const usarPaginacao = ['page', 'pagina', 'limit', 'limite']
        .some((chave) => req.query?.[chave] !== undefined);

      if (!usarPaginacao) {
        const [pedidos] = await pool.query(
          `SELECT ${selectPedidosList}
             FROM pedidos p
            WHERE p.usuario_id = ?
            ORDER BY ${orderByClause}`,
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
        `SELECT ${selectPedidosList}
           FROM pedidos p
          WHERE p.usuario_id = ?
          ORDER BY ${orderByClause}
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
      const columns = await getPedidosColumns();

      const [pedidos] = await pool.query(
        `SELECT p.id,
                p.usuario_id,
                p.total,
                ${selectOptional(columns, 'taxa_servico', 'taxa_servico')},
                p.status,
                ${selectOptional(columns, 'forma_pagamento', 'forma_pagamento')},
                ${selectOptional(columns, 'tipo_entrega', 'tipo_entrega')},
                ${selectOptional(columns, 'pix_codigo', 'pix_codigo')},
                ${selectOptional(columns, 'pix_qrcode', 'pix_qrcode')},
                ${selectOptional(columns, 'pix_id', 'pix_id')},
                ${selectOptional(columns, 'pix_status', 'pix_status')},
                ${selectOptional(columns, 'frete_cobrado_cliente', 'frete_cobrado_cliente')},
                ${selectOptional(columns, 'frete_real_uber', 'frete_real_uber')},
                ${selectOptional(columns, 'margem_pedido', 'margem_pedido')},
                ${selectOptional(columns, 'uber_delivery_id', 'uber_delivery_id')},
                ${selectOptional(columns, 'uber_tracking_url', 'uber_tracking_url')},
                ${selectOptional(columns, 'uber_vehicle_type', 'uber_vehicle_type')},
                ${selectOptional(columns, 'uber_eta_seconds', 'uber_eta_seconds')},
                ${selectOptional(columns, 'entrega_status', 'entrega_status')},
                ${selectOptional(columns, 'criado_em', 'criado_em')},
                ${selectOptional(columns, 'atualizado_em', 'atualizado_em')}
           FROM pedidos p
          WHERE p.id = ? AND p.usuario_id = ?`,
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
      const columns = await getPedidosColumns();

      const [rows] = await pool.query(
        `SELECT p.id,
                p.status,
                ${selectOptional(columns, 'tipo_entrega', 'tipo_entrega')},
                ${selectOptional(columns, 'forma_pagamento', 'forma_pagamento')},
                ${selectOptional(columns, 'uber_delivery_id', 'uber_delivery_id')},
                ${selectOptional(columns, 'uber_tracking_url', 'uber_tracking_url')},
                ${selectOptional(columns, 'uber_vehicle_type', 'uber_vehicle_type')},
                ${selectOptional(columns, 'uber_eta_seconds', 'uber_eta_seconds')},
                ${selectOptional(columns, 'entrega_status', 'entrega_status')},
                ${selectOptional(columns, 'frete_cobrado_cliente', 'frete_cobrado_cliente')},
                ${selectOptional(columns, 'frete_real_uber', 'frete_real_uber')},
                ${selectOptional(columns, 'margem_pedido', 'margem_pedido')},
                ${selectOptional(columns, 'pago_em', 'pago_em')},
                ${selectOptional(columns, 'em_preparo_em', 'em_preparo_em')},
                ${selectOptional(columns, 'pronto_em', 'pronto_em')},
                ${selectOptional(columns, 'saiu_entrega_em', 'saiu_entrega_em')},
                ${selectOptional(columns, 'entregue_em', 'entregue_em')},
                ${selectOptional(columns, 'retirado_em', 'retirado_em')},
                ${selectOptional(columns, 'cancelado_em', 'cancelado_em')},
                ${selectOptional(columns, 'atualizado_em', 'atualizado_em')}
           FROM pedidos p
          WHERE p.id = ? AND p.usuario_id = ?
          LIMIT 1`,
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
