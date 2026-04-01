import React from 'react';
import { colors, fonts, radius, shadows } from '../../styles/tokens';

// <Btn>Atualizar</Btn>                     — secondary (default)
// <Btn primary>Salvar</Btn>                — teal gradient
// <Btn gold>Importar</Btn>                 — gold CTA
// <Btn danger>Cancelar</Btn>               — red outline
// <Btn icon={<RefreshCw size={14} />}>Refresh</Btn>

export default function Btn({ children, primary, gold, danger, icon, disabled, onClick, type, href, style, ...rest }) {
  const isPrimary = primary;
  const isGold = gold;
  const isDanger = danger;

  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8,
    fontSize: 12, fontWeight: isPrimary || isGold ? 700 : 600,
    fontFamily: fonts.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    border: 'none',
  };

  let variant;
  if (isGold) {
    variant = {
      background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDark})`,
      color: '#0A1F1A',
      boxShadow: shadows.gold,
    };
  } else if (isPrimary) {
    variant = {
      background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealLight})`,
      color: colors.white,
      boxShadow: shadows.teal,
    };
  } else if (isDanger) {
    variant = {
      background: colors.redBg,
      color: colors.red,
      border: `1px solid ${colors.redBorder}`,
    };
  } else {
    // Secondary
    variant = {
      background: colors.tealDim,
      color: colors.muted,
      border: `1px solid ${colors.border}`,
    };
  }

  const Tag = href ? 'a' : 'button';
  const extraProps = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { type: type || 'button', disabled };

  return (
    <Tag
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variant, ...style }}
      {...extraProps}
      {...rest}
    >
      {icon}{children}
    </Tag>
  );
}
