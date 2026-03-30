import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fonts, formatPrice, formatProductName } from '../theme';
import Icon from '../components/Icon';
import { getPedidos, getPedidoById, getMe } from '../lib/api';
import { SkeletonOrderCard } from '../components/ui/Skeleton';

const statusMap = {
  aguardando_revisao: { bg: 'rgba(226,184,74,0.12)', color: '#E2B84A', border: 'rgba(226,184,74,0.25)', label: 'Aguardando' },
  pendente: { bg: 'rgba(226,184,74,0.12)', color: '#E2B84A', border: 'rgba(226,184,74,0.25)', label: 'Pendente' },
  pagamento_recusado: { bg: 'rgba(239,83,80,0.12)', color: '#EF5350', border: 'rgba(239,83,80,0.25)', label: 'Pagamento recusado' },
  pago: { bg: 'rgba(90,228,167,0.12)', color: '#5AE4A7', border: 'rgba(90,228,167,0.25)', label: 'Pago' },
  preparando: { bg: 'rgba(90,228,167,0.12)', color: '#5AE4A7', border: 'rgba(90,228,167,0.25)', label: 'Preparando' },
  enviado: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: 'rgba(59,130,246,0.25)', label: 'Enviado' },
  entregue: { bg: 'rgba(90,228,167,0.12)', color: '#5AE4A7', border: 'rgba(90,228,167,0.25)', label: 'Entregue' },
  retirado: { bg: 'rgba(90,228,167,0.12)', color: '#5AE4A7', border: 'rgba(90,228,167,0.25)', label: 'Retirado' },
  cancelado: { bg: 'rgba(239,83,80,0.12)', color: '#EF5350', border: 'rgba(239,83,80,0.25)', label: 'Cancelado' },
  expirado: { bg: 'rgba(239,83,80,0.12)', color: '#EF5350', border: 'rgba(239,83,80,0.25)', label: 'Expirado' },
};

