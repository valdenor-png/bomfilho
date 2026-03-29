// pages/Orders.jsx — Tela de pedidos
// Props: orders (array da API), onViewDetails(orderId)
// orders: [{id, date, status, total, items, payment_method}]

import { colors, fonts, formatPrice } from '../theme';
import Icon from '../components/Icon';

const statusStyles = {
  pending: { bg: 'rgba(226,184,74,0.12)', color: '#E2B84A', border: 'rgba(226,184,74,0.25)', label: 'Pendente' },
  accepted: { bg: 'rgba(226,184,74,0.12)', color: '#E2B84A', border: 'rgba(226,184,74,0.25)', label: 'Aceito' },
  preparing: { bg: 'rgba(226,184,74,0.12)', color: '#E2B84A', border: 'rgba(226,184,74,0.25)', label: 'Preparando' },
  delivered: { bg: 'rgba(90,228,167,0.10)', color: '#5AE4A7', border: 'rgba(90,228,167,0.25)', label: 'Entregue' },
  cancelled: { bg: 'rgba(239,83,80,0.10)', color: '#EF5350', border: 'rgba(239,83,80,0.20)', label: 'Cancelado' },
};

export default function Orders({ orders = [], onViewDetails }) {
  if (orders.length === 0) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
          Pedidos
        </h1>
        <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 20, fontFamily: fonts.text }}>
          Acompanhe o andamento de cada compra
        </p>
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 14, padding: 24, textAlign: 'center',
        }}>
          <Icon name="clipboard" size={36} color={colors.textMuted} />
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.white, marginTop: 10, fontFamily: fonts.text }}>
            Nenhum pedido ainda
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, fontFamily: fonts.text }}>
            Faca sua primeira compra!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
        Pedidos
      </h1>
      <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 14, fontFamily: fonts.text }}>
        Acompanhe o andamento de cada compra
      </p>

      {orders.map(order => {
        const st = statusStyles[order.status] || statusStyles.pending;
        return (
          <div key={order.id} style={{
            background: colors.card, border: `1px solid ${colors.border}`,
            borderRadius: 14, padding: 14, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: colors.white, fontFamily: fonts.text }}>
                Pedido <span style={{ fontFamily: fonts.number }}>#{order.id}</span>
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                background: st.bg, color: st.color, border: `1px solid ${st.border}`,
              }}>
                {st.label}
              </span>
            </div>
            <p style={{ fontSize: 10, color: colors.textMuted, marginBottom: 8, fontFamily: fonts.text }}>
              {order.date}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: fonts.text }}>
                {order.payment_method} · {order.items?.length || 0} itens
              </span>
              <span style={{ fontFamily: fonts.number, fontWeight: 800, fontSize: 14, color: colors.gold }}>
                {formatPrice(order.total)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={() => onViewDetails?.(order.id)} style={{
                flex: 1, padding: 9, background: 'transparent',
                border: `1px solid ${colors.goldBorder}`, borderRadius: 10,
                color: colors.gold, fontWeight: 700, fontSize: 11,
                cursor: 'pointer', fontFamily: fonts.text,
              }}>
                Ver detalhes
              </button>
              <button style={{
                flex: 1, padding: 9, background: colors.card,
                border: `1px solid ${colors.border}`, borderRadius: 10,
                color: colors.white, fontWeight: 700, fontSize: 11,
                cursor: 'pointer', fontFamily: fonts.text,
              }}>
                Pedir novamente
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
