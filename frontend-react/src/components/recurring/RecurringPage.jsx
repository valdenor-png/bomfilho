import React, { useState, useEffect } from 'react';
import { colors, fonts, formatPrice } from '../../theme';
import Icon from '../Icon';

const STORAGE_KEY = 'bomfilho_recurring';
const FREQ_LABELS = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal' };

export default function RecurringPage({ onBack, onAdd }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    setOrders(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  }, []);

  const save = (updated) => {
    setOrders(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleToggle = (id) => {
    save(orders.map(o => o.id === id ? { ...o, isActive: !o.isActive } : o));
  };

  const handleDelete = (id) => {
    save(orders.filter(o => o.id !== id));
  };

  const handleUseNow = (order) => {
    if (!onAdd) return;
    for (const item of order.items) {
      if (item.productId) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) onAdd(item.productId);
      }
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: colors.white, padding: 4,
        }}>
          <Icon name="arrowLeft" size={18} color={colors.white} />
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
          Compras Recorrentes
        </h1>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{'\u{1F501}'}</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
            Nenhuma compra recorrente
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted, fontFamily: fonts.text }}>
            Configure no carrinho para receber lembretes automaticos
          </p>
        </div>
      ) : (
        orders.map(order => {
          const total = order.items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
          return (
            <div key={order.id} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: 14, marginBottom: 8,
              opacity: order.isActive ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
                    {order.name}
                  </p>
                  <p style={{ fontSize: 10, color: colors.textMuted, margin: '2px 0 0', fontFamily: fonts.text }}>
                    {FREQ_LABELS[order.frequency] || order.frequency} \u00B7 {order.items.length} itens \u00B7 ~{formatPrice(total)}
                  </p>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: order.isActive ? 'rgba(90,228,167,0.12)' : 'rgba(255,255,255,0.05)',
                  color: order.isActive ? '#5AE4A7' : colors.textMuted,
                  border: `1px solid ${order.isActive ? 'rgba(90,228,167,0.25)' : colors.border}`,
                }}>
                  {order.isActive ? 'Ativo' : 'Pausado'}
                </span>
              </div>

              <p style={{ fontSize: 10, color: colors.textMuted, margin: '4px 0 8px', fontFamily: fonts.text }}>
                Proximo lembrete: {order.nextReminder}
              </p>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleUseNow(order)} style={{
                  flex: 1, padding: 9, borderRadius: 10,
                  background: colors.gold, border: 'none', color: colors.bgDeep,
                  fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: fonts.text,
                }}>Usar agora</button>
                <button onClick={() => handleToggle(order.id)} style={{
                  padding: '9px 12px', borderRadius: 10,
                  background: 'transparent', border: `1px solid ${colors.border}`,
                  color: colors.textSecondary, fontWeight: 700, fontSize: 11,
                  cursor: 'pointer', fontFamily: fonts.text,
                }}>{order.isActive ? 'Pausar' : 'Retomar'}</button>
                <button onClick={() => handleDelete(order.id)} style={{
                  padding: '9px 12px', borderRadius: 10,
                  background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.2)',
                  color: '#EF5350', fontWeight: 700, fontSize: 11,
                  cursor: 'pointer', fontFamily: fonts.text,
                }}>Excluir</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
