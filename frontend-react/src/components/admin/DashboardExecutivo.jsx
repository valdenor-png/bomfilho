import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AlertTriangle, BadgeX, Info } from 'lucide-react';
import { adminGetDashboardResumo } from '../../lib/api';
import { formatarDuracaoMs } from '../../lib/metricasOperacionais';

// ============================================
// Helpers
// ============================================

const R$ = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const pct = (v) => (v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : null);

const LABELS_PAGAMENTO = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', cartao: 'Cartão' };
const labelPagamento = (f) => LABELS_PAGAMENTO[f] || f || 'Outros';

const LABELS_STATUS = {
  pendente: 'Pendente', pago: 'Pago', preparando: 'Preparando',
  pronto_para_retirada: 'Pronto', enviado: 'Em rota',
  entregue: 'Entregue', retirado: 'Retirado', cancelado: 'Cancelado'
};
const labelStatus = (s) => LABELS_STATUS[s] || s;

const COR_STATUS = {
  pendente: '#6b7280', pago: '#2563eb', preparando: '#d97706',
  pronto_para_retirada: '#7c3aed', enviado: '#0891b2',
  entregue: '#16a34a', retirado: '#059669', cancelado: '#dc2626'
};

const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'mes', label: 'Mês atual' },
  { value: 'custom', label: 'Personalizado' }
];

// ============================================
// Sub-components
// ============================================

function VariacaoIndicador({ valor }) {
  if (valor == null) return null;
  const positivo = valor >= 0;
  const cls = positivo ? 'dash-var-up' : 'dash-var-down';
  return <span className={`dash-variacao ${cls}`}>{positivo ? '▲' : '▼'} {Math.abs(valor).toFixed(1)}%</span>;
}

function KpiCard({ titulo, valor, variacao, destaque, tom }) {
  const cls = ['dash-kpi-card'];
  if (tom) cls.push(`is-${tom}`);
  if (destaque) cls.push('is-destaque');
  return (
    <div className={cls.join(' ')}>
      <span className="dash-kpi-titulo">{titulo}</span>
      <span className="dash-kpi-valor">{valor}</span>
      {variacao != null ? <VariacaoIndicador valor={variacao} /> : null}
    </div>
  );
}

