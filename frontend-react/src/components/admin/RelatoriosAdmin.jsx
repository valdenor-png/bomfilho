import React, { useState, useCallback } from 'react';
import { BarChart3, Download, FileSpreadsheet, Store, Truck } from '../../icons';
import { adminGetRelatorioVendas, adminExportarRelatorioVendasCSV } from '../../lib/api';
import { R$, LABELS_PAGAMENTO, LABELS_STATUS } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';

const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'mes', label: 'Mês atual' },
  { value: 'custom', label: 'Personalizado' }
];

export default function RelatoriosAdmin() {
  const [periodo, setPeriodo] = useState('hoje');
  const [canal, setCanal] = useState('todos');
  const [pagamento, setPagamento] = useState('todos');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [resultados, setResultados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');

  const getParams = useCallback(() => {
    const p = { periodo, canal, pagamento };
    if (periodo === 'custom') {
      if (inicio) p.inicio = inicio;
      if (fim) p.fim = fim;
    }
    return p;
  }, [periodo, canal, pagamento, inicio, fim]);

  const gerar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resp = await adminGetRelatorioVendas(getParams());
      setResultados(resp);
    } catch (e) {
      setResultados(null);
      setErro(e.message || 'Erro ao gerar relatório.');
    } finally {
      setCarregando(false);
    }
  }, [getParams]);

  const exportarCSV = useCallback(async () => {
    setExportando(true);
    try {
      await adminExportarRelatorioVendasCSV(getParams());
    } catch (e) {
      setErro('Falha ao exportar CSV. Tente novamente.');
    } finally {
      setExportando(false);
    }
  }, [getParams]);

  // Resumo
  const resumo = resultados ? (() => {
    const pedidos = resultados.pedidos || [];
    const validos = pedidos.filter(p => p.status !== 'cancelado');
    return {
      total: pedidos.length,
      faturamento: validos.reduce((s, p) => s + Number(p.total || 0), 0),
      ticket: validos.length > 0 ? validos.reduce((s, p) => s + Number(p.total || 0), 0) / validos.length : 0,
      cancelados: pedidos.filter(p => p.status === 'cancelado').length,
      porPag: Object.entries(validos.reduce((acc, p) => { acc[p.forma_pagamento] = (acc[p.forma_pagamento] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]),
      porStatus: Object.entries(pedidos.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])
    };
  })() : null;

  return (
    <div className="relatorios-admin">
      <div className="rel-header">
        <h2><BarChart3 size={18} aria-hidden="true" /> Relatórios</h2>
      </div>

      {/* Filtros */}
      <div className="rel-filtros">
        <div className="rel-filtro-grupo">
          <label>Período</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} className="rel-select">
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {periodo === 'custom' && (
          <>
            <div className="rel-filtro-grupo">
              <label>De</label>
              <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="rel-date" />
            </div>
            <div className="rel-filtro-grupo">
              <label>Até</label>
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="rel-date" />
            </div>
          </>
        )}
        <div className="rel-filtro-grupo">
          <label>Canal</label>
          <select value={canal} onChange={e => setCanal(e.target.value)} className="rel-select">
            <option value="todos">Todos</option>
            <option value="entrega">Entrega</option>
            <option value="retirada">Retirada</option>
          </select>
        </div>
        <div className="rel-filtro-grupo">
          <label>Pagamento</label>
          <select value={pagamento} onChange={e => setPagamento(e.target.value)} className="rel-select">
            <option value="todos">Todos</option>
            <option value="pix">PIX</option>
            <option value="credito">Crédito</option>
            <option value="debito">Débito</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
        </div>
        <div className="rel-filtro-acoes">
          <button className="rel-btn-gerar" onClick={gerar} disabled={carregando}>
            {carregando ? 'Gerando...' : <><FileSpreadsheet size={14} aria-hidden="true" /> Gerar Relatório</>}
          </button>
          {resultados && (
            <button className="rel-btn-exportar" onClick={exportarCSV} disabled={exportando}>
              {exportando ? 'Exportando...' : <><Download size={14} aria-hidden="true" /> Exportar CSV</>}
            </button>
          )}
        </div>
      </div>

      {carregando && <LoadingSkeleton type="kpis" />}

      {erro && !carregando && (
        <ErrorState message={erro} onRetry={gerar} compact />
      )}

      {/* Resultados */}
      {resultados && resumo && !carregando && (
        <>
          <div className="rel-resumo">
            <div className="rel-kpi is-destaque">
              <span className="rel-kpi-v">{R$(resumo.faturamento)}</span>
              <span className="rel-kpi-l">Faturamento</span>
            </div>
            <div className="rel-kpi">
              <span className="rel-kpi-v">{resumo.total}</span>
              <span className="rel-kpi-l">Pedidos</span>
            </div>
            <div className="rel-kpi">
              <span className="rel-kpi-v">{R$(resumo.ticket)}</span>
              <span className="rel-kpi-l">Ticket Médio</span>
            </div>
            <div className="rel-kpi is-alerta">
              <span className="rel-kpi-v">{resumo.cancelados}</span>
              <span className="rel-kpi-l">Cancelados</span>
            </div>
          </div>

          <div className="rel-distribuicao">
            <div className="rel-dist-col">
              <h4>Por Pagamento</h4>
              {resumo.porPag.map(([k, v]) => (
                <div key={k} className="rel-dist-row">
                  <span>{LABELS_PAGAMENTO[k] || k}</span>
                  <span className="rel-dist-val">{v}</span>
                  <div className="rel-dist-bar"><div style={{ width: `${resumo.total > 0 ? (v / resumo.total * 100) : 0}%` }}></div></div>
                </div>
              ))}
            </div>
            <div className="rel-dist-col">
              <h4>Por Status</h4>
              {resumo.porStatus.map(([k, v]) => (
                <div key={k} className="rel-dist-row">
                  <span>{LABELS_STATUS[k] || k}</span>
                  <span className="rel-dist-val">{v}</span>
                  <div className="rel-dist-bar"><div style={{ width: `${resumo.total > 0 ? (v / resumo.total * 100) : 0}%` }}></div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de pedidos */}
          <div className="rel-tabela-wrap">
            <table className="rel-tabela">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Canal</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(resultados.pedidos || []).slice(0, 100).map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{new Date(p.criado_em).toLocaleString('pt-BR')}</td>
                    <td>{p.cliente_nome || '—'}</td>
                    <td><span className={`rel-status is-${p.status}`}>{LABELS_STATUS[p.status] || p.status}</span></td>
                    <td>{LABELS_PAGAMENTO[p.forma_pagamento] || p.forma_pagamento}</td>
                    <td>{p.tipo_entrega === 'retirada' ? <Store size={14} aria-hidden="true" /> : <Truck size={14} aria-hidden="true" />}</td>
                    <td className="rel-valor">{R$(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(resultados.pedidos || []).length > 100 && (
              <div className="rel-nota">Mostrando 100 de {resultados.pedidos.length} pedidos. Exporte para ver todos.</div>
            )}
          </div>
        </>
      )}

      {!resultados && !carregando && !erro && (
        <div className="rel-instrucao">Selecione os filtros e clique em "Gerar Relatório" para visualizar os dados.</div>
      )}
    </div>
  );
}
