'use strict';

const STATUS_TIMESTAMP_COLUNA = Object.freeze({
  pago: 'pago_em',
  preparando: 'em_preparo_em',
  pronto_para_retirada: 'pronto_em',
  enviado: 'saiu_entrega_em',
  entregue: 'entregue_em',
  retirado: 'retirado_em',
  cancelado: 'cancelado_em'
});

function calcularMetricasTempoOperacional(pedido) {
  if (!pedido || typeof pedido !== 'object') return {};

  const ts = (campo) => {
    const val = pedido[campo];
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  };

  const base = ts('pago_em') || ts('criado_em');
  const prontoMs = ts('pronto_em');
  const saiuMs = ts('saiu_entrega_em');
  const entregueMs = ts('entregue_em');
  const retiradoMs = ts('retirado_em');
  const canceladoMs = ts('cancelado_em');

  const diff = (a, b) => (a && b && a > b ? a - b : null);

  return {
    tempo_ate_preparo_ms: diff(prontoMs, base),
    tempo_aguardando_coleta_ms: diff(saiuMs, prontoMs),
    tempo_de_rota_ms: diff(entregueMs, saiuMs),
    tempo_total_entrega_ms: diff(entregueMs, base),
    tempo_espera_retirada_ms: diff(retiradoMs, prontoMs),
    tempo_total_retirada_ms: diff(retiradoMs, base),
    tempo_ate_cancelamento_ms: diff(canceladoMs, base)
  };
}

function calcularPeriodoDashboard(periodo, inicioCustom, fimCustom) {
  const agora = new Date();
  const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
  const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  let inicio;
  let fim;

  switch (periodo) {
    case 'ontem': {
      const ontem = new Date(hojeInicio);
      ontem.setDate(ontem.getDate() - 1);
      inicio = ontem;
      fim = new Date(hojeInicio.getTime() - 1);
      break;
    }
    case '7d': {
      const d = new Date(hojeInicio);
      d.setDate(d.getDate() - 6);
      inicio = d;
      fim = hojeFim;
      break;
    }
    case '30d': {
      const d = new Date(hojeInicio);
      d.setDate(d.getDate() - 29);
      inicio = d;
      fim = hojeFim;
      break;
    }
    case 'mes': {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      fim = hojeFim;
      break;
    }
    case 'custom': {
      inicio = inicioCustom ? new Date(inicioCustom + 'T00:00:00') : hojeInicio;
      fim = fimCustom ? new Date(fimCustom + 'T23:59:59.999') : hojeFim;
      break;
    }
    default:
      inicio = hojeInicio;
      fim = hojeFim;
  }

  const duracao = fim.getTime() - inicio.getTime();
  const anteriorFim = new Date(inicio.getTime() - 1);
  const anteriorInicio = new Date(anteriorFim.getTime() - duracao);

  return { inicio, fim, anteriorInicio, anteriorFim };
}

module.exports = {
  STATUS_TIMESTAMP_COLUNA,
  calcularMetricasTempoOperacional,
  calcularPeriodoDashboard
};