function MiniBarChart({ dados, labelKey, valorKey, formatValor, titulo, altura }) {
  const max = Math.max(...dados.map(d => Number(d[valorKey] || 0)), 1);
  return (
    <div className="dash-chart-box">
      {titulo ? <h4 className="dash-chart-titulo">{titulo}</h4> : null}
      <div className="dash-bars" style={altura ? { height: altura } : undefined}>
        {dados.map((d, i) => {
          const v = Number(d[valorKey] || 0);
          const pctH = Math.max((v / max) * 100, 2);
          return (
            <div key={i} className="dash-bar-col" title={`${d[labelKey]}: ${formatValor ? formatValor(v) : v}`}>
              <div className="dash-bar-fill" style={{ height: `${pctH}%` }} />
              <span className="dash-bar-label">{d[labelKey]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorizontalBar({ dados, labelKey, valorKey, formatValor, titulo, corFn }) {
  const max = Math.max(...dados.map(d => Number(d[valorKey] || 0)), 1);
  return (
    <div className="dash-chart-box">
      {titulo ? <h4 className="dash-chart-titulo">{titulo}</h4> : null}
      <div className="dash-hbars">
        {dados.map((d, i) => {
          const v = Number(d[valorKey] || 0);
          const w = Math.max((v / max) * 100, 2);
          const cor = corFn ? corFn(d) : undefined;
          return (
            <div key={i} className="dash-hbar-row">
              <span className="dash-hbar-label">{d[labelKey]}</span>
              <div className="dash-hbar-track">
                <div className="dash-hbar-fill" style={{ width: `${w}%`, background: cor }} />
              </div>
              <span className="dash-hbar-valor">{formatValor ? formatValor(v) : v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankingTable({ titulo, dados, colunas }) {
  if (!dados || dados.length === 0) return null;
  return (
    <div className="dash-chart-box">
      {titulo ? <h4 className="dash-chart-titulo">{titulo}</h4> : null}
      <table className="dash-ranking-table">
        <thead>
          <tr>{colunas.map((c, i) => <th key={i}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {dados.map((d, i) => (
            <tr key={i}>
              {colunas.map((c, j) => <td key={j}>{c.render ? c.render(d, i) : d[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertaCard({ tipo, titulo, descricao }) {
  const Icon = tipo === 'perigo' ? BadgeX : tipo === 'atencao' ? AlertTriangle : Info;

  return (
    <div className={`dash-alerta is-${tipo}`}>
      <span className="dash-alerta-icon"><Icon size={14} aria-hidden="true" /></span>
      <div>
        <strong>{titulo}</strong>
        {descricao ? <p>{descricao}</p> : null}
      </div>
    </div>
  );
}

function SegmentoBar({ segmentos, titulo }) {
  const total = segmentos.reduce((acc, s) => acc + Number(s.valor || 0), 0);
  if (!total) return null;
  const cores = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  return (
    <div className="dash-chart-box">
      {titulo ? <h4 className="dash-chart-titulo">{titulo}</h4> : null}
      <div className="dash-seg-bar">
        {segmentos.map((s, i) => {
          const w = (Number(s.valor) / total) * 100;
          if (w < 0.5) return null;
          return <div key={i} className="dash-seg-fill" style={{ width: `${w}%`, background: cores[i % cores.length] }} title={`${s.label}: ${R$(s.valor)}`} />;
        })}
      </div>
      <div className="dash-seg-legend">
        {segmentos.map((s, i) => (
          <span key={i} className="dash-seg-item">
            <span className="dash-seg-dot" style={{ background: cores[i % cores.length] }} />
            {s.label}: {R$(s.valor)} ({total > 0 ? ((Number(s.valor) / total) * 100).toFixed(0) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function DashboardExecutivo() {
  const [periodo, setPeriodo] = useState('hoje');
  const [canal, setCanal] = useState('todos');
  const [pagamento, setPagamento] = useState('todos');
  const [inicioCustom, setInicioCustom] = useState('');
  const [fimCustom, setFimCustom] = useState('');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [secaoAtiva, setSecaoAtiva] = useState('executivo');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = { periodo, canal, pagamento };
      if (periodo === 'custom') {
        if (inicioCustom) params.inicio = inicioCustom;
        if (fimCustom) params.fim = fimCustom;
      }
      const resp = await adminGetDashboardResumo(params);
      if (mounted.current) {
        setDados(resp);
      }
    } catch (e) {
      if (mounted.current) {
        setErro(e?.message || 'Erro ao carregar dashboard.');
      }
    } finally {
      if (mounted.current) setCarregando(false);
    }
  }, [periodo, canal, pagamento, inicioCustom, fimCustom]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Prepare chart data
  const vendasHoraChart = useMemo(() => {
    if (!dados?.vendas_por_hora) return [];
    // Fill all 24h
    const map = new Map(dados.vendas_por_hora.map(h => [h.hora, h]));
    const arr = [];
    for (let i = 0; i < 24; i++) {
      const d = map.get(i);
      arr.push({ hora: `${String(i).padStart(2, '0')}h`, quantidade: d?.quantidade || 0, total: d?.total || 0 });
    }
    return arr;
  }, [dados]);

  const vendasDiaChart = useMemo(() => {
    if (!dados?.vendas_por_dia) return [];
    return dados.vendas_por_dia.map(d => ({
      dia: new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      quantidade: d.quantidade,
      total: d.total
    }));
  }, [dados]);

  const canalSegmentos = useMemo(() => {
    if (!dados?.por_canal) return [];
    return dados.por_canal.map(c => ({
      label: c.canal === 'retirada' ? 'Retirada' : 'Entrega',
      valor: c.total
    }));
  }, [dados]);

  const pagamentoSegmentos = useMemo(() => {
    if (!dados?.por_forma_pagamento) return [];
    return dados.por_forma_pagamento.map(p => ({
      label: labelPagamento(p.forma),
      valor: p.total
    }));
  }, [dados]);

  const statusChart = useMemo(() => {
    if (!dados?.por_status) return [];
    return dados.por_status.map(s => ({
      status: labelStatus(s.status),
      quantidade: s.quantidade,
      _raw: s.status
    }));
  }, [dados]);

  // ============ RENDER ============

  const k = dados?.kpis;
  const comp = dados?.comparativo;

  return (
    <div className="dash-exec">
      {/* ---- Filtros Globais ---- */}
      <div className="dash-filtros">
        <div className="dash-filtros-row">
          <div className="dash-filtro-group">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                type="button"
                className={`dash-filtro-btn${periodo === p.value ? ' active' : ''}`}
                onClick={() => setPeriodo(p.value)}
              >{p.label}</button>
            ))}
          </div>
          <select className="dash-filtro-select" value={canal} onChange={e => setCanal(e.target.value)}>
            <option value="todos">Todos os canais</option>
            <option value="entrega">Entrega</option>
            <option value="retirada">Retirada</option>
          </select>
          <select className="dash-filtro-select" value={pagamento} onChange={e => setPagamento(e.target.value)}>
            <option value="todos">Todos pagamentos</option>
            <option value="pix">PIX</option>
            <option value="credito">Crédito</option>
            <option value="debito">Débito</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
          <button type="button" className="dash-filtro-btn active" onClick={carregarDados} disabled={carregando}>
            {carregando ? '...' : '⟳'}
          </button>
        </div>
        {periodo === 'custom' ? (
          <div className="dash-filtros-row" style={{ marginTop: '0.4rem' }}>
            <input type="date" className="dash-filtro-date" value={inicioCustom} onChange={e => setInicioCustom(e.target.value)} />
            <input type="date" className="dash-filtro-date" value={fimCustom} onChange={e => setFimCustom(e.target.value)} />
          </div>
        ) : null}
      </div>

      {erro ? <p className="dash-erro">{erro}</p> : null}
      {carregando && !dados ? <p className="dash-loading">Carregando dashboard executivo...</p> : null}

      {dados ? (
        <>
          {/* ---- Section Tabs ---- */}
          <div className="dash-secao-tabs">
            {[
              { id: 'executivo', label: 'Executivo' },
              { id: 'financeiro', label: 'Financeiro' },
              { id: 'operacional', label: 'Operacional' }
            ].map(s => (
              <button
                key={s.id}
                type="button"
                className={`dash-secao-tab${secaoAtiva === s.id ? ' active' : ''}`}
                onClick={() => setSecaoAtiva(s.id)}
              >{s.label}</button>
            ))}
          </div>

          {/* ================================================================
              EXECUTIVO
              ================================================================ */}
          {secaoAtiva === 'executivo' ? (
            <div className="dash-secao">
              {/* KPIs */}
              <div className="dash-kpis-grid">
                <KpiCard titulo="Faturamento" valor={R$(k.faturamento_bruto)} variacao={comp.variacao_faturamento} destaque />
                <KpiCard titulo="Pedidos Pagos" valor={k.pedidos_pagos} variacao={comp.variacao_pedidos} />
                <KpiCard titulo="Concluídos" valor={k.pedidos_concluidos} />
                <KpiCard titulo="Ticket Médio" valor={R$(k.ticket_medio)} />
                <KpiCard titulo="Cancelamentos" valor={`${k.pedidos_cancelados} (${k.taxa_cancelamento}%)`} tom={k.taxa_cancelamento > 10 ? 'danger' : undefined} />
                <KpiCard titulo="Entrega no Prazo" valor={k.taxa_entrega_prazo != null ? `${k.taxa_entrega_prazo}%` : '—'} tom={k.taxa_entrega_prazo != null && k.taxa_entrega_prazo < 80 ? 'warning' : undefined} />
                <KpiCard titulo="Tempo Médio Total" valor={formatarDuracaoMs(k.tempo_medio_total_ms)} />
                <KpiCard titulo="Pendentes" valor={k.pedidos_pendentes} tom={k.pedidos_pendentes > 5 ? 'warning' : undefined} />
              </div>

              {/* Charts Row */}
              <div className="dash-charts-row">
                {vendasDiaChart.length > 1 ? (
                  <MiniBarChart dados={vendasDiaChart} labelKey="dia" valorKey="total" formatValor={R$} titulo="Vendas por dia" />
                ) : null}
                {vendasHoraChart.length > 0 ? (
                  <MiniBarChart dados={vendasHoraChart} labelKey="hora" valorKey="total" formatValor={R$} titulo="Vendas por hora" />
                ) : null}
              </div>

              {/* Segments */}
              <div className="dash-charts-row">
                <SegmentoBar segmentos={canalSegmentos} titulo="Entrega vs Retirada" />
                <SegmentoBar segmentos={pagamentoSegmentos} titulo="Formas de Pagamento" />
              </div>

              {/* Status distribution */}
              {statusChart.length > 0 ? (
                <div className="dash-charts-row">
                  <HorizontalBar
                    dados={statusChart}
                    labelKey="status"
                    valorKey="quantidade"
                    titulo="Pedidos por Status"
                    corFn={d => COR_STATUS[d._raw] || '#64748b'}
                  />
                </div>
              ) : null}

              {/* Rankings */}
              <div className="dash-charts-row">
                <RankingTable
                  titulo="Top Produtos"
                  dados={dados.top_produtos}
                  colunas={[
                    { header: '#', render: (_, i) => i + 1 },
                    { header: 'Produto', key: 'nome' },
                    { header: 'Qtd', key: 'quantidade' },
                    { header: 'Faturamento', render: d => R$(d.faturamento) }
                  ]}
                />
                <RankingTable
                  titulo="Top Categorias"
                  dados={dados.top_categorias}
                  colunas={[
                    { header: '#', render: (_, i) => i + 1 },
                    { header: 'Categoria', key: 'categoria' },
                    { header: 'Qtd', key: 'quantidade' },
                    { header: 'Faturamento', render: d => R$(d.faturamento) }
                  ]}
                />
              </div>

              {dados.top_bairros?.length > 0 ? (
                <div className="dash-charts-row">
                  <HorizontalBar
                    dados={dados.top_bairros}
                    labelKey="bairro"
                    valorKey="quantidade"
                    titulo="Pedidos por Bairro"
                  />
                </div>
              ) : null}

              {/* Alertas */}
              {dados.alertas?.length > 0 ? (
                <div className="dash-alertas-box">
                  <h4 className="dash-chart-titulo">Alertas</h4>
                  {dados.alertas.map((a, i) => (
                    <AlertaCard key={i} tipo={a.tipo} titulo={a.titulo} descricao={a.descricao} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ================================================================
              FINANCEIRO
              ================================================================ */}
          {secaoAtiva === 'financeiro' ? (
            <div className="dash-secao">
              <div className="dash-kpis-grid">
                <KpiCard titulo="Receita Bruta" valor={R$(k.faturamento_bruto)} destaque />
                <KpiCard titulo="Pedidos Pagos" valor={k.pedidos_pagos} />
                <KpiCard titulo="Ticket Médio" valor={R$(k.ticket_medio)} />
                <KpiCard titulo="Cancelados" valor={`${k.pedidos_cancelados}`} tom={k.pedidos_cancelados > 0 ? 'danger' : undefined} />
                <KpiCard titulo="Pendentes" valor={k.pedidos_pendentes} tom={k.pedidos_pendentes > 3 ? 'warning' : undefined} />
                <KpiCard titulo="Taxa Cancelamento" valor={`${k.taxa_cancelamento}%`} tom={k.taxa_cancelamento > 10 ? 'danger' : undefined} />
              </div>

              {/* Payment breakdown table */}
              <RankingTable
                titulo="Resumo por Forma de Pagamento"
                dados={dados.por_forma_pagamento}
                colunas={[
                  { header: 'Forma', render: d => labelPagamento(d.forma) },
                  { header: 'Pedidos', key: 'quantidade' },
                  { header: 'Total', render: d => R$(d.total) },
                  { header: '% do Total', render: d => {
                    const tot = dados.por_forma_pagamento.reduce((a, x) => a + x.total, 0);
                    return tot > 0 ? `${((d.total / tot) * 100).toFixed(1)}%` : '—';
                  }}
                ]}
              />

              {/* Channel breakdown */}
              <RankingTable
                titulo="Resumo por Canal"
                dados={dados.por_canal}
                colunas={[
                  { header: 'Canal', render: d => d.canal === 'retirada' ? 'Retirada na loja' : 'Entrega' },
                  { header: 'Pedidos', key: 'quantidade' },
                  { header: 'Total', render: d => R$(d.total) },
                  { header: '% do Total', render: d => {
                    const tot = dados.por_canal.reduce((a, x) => a + x.total, 0);
                    return tot > 0 ? `${((d.total / tot) * 100).toFixed(1)}%` : '—';
                  }}
                ]}
              />

              {/* Fechamento do dia */}
              <div className="dash-chart-box dash-fechamento">
                <h4 className="dash-chart-titulo">Fechamento do Período</h4>
                <div className="dash-fechamento-grid">
                  <div className="dash-fechamento-item">
                    <span>Total de pedidos</span>
                    <strong>{k.total_pedidos}</strong>
                  </div>
                  <div className="dash-fechamento-item">
                    <span>Pagos</span>
                    <strong>{k.pedidos_pagos}</strong>
                  </div>
                  <div className="dash-fechamento-item">
                    <span>Cancelados</span>
                    <strong>{k.pedidos_cancelados}</strong>
                  </div>
                  <div className="dash-fechamento-item">
                    <span>Receita</span>
                    <strong>{R$(k.faturamento_bruto)}</strong>
                  </div>
                  <div className="dash-fechamento-item">
                    <span>Ticket Médio</span>
                    <strong>{R$(k.ticket_medio)}</strong>
                  </div>
                  <div className="dash-fechamento-item">
                    <span>Entrega vs Retirada</span>
                    <strong>
                      {(() => {
                        const tot = dados.por_canal.reduce((a, x) => a + x.quantidade, 0);
                        const entrega = dados.por_canal.find(c => c.canal !== 'retirada');
                        const retirada = dados.por_canal.find(c => c.canal === 'retirada');
                        const eP = tot > 0 && entrega ? ((entrega.quantidade / tot) * 100).toFixed(0) : 0;
                        const rP = tot > 0 && retirada ? ((retirada.quantidade / tot) * 100).toFixed(0) : 0;
                        return `${eP}% / ${rP}%`;
                      })()}
                    </strong>
                  </div>
                  <div className="dash-fechamento-item">
                    <span>SLA Médio</span>
                    <strong>{formatarDuracaoMs(k.tempo_medio_total_ms)}</strong>
                  </div>
                  {comp.variacao_faturamento != null ? (
                    <div className="dash-fechamento-item">
                      <span>vs Período Anterior</span>
                      <strong className={comp.variacao_faturamento >= 0 ? 'txt-up' : 'txt-down'}>
                        {pct(comp.variacao_faturamento)} ({R$(comp.faturamento_anterior)})
                      </strong>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ================================================================
              OPERACIONAL
              ================================================================ */}
          {secaoAtiva === 'operacional' ? (
            <div className="dash-secao">
              <div className="dash-kpis-grid">
                <KpiCard titulo="Tempo Médio Preparo" valor={formatarDuracaoMs(k.tempo_medio_preparo_ms)} />
                <KpiCard titulo="Tempo Médio Rota" valor={formatarDuracaoMs(k.tempo_medio_rota_ms)} />
                <KpiCard titulo="Tempo Médio Total" valor={formatarDuracaoMs(k.tempo_medio_total_ms)} />
                <KpiCard titulo="Entrega no Prazo" valor={k.taxa_entrega_prazo != null ? `${k.taxa_entrega_prazo}%` : '—'} tom={k.taxa_entrega_prazo != null && k.taxa_entrega_prazo < 80 ? 'danger' : k.taxa_entrega_prazo != null && k.taxa_entrega_prazo < 95 ? 'warning' : undefined} />
                <KpiCard titulo="Pedidos Concluídos" valor={k.pedidos_concluidos} />
                <KpiCard titulo="Cancelamentos" valor={k.pedidos_cancelados} tom={k.pedidos_cancelados > 0 ? 'danger' : undefined} />
              </div>

              {/* Vendas por hora — good for operations to see peak times */}
              {vendasHoraChart.length > 0 ? (
                <div className="dash-charts-row">
                  <MiniBarChart dados={vendasHoraChart} labelKey="hora" valorKey="quantidade" titulo="Pedidos por Hora" />
                </div>
              ) : null}

              {statusChart.length > 0 ? (
                <div className="dash-charts-row">
                  <HorizontalBar
                    dados={statusChart}
                    labelKey="status"
                    valorKey="quantidade"
                    titulo="Distribuição por Status"
                    corFn={d => COR_STATUS[d._raw] || '#64748b'}
                  />
                </div>
              ) : null}

              {/* Alertas operacionais */}
              {dados.alertas?.length > 0 ? (
                <div className="dash-alertas-box">
                  <h4 className="dash-chart-titulo">Alertas Operacionais</h4>
                  {dados.alertas.filter(a => a.tipo === 'perigo' || a.tipo === 'atencao').map((a, i) => (
                    <AlertaCard key={i} tipo={a.tipo} titulo={a.titulo} descricao={a.descricao} />
                  ))}
                  {dados.alertas.filter(a => a.tipo === 'perigo' || a.tipo === 'atencao').length === 0 ? (
                    <p className="dash-sem-alertas">Nenhum alerta operacional no momento.</p>
                  ) : null}
                </div>
              ) : (
                <div className="dash-alertas-box">
                  <h4 className="dash-chart-titulo">Alertas Operacionais</h4>
                  <p className="dash-sem-alertas">Nenhum alerta operacional no momento.</p>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