function getStatus(status) {
  const s = String(status || '').toLowerCase();
  return statusMap[s] || { bg: colors.card, color: colors.textMuted, border: colors.border, label: status || 'Desconhecido' };
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR') + ' as ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Orders({ onAdd, products = [] }) {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [detalhes, setDetalhes] = useState({});
  const [filter, setFilter] = useState('todos');
  const [reordering, setReordering] = useState(null);

  useEffect(() => {
    getMe()
      .then(() => {
        setLoggedIn(true);
        return getPedidos({ page: 1, limit: 20 });
      })
      .then((data) => setPedidos(data.pedidos || []))
      .catch(() => setLoggedIn(false))
      .finally(() => setLoading(false));
  }, []);

  const handleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!detalhes[id]) {
      try {
        const data = await getPedidoById(id);
        setDetalhes(prev => ({ ...prev, [id]: data }));
      } catch {}
    }
  };

  const handleReorder = (pedidoId) => {
    const det = detalhes[pedidoId];
    const itens = det?.itens || det?.pedido_itens || [];
    if (!itens.length || !onAdd) return;

    setReordering(pedidoId);
    let added = 0;
    let unavailable = 0;

    for (const item of itens) {
      const productId = item.produto_id || item.product_id;
      const product = products.find(p => p.id === Number(productId));
      if (product) {
        const qty = item.quantidade || 1;
        for (let i = 0; i < qty; i++) {
          onAdd(product.id);
        }
        added++;
      } else {
        unavailable++;
      }
    }

    setTimeout(() => {
      setReordering(null);
      if (unavailable > 0) {
        // Still navigate even if some items are unavailable
      }
      navigate('/pagamento');
    }, 300);
  };

  const filters = [
    { id: 'todos', label: 'Todos' },
    { id: 'andamento', label: 'Em andamento' },
    { id: 'entregues', label: 'Entregues' },
    { id: 'cancelados', label: 'Cancelados' },
  ];

  const filtered = pedidos.filter(p => {
    const s = String(p.status || '').toLowerCase();
    if (filter === 'todos') return true;
    if (filter === 'andamento') return ['aguardando_revisao', 'pendente', 'pago', 'preparando', 'enviado'].includes(s);
    if (filter === 'entregues') return ['entregue', 'retirado'].includes(s);
    if (filter === 'cancelados') return ['cancelado', 'expirado', 'pagamento_recusado'].includes(s);
    return true;
  });

  if (loading) return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3].map(i => <SkeletonOrderCard key={i} />)}
    </div>
  );

  if (!loggedIn) return (
    <div style={{ padding: '40px 16px', textAlign: 'center' }}>
      <Icon name="clipboard" size={36} color={colors.textMuted} />
      <p style={{ fontSize: 15, fontWeight: 800, color: colors.white, margin: '12px 0 4px', fontFamily: fonts.text }}>
        Seus pedidos
      </p>
      <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.text }}>
        Faca login para ver seus pedidos
      </p>
    </div>
  );

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
        Pedidos
      </h1>
      <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12, fontFamily: fonts.text }}>
        {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} no total
      </p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap',
            background: filter === f.id ? colors.gold : colors.card,
            border: filter === f.id ? 'none' : `1px solid ${colors.border}`,
            color: filter === f.id ? colors.bgDeep : colors.textSecondary,
            fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: fonts.text,
            flexShrink: 0,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: 24, textAlign: 'center',
        }}>
          <Icon name="clipboard" size={28} color={colors.textMuted} />
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, margin: '8px 0 4px', fontFamily: fonts.text }}>
            Nenhum pedido
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted }}>
            {filter === 'todos' ? 'Faca sua primeira compra!' : 'Nenhum pedido nesta categoria'}
          </p>
        </div>
      ) : (
        filtered.map((pedido) => {
          const st = getStatus(pedido.status);
          const isExpanded = expanded === pedido.id;
          const det = detalhes[pedido.id];
          const itens = det?.itens || det?.pedido_itens || [];
          const canReorder = ['entregue', 'retirado', 'cancelado', 'expirado'].includes(
            String(pedido.status || '').toLowerCase()
          );

          return (
            <div key={pedido.id} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 14, marginBottom: 8, overflow: 'hidden',
            }}>
              {/* Header do pedido */}
              <button onClick={() => handleExpand(pedido.id)} style={{
                width: '100%', padding: '12px 14px', border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: colors.white, fontFamily: fonts.text }}>
                      Pedido <span style={{ fontFamily: fonts.number }}>#{pedido.id}</span>
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                    }}>{st.label}</span>
                  </div>
                  <p style={{ fontSize: 10, color: colors.textMuted, margin: 0, fontFamily: fonts.text }}>
                    {formatDate(pedido.criado_em)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: fonts.number, fontWeight: 900, fontSize: 15, color: colors.gold }}>
                    {formatPrice(Number(pedido.total || 0))}
                  </span>
                  <p style={{ fontSize: 9, color: colors.textMuted, margin: '2px 0 0', fontFamily: fonts.text }}>
                    {pedido.forma_pagamento === 'pix' ? 'PIX' : pedido.forma_pagamento === 'credito' ? 'Credito' : pedido.forma_pagamento === 'debito' ? 'Debito' : pedido.forma_pagamento || ''}
                    {pedido.tipo_entrega === 'retirada' ? ' · Retirada' : ' · Entrega'}
                  </p>
                </div>
              </button>

              {/* Detalhes expandidos */}
              {isExpanded && (
                <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${colors.border}` }}>
                  {/* Timeline */}
                  {(() => {
                    const steps = [
                      { key: 'pendente', label: 'Recebido', icon: '\u{1F4E5}' },
                      { key: 'pago', label: 'Pago', icon: '\u2705' },
                      { key: 'preparando', label: 'Separando', icon: '\u{1F4E6}' },
                      { key: 'enviado', label: pedido.tipo_entrega === 'retirada' ? 'Pronto' : 'Saiu entrega', icon: '\u{1F69A}' },
                      { key: 'entregue', label: pedido.tipo_entrega === 'retirada' ? 'Retirado' : 'Entregue', icon: '\u{1F389}' },
                    ];
                    const statusOrder = ['pendente', 'aguardando_revisao', 'pago', 'preparando', 'enviado', 'entregue', 'retirado'];
                    const currentIdx = statusOrder.indexOf(String(pedido.status || '').toLowerCase());
                    const isCanceled = ['cancelado', 'expirado', 'pagamento_recusado'].includes(String(pedido.status || '').toLowerCase());

                    if (isCanceled) return null;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0 8px', overflow: 'hidden' }}>
                        {steps.map((step, i) => {
                          const stepIdx = statusOrder.indexOf(step.key);
                          const done = currentIdx >= stepIdx;
                          const isCurrent = (i === 0 && currentIdx <= 1) ||
                            (i === 1 && currentIdx === 2) ||
                            (i === 2 && currentIdx === 3) ||
                            (i === 3 && currentIdx === 4) ||
                            (i === 4 && currentIdx >= 5);
                          return (
                            <div key={step.key} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%', margin: '0 auto 3px',
                                background: done ? colors.gold : 'rgba(255,255,255,0.08)',
                                border: `2px solid ${done ? colors.gold : 'rgba(255,255,255,0.15)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, transition: 'all 0.3s',
                              }}>
                                {done ? step.icon : ''}
                              </div>
                              <span style={{
                                fontSize: 7, fontWeight: isCurrent ? 800 : 600,
                                color: done ? colors.gold : 'rgba(255,255,255,0.35)',
                                fontFamily: fonts.text,
                              }}>{step.label}</span>
                              {i < steps.length - 1 && (
                                <div style={{
                                  position: 'absolute', top: 12, left: '60%', right: '-40%', height: 2,
                                  background: done && currentIdx > stepIdx ? colors.gold : 'rgba(255,255,255,0.1)',
                                  zIndex: 0,
                                }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {itens.length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      {itens.map((item, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '5px 0', borderBottom: i < itens.length - 1 ? `1px solid ${colors.border}` : 'none',
                        }}>
                          <span style={{ fontSize: 11, color: colors.textSecondary, fontFamily: fonts.text }}>
                            <span style={{ fontFamily: fonts.number }}>{item.quantidade}x</span>{' '}
                            {formatProductName(item.nome_produto || item.nome || 'Item')}
                          </span>
                          <span style={{ fontSize: 11, fontFamily: fonts.number, color: colors.gold, fontWeight: 700 }}>
                            {formatPrice(Number(item.subtotal || item.preco || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: colors.textMuted, margin: '8px 0 0', fontStyle: 'italic' }}>
                      Carregando itens...
                    </p>
                  )}

                  {/* Botoes */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {canReorder && itens.length > 0 && (
                      <button
                        onClick={() => handleReorder(pedido.id)}
                        disabled={reordering === pedido.id}
                        style={{
                          flex: 1, padding: 10, borderRadius: 10,
                          background: colors.gold, border: 'none',
                          color: colors.bgDeep, fontWeight: 800, fontSize: 11,
                          cursor: 'pointer', fontFamily: fonts.text,
                          opacity: reordering === pedido.id ? 0.6 : 1,
                          boxShadow: '0 2px 8px rgba(226,184,74,0.3)',
                        }}
                      >
                        {reordering === pedido.id ? 'Adicionando...' : 'Pedir de novo'}
                      </button>
                    )}
                    <button onClick={() => window.open(`https://wa.me/5591999652790?text=Ola, sobre meu pedido %23${pedido.id}`, '_blank')} style={{
                      flex: 1, padding: 10, borderRadius: 10,
                      background: 'transparent', border: `1px solid ${colors.gold}`,
                      color: colors.gold, fontWeight: 700, fontSize: 11,
                      cursor: 'pointer', fontFamily: fonts.text,
                    }}>Ajuda</button>
                    <button onClick={() => handleExpand(null)} style={{
                      flex: 1, padding: 10, borderRadius: 10,
                      background: colors.card, border: `1px solid ${colors.border}`,
                      color: colors.white, fontWeight: 700, fontSize: 11,
                      cursor: 'pointer', fontFamily: fonts.text,
                    }}>Fechar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
