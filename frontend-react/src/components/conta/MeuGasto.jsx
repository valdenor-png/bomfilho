import React, { useMemo } from 'react';
import { colors, fonts, formatPrice } from '../../theme';
import Icon from '../Icon';

export default function MeuGasto({ pedidos = [], onBack }) {
  const monthlyData = useMemo(() => {
    const months = {};
    pedidos
      .filter(o => !['cancelado', 'expirado'].includes(String(o.status || '').toLowerCase()))
      .forEach(order => {
        const d = new Date(order.criado_em);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (!months[key]) months[key] = { label, total: 0, count: 0 };
        months[key].total += Number(order.total || 0);
        months[key].count++;
      });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }, [pedidos]);

  const totalGeral = monthlyData.reduce((s, m) => s + m.total, 0);
  const totalPedidos = monthlyData.reduce((s, m) => s + m.count, 0);

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: colors.white, padding: 4,
        }}>
          <Icon name="arrowLeft" size={18} color={colors.white} />
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
          Meu Gasto
        </h1>
      </div>

      {/* Resumo geral */}
      <div style={{
        background: colors.goldBg, border: `1px solid ${colors.goldBorder}`,
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}>
        <p style={{ fontSize: 10, color: colors.gold, fontWeight: 700, margin: '0 0 4px', fontFamily: fonts.text }}>
          TOTAL GERAL
        </p>
        <p style={{ fontSize: 28, fontWeight: 900, color: colors.gold, margin: 0, fontFamily: fonts.number }}>
          {formatPrice(totalGeral)}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(226,184,74,0.7)', margin: '4px 0 0', fontFamily: fonts.text }}>
          {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} no total
        </p>
      </div>

      {/* Meses */}
      {monthlyData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Icon name="clipboard" size={32} color={colors.textMuted} />
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, margin: '10px 0 4px', fontFamily: fonts.text }}>
            Sem dados ainda
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted, fontFamily: fonts.text }}>
            Seus gastos mensais aparecerao aqui
          </p>
        </div>
      ) : (
        monthlyData.map((month, i) => {
          const ticketMedio = month.count > 0 ? month.total / month.count : 0;
          return (
            <div key={i} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: 14, marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: colors.white, fontFamily: fonts.text,
                  textTransform: 'capitalize',
                }}>
                  {month.label}
                </span>
                <span style={{ fontFamily: fonts.number, fontWeight: 900, fontSize: 16, color: colors.gold }}>
                  {formatPrice(month.total)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: fonts.text }}>
                  {month.count} pedido{month.count !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: fonts.text }}>
                  Ticket medio: <span style={{ fontFamily: fonts.number, fontWeight: 700, color: colors.textSecondary }}>
                    {formatPrice(ticketMedio)}
                  </span>
                </span>
              </div>
              {/* Barra visual */}
              <div style={{
                height: 4, borderRadius: 2, marginTop: 8,
                background: 'rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: colors.gold,
                  width: `${Math.min(100, (month.total / (monthlyData[0]?.total || 1)) * 100)}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
