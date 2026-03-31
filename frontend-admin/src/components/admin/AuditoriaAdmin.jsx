import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, Search } from '../../icons';
import { adminGetAuditoria } from '../../lib/api';
import { LABELS_ACAO, LABELS_ENTIDADE } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';

export default function AuditoriaAdmin() {
  const [logs, setLogs] = useState([]);
  const [paginacao, setPaginacao] = useState({ pagina: 1, total: 0, total_paginas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [filtroAcao, setFiltroAcao] = useState('');
  const [filtroEntidade, setFiltroEntidade] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [aviso, setAviso] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resp = await adminGetAuditoria({
        page: paginaAtual,
        limit: 30,
        acao: filtroAcao || undefined,
        entidade: filtroEntidade || undefined
      });
      setLogs(resp.logs || []);
      setPaginacao(resp.paginacao || { pagina: 1, total: 0, total_paginas: 0 });
      setAviso(resp.aviso || null);
    } catch (e) {
      setLogs([]);
      setAviso(e.message || 'Erro ao carregar auditoria.');
    } finally {
      setCarregando(false);
    }
  }, [paginaAtual, filtroAcao, filtroEntidade]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="auditoria-admin">
      <div className="aud-header">
        <h2><Search size={18} aria-hidden="true" /> Auditoria</h2>
        <span className="aud-total">{paginacao.total} registros</span>
      </div>

      {aviso && <div className="aud-aviso">{aviso}</div>}

      <div className="aud-filtros">
        <select value={filtroAcao} onChange={e => { setFiltroAcao(e.target.value); setPaginaAtual(1); }} className="aud-select">
          <option value="">Todas as ações</option>
          <option value="alterar_status_pedido">Alteração de status</option>
          <option value="exportar_relatorio">Exportação</option>
          <option value="login">Login</option>
        </select>
        <select value={filtroEntidade} onChange={e => { setFiltroEntidade(e.target.value); setPaginaAtual(1); }} className="aud-select">
          <option value="">Todas as entidades</option>
          <option value="pedido">Pedido</option>
          <option value="produto">Produto</option>
          <option value="pedidos">Pedidos (relatórios)</option>
        </select>
      </div>

      {carregando ? (
        <LoadingSkeleton type="table" lines={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Search size={18} aria-hidden="true" />}
          title="Nenhum registro de auditoria"
          description={filtroAcao || filtroEntidade ? 'Tente ajustar os filtros.' : 'Os registros de auditoria aparecerão aqui conforme ações forem realizadas.'}
          actionLabel={aviso ? 'Tentar novamente' : null}
          onAction={aviso ? carregar : null}
        />
      ) : (
        <div className="aud-tabela-wrap">
          <table className="aud-tabela">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>ID</th>
                <th>Usuário</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="aud-row" onClick={() => setExpandidoId(expandidoId === l.id ? null : l.id)}>
                  <td className="aud-data">{new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                  <td><span className="aud-acao-badge">{LABELS_ACAO[l.acao] || l.acao}</span></td>
                  <td>{LABELS_ENTIDADE[l.entidade] || l.entidade || '—'}</td>
                  <td className="aud-id">{l.entidade_id || '—'}</td>
                  <td>{l.admin_usuario || '—'}</td>
                  <td className="aud-ip">{l.ip || '—'}</td>
                  <td>{l.detalhes ? <button className="aud-btn-det" onClick={e => { e.stopPropagation(); setExpandidoId(expandidoId === l.id ? null : l.id); }}><ClipboardList size={14} aria-hidden="true" /></button> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {expandidoId && (() => {
            const log = logs.find(l => l.id === expandidoId);
            if (!log || !log.detalhes) return null;
            return (
              <div className="aud-detalhes-panel">
                <h4>Detalhes — {LABELS_ACAO[log.acao] || log.acao} #{log.entidade_id || ''}</h4>
                <pre className="aud-json">{JSON.stringify(log.detalhes, null, 2)}</pre>
              </div>
            );
          })()}
        </div>
      )}

      {paginacao.total_paginas > 1 && (
        <div className="aud-paginacao">
          <button disabled={paginaAtual <= 1} onClick={() => setPaginaAtual(p => p - 1)}><ArrowLeft size={14} aria-hidden="true" /> Anterior</button>
          <span>Página {paginaAtual} de {paginacao.total_paginas}</span>
          <button disabled={paginaAtual >= paginacao.total_paginas} onClick={() => setPaginaAtual(p => p + 1)}>Próxima <ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
