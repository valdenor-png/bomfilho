import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';

// Pipeline stage card for Operacao ao Vivo
// <StageCard label="Separando" count={3} color="#A07AE2" active />

export default function StageCard({ label, count = 0, color, active, onClick, style }) {
  const borderTopColor = count > 0 ? (color || colors.teal) : 'transparent';
  const valueColor = count > 0 ? (color || colors.white) : colors.dim;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 8px',
        borderRadius: radius.lg,
        background: colors.bgCard,
        border: `1px solid ${active ? colors.goldBorder : colors.border}`,
        borderTop: `3px solid ${borderTopColor}`,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        minWidth: 90,
        ...style,
      }}
    >
      <span style={{
        display: 'block', fontSize: 26, fontWeight: 800,
        fontFamily: fonts.numbers, color: valueColor, lineHeight: 1.2,
      }}>
        {count}
      </span>
      <span style={{
        display: 'block', fontSize: 10, fontWeight: 500,
        color: colors.muted, marginTop: 2,
        fontFamily: fonts.text,
      }}>
        {label}
      </span>
    </button>
  );
}
