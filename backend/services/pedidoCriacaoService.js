'use strict';

const { DB_DIALECT } = require('../lib/config');
const { hashFingerprint } = require('./distributedIdempotencyService');

async function getTableColumns(connection, tableName) {
  const query = DB_DIALECT === 'postgres'
    ? `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true))
          AND table_name = ?`
    : `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`;

  const [rows] = await connection.query(query, [tableName]);

  return new Set(
    (rows || [])
      .map((row) => String(row?.COLUMN_NAME || row?.column_name || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

function hasColumn(columns, columnName) {
  return columns.has(String(columnName || '').trim().toLowerCase());
}

function montarFingerprintCriacaoPedido(payload = {}) {
  const itens = Array.isArray(payload?.itens)
    ? payload.itens
      .map((item) => ({
        produto_id: Number(item?.produto_id || 0),
        quantidade: Number(item?.quantidade || 0),
        unidade_venda: String(item?.unidade_venda || item?.unidadeVenda || '').trim().toLowerCase(),
        peso_gramas: Number(item?.peso_gramas || item?.pesoGramas || 0)
      }))
      .sort((a, b) => {
        if (a.produto_id !== b.produto_id) {
          return a.produto_id - b.produto_id;
        }
        if (a.peso_gramas !== b.peso_gramas) {
          return a.peso_gramas - b.peso_gramas;
        }
        return String(a.unidade_venda || '').localeCompare(String(b.unidade_venda || ''));
      })
    : [];

  const entrega = payload?.entrega && typeof payload.entrega === 'object'
    ? {
      cep: String(payload.entrega?.cep_destino || payload.entrega?.cep || '').replace(/\D/g, '').slice(0, 8),
      numero: String(payload.entrega?.numero_destino || payload.entrega?.numero || '').trim().slice(0, 20),
      veiculo: String(payload.entrega?.veiculo || '').trim().toLowerCase()
    }
    : null;

  return hashFingerprint({
    itens,
    forma_pagamento: String(payload?.forma_pagamento || '').trim().toLowerCase(),
    cupom_id: payload?.cupom_id ?? null,
    tipo_entrega: String(payload?.tipo_entrega || '').trim().toLowerCase(),
    tax_id: String(payload?.tax_id || payload?.cpf || '').replace(/\D/g, ''),
    entrega
  });
}

module.exports = {
  getTableColumns,
  hasColumn,
  montarFingerprintCriacaoPedido
};
