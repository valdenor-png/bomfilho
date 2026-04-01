import React from 'react';
import { colors, fonts, radius, getStatusStyle } from '../../styles/tokens';

// Badge for status, categories, labels
// <Badge status="cancelado" />
// <Badge color="#E25C5C" bg="rgba(226,92,92,0.3)" label="Urgente" />
// <Badge tone="green" label="Ativo" />

const TONES = {
  green:  { color: colors.green,  bg: colors.greenBg,  border: colors.greenBorder },
  red:    { color: colors.red,    bg: colors.redBg,    border: colors.redBorder },
  orange: { color: colors.orange, bg: colors.orangeBg, border: colors.orangeBorder },
  blue:   { color: colors.blue,   bg: colors.blueBg,   border: colors.blueBorder },
  purple: { color: colors.purple, bg: colors.purpleBg, border: colors.purpleBorder },
  gold:   { color: colors.gold,   bg: colors.goldDim,  border: colors.goldBorder },
  muted:  { color: colors.muted,  bg: 'rgba(255,255,255,0.06)', border: colors.border },
};

export default function Badge({ status, tone, color, bg, border, label, children, style }) {
  let c, b, bd, text;

  if (status) {
    const s = getStatusStyle(status);
    c = s.color; b = s.bg; bd = s.border; text = label || s.label;
  } else if (tone && TONES[tone]) {
    c = TONES[tone].color; b = TONES[tone].bg; bd = TONES[tone].border; text = label || children;
  } else {
    c = color || colors.muted;
    b = bg || 'rgba(255,255,255,0.06)';
    bd = border || colors.border;
    text = label || children;
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: radius.sm,
      fontSize: 11, fontWeight: 700, fontFamily: fonts.text,
      color: c, background: b, border: `1px solid ${bd}`,
      whiteSpace: 'nowrap', lineHeight: 1.4,
      ...style,
    }}>
      {text}
    </span>
  );
}
