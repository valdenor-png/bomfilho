'use strict';

const express = require('express');
const { queryWithRetry } = require('../lib/db');

/**
 * Quick Reorder routes.
 *
 * Returns the user's most recent order with current product info and a
 * frequency-ranked list of their most-purchased items across the last
 * three orders.
 *
 * @param {Object}   deps
 * @param {Function} deps.autenticarToken
 */
module.exports = function createRecompraRoutes({ autenticarToken }) {
  const router = express.Router();

  // GET /api/recompra
  router.get('/', autenticarToken, async (req, res) => {
    try {
      const usuarioId = req.usuario?.id ?? req.userId;

      // ── 1. Last 3 orders (most recent first) ──────────────────────────
      const ordersResult = await queryWithRetry(
        `SELECT id, total, frete, metodo_pagamento, criado_em
           FROM pedidos
          WHERE usuario_id = $1
          ORDER BY criado_em DESC
          LIMIT 3`,
        [usuarioId]
      );

      const [pedidos] = ordersResult;

      if (!pedidos || pedidos.length === 0) {
        return res.json({ ultimo_pedido: null, mais_comprados: [] });
      }

      // ── 2. Items for those orders + current product data ───────────────
      const pedidoIds = pedidos.map((p) => p.id);

      const itemsResult = await queryWithRetry(
        `SELECT ip.pedido_id, ip.produto_id, ip.quantidade, ip.preco AS preco_unitario, ip.nome_produto AS nome,
                p.nome   AS nome_atual,
                p.preco  AS preco_atual,
                p.estoque,
                p.ativo,
                p.imagem_url
           FROM pedido_itens ip
           LEFT JOIN produtos p ON p.id = ip.produto_id
          WHERE ip.pedido_id = ANY($1)`,
        [pedidoIds]
      );

      const [itens] = itemsResult;

      // ── 3. Build ultimo_pedido (most recent order) ─────────────────────
      const ultimoPedido = pedidos[0];
      const itensUltimoPedido = itens
        .filter((i) => i.pedido_id === ultimoPedido.id)
        .map((i) => {
          const precoAtual = i.preco_atual != null ? Number(i.preco_atual) : null;
          const precoUnitario = Number(i.preco_unitario);
          const disponivel =
            i.produto_id != null &&
            i.ativo === true &&
            i.estoque != null &&
            i.estoque > 0;

          const item = {
            produto_id: i.produto_id,
            nome: i.nome_atual || i.nome,
            quantidade: i.quantidade,
            preco_atual: precoAtual,
            disponivel,
            imagem_url: i.imagem_url || null,
          };

          // Include preco_anterior only when the price actually changed
          if (precoAtual != null && precoAtual !== precoUnitario) {
            item.preco_anterior = precoUnitario;
          }

          return item;
        });

      // ── 4. Aggregate frequency across all 3 orders ─────────────────────
      const freqMap = new Map(); // produto_id → { ...data, frequencia }

      for (const i of itens) {
        if (i.produto_id == null) continue;

        if (freqMap.has(i.produto_id)) {
          freqMap.get(i.produto_id).frequencia += 1;
        } else {
          const disponivel =
            i.ativo === true && i.estoque != null && i.estoque > 0;

          freqMap.set(i.produto_id, {
            produto_id: i.produto_id,
            nome: i.nome_atual || i.nome,
            frequencia: 1,
            preco_atual: i.preco_atual != null ? Number(i.preco_atual) : null,
            disponivel,
            imagem_url: i.imagem_url || null,
          });
        }
      }

      const maisComprados = Array.from(freqMap.values()).sort(
        (a, b) => b.frequencia - a.frequencia
      );

      // ── 5. Respond ────────────────────────────────────────────────────
      return res.json({
        ultimo_pedido: {
          id: ultimoPedido.id,
          data: ultimoPedido.criado_em,
          total: Number(ultimoPedido.total),
          itens: itensUltimoPedido,
        },
        mais_comprados: maisComprados,
      });
    } catch (err) {
      console.error('[recompra] Erro ao buscar dados de recompra:', err);
      return res.status(500).json({ erro: 'Erro interno ao buscar recompra.' });
    }
  });

  return router;
};
