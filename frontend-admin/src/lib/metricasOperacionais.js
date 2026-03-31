/**
 * Utilitários de métricas operacionais para pedidos (admin).
 * Formata duração, classifica SLA e extrai tempos de etapas.
 *
 * Centraliza todas as regras de cálculo e apresentação de tempo operacional.
 * Não depende de horário do navegador — consome timestamps já calculados pelo servidor.
 */

// =============================================
// Formatação de duração
// =============================================

/**
 * Formata millisegundos em texto legível: "8 min", "42 min", "1h 08min", "2h 03min".
 * Retorna '–' se o valor for inválido ou null.
 */
export function formatarDuracaoMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '–';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return '<1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  const minPad = String(minutos).padStart(2, '0');
  return minutos > 0 ? `${horas}h ${minPad}min` : `${horas}h`;
}

// =============================================
// Classificação SLA — faixas centralizadas
// =============================================

/**
 * Limites de SLA por tipo de etapa (em minutos).
 * Alteração futura deve ser feita apenas aqui.
 */
export const SLA_CONFIG = Object.freeze({
  preparo:  { okMin: 20, atencaoMin: 35 },
  rota:     { okMin: 25, atencaoMin: 45 },
  total:    { okMin: 45, atencaoMin: 75 },
  retirada: { okMin: 15, atencaoMin: 30 }
});

/**
 * Retorna tone de SLA: 'ok' | 'atencao' | 'atrasado' | null
 * @param {number|null} ms - duração em ms
 * @param {'preparo'|'rota'|'total'|'retirada'} tipo
 */
export function classificarSla(ms, tipo) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const cfg = SLA_CONFIG[tipo];
  if (!cfg) return null;
  if (ms <= cfg.okMin * 60000) return 'ok';
  if (ms <= cfg.atencaoMin * 60000) return 'atencao';
  return 'atrasado';
}

/**
 * Label legível do SLA para exibição.
 */
export function labelSla(tone) {
  if (tone === 'ok') return 'No prazo';
  if (tone === 'atencao') return 'Atenção';
  if (tone === 'atrasado') return 'Atrasado';
  return '';
}

// =============================================
// Labels de etapas — centralizadas
// =============================================

export const ETAPA_LABELS = Object.freeze({
  criado: 'Criado',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  saiu_entrega: 'Saiu p/ entrega',
  entregue: 'Entregue',
  retirado: 'Retirado',
  cancelado: 'Cancelado'
});

// =============================================
// Extração de métricas de um pedido
// =============================================

/**
 * Extrai métricas de tempo de um pedido retornado pela API admin.
 * Retorna objeto com valores formatados e tons SLA.
 */
export function extrairMetricasTempoPedido(pedido) {
  if (!pedido || typeof pedido !== 'object') return null;

  const tipoRaw = String(pedido.tipo_entrega || pedido.tipoEntregaNormalizado || '').toLowerCase();
  const isRetirada = tipoRaw === 'retirada';
  const isCancelado = String(pedido.status || pedido.statusNormalizado || '').toLowerCase() === 'cancelado';

  const preparoMs = pedido.tempo_ate_preparo_ms ?? null;
  const rotaMs = pedido.tempo_de_rota_ms ?? null;
  const aguardandoColetaMs = pedido.tempo_aguardando_coleta_ms ?? null;
  const totalEntregaMs = pedido.tempo_total_entrega_ms ?? null;
  const esperaRetiradaMs = pedido.tempo_espera_retirada_ms ?? null;
  const totalRetiradaMs = pedido.tempo_total_retirada_ms ?? null;
  const cancelamentoMs = pedido.tempo_ate_cancelamento_ms ?? null;

  const totalMs = isRetirada ? totalRetiradaMs : totalEntregaMs;

  return {
    isRetirada,
    isCancelado,
    preparo: {
      ms: preparoMs,
      label: formatarDuracaoMs(preparoMs),
      sla: classificarSla(preparoMs, 'preparo')
    },
    rota: isRetirada ? null : {
      ms: rotaMs,
      label: formatarDuracaoMs(rotaMs),
      sla: classificarSla(rotaMs, 'rota')
    },
    aguardandoColeta: isRetirada ? null : {
      ms: aguardandoColetaMs,
      label: formatarDuracaoMs(aguardandoColetaMs)
    },
    esperaRetirada: isRetirada ? {
      ms: esperaRetiradaMs,
      label: formatarDuracaoMs(esperaRetiradaMs),
      sla: classificarSla(esperaRetiradaMs, 'retirada')
    } : null,
    total: {
      ms: totalMs,
      label: formatarDuracaoMs(totalMs),
      sla: classificarSla(totalMs, 'total')
    },
    cancelamento: isCancelado ? {
      ms: cancelamentoMs,
      label: cancelamentoMs != null ? `Cancelado após ${formatarDuracaoMs(cancelamentoMs)}` : 'Cancelado'
    } : null
  };
}

