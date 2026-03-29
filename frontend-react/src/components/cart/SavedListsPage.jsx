import React from 'react';
import { useSavedLists } from '../../hooks/useSavedLists';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return ''; }
}

function formatPrice(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

export default function SavedListsPage({ onBack, onLoadList }) {
  const { lists, deleteList, count } = useSavedLists();

  const handleDelete = (list) => {
    if (window.confirm(`Deletar a lista "${list.name}"?`)) {
      deleteList(list.id);
    }
  };

  const handleLoad = (list) => {
    if (onLoadList) onLoadList(list);
  };

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 20px' }}>
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: '1rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{'\u2190'}</button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>Minhas Listas</h2>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
            {count} lista{count !== 1 ? 's' : ''} salva{count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.45)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.5 }}>{'\u{1F4CB}'}</div>
          <p style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', margin: '0 0 4px' }}>
            Nenhuma lista salva
          </p>
          <p style={{ fontSize: '0.82rem', margin: 0 }}>
            Salve uma lista após finalizar um pedido
          </p>
        </div>
      ) : (
        lists.map(list => {
          const total = list.items.reduce((s, i) => s + (i.price * i.quantity), 0);
          return (
            <div key={list.id} style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16, padding: 16, marginBottom: 10,
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', margin: 0 }}>{list.name}</p>
                  <p style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    {list.items.length} ite{list.items.length === 1 ? 'm' : 'ns'} · Usado em {formatDate(list.lastUsedAt)}
                  </p>
                </div>
                <span style={{
                  fontFamily: "'Sora', sans-serif", fontWeight: 800,
                  fontSize: '0.92rem', color: '#E2B84A', flexShrink: 0,
                }}>
                  {formatPrice(total)}
                </span>
              </div>

              {/* Items preview */}
              <div style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 10px',
                marginBottom: 10, maxHeight: 100, overflowY: 'auto',
              }}>
                {list.items.map((item, i) => (
                  <p key={i} style={{
                    fontSize: '0.74rem', color: 'rgba(255,255,255,0.65)',
                    margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.quantity}x {item.name}
                  </p>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleLoad(list)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  background: '#E2B84A', border: 'none', color: '#174A40',
                  fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {'\u{1F6D2}'} Adicionar ao carrinho
                </button>
                <button onClick={() => handleDelete(list)} style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F87171', fontSize: '0.8rem', cursor: 'pointer',
                }}>
                  {'\u2715'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
