import React from 'react';
import { formatarData } from '../../../lib/adminGerenciaUtils';

export default function GerenciaLogsTab({
  importLogs,
  enrichmentLogs,
  carregandoLogs,
  onCarregarLogs
}) {
  return (
    <div className="admin-gerencia-panel">
      <div className="toolbar-box" style={{ marginTop: '0.8rem' }}>
        <button className="btn-secondary" type="button" disabled={carregandoLogs} onClick={onCarregarLogs}>
          {carregandoLogs ? 'Atualizando...' : 'Atualizar logs'}
        </button>
      </div>

      <div className="card-box" style={{ marginTop: '0.8rem' }}>
        <p><strong>Logs de importacao</strong></p>
        <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Arquivo</th>
                <th>Formato</th>
                <th>Status</th>
                <th>Validas</th>
                <th>Com erro</th>
                <th>Duracao</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLogs ? (
                <tr><td colSpan={8}>Carregando logs de importacao...</td></tr>
              ) : importLogs.length === 0 ? (
                <tr><td colSpan={8}>Nenhum log de importacao registrado.</td></tr>
              ) : (
                importLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatarData(log.created_at)}</td>
                    <td>{log.arquivo_nome}</td>
                    <td>{log?.resumo?.formato || '-'}</td>
                    <td>{log.status}</td>
                    <td>{Number(log.linhas_validas || 0)}</td>
                    <td>{Number(log.linhas_com_erro || 0)}</td>
                    <td>{Number(log?.resumo?.performance?.duracao_total_ms || log?.resumo?.duracao_ms || 0) > 0 ? `${Number(log.resumo.performance?.duracao_total_ms || log.resumo?.duracao_ms)} ms` : '-'}</td>
                    <td>{log.criado_por || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-box" style={{ marginTop: '1rem' }}>
        <p><strong>Logs de enriquecimento</strong></p>
        <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Barcode</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {carregandoLogs ? (
                <tr><td colSpan={6}>Carregando logs de enriquecimento...</td></tr>
              ) : enrichmentLogs.length === 0 ? (
                <tr><td colSpan={6}>Nenhum log de enriquecimento registrado.</td></tr>
              ) : (
                enrichmentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatarData(log.created_at)}</td>
                    <td>{log.produto_id || '-'}</td>
                    <td>{log.barcode || '-'}</td>
                    <td>{log.provider || '-'}</td>
                    <td>{log.status || '-'}</td>
                    <td>{log.mensagem || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
