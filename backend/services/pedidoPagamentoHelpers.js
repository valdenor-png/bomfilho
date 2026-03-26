'use strict';

const FORMAS_PAGAMENTO_PEDIDO_VALIDAS = new Set(['pix', 'dinheiro', 'debito', 'credito', 'cartao']);
const TIPOS_ENTREGA_PEDIDO_VALIDOS = new Set(['entrega', 'retirada']);

function extrairTaxIdDigits(payload = {}) {
  return String(
    payload?.tax_id
    ?? payload?.taxId
    ?? payload?.cpf
    ?? payload?.cpf_na_nota
    ?? payload?.cpfNota
    ?? payload?.documento
    ?? payload?.documento_pagador
    ?? payload?.cpf_pagador
    ?? ''
  ).replace(/\D/g, '');
}

function normalizarFormaPagamentoPedido(value) {
  return String(value || 'pix').trim().toLowerCase();
}

function normalizarTipoEntregaPedidoInput(value) {
  const tipo = String(value || 'entrega').trim().toLowerCase();
  return TIPOS_ENTREGA_PEDIDO_VALIDOS.has(tipo) ? tipo : 'entrega';
}

function normalizarItensPedidoInput(itens) {
  if (!Array.isArray(itens)) {
    return [];
  }

  return itens.map((item) => {
    const quantidadeRecebida = item?.quantidade;
    const quantidadeBase = (
      quantidadeRecebida === undefined
      || quantidadeRecebida === null
      || String(quantidadeRecebida).trim() === ''
    )
      ? 1
      : quantidadeRecebida;
    const pesoGramasRecebido = (
      item?.peso_gramas
      ?? item?.pesoGramas
      ?? item?.peso_gramas_selecionado
      ?? item?.pesoSelecionadoGramas
      ?? null
    );

    const pesoGramasNumero = Number(pesoGramasRecebido);
    const unidadeVendaRecebida = String(item?.unidade_venda || item?.unidadeVenda || '').trim().toLowerCase();

    return {
      produto_id: Number(item?.produto_id),
      quantidade: Number(quantidadeBase),
      unidade_venda: unidadeVendaRecebida,
      peso_gramas: Number.isFinite(pesoGramasNumero) && pesoGramasNumero > 0
        ? Math.round(pesoGramasNumero)
        : null
    };
  });
}

function itensPedidoSaoValidos(itensNormalizados = []) {
  if (!Array.isArray(itensNormalizados) || itensNormalizados.length === 0 || itensNormalizados.length > 100) {
    return false;
  }

  return !itensNormalizados.some((item) => (
    !Number.isInteger(item.produto_id)
    || item.produto_id <= 0
    || !Number.isFinite(Number(item.quantidade || 0))
    || Number(item.quantidade || 0) <= 0
    || Number(item.quantidade || 0) > 999
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
    numeroDestino: String(entrega.numero_destino || entrega.numero || '').trim(),
    estimate_id: String(entrega.estimate_id || entrega.estimateId || '').trim() || null
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
  TIPOS_ENTREGA_PEDIDO_VALIDOS,
  extrairTaxIdDigits,
  normalizarFormaPagamentoPedido,
  normalizarTipoEntregaPedidoInput,
  normalizarItensPedidoInput,
  itensPedidoSaoValidos,
  normalizarEntregaPedidoInput,
  buscarPedidoDoUsuarioPorId
};
