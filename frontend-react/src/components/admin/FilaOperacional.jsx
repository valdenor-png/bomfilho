import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  adminGetFilaOperacional,
  adminAtualizarStatusPedido,
  adminAprovarRevisao,
  adminRejeitarRevisao,
  adminListarEntregasUber,
  adminCriarEntregaUber,
  adminCancelarEntregaUber
} from '../../lib/api';
import LoadingSkeleton from './ui/LoadingSkeleton';

const R$ = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Filas operacionais com labels atualizados
const LABELS_FILA = {
  aguardando_revisao: { titulo: '📋 Revisão — Confirmar Disponibilidade', cor: '#f97316', proximoStatus: null, btnLabel: null, btnClass: null, isRevisao: true },
  pagos_aguardando_preparo: { titulo: '💳 Pagos — Aguardando Separação', cor: '#3b82f6', proximoStatus: 'preparando', btnLabel: '📦 Separar Pedido', btnClass: 'btn-separar' },
  em_separacao: { titulo: '📦 Separando', cor: '#8b5cf6', proximoStatus: 'pronto_para_retirada', btnLabel: '✅ Marcar Preparado', btnClass: 'btn-preparado' },
  prontos_aguardando_saida: { titulo: '✅ Preparados — Despachar', cor: '#10b981', proximoStatus: 'enviado', btnLabel: '🛵 Saiu pra Entrega', btnClass: 'btn-despachar' },
  em_rota: { titulo: '🛵 Saiu pra Entrega', cor: '#f59e0b', proximoStatus: 'entregue', btnLabel: '🏁 Confirmar Entrega', btnClass: 'btn-entregue' },
  em_rota_acima_sla: { titulo: '🚨 Em Rota — Acima do SLA', cor: '#ef4444', proximoStatus: 'entregue', btnLabel: '🏁 Confirmar Entrega', btnClass: 'btn-entregue' },
  retiradas_prontas_aguardando: { titulo: '🏪 Retiradas — Avisar Cliente', cor: '#0891b2', proximoStatus: 'retirado', btnLabel: '👋 Marcar Retirado', btnClass: 'btn-retirado' },
  pendentes_pagamento: { titulo: '⏳ Aguardando Pagamento', cor: '#9ca3af', proximoStatus: null, btnLabel: null, btnClass: null },
  travados: { titulo: '⚠️ Travados (+60min)', cor: '#6b7280', proximoStatus: null, btnLabel: null, btnClass: null }
};

const STATUS_DISPLAY = {
  aguardando_revisao: { label: 'Em Revisão', icon: '📋', cor: '#f97316' },
  pendente: { label: 'Aguardando', icon: '⏳', cor: '#9ca3af' },
  pago: { label: 'Pago', icon: '💳', cor: '#3b82f6' },
  preparando: { label: 'Separando', icon: '📦', cor: '#8b5cf6' },
  pronto_para_retirada: { label: 'Preparado', icon: '✅', cor: '#10b981' },
  enviado: { label: 'Saiu pra Entrega', icon: '🛵', cor: '#f59e0b' },
  entregue: { label: 'Entregue', icon: '🏁', cor: '#22c55e' },
  retirado: { label: 'Retirado', icon: '👋', cor: '#22c55e' },
  cancelado: { label: 'Cancelado', icon: '⛔', cor: '#ef4444' }
};

function StatusBadge({ status }) {
  const meta = STATUS_DISPLAY[status] || { label: status, icon: '📋', cor: '#6b7280' };
  return (
    <span className="fila-status-badge" style={{ background: `${meta.cor}18`, color: meta.cor, borderColor: `${meta.cor}40` }}>
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </span>
  );
}

