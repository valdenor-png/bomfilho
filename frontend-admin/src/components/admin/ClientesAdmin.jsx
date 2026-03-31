import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, Mail, MapPin, Phone, Users, X } from '../../icons';
import { adminGetClientes, adminGetClienteDetalhe } from '../../lib/api';
import { R$, LABELS_PAGAMENTO, LABELS_STATUS } from './ui/adminUtils';
import LoadingSkeleton from './ui/LoadingSkeleton';
import ErrorState from './ui/ErrorState';
import EmptyState from './ui/EmptyState';
const SEGMENTOS = [
  { value: 'todos', label: 'Todos' },
  { value: 'novos', label: 'Novos (1 pedido)' },
  { value: 'recorrentes', label: 'Recorrentes (3+)' },
  { value: 'vip', label: 'VIP (R$500+ e 5+)' },
  { value: 'inativos', label: 'Inativos (+60d)' },
  { value: 'risco_churn', label: 'Risco churn (+30d)' }
];

const ORDENACOES = [
  { value: 'gasto_desc', label: 'Maior gasto' },
  { value: 'pedidos_desc', label: 'Mais pedidos' },
  { value: 'ticket_desc', label: 'Maior ticket' },
  { value: 'recente', label: 'Mais recente' },
  { value: 'antigo', label: 'Mais antigo' }
];

