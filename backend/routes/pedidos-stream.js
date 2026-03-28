/**
 * SSE endpoint para acompanhamento de pedido em tempo real.
 *
 * GET /api/pedidos/:id/stream
 *
 * O cliente abre uma conexão SSE e recebe eventos quando o status
 * do pedido muda (via webhook do Mercado Pago ou ação do admin).
 */
const express = require('express');
const { addClient, removeClient } = require('../lib/sseHub');

module.exports = function createPedidosStreamRoutes({ autenticarToken }) {
  const router = express.Router();

  router.get('/api/pedidos/:id/stream', autenticarToken, (req, res) => {
    const pedidoId = Number(req.params.id);
    if (!pedidoId || !Number.isInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ erro: 'ID do pedido inválido.' });
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx proxy
    });

    // Heartbeat a cada 30s para manter a conexão viva
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // Evento inicial de conexão
    res.write(`data: ${JSON.stringify({ type: 'connected', pedido_id: pedidoId })}\n\n`);

    addClient(pedidoId, res);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(pedidoId, res);
    });
  });

  return router;
};
