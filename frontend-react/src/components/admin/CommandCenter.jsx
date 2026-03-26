import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, BadgeX, BarChart3, Bell, CircleCheck, Clock3, Info, Radio, Receipt, RefreshCw, Target, Zap } from 'lucide-react';
import { adminGetCentralVivo, adminGetFeed, adminGetAlertas } from '../../lib/api';
import { formatarMoeda, formatarNum, tempoRelativo, R$ } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';

export default function CommandCenter({ onNavigate }) {
  const [dados, setDados] = useState(null);
  const [feed, setFeed] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [errosParciais, setErrosParciais] = useState([]);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        adminGetCentralVivo(),
        adminGetFeed({ limit: 20 }),
        adminGetAlertas()
      ]);

      if (!mountedRef.current) return;

      const parciais = [];
      const vivo = results[0].status === 'fulfilled' ? results[0].value : null;
      const feedData = results[1].status === 'fulfilled' ? results[1].value : null;
      const alertData = results[2].status === 'fulfilled' ? results[2].value : null;

      if (!vivo) parciais.push('dados ao vivo');
      if (!feedData) parciais.push('feed');
      if (!alertData) parciais.push('alertas');

      if (!vivo && !feedData && !alertData) {
        setErro('Falha ao carregar dados ao vivo.');
      } else {
        if (vivo) setDados(vivo);
        setFeed(feedData?.eventos || []);
        setAlertas(alertData?.alertas || []);
        setErro('');
      }
      setErrosParciais(parciais);
    } catch (e) {
      if (!mountedRef.current) return;
      setErro('Falha ao carregar dados ao vivo.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, [carregar]);

  if (loading && !dados) {
    return (
      <div className="ck-command-grid">
        <LoadingSkeleton type="kpis" />
        <div className="ck-command-top">
          <div className="ck-card"><LoadingSkeleton lines={3} /></div>
          <div className="ck-card"><LoadingSkeleton lines={3} /></div>
        </div>
        <div className="ck-command-bottom">
          <div className="ck-card"><LoadingSkeleton lines={5} /></div>
          <div className="ck-card"><LoadingSkeleton lines={5} /></div>
        </div>
      </div>
    );
  }

  if (erro && !dados) {
    return <ErrorState message={erro} onRetry={carregar} />;
  }

  const k = dados?.kpis || {};
  const op = dados?.operacao || {};
  const sla = dados?.sla || {};
  const porHora = dados?.por_hora || [];
  const recentes = dados?.recentes || [];
  const maxHora = Math.max(...porHora.map(h => h.qtd), 1);

  const slaPct = sla.pct != null ? sla.pct : null;
  const slaClass = slaPct === null ? 'good' : slaPct >= 85 ? 'good' : slaPct >= 70 ? 'warn' : 'bad';
  const alertasCriticos = alertas.filter(a => a.severidade === 'critico');
  const alertasAtencao = alertas.filter(a => a.severidade !== 'critico');

  return (
    <div className="ck-command-grid">
      {/* Aviso de dados parciais */}
      {errosParciais.length > 0 && (
        <div className="ck-partial-warning">
          <AlertTriangle size={14} aria-hidden="true" /> Falha parcial: {errosParciais.join(', ')} indisponíveis
          <button type="button" className="ck-partial-retry" onClick={carregar}><RefreshCw size={14} aria-hidden="true" /> Recarregar</button>
        </div>
      )}

      {/* Row 1: KPIs principais */}
      <div className="ck-kpis-grid">
        <div className="ck-kpi accent">
          <span className="ck-kpi-label">Faturamento Hoje</span>
          <span className="ck-kpi-value">{formatarMoeda(k.faturamento)}</span>
          {k.var_faturamento != null ? (
            <span className={`ck-kpi-var ${k.var_faturamento >= 0 ? 'up' : 'down'}`}>
              {k.var_faturamento >= 0 ? '▲' : '▼'} {Math.abs(k.var_faturamento)}% vs ontem
            </span>
          ) : null}
        </div>
        <div className="ck-kpi">
          <span className="ck-kpi-label">Pedidos Hoje</span>
          <span className="ck-kpi-value">{formatarNum(k.pedidos)}</span>
          {k.var_pedidos != null ? (
            <span className={`ck-kpi-var ${k.var_pedidos >= 0 ? 'up' : 'down'}`}>
              {k.var_pedidos >= 0 ? '▲' : '▼'} {Math.abs(k.var_pedidos)}%
            </span>
          ) : null}
        </div>
        <div className="ck-kpi green">
          <span className="ck-kpi-label">Concluídos</span>
          <span className="ck-kpi-value">{formatarNum(k.concluidos)}</span>
        </div>
        <div className="ck-kpi">
          <span className="ck-kpi-label">Ticket Médio</span>
          <span className="ck-kpi-value">{formatarMoeda(k.ticket_medio)}</span>
        </div>
        <div className={`ck-kpi ${k.cancelados > 0 ? 'red' : ''}`}>
          <span className="ck-kpi-label">Cancelados</span>
          <span className="ck-kpi-value">{formatarNum(k.cancelados)}</span>
          {k.taxa_cancelamento > 0 ? <span className="ck-kpi-var down">{k.taxa_cancelamento}%</span> : null}
        </div>
        <div className={`ck-kpi ${k.pendentes > 2 ? 'yellow' : ''}`}>
          <span className="ck-kpi-label">Pendentes</span>
          <span className="ck-kpi-value">{formatarNum(k.pendentes)}</span>
        </div>
      </div>

      {/* Row 2: Operação agora + SLA */}
      <div className="ck-command-top">
        <div className="ck-card">
          <div className="ck-card-header">
            <span className="ck-card-title"><span className="icon"><Zap size={16} aria-hidden="true" /></span> Agora na Operação</span>
            <span className="ck-card-subtitle">{Number(op.total || 0)} pedido(s) em aberto</span>
          </div>
          <div className="ck-live-block">
            <div className="ck-live-item">
              <span className="ck-live-num">{Number(op.pendentes || 0)}</span>
              <span className="ck-live-label">Pendentes</span>
            </div>
            <div className="ck-live-item yellow">
              <span className="ck-live-num">{Number(op.em_preparo || 0)}</span>
              <span className="ck-live-label">Em Preparo</span>
            </div>
            <div className="ck-live-item purple">
              <span className="ck-live-num">{Number(op.aguardando_retirada || 0)}</span>
              <span className="ck-live-label">Retirada</span>
            </div>
            <div className="ck-live-item green">
              <span className="ck-live-num">{Number(op.em_rota || 0)}</span>
              <span className="ck-live-label">Em Rota</span>
            </div>
            {Number(op.atrasados) > 0 ? (
              <div className="ck-live-item red">
                <span className="ck-live-num">{op.atrasados}</span>
                <span className="ck-live-label">Atrasados</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="ck-card">
          <div className="ck-card-header">
            <span className="ck-card-title"><span className="icon"><Target size={16} aria-hidden="true" /></span> SLA Hoje</span>
          </div>
          <div className="ck-sla-container">
            <div className="ck-sla-gauge">
              <div className={`ck-sla-ring ${slaClass}`} style={{ '--pct': `${slaPct || 0}%` }}>
                <span>{slaPct != null ? `${slaPct}%` : '—'}</span>
              </div>
              <div className="ck-sla-label">Dentro do SLA</div>
            </div>
            <div className="ck-sla-detail">
              <div className="ck-sla-detail-line">
                {sla.dentro || 0} de {sla.total_concl || 0} no prazo
              </div>
              <div className="ck-sla-detail-meta">
                Meta: ≥ 85% dentro do SLA
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Alertas + Volume hora */}
      <div className="ck-command-bottom">
        <div className="ck-card">
          <div className="ck-card-header">
            <span className="ck-card-title"><span className="icon"><Bell size={16} aria-hidden="true" /></span> Atenção Imediata</span>
            <span className="ck-card-subtitle">{alertas.length} alerta(s)</span>
          </div>
          {alertas.length === 0 ? (
            <div className="ck-sem-alertas"><CircleCheck size={14} aria-hidden="true" /> Nenhum alerta — operação normal</div>
          ) : (
            <div className="ck-alertas-lista">
              {alertasCriticos.map(a => (
                <div key={a.id} className="ck-alerta-item critico" onClick={() => a.cta?.tab && onNavigate(a.cta.tab)}>
                  <span className="ck-alerta-icon"><BadgeX size={14} aria-hidden="true" /></span>
                  <div className="ck-alerta-body">
                    <div className="ck-alerta-titulo">{a.titulo}</div>
                    <div className="ck-alerta-desc">{a.descricao}</div>
                  </div>
                  <span className="ck-alerta-valor">{a.valor}</span>
                </div>
              ))}
              {alertasAtencao.map(a => (
                <div key={a.id} className={`ck-alerta-item ${a.severidade === 'atencao' ? 'atencao' : 'info'}`} onClick={() => a.cta?.tab && onNavigate(a.cta.tab)}>
                  <span className="ck-alerta-icon">{a.severidade === 'atencao' ? <AlertTriangle size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}</span>
                  <div className="ck-alerta-body">
                    <div className="ck-alerta-titulo">{a.titulo}</div>
                    <div className="ck-alerta-desc">{a.descricao}</div>
                  </div>
                  <span className="ck-alerta-valor">{a.valor}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ck-card">
          <div className="ck-card-header">
            <span className="ck-card-title"><span className="icon"><BarChart3 size={16} aria-hidden="true" /></span> Volume por Hora</span>
          </div>
          {porHora.length > 0 ? (
            <div className="ck-hour-chart">
              {porHora.map(h => (
                <div className="ck-hour-bar" key={h.hora}>
                  <div className="ck-hour-fill" style={{ height: `${(h.qtd / maxHora) * 100}%` }} title={`${h.hora}h: ${h.qtd} pedido(s) — ${formatarMoeda(h.valor)}`} />
                  <span className="ck-hour-label">{h.hora}h</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ck-chart-empty">Sem dados de volume por hora</div>
          )}
        </div>
      </div>

      {/* Row 4: Feed de atividade */}
      <div className="ck-card">
        <div className="ck-card-header">
          <span className="ck-card-title"><span className="icon"><Radio size={16} aria-hidden="true" /></span> Atividade Recente</span>
          <span className="ck-card-subtitle">Últimas 2 horas</span>
        </div>
        {feed.length === 0 ? (
          <div className="ck-feed-vazio">Nenhuma atividade recente</div>
        ) : (
          <div className="ck-feed">
            {feed.slice(0, 15).map((ev, i) => (
              <div className="ck-feed-item" key={i}>
                <span className="ck-feed-icon"><Receipt size={14} aria-hidden="true" /></span>
                <div className="ck-feed-body">
                  <div className="ck-feed-titulo">{ev.titulo}</div>
                  <div className="ck-feed-detalhe">{ev.detalhe}</div>
                </div>
                <span className="ck-feed-tempo">{tempoRelativo(ev.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 5: Últimos pedidos rápido */}
      {recentes.length > 0 ? (
        <div className="ck-card">
          <div className="ck-card-header">
            <span className="ck-card-title"><span className="icon"><Clock3 size={16} aria-hidden="true" /></span> Últimos 30 min</span>
            <button type="button" className="ck-btn-link" onClick={() => onNavigate('pedidos')}>
              Ver todos →
            </button>
          </div>
          <div className="ck-recentes-grid">
            {recentes.slice(0, 8).map(r => (
              <div key={r.id} className="ck-recente-item">
                <span className="ck-recente-id">#{r.id}</span>
                <span className="ck-recente-cliente">{r.cliente || '—'}</span>
                <span className="ck-recente-valor">{formatarMoeda(r.total)}</span>
                <span className={`ck-recente-status is-${r.status}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