function ClienteDetalheModal({ clienteId, onFechar }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    setCarregando(true);
    adminGetClienteDetalhe(clienteId)
      .then(r => setDados(r))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, [clienteId]);

  if (!clienteId) return null;

  return (
    <div className="cli-modal-overlay" onClick={onFechar}>
      <div className="cli-modal" onClick={e => e.stopPropagation()}>
        <button className="cli-modal-fechar" onClick={onFechar} aria-label="Fechar detalhe do cliente">
          <X size={16} aria-hidden="true" />
        </button>
        {carregando ? (
          <div className="cli-modal-loading">Carregando...</div>
        ) : !dados ? (
          <div className="cli-modal-erro">Cliente não encontrado</div>
        ) : (
          <>
            <div className="cli-modal-header">
              <h3>{dados.nome || 'Sem nome'}</h3>
              <div className="cli-modal-contato">
                {dados.telefone && <span><Phone size={14} aria-hidden="true" /> {dados.telefone}</span>}
                {dados.email && <span><Mail size={14} aria-hidden="true" /> {dados.email}</span>}
              </div>
            </div>

            <div className="cli-modal-kpis">
              <div className="cli-kpi"><span className="cli-kpi-v">{dados.total_pedidos}</span><span className="cli-kpi-l">Pedidos</span></div>
              <div className="cli-kpi"><span className="cli-kpi-v">{R$(dados.total_gasto)}</span><span className="cli-kpi-l">Total gasto</span></div>
              <div className="cli-kpi"><span className="cli-kpi-v">{R$(dados.ticket_medio)}</span><span className="cli-kpi-l">Ticket médio</span></div>
              <div className="cli-kpi"><span className="cli-kpi-v">{dados.total_cancelamentos || 0}</span><span className="cli-kpi-l">Cancelamentos</span></div>
              <div className="cli-kpi"><span className="cli-kpi-v">{dados.dias_desde_ultimo != null ? `${dados.dias_desde_ultimo}d` : '—'}</span><span className="cli-kpi-l">Desde último</span></div>
            </div>

            {dados.enderecos && dados.enderecos.length > 0 && (
              <div className="cli-modal-secao">
                <h4><MapPin size={14} aria-hidden="true" /> Endereços</h4>
                {dados.enderecos.map((e, i) => (
                  <div key={i} className="cli-endereco">{[e.rua, e.numero, e.bairro, e.cidade].filter(Boolean).join(', ') || 'Endereço incompleto'}</div>
                ))}
              </div>
            )}

            <div className="cli-modal-secao">
              <h4><ClipboardList size={14} aria-hidden="true" /> Últimos Pedidos</h4>
              <div className="cli-pedidos-lista">
                {(dados.pedidos || []).map(p => (
                  <div key={p.id} className="cli-pedido-row">
                    <span className="cli-ped-id">#{p.id}</span>
                    <span className="cli-ped-data">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span>
                    <span className={`cli-ped-status is-${p.status}`}>{LABELS_STATUS[p.status] || p.status}</span>
                    <span className="cli-ped-pag">{LABELS_PAGAMENTO[p.forma_pagamento] || p.forma_pagamento}</span>
                    <span className="cli-ped-valor">{R$(p.total)}</span>
                  </div>
                ))}
                {(!dados.pedidos || dados.pedidos.length === 0) && <div className="cli-vazio">Nenhum pedido encontrado</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SegmentoBadge({ cliente }) {
  const badges = [];
  if (cliente.total_pedidos === 1) badges.push({ label: 'Novo', cor: '#3b82f6' });
  if (cliente.total_pedidos >= 3) badges.push({ label: 'Recorrente', cor: '#22c55e' });
  if (cliente.total_gasto >= 500 && cliente.total_pedidos >= 5) badges.push({ label: 'VIP', cor: '#f59e0b' });
  if (cliente.dias_desde_ultimo > 60) badges.push({ label: 'Inativo', cor: '#6b7280' });
  else if (cliente.dias_desde_ultimo > 30 && cliente.total_pedidos >= 2) badges.push({ label: 'Risco', cor: '#ef4444' });

  if (badges.length === 0) return null;
  return (
    <span className="cli-badges">
      {badges.map((b, i) => <span key={i} className="cli-badge" style={{ background: b.cor }}>{b.label}</span>)}
    </span>
  );
}

export default function ClientesAdmin() {
  const [clientes, setClientes] = useState([]);
  const [paginacao, setPaginacao] = useState({ pagina: 1, total: 0, total_paginas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [segmento, setSegmento] = useState('todos');
  const [ordenar, setOrdenar] = useState('gasto_desc');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [clienteDetalheId, setClienteDetalheId] = useState(null);
  const [erro, setErro] = useState('');
  const buscaTimeoutRef = useRef(null);

  const carregar = useCallback(async (params = {}) => {
    setCarregando(true);
    try {
      const resp = await adminGetClientes({
        busca: params.busca ?? busca,
        segmento: params.segmento ?? segmento,
        ordenar: params.ordenar ?? ordenar,
        page: params.page ?? paginaAtual,
        limit: 30
      });
      setClientes(resp.clientes || []);
      setPaginacao(resp.paginacao || { pagina: 1, total: 0, total_paginas: 0 });
    } catch (e) {
      setClientes([]);
      setErro(e.message || 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }, [busca, segmento, ordenar, paginaAtual]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleBusca = useCallback((valor) => {
    setBusca(valor);
    if (buscaTimeoutRef.current) clearTimeout(buscaTimeoutRef.current);
    buscaTimeoutRef.current = setTimeout(() => {
      setPaginaAtual(1);
      carregar({ busca: valor, page: 1 });
    }, 400);
  }, [carregar]);

  return (
    <div className="clientes-admin">
      <div className="cli-header">
        <h2><Users size={18} aria-hidden="true" /> Clientes</h2>
        <span className="cli-total">{paginacao.total} clientes</span>
      </div>

      {/* Filtros */}
      <div className="cli-filtros">
        <input
          type="text"
          className="cli-busca"
          placeholder="Buscar por nome, telefone ou email..."
          value={busca}
          onChange={e => handleBusca(e.target.value)}
        />
        <select className="cli-select" value={segmento} onChange={e => { setSegmento(e.target.value); setPaginaAtual(1); }}>
          {SEGMENTOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="cli-select" value={ordenar} onChange={e => { setOrdenar(e.target.value); setPaginaAtual(1); }}>
          {ORDENACOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Tabela de clientes */}
      {carregando ? (
        <LoadingSkeleton type="table" lines={8} />
      ) : erro ? (
        <ErrorState message={erro} onRetry={() => carregar()} compact />
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={<Users size={18} aria-hidden="true" />}
          title="Nenhum cliente encontrado"
          description={busca || segmento !== 'todos' ? 'Tente ajustar os filtros de busca.' : 'Os clientes aparecerão aqui assim que fizerem pedidos.'}
          actionLabel={busca || segmento !== 'todos' ? 'Limpar filtros' : null}
          onAction={busca || segmento !== 'todos' ? () => { setBusca(''); setSegmento('todos'); setPaginaAtual(1); } : null}
        />
      ) : (
        <div className="cli-tabela-wrap">
          <table className="cli-tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Segmento</th>
                <th>Pedidos</th>
                <th>Total Gasto</th>
                <th>Ticket Médio</th>
                <th>Último Pedido</th>
                <th>Pagamento Fav.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className="cli-row" onClick={() => setClienteDetalheId(c.id)}>
                  <td>
                    <div className="cli-nome">{c.nome || 'Sem nome'}</div>
                    <div className="cli-contato">{c.telefone || c.email || ''}</div>
                  </td>
                  <td><SegmentoBadge cliente={c} /></td>
                  <td className="cli-num">{c.total_pedidos}</td>
                  <td className="cli-num">{R$(c.total_gasto)}</td>
                  <td className="cli-num">{R$(c.ticket_medio)}</td>
                  <td className="cli-num">
                    {c.ultimo_pedido ? new Date(c.ultimo_pedido).toLocaleDateString('pt-BR') : '—'}
                    {c.dias_desde_ultimo != null && <span className="cli-dias"> ({c.dias_desde_ultimo}d)</span>}
                  </td>
                  <td>{LABELS_PAGAMENTO[c.pagamento_favorito] || c.pagamento_favorito || '—'}</td>
                  <td><button className="cli-btn-ver" onClick={e => { e.stopPropagation(); setClienteDetalheId(c.id); }}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {paginacao.total_paginas > 1 && (
        <div className="cli-paginacao">
          <button disabled={paginaAtual <= 1} onClick={() => setPaginaAtual(p => p - 1)}>← Anterior</button>
          <span>Página {paginaAtual} de {paginacao.total_paginas}</span>
          <button disabled={paginaAtual >= paginacao.total_paginas} onClick={() => setPaginaAtual(p => p + 1)}>Próxima →</button>
        </div>
      )}

      {/* Modal detalhe */}
      {clienteDetalheId && (
        <ClienteDetalheModal clienteId={clienteDetalheId} onFechar={() => setClienteDetalheId(null)} />
      )}
    </div>
  );
}
