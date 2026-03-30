/* ============================================================
   BOMFILHO ADMIN — Theme Constants (JS)
   Usar quando precisar das cores em inline styles ou lógica JS.
   Para CSS puro, use as variáveis de admin-theme.css.
   ============================================================ */

export const ADMIN_COLORS = {
  bg:            '#0B1F1A',
  bgCard:        '#132E27',
  bgCardHover:   '#1A3D33',
  bgSidebar:     '#091A15',
  bgTopbar:      'rgba(11, 31, 26, 0.85)',
  bgInput:       '#0E2420',

  teal:          '#1F5C50',
  tealLight:     '#2A7A6A',
  gold:          '#E2B84A',
  goldDim:       '#C9A23E',

  textPrimary:   '#F0F0F0',
  textSecondary: '#8BADA3',
  textMuted:     '#5A8A7D',

  border:        'rgba(255, 255, 255, 0.06)',
  borderActive:  'rgba(226, 184, 74, 0.3)',
  borderInput:   'rgba(255, 255, 255, 0.1)',
  borderInputFocus: 'rgba(226, 184, 74, 0.5)',

  success:       '#34D399',
  successBg:     'rgba(52, 211, 153, 0.12)',
  successBorder: 'rgba(52, 211, 153, 0.2)',

  warning:       '#FBBF24',
  warningBg:     'rgba(251, 191, 36, 0.12)',
  warningBorder: 'rgba(251, 191, 36, 0.2)',

  danger:        '#F87171',
  dangerBg:      'rgba(248, 113, 113, 0.12)',
  dangerBorder:  'rgba(248, 113, 113, 0.2)',

  white:         '#FFFFFF',
};

export const ADMIN_FONTS = {
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'Sora', system-ui, sans-serif",
};

// Mapeia status de pedido → tipo visual
export const STATUS_MAP = {
  'aguardando confirmacao': 'warning',
  'aguardando pagamento':   'warning',
  'aguardando separacao':   'warning',
  'separando':              'info',
  'preparado':              'success',
  'concluido':              'success',
  'pago':                   'success',
  'cancelado':              'danger',
  'retirada':               'neutral',
};

export function getStatusType(status) {
  const key = (status || '').toLowerCase().trim();
  return STATUS_MAP[key] || 'neutral';
}
