'use strict';

const FORMAS_PAGAMENTO_PEDIDO_VALIDAS = new Set(['pix', 'dinheiro', 'debito', 'credito', 'cartao']);

function extrairTaxIdDigits(payload = {}) {
  return String(payload?.tax_id ?? payload?.cpf ?? '').replace(/\D/g, '');
}

function normalizarFormaPagamentoPedido(value) {
  return String(value || 'pix').trim().toLowerCase();
}

function normalizarItensPedidoInput(itens) {
  if (!Array.isArray(itens)) {
    return [];
  }

  return itens.map((item) => ({
    produto_id: Number(item?.produto_id),
    quantidade: Math.floor(Number(item?.quantidade || 1))
  }));
}

function itensPedidoSaoValidos(itensNormalizados = []) {
  if (!Array.isArray(itensNormalizados) || itensNormalizados.length === 0 || itensNormalizados.length > 100) {
    return false;
  }

  return !itensNormalizados.some((item) => (
    !Number.isInteger(item.produto_id)
    || item.produto_id <= 0
    || !Number.isInteger(item.quantidade)
    || item.quantidade <= 0
    || item.quantidade > 100
  ));
}

function normalizarEntregaPedidoInput(entrega, normalizarCepFn) {
  if (!entrega || typeof entrega !== 'object') {
    return null;
  }

  const normalizarCep = typeof normalizarCepFn === 'function'
    ? normalizarCepFn
    : (valor) => String(valor || '').replace(/\D/g, '').slice(0, 8);

  return {
    veiculo: String(entrega.veiculo || 'moto').trim().toLowerCase(),
    cepDestino: normalizarCep(entrega.cep_destino || entrega.cep),
    numeroDestino: String(entrega.numero_destino || entrega.numero || '').trim()
  };
}

async function buscarPedidoDoUsuarioPorId({ connection, pedidoId, usuarioId } = {}) {
  if (!connection) {
    throw new Error('Conexão de banco não informada para buscar pedido do usuário.');
  }

  const pedidoIdNumerico = Number.parseInt(String(pedidoId || ''), 10);
  if (!Number.isInteger(pedidoIdNumerico) || pedidoIdNumerico <= 0) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT p.id, p.total, p.status, p.forma_pagamento, u.email, u.nome
     FROM pedidos p
     JOIN usuarios u ON p.usuario_id = u.id
     WHERE p.id = ? AND p.usuario_id = ?
     LIMIT 1`,
    [pedidoIdNumerico, usuarioId]
  );

  return rows.length ? rows[0] : null;
}

module.exports = {
  FORMAS_PAGAMENTO_PEDIDO_VALIDAS,
  extrairTaxIdDigits,
  normalizarFormaPagamentoPedido,
  normalizarItensPedidoInput,
  itensPedidoSaoValidos,
  normalizarEntregaPedidoInput,
  buscarPedidoDoUsuarioPorId
};
