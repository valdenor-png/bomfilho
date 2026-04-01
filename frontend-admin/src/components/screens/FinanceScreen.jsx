import React from 'react';
import { colors, fonts, radius, getStatusStyle } from '../../styles/tokens';
import { KPICard, FilterChip, SelectField, InputField, Btn, Badge } from '../ui';

const BRL = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

const PERIOD_OPTIONS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
  { id: 'todos', label: 'Todos' },
  { id: 'custom', label: 'Custom' },
];

const ORDER_OPTIONS = [
  { value: 'data_desc', label: 'Mais recente' },
  { value: 'data_asc', label: 'Mais antiga' },
  { value: 'valor_desc', label: 'Maior valor' },
  { value: 'valor_asc', label: 'Menor valor' },
];

export default function FinanceScreen({
  financeiro,
  resumoFinanceiroFiltrado,
  linhasFinanceiro,
  filtroFinanceiroPeriodo, setFiltroFinanceiroPeriodo,
  filtroFinanceiroStatus, setFiltroFinanceiroStatus,
  filtroFinanceiroOrdem, setFiltroFinanceiroOrdem,
  filtroFinanceiroBusca, setFiltroFinanceiroBusca,
  filtroFinanceiroInicio, setFiltroFinanceiroInicio,
  filtroFinanceiroFim, setFiltroFinanceiroFim,
  paginacaoPedidos, carregandoPedidos,
  carregarPedidosPagina,
  exportarFinanceiroCsv,
  statusOptions,
  formatarStatusPedido,
  formasPagamentoLabels,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, fontFamily: fonts.text }}>Painel Financeiro</h2>
          <p style={{ fontSize: 11, color: colors.dim, margin: '2px 0 0' }}>Visao consolidada de faturamento, pagamentos e movimentacao.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: colors.tealDim, color: colors.muted, fontFamily: fonts.numbers }}>
            Pag {paginacaoPedidos.pagina}/{paginacaoPedidos.total_paginas}
          </span>
          <Btn onClick={() => carregarPedidosPagina(paginacaoPedidos.pagina - 1)} disabled={carregandoPedidos || paginacaoPedidos.pagina <= 1}>
            ← Anterior
          </Btn>
          <Btn onClick={() => carregarPedidosPagina(paginacaoPedidos.pagina + 1)} disabled={carregandoPedidos || !paginacaoPedidos.tem_mais}>
            Proxima →
          </Btn>
        </div>
      </div>

      {/* Period chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PERIOD_OPTIONS.map(p => (
          <FilterChip
            key={p.id}
            label={p.label}
            active={filtroFinanceiroPeriodo === p.id}
            gold={filtroFinanceiroPeriodo === p.id}
            onClick={() => setFiltroFinanceiroPeriodo(p.id)}
          />
        ))}
      </div>

      {/* Custom date range */}
      {filtroFinanceiroPeriodo === 'custom' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <InputField label="Inicio" type="date" value={filtroFinanceiroInicio} onChange={setFiltroFinanceiroInicio} style={{ flex: 1 }} />
          <InputField label="Fim" type="date" value={filtroFinanceiroFim} onChange={setFiltroFinanceiroFim} style={{ flex: 1 }} />
        </div>
      )}

      {/* KPIs row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <KPICard label="Faturamento" value={BRL(financeiro.faturamentoTotal)} sub="total da pagina" tone="green" />
        <KPICard label="Ticket Medio" value={BRL(financeiro.ticketMedio)} />
        <KPICard label="Pendentes" value={BRL(financeiro.pendentesTotal)} sub={`${financeiro.pedidosComData?.filter(p => p.status === 'pendente').length || 0} pedidos`} tone="orange" />
        <KPICard label="Cancelados" value={BRL(financeiro.canceladosTotal)} sub={`${financeiro.pedidosComData?.filter(p => p.status === 'cancelado').length || 0} pedidos`} tone="red" />
      </div>

      {/* KPIs row 2 — filtered stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8,
        padding: 14, borderRadius: radius.lg,
        background: colors.bgCard, border: `1px solid ${colors.border}`,
      }}>
        {[
          { label: 'Pedidos filtrados', value: resumoFinanceiroFiltrado.quantidade },
          { label: 'Fat. filtrado', value: BRL(resumoFinanceiroFiltrado.faturamento) },
          { label: 'Ticket filtrado', value: BRL(resumoFinanceiroFiltrado.ticket) },
          { label: 'Fat. hoje', value: BRL(financeiro.faturamentoHoje) },
        ].map((kpi, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: colors.dim, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 2 }}>{kpi.label}</span>
            <strong style={{ fontSize: 16, fontWeight: 800, fontFamily: fonts.numbers, color: colors.white }}>{kpi.value}</strong>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'flex-end' }}>
        <SelectField
          label="Status"
          value={filtroFinanceiroStatus}
          onChange={setFiltroFinanceiroStatus}
          options={[{ value: 'todos', label: 'Todos os status' }, ...statusOptions.map(s => ({ value: s, label: formatarStatusPedido(s) }))]}
        />
        <SelectField
          label="Ordenar"
          value={filtroFinanceiroOrdem}
          onChange={setFiltroFinanceiroOrdem}
          options={ORDER_OPTIONS}
        />
        <InputField
          label="Buscar"
          value={filtroFinanceiroBusca}
          onChange={setFiltroFinanceiroBusca}
          placeholder="Cliente ou #pedido"
        />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Btn onClick={exportarFinanceiroCsv} icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          }>
            Exportar CSV
          </Btn>
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: radius.lg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(31,92,80,0.1)' }}>
              {['#', 'Data', 'Cliente', 'Status', 'Pagamento', 'Valor'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i === 5 ? 'right' : 'left',
                  padding: '10px 12px', fontSize: 10, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  color: colors.dim, borderBottom: `1px solid ${colors.borderLight}`,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasFinanceiro.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: colors.dim }}>
                  Nenhum registro financeiro para os filtros aplicados.
                </td>
              </tr>
            ) : (
              linhasFinanceiro.map(pedido => (
                <tr key={pedido.id} style={{ borderBottom: `1px solid ${colors.borderDim}` }}>
                  <td style={{ padding: '10px 12px', fontFamily: fonts.numbers, fontWeight: 700, color: colors.gold }}>
                    #{pedido.id}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.dim, fontSize: 11 }}>
                    {pedido._data ? pedido._data.toLocaleString('pt-BR') : '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {pedido.cliente_nome || '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge status={pedido.status} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Badge tone="muted" label={formasPagamentoLabels[pedido.forma_pagamento] || pedido.forma_pagamento || 'PIX'} />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: fonts.numbers, fontWeight: 600, color: colors.gold }}>
                    {BRL(pedido._total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
