// Design System Tokens — BomFilho Admin v4
// Import: import { colors, fonts, radius, shadows, statusColors } from '../styles/tokens';

export const colors = {
  bg:         '#0A1F1A',
  bgCard:     '#122B24',
  bgHover:    '#163530',
  bgDeep:     '#091A15',

  border:     'rgba(31,92,80,0.4)',
  borderDim:  'rgba(31,92,80,0.15)',
  borderLight:'rgba(31,92,80,0.25)',

  teal:       '#1F5C50',
  tealLight:  '#2A7A6A',
  tealDim:    'rgba(31,92,80,0.15)',

  gold:       '#E2B84A',
  goldDark:   '#C9A040',
  goldDim:    'rgba(226,184,74,0.15)',
  goldBorder: 'rgba(226,184,74,0.2)',

  white:      '#FFFFFF',
  muted:      '#8BA8A0',
  dim:        '#5C7E74',

  red:        '#E25C5C',
  redBg:      'rgba(226,92,92,0.12)',
  redBorder:  'rgba(226,92,92,0.2)',

  green:      '#4AE28A',
  greenBg:    'rgba(74,226,138,0.12)',
  greenBorder:'rgba(74,226,138,0.2)',

  orange:     '#E2A04A',
  orangeBg:   'rgba(226,160,74,0.12)',
  orangeBorder:'rgba(226,160,74,0.2)',

  blue:       '#4A8AE2',
  blueBg:     'rgba(74,138,226,0.12)',
  blueBorder: 'rgba(74,138,226,0.2)',

  purple:     '#A07AE2',
  purpleBg:   'rgba(160,122,226,0.12)',
  purpleBorder:'rgba(160,122,226,0.2)',

  whatsapp:   '#25D366',
};

export const fonts = {
  text:    "'Plus Jakarta Sans', sans-serif",
  numbers: "'Sora', sans-serif",
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const shadows = {
  card:    '0 1px 3px rgba(0,0,0,0.3)',
  cardLg:  '0 4px 20px rgba(0,0,0,0.4)',
  teal:    '0 2px 8px rgba(31,92,80,0.3)',
  gold:    '0 2px 8px rgba(226,184,74,0.25)',
  glow: (color, alpha = 0.4) => `0 0 8px rgba(${color},${alpha})`,
};

// Status → color mapping
export const statusColors = {
  pendente:             { color: colors.orange, bg: colors.orangeBg, border: colors.orangeBorder, label: 'Pendente' },
  aguardando_revisao:   { color: colors.orange, bg: colors.orangeBg, border: colors.orangeBorder, label: 'Em Revisão' },
  pago:                 { color: colors.blue,   bg: colors.blueBg,   border: colors.blueBorder,   label: 'Pago' },
  preparando:           { color: colors.purple, bg: colors.purpleBg, border: colors.purpleBorder, label: 'Separando' },
  pronto_para_retirada: { color: colors.green,  bg: colors.greenBg,  border: colors.greenBorder,  label: 'Preparado' },
  enviado:              { color: colors.orange, bg: colors.orangeBg, border: colors.orangeBorder, label: 'Em Entrega' },
  entregue:             { color: colors.green,  bg: colors.greenBg,  border: colors.greenBorder,  label: 'Entregue' },
  retirado:             { color: colors.green,  bg: colors.greenBg,  border: colors.greenBorder,  label: 'Retirado' },
  cancelado:            { color: colors.red,    bg: colors.redBg,    border: colors.redBorder,    label: 'Cancelado' },
  pagamento_recusado:   { color: colors.red,    bg: colors.redBg,    border: colors.redBorder,    label: 'Pag. Recusado' },
};

export function getStatusStyle(status) {
  return statusColors[String(status || '').toLowerCase()] || { color: colors.muted, bg: 'rgba(255,255,255,0.06)', border: colors.border, label: status || '—' };
}