function ProgressoEtapas({ status, tipoEntrega }) {
  const isRetirada = tipoEntrega === 'retirada';
  const etapas = isRetirada
    ? [{ key: 'pago', label: 'Pago' }, { key: 'preparando', label: 'Separando' }, { key: 'pronto_para_retirada', label: 'Preparado' }, { key: 'retirado', label: 'Retirado' }]
    : [{ key: 'pago', label: 'Pago' }, { key: 'preparando', label: 'Separando' }, { key: 'pronto_para_retirada', label: 'Preparado' }, { key: 'enviado', label: 'Em Entrega' }, { key: 'entregue', label: 'Entregue' }];

  const ordemStatus = etapas.map(e => e.key);
  const idxAtual = ordemStatus.indexOf(status);

  return (
    <div className="fila-progresso-etapas">
      {etapas.map((etapa, i) => {
        const done = i < idxAtual;
        const current = i === idxAtual;
        return (
          <div key={etapa.key} className={`fila-etapa ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
            <span className="fila-etapa-dot" />
            <span className="fila-etapa-label">{etapa.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FilaPedidoCard({ pedido, filaConfig, onAcao, onRevisao, atualizandoId }) {
  const minParado = Number(pedido.minutos_parado || pedido.minutos_rota || pedido.minutos_pendente || pedido.minutos_desde_criacao || 0);
  const urgente = minParado > 30;
  const critico = minParado > 60;

  return (
    <div className={`fila-card ${critico ? 'is-critico' : urgente ? 'is-urgente' : ''}`}>
      <div className="fila-card-header">
        <span className="fila-card-id">#{pedido.id}</span>
        <span className="fila-card-tempo" title={`${minParado}min parado`}>
          ⏱ {minParado >= 60 ? `${Math.floor(minParado / 60)}h${minParado % 60}m` : `${minParado}min`}
        </span>
      </div>

      <div className="fila-card-info">
        <span className="fila-card-cliente">{pedido.cliente_nome || '—'}</span>
        <span className="fila-card-valor">{R$(pedido.total)}</span>
      </div>

      <div className="fila-card-meta">
        <span className="fila-card-tipo">
          {pedido.tipo_entrega === 'retirada' ? '🏪 Retirada' : '🚗 Entrega'}
        </span>
        <StatusBadge status={pedido.status} />
      </div>

      <ProgressoEtapas status={pedido.status} tipoEntrega={pedido.tipo_entrega} />

      {filaConfig.isRevisao ? (
        <div className="fila-card-acoes fila-card-acoes-revisao">
          <button
            className="fila-btn-acao btn-aprovar-revisao"
            disabled={atualizandoId === pedido.id}
            onClick={() => onRevisao(pedido.id, 'aprovar')}
          >
            {atualizandoId === pedido.id ? 'Processando...' : '✅ Aprovar'}
          </button>
          <button
            className="fila-btn-acao btn-rejeitar-revisao"
            disabled={atualizandoId === pedido.id}
            onClick={() => onRevisao(pedido.id, 'rejeitar')}
          >
            ❌ Rejeitar
          </button>
        </div>
      ) : filaConfig.proximoStatus && (
        <div className="fila-card-acoes">
          <button
            className={`fila-btn-acao ${filaConfig.btnClass || ''}`}
            disabled={atualizandoId === pedido.id}
            onClick={() => onAcao(pedido.id, filaConfig.proximoStatus)}
          >
            {atualizandoId === pedido.id ? 'Atualizando...' : filaConfig.btnLabel}
          </button>
          {/* Botão cancelar sempre disponível */}
          <button
            className="fila-btn-cancelar"
            disabled={atualizandoId === pedido.id}
            onClick={() => onAcao(pedido.id, 'cancelado')}
            title="Cancelar pedido"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function FilaGrupo({ chave, pedidos, onAcao, onRevisao, atualizandoId }) {
  const cfg = LABELS_FILA[chave];
  if (!cfg || !pedidos || pedidos.length === 0) return null;

  return (
    <div className="fila-grupo">
      <div className="fila-grupo-header" style={{ borderLeftColor: cfg.cor }}>
        <span className="fila-grupo-titulo">{cfg.titulo}</span>
        <span className="fila-grupo-badge" style={{ background: cfg.cor }}>{pedidos.length}</span>
      </div>
      <div className="fila-grupo-cards">
        {pedidos.map(p => (
          <FilaPedidoCard
            key={p.id}
            pedido={p}
            filaConfig={cfg}
            onAcao={onAcao}
            onRevisao={onRevisao}
            atualizandoId={atualizandoId}
          />
        ))}
      </div>
    </div>
  );
}

export default function FilaOperacional() {
  const [dados, setDados] = useState(null);
  const [entregasUber, setEntregasUber] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [atualizandoId, setAtualizandoId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const intervaloRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [respFila, respUber] = await Promise.all([
        adminGetFilaOperacional(),
        adminListarEntregasUber().catch(() => ({ pedidos: [] }))
      ]);
      const resp = respFila;
      setDados(resp);
      setEntregasUber(Array.isArray(respUber?.pedidos) ? respUber.pedidos : []);
      setErro(null);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar fila operacional');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [carregar]);

  useEffect(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    if (autoRefresh) {
      intervaloRef.current = setInterval(carregar, 30000);
    }
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, [autoRefresh, carregar]);

  const handleAcao = useCallback(async (pedidoId, novoStatus) => {
    if (novoStatus === 'cancelado') {
      if (!window.confirm(`Tem certeza que deseja cancelar o pedido #${pedidoId}?`)) return;
    }
    setAtualizandoId(pedidoId);
    try {
      await adminAtualizarStatusPedido(pedidoId, novoStatus);
      const labelStatus = STATUS_DISPLAY[novoStatus]?.label || novoStatus;
      setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} → ${labelStatus}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao atualizar status' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  const handleChamarUber = useCallback(async (pedido) => {
    const pedidoId = Number(pedido?.id || 0);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return;
    }

    setAtualizandoId(pedidoId);
    try {
      await adminCriarEntregaUber({
        pedidoId,
        estimateId: pedido?.uber_estimate_id
      });
      setFeedback({ tipo: 'ok', msg: `Entrega Uber criada para pedido #${pedidoId}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Falha ao chamar Uber' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  const handleCancelarUber = useCallback(async (pedido) => {
    const pedidoId = Number(pedido?.id || 0);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return;
    }

    if (!window.confirm(`Cancelar entrega Uber do pedido #${pedidoId}?`)) {
      return;
    }

    setAtualizandoId(pedidoId);
    try {
      await adminCancelarEntregaUber({
        pedidoId,
        motivo: 'cancelamento_operacional_admin'
      });
      setFeedback({ tipo: 'ok', msg: `Entrega Uber cancelada no pedido #${pedidoId}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Falha ao cancelar entrega Uber' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  const handleRevisao = useCallback(async (pedidoId, acao) => {
    if (acao === 'rejeitar') {
      const motivo = window.prompt(`Motivo da rejeição do pedido #${pedidoId}:`);
      if (motivo === null) return; // cancelou prompt
      setAtualizandoId(pedidoId);
      try {
        await adminRejeitarRevisao(pedidoId, motivo || 'Produto(s) indisponível(is)');
        setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} rejeitado — estoque restaurado` });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
        await carregar();
      } catch (e) {
        setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao rejeitar revisão' });
      } finally {
        setAtualizandoId(null);
      }
    } else {
      setAtualizandoId(pedidoId);
      try {
        await adminAprovarRevisao(pedidoId, '');
        setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} aprovado — aguardando pagamento` });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
        await carregar();
      } catch (e) {
        setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao aprovar revisão' });
      } finally {
        setAtualizandoId(null);
      }
    }
  }, [carregar]);

  if (carregando) return <LoadingSkeleton type="cards" lines={4} />;
  if (erro) return <div className="fila-erro">{erro} <button onClick={carregar}>Tentar novamente</button></div>;
  if (!dados) return null;

  const totalAlertas = Object.values(dados.contadores || {}).reduce((s, v) => s + v, 0);
  const ordemFilas = [
    'aguardando_revisao',
    'pagos_aguardando_preparo',
    'em_separacao',
    'prontos_aguardando_saida',
    'em_rota',
    'em_rota_acima_sla',
    'retiradas_prontas_aguardando',
    'pendentes_pagamento',
    'travados'
  ];

  return (
    <div className="fila-operacional">
      <div className="fila-header">
        <h2 className="fila-titulo">
          🎯 Fila Operacional
          {totalAlertas > 0 && <span className="fila-total-badge">{totalAlertas} ações</span>}
        </h2>
        <div className="fila-controles">
          <label className="fila-auto-refresh">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh 30s
          </label>
          <button className="fila-btn-refresh" onClick={carregar}>⟳ Atualizar</button>
        </div>
      </div>

      {feedback && (
        <div className={`fila-feedback is-${feedback.tipo}`}>{feedback.msg}</div>
      )}

      {/* Contadores rápidos */}
      <div className="fila-contadores">
        {Object.entries(dados.contadores || {}).map(([k, v]) => {
          const cfg = LABELS_FILA[k];
          if (!cfg) return null;
          return (
            <div key={k} className="fila-contador" style={{ borderLeftColor: cfg.cor }}>
              <span className="fila-contador-valor" style={{ color: v > 0 ? cfg.cor : '#6b7280' }}>{v}</span>
              <span className="fila-contador-label">{cfg.titulo.replace(/^[^\s]+\s/, '')}</span>
            </div>
          );
        })}
      </div>

      {totalAlertas === 0 && (
        <div className="fila-vazia">✅ Nenhum pedido pendente de ação. Operação em dia!</div>
      )}

      {/* Filas por prioridade */}
      <div className="fila-grupos">
        {ordemFilas.map(chave => (
          <FilaGrupo key={chave} chave={chave} pedidos={dados[chave]} onAcao={handleAcao} onRevisao={handleRevisao} atualizandoId={atualizandoId} />
        ))}
      </div>

      <div className="fila-grupo" style={{ marginTop: 16 }}>
        <div className="fila-grupo-header" style={{ borderLeftColor: '#111827' }}>
          <span className="fila-grupo-titulo">🚚 Uber Direct — Operação de Entrega</span>
          <span className="fila-grupo-badge" style={{ background: '#111827' }}>{entregasUber.length}</span>
        </div>

        {entregasUber.length === 0 ? (
          <div className="fila-vazia">Sem pedidos de entrega para Uber no momento.</div>
        ) : (
          <div className="fila-grupo-cards">
            {entregasUber.map((pedido) => {
              const emEnvio = String(pedido?.status || '').toLowerCase() === 'enviado';
              const possuiEntrega = Boolean(String(pedido?.uber_delivery_id || '').trim());
              const freteCliente = Number(pedido?.frete_cobrado_cliente || 0);
              const freteUber = Number(pedido?.frete_real_uber || 0);
              const margem = Number(pedido?.margem_pedido || 0);

              return (
                <article key={`uber-${pedido.id}`} className="fila-card">
                  <div className="fila-card-header">
                    <span className="fila-card-id">#{pedido.id}</span>
                    <span className="fila-card-tempo">{pedido?.entrega_status || 'pendente'}</span>
                  </div>
                  <div className="fila-card-info">
                    <span className="fila-card-cliente">{pedido?.cliente_nome || '—'}</span>
                    <span className="fila-card-valor">{R$(pedido?.total)}</span>
                  </div>
                  <div className="fila-card-meta" style={{ display: 'grid', gap: 4 }}>
                    <span>Frete cliente: <strong>{R$(freteCliente)}</strong></span>
                    <span>Frete Uber: <strong>{freteUber > 0 ? R$(freteUber) : '—'}</strong></span>
                    <span>Margem: <strong>{R$(margem)}</strong></span>
                    {pedido?.uber_vehicle_type ? <span>Veículo: <strong>{String(pedido.uber_vehicle_type).toUpperCase()}</strong></span> : null}
                  </div>
                  <div className="fila-card-acoes" style={{ marginTop: 10 }}>
                    {!possuiEntrega ? (
                      <button
                        className="fila-btn-acao btn-despachar"
                        disabled={atualizandoId === pedido.id}
                        onClick={() => handleChamarUber(pedido)}
                      >
                        {atualizandoId === pedido.id ? 'Chamando...' : '🚚 Chamar Uber'}
                      </button>
                    ) : null}

                    {possuiEntrega ? (
                      <>
                        {pedido?.uber_tracking_url ? (
                          <a className="fila-btn-acao btn-separar" href={pedido.uber_tracking_url} target="_blank" rel="noreferrer">
                            🔎 Rastreio
                          </a>
                        ) : null}
                        {emEnvio ? (
                          <button
                            className="fila-btn-cancelar"
                            disabled={atualizandoId === pedido.id}
                            onClick={() => handleCancelarUber(pedido)}
                            title="Cancelar entrega Uber"
                          >
                            ✕
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
