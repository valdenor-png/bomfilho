/**
 * SSE Hub — gerencia conexões Server-Sent Events por pedido.
 *
 * Uso:
 *   const { addClient, removeClient, broadcast } = require('./lib/sseHub');
 *
 *   // Em uma rota SSE:
 *   addClient(pedidoId, res);
 *   req.on('close', () => removeClient(pedidoId, res));
 *
 *   // Quando o status muda (ex: webhook do MP):
 *   broadcast(pedidoId, { status: 'pago', pedido_id: 123 });
 */

// Map<pedidoId, Set<res>>
const clients = new Map();

function addClient(pedidoId, res) {
  const id = Number(pedidoId);
  if (!id) return;

  if (!clients.has(id)) {
    clients.set(id, new Set());
  }
  clients.get(id).add(res);
}

function removeClient(pedidoId, res) {
  const id = Number(pedidoId);
  if (!id) return;

  const set = clients.get(id);
  if (!set) return;

  set.delete(res);
  if (set.size === 0) {
    clients.delete(id);
  }
}

function broadcast(pedidoId, data) {
  const id = Number(pedidoId);
  if (!id) return;

  const set = clients.get(id);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;

  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

function getClientCount(pedidoId) {
  const id = Number(pedidoId);
  return clients.get(id)?.size || 0;
}

module.exports = { addClient, removeClient, broadcast, getClientCount };
