'use strict';

function normalizarParcelasCartao(valor) {
  const parcelas = Number.parseInt(valor, 10);
  if (!Number.isFinite(parcelas) || parcelas < 1) {
    return 1;
  }

  return Math.min(3, parcelas);
}

function normalizarTipoCartao(valor) {
  const tipo = String(valor || '').trim().toLowerCase();
  if (['debito', 'debit', 'debit_card'].includes(tipo)) {
    return 'debito';
  }

  return 'credito';
}

module.exports = {
  normalizarParcelasCartao,
  normalizarTipoCartao
};
