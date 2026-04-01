import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';

// <FilterChip label="Hoje" active={period === 'hoje'} onClick={() => setPeriod('hoje')} />
// <FilterChip label="Mês" active gold />  — gold variant for active

export default function FilterChip({ label, active, gold, onClick, count, style }) {
  const isGold = gold && active;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: fonts.text,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: active
          ? (isGold ? `1px solid ${colors.goldBorder}` : `1px solid ${colors.tealLight}`)
          : `1px solid ${colors.border}`,
        background: active
          ? (isGold ? colors.goldDim : `linear-gradient(135deg, ${colors.teal}, ${colors.tealLight})`)
          : colors.tealDim,
        color: active
          ? (isGold ? colors.gold : colors.white)
          : colors.muted,
        ...style,
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span style={{
          marginLeft: 5, fontSize: 10, fontFamily: fonts.numbers, fontWeight: 700,
          padding: '1px 5px', borderRadius: 4,
          background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
        }}>
          {count}
        </span>
      )}
    </button>
  );
}
