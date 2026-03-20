import React, { useState, useEffect, useCallback } from 'react';
import { adminGetConciliacao, adminGetFechamentoDiario } from '../../lib/api';
import { R$, LABELS_PAGAMENTO, LABELS_CANAL } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';

function FechamentoDiario() {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resp = await adminGetFechamentoDiario({ data });
      setDados(resp);
    } catch (e) {
      setDados(null);
      setErro(e.message || 'Erro ao carregar fechamento diário.');
    } finally {
      setCarregando(false);
    }
  }, [data]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="fin-secao">
      <div className="fin-secao-header">
        <h3>📊 Fechamento Diário</h3>
        <input type="date" value={data} onChange={e => setData(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="fin-date-input" />
      </div>

      {carregando ? <LoadingSkeleton type="kpis" /> : erro ? <ErrorState message={erro} onRetry={carregar} compact /> : !dados ? <div className="fin-vazio">Sem dados para esta data.</div> : (
        <>
          <div className="fin-kpis">
            <div className="fin-kpi is-destaque">
              <span className="fin-kpi-v">{R$(dados.faturamento_bruto)}</span>
              <span className="fin-kpi-l">Faturamento</span>
            </div>
            <div className="fin-kpi">
              <span className="fin-kpi-v">{dados.total_pedidos}</span>
              <span className="fin-kpi-l">Total Pedidos</span>
            </div>
            <div className="fin-kpi">
              <span className="fin-kpi-v">{dados.pagos}</span>
              <span className="fin-kpi-l">Pagos</span>
            </div>
            <div className="fin-kpi">
              <span className="fin-kpi-v">{dados.concluidos}</span>
              <span className="fin-kpi-l">Concluídos</span>
            </div>
            <div className="fin-kpi is-alerta">
              <span className="fin-kpi-v">{dados.cancelados}</span>
              <span className="fin-kpi-l">Cancelados</span>
            </div>
            <div className="fin-kpi">
              <span className="fin-kpi-v">{R$(dados.ticket_medio)}</span>
              <span className="fin-kpi-l">Ticket Médio</span>
            </div>
          </div>

          {/* Por pagamento */}
          <div className="fin-breakdown">
            <div className="fin-breakdown-col">
              <h4>💳 Por Pagamento</h4>
              {(dados.por_pagamento || []).map(r => (
                <div key={r.forma} className="fin-break-row">
                  <span className="fin-break-label">{LABELS_PAGAMENTO[r.forma] || r.forma}</span>
                  <span className="fin-break-qtd">{r.quantidade}x</span>
                  <span className="fin-break-valor">{R$(r.valor)}</span>
                  <div className="fin-break-bar">
                    <div style={{ width: `${dados.faturamento_bruto > 0 ? (r.valor / dados.faturamento_bruto * 100) : 0}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="fin-breakdown-col">
              <h4>📦 Por Canal</h4>
              {(dados.por_canal || []).map(r => (
                <div key={r.canal} className="fin-break-row">
                  <span className="fin-break-label">{LABELS_CANAL[r.canal] || r.canal}</span>
                  <span className="fin-break-qtd">{r.quantidade}x</span>
                  <span className="fin-break-valor">{R$(r.valor)}</span>
                  <div className="fin-break-bar">
                    <div style={{ width: `${dados.faturamento_bruto > 0 ? (r.valor / dados.faturamento_bruto * 100) : 0}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SLA e pendências */}
          <div className="fin-rodape">
            {dados.sla && dados.sla.pct != null && (
              <div className={`fin-sla ${dados.sla.pct >= 80 ? 'is-ok' : dados.sla.pct >= 60 ? 'is-atencao' : 'is-critico'}`}>
                SLA do dia: {dados.sla.pct}% ({dados.sla.dentro_prazo}/{dados.sla.total_concluidos} no prazo)
              </div>
            )}
            {dados.pendencias_financeiras > 0 && (
              <div className="fin-pendencias">⚠️ {dados.pendencias_financeiras} pendências financeiras no dia</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConciliacaoFinanceira() {
  const [dias, setDias] = useState(7);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [secaoAberta, setSecaoAberta] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resp = await adminGetConciliacao({ dias });
      setDados(resp);
    } catch (e) {
      setDados(null);
      setErro(e.message || 'Erro ao carregar conciliação.');
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const secoes = [
    { chave: 'pendentes_longo', titulo: '⏳ Pendentes +30min', cor: '#f59e0b', dados: dados?.pendentes_longo },
    { chave: 'sem_confirmacao_pix', titulo: '🔍 Sem confirmação PIX', cor: '#ef4444', dados: dados?.sem_confirmacao_pix },
    { chave: 'cancelados_pagos', titulo: '💸 Cancelados com pagamento', cor: '#dc2626', dados: dados?.cancelados_pagos },
    { chave: 'pagos_nao_concluidos', titulo: '📦 Pagos não concluídos', cor: '#3b82f6', dados: dados?.pagos_nao_concluidos }
  ];

  return (
    <div className="fin-secao">
      <div className="fin-secao-header">
        <h3>🔎 Conciliação Financeira</h3>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} className="fin-select">
          <option value={3}>3 dias</option>
          <option value={7}>7 dias</option>
          <option value={15}>15 dias</option>
          <option value={30}>30 dias</option>
        </select>
      </div>

      {carregando ? <LoadingSkeleton type="cards" lines={4} /> : erro ? <ErrorState message={erro} onRetry={carregar} compact /> : !dados ? <div className="fin-vazio">Sem dados de conciliação.</div> : (
        <>
          <div className="fin-alertas-grid">
            {secoes.map(s => (
              <div
                key={s.chave}
                className={`fin-alerta-card ${dados.contadores[s.chave] > 0 ? 'is-ativo' : ''}`}
                style={{ borderLeftColor: s.cor }}
                onClick={() => setSecaoAberta(secaoAberta === s.chave ? null : s.chave)}
              >
                <span className="fin-alerta-valor" style={{ color: dados.contadores[s.chave] > 0 ? s.cor : '#6b7280' }}>
                  {dados.contadores[s.chave] || 0}
                </span>
                <span className="fin-alerta-label">{s.titulo}</span>
              </div>
            ))}
          </div>

          {secaoAberta && (
            <div className="fin-detalhe-conciliacao">
              {secoes.filter(s => s.chave === secaoAberta).map(s => (
                <div key={s.chave}>
                  <h4 style={{ color: s.cor }}>{s.titulo}</h4>
                  {(!s.dados || s.dados.length === 0) ? <p className="fin-vazio">Nenhum item</p> : (
                    <table className="fin-tabela">
                      <thead>
                        <tr><th>#</th><th>Cliente</th><th>Valor</th><th>Pagamento</th><th>Status</th><th>Data</th></tr>
                      </thead>
                      <tbody>
                        {s.dados.map(p => (
                          <tr key={p.id}>
                            <td>#{p.id}</td>
                            <td>{p.cliente_nome || '—'}</td>
                            <td>{R$(p.total)}</td>
                            <td>{LABELS_PAGAMENTO[p.forma_pagamento] || p.forma_pagamento}</td>
                            <td>{p.status}</td>
                            <td>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )}

          {Object.values(dados.contadores).every(v => v === 0) && (
            <div className="fin-ok">✅ Nenhuma inconsistência encontrada nos últimos {dias} dias.</div>
          )}
        </>
      )}
    </div>
  );
}

export default function FinanceiroAvancado() {
  const [aba, setAba] = useState('fechamento');

  return (
    <div className="financeiro-avancado">
      <div className="fin-nav">
        <button className={`fin-nav-btn ${aba === 'fechamento' ? 'ativo' : ''}`} onClick={() => setAba('fechamento')}>📊 Fechamento</button>
        <button className={`fin-nav-btn ${aba === 'conciliacao' ? 'ativo' : ''}`} onClick={() => setAba('conciliacao')}>🔎 Conciliação</button>
      </div>

      {aba === 'fechamento' && <FechamentoDiario />}
      {aba === 'conciliacao' && <ConciliacaoFinanceira />}
    </div>
  );
}
