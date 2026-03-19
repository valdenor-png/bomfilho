import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminGetFilaOperacional, adminAtualizarStatusPedido } from '../../lib/api';
import LoadingSkeleton from './ui/LoadingSkeleton';

const R$ = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const LABELS_FILA = {
  pendentes_pagamento: { titulo: '⏳ Aguardando Pagamento', cor: '#f59e0b', proximoStatus: null },
  pagos_aguardando_preparo: { titulo: '🔥 Pagos — Iniciar Preparo', cor: '#3b82f6', proximoStatus: 'preparando' },
  prontos_aguardando_saida: { titulo: '📦 Prontos — Despachar', cor: '#8b5cf6', proximoStatus: 'enviado' },
  em_rota_acima_sla: { titulo: '🚨 Em Rota Acima do SLA', cor: '#ef4444', proximoStatus: 'entregue' },
  retiradas_prontas_aguardando: { titulo: '🏪 Retiradas Aguardando Cliente', cor: '#06b6d4', proximoStatus: null },
  travados: { titulo: '⚠️ Pedidos Travados (+60min)', cor: '#94a3b8', proximoStatus: null }
};

const LABEL_STATUS_BTN = {
  preparando: 'Iniciar Preparo',
  enviado: 'Despachar',
  entregue: 'Marcar Entregue',
  pronto_para_retirada: 'Marcar Pronto',
  retirado: 'Marcar Retirado',
  cancelado: 'Cancelar'
};

function FilaPedidoCard({ pedido, proximoStatus, onAcao, atualizandoId }) {
  const minParado = Number(pedido.minutos_parado || pedido.minutos_rota || pedido.minutos_pendente || pedido.minutos_desde_criacao || 0);
  const urgente = minParado > 30;
  const critico = minParado > 60;
  
  return (
    <div className={`fila-card ${critico ? 'is-critico' : urgente ? 'is-urgente' : ''}`}>
      <div className="fila-card-header">
        <span className="fila-card-id">#{pedido.id}</span>
        <span className="fila-card-tempo" title={`${minParado}min parado`}>
          {minParado >= 60 ? `${Math.floor(minParado / 60)}h${minParado % 60}min` : `${minParado}min`}
        </span>
      </div>
      <div className="fila-card-info">
        <span className="fila-card-cliente">{pedido.cliente_nome || '—'}</span>
        <span className="fila-card-valor">{R$(pedido.total)}</span>
      </div>
      <div className="fila-card-meta">
        <span>{pedido.tipo_entrega === 'retirada' ? '🏪 Retirada' : '🚗 Entrega'}</span>
        <span className="fila-card-status">{pedido.status}</span>
      </div>
      {proximoStatus && (
        <div className="fila-card-acoes">
          <button
            className="fila-btn-acao"
            disabled={atualizandoId === pedido.id}
            onClick={() => onAcao(pedido.id, proximoStatus)}
          >
            {atualizandoId === pedido.id ? '...' : (LABEL_STATUS_BTN[proximoStatus] || `→ ${proximoStatus}`)}
          </button>
        </div>
      )}
    </div>
  );
}

function FilaGrupo({ chave, pedidos, onAcao, atualizandoId }) {
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
            proximoStatus={cfg.proximoStatus}
            onAcao={onAcao}
            atualizandoId={atualizandoId}
          />
        ))}
      </div>
    </div>
  );
}

export default function FilaOperacional() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [atualizandoId, setAtualizandoId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const intervaloRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const resp = await adminGetFilaOperacional();
      setDados(resp);
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
    setAtualizandoId(pedidoId);
    try {
      await adminAtualizarStatusPedido(pedidoId, novoStatus);
      setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} → ${novoStatus}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao atualizar status' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  if (carregando) return <LoadingSkeleton type="cards" lines={4} />;
  if (erro) return <div className="fila-erro">{erro} <button onClick={carregar}>Tentar novamente</button></div>;
  if (!dados) return null;

  const totalAlertas = Object.values(dados.contadores || {}).reduce((s, v) => s + v, 0);
  const ordemFilas = ['pagos_aguardando_preparo', 'prontos_aguardando_saida', 'em_rota_acima_sla', 'pendentes_pagamento', 'retiradas_prontas_aguardando', 'travados'];

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
              <span className="fila-contador-valor" style={{ color: v > 0 ? cfg.cor : '#94a3b8' }}>{v}</span>
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
          <FilaGrupo key={chave} chave={chave} pedidos={dados[chave]} onAcao={handleAcao} atualizandoId={atualizandoId} />
        ))}
      </div>
    </div>
  );
}
