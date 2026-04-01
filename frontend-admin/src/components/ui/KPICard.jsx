import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';

// <KPICard label="Faturamento" value="R$ 8,24" sub="mes atual" tone="green" icon={<DollarIcon />} />

const TONE_COLORS = {
  green:  colors.green,
  red:    colors.red,
  orange: colors.orange,
  blue:   colors.blue,
  gold:   colors.gold,
  accent: colors.gold,
  yellow: colors.orange,
};

const TONE_BORDERS = {
  green:  colors.greenBorder,
  red:    colors.redBorder,
  orange: colors.orangeBorder,
  blue:   colors.blueBorder,
  gold:   colors.goldBorder,
  accent: colors.goldBorder,
  yellow: colors.orangeBorder,
};

export default function KPICard({ label, value, sub, tone, icon, onClick, style }) {
  const valueColor = tone ? (TONE_COLORS[tone] || colors.white) : colors.white;
  const borderColor = tone ? (TONE_BORDERS[tone] || colors.border) : colors.border;

  return (
    <article
      onClick={onClick}
      style={{
        padding: 14,
        borderRadius: radius.lg,
        background: colors.bgCard,
        border: `1px solid ${borderColor}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, transform 0.15s',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, color: colors.dim,
          textTransform: 'uppercase', letterSpacing: '0.8px',
          fontFamily: fonts.text,
        }}>
          {label}
        </span>
        {icon && <span style={{ color: colors.muted, opacity: 0.6 }}>{icon}</span>}
      </div>
      <strong style={{
        fontSize: 22, fontWeight: 800, fontFamily: fonts.numbers,
        color: valueColor, display: 'block', lineHeight: 1.2,
      }}>
        {value}
      </strong>
      {sub && (
        <small style={{ fontSize: 10, color: colors.dim, display: 'block', marginTop: 2 }}>
          {sub}
        </small>
      )}
    </article>
  );
}