// =============================================
// Timeline de etapas com timestamps
// =============================================

/**
 * Monta timeline enriquecida a partir dos timestamps do pedido.
 * Inclui horário, duração e descrição semântica para cada etapa.
 */
export function montarTimelineEtapas(pedido) {
  if (!pedido || typeof pedido !== 'object') return [];

  const tipoRaw = String(pedido.tipo_entrega || pedido.tipoEntregaNormalizado || '').toLowerCase();
  const isRetirada = tipoRaw === 'retirada';

  const parseDt = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const fmtHora = (d) => {
    if (!d) return null;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const criadoEm = parseDt(pedido.criado_em);
  const pagoEm = parseDt(pedido.pago_em);
  const emPreparoEm = parseDt(pedido.em_preparo_em);
  const prontoEm = parseDt(pedido.pronto_em);
  const saiuEntregaEm = parseDt(pedido.saiu_entrega_em);
  const entregueEm = parseDt(pedido.entregue_em);
  const retiradoEm = parseDt(pedido.retirado_em);
  const canceladoEm = parseDt(pedido.cancelado_em);

  const etapas = [
    { id: 'criado', label: ETAPA_LABELS.criado, dt: criadoEm, hora: fmtHora(criadoEm) },
    { id: 'pago', label: ETAPA_LABELS.pago, dt: pagoEm, hora: fmtHora(pagoEm) },
    { id: 'em_preparo', label: ETAPA_LABELS.em_preparo, dt: emPreparoEm, hora: fmtHora(emPreparoEm) },
    { id: 'pronto', label: ETAPA_LABELS.pronto, dt: prontoEm, hora: fmtHora(prontoEm) }
  ];

  if (isRetirada) {
    etapas.push({ id: 'retirado', label: ETAPA_LABELS.retirado, dt: retiradoEm, hora: fmtHora(retiradoEm) });
  } else {
    etapas.push(
      { id: 'saiu_entrega', label: ETAPA_LABELS.saiu_entrega, dt: saiuEntregaEm, hora: fmtHora(saiuEntregaEm) },
      { id: 'entregue', label: ETAPA_LABELS.entregue, dt: entregueEm, hora: fmtHora(entregueEm) }
    );
  }

  if (canceladoEm) {
    etapas.push({ id: 'cancelado', label: ETAPA_LABELS.cancelado, dt: canceladoEm, hora: fmtHora(canceladoEm) });
  }

  // Duração entre etapas consecutivas + descrição semântica
  for (let i = 1; i < etapas.length; i++) {
    const prev = etapas[i - 1];
    const curr = etapas[i];
    if (prev.dt && curr.dt) {
      const diffMs = curr.dt.getTime() - prev.dt.getTime();
      curr.duracaoDesdeAnterior = diffMs >= 0 ? diffMs : null;
      curr.duracaoDesdeAnteriorLabel = diffMs >= 0 ? formatarDuracaoMs(diffMs) : null;

      // Descrição semântica para gerência
      if (diffMs >= 0) {
        const durLabel = formatarDuracaoMs(diffMs);
        if (curr.id === 'pronto') curr.descricao = `Ficou pronto em ${durLabel}`;
        else if (curr.id === 'saiu_entrega') curr.descricao = `Aguardou coleta ${durLabel}`;
        else if (curr.id === 'entregue') curr.descricao = `Rota: ${durLabel}`;
        else if (curr.id === 'retirado') curr.descricao = `Retirado após ${durLabel}`;
        else if (curr.id === 'cancelado') curr.descricao = `Cancelado após ${durLabel}`;
      }
    }
  }

  return etapas;
}

/**
 * Calcula tempo total do pedido a partir da timeline (primeiro até último evento).
 */
export function calcularTempoTotalTimeline(etapas) {
  if (!Array.isArray(etapas) || etapas.length < 2) return null;
  const primeiro = etapas.find((e) => e.dt);
  const etapasComDt = etapas.filter((e) => e.dt);
  const ultimo = etapasComDt[etapasComDt.length - 1];
  if (!primeiro || !ultimo || primeiro === ultimo) return null;
  const diff = ultimo.dt.getTime() - primeiro.dt.getTime();
  return diff >= 0 ? diff : null;
}
