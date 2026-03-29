// theme.js — Cores, fontes e estilos compartilhados do BomFilho
// Importar em qualquer componente: import { colors, fonts, styles } from '../theme'

export const colors = {
  // Fundos
  bg: '#1F5C50',
  bgDark: '#174A40',
  bgDeep: '#133D35',

  // Cards (glassmorphism)
  card: 'rgba(255,255,255,0.06)',
  cardHover: 'rgba(255,255,255,0.10)',
  cardActive: 'rgba(255,255,255,0.14)',

  // Bordas
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(255,255,255,0.15)',

  // Dourado (destaque)
  gold: '#E2B84A',
  goldBg: 'rgba(226,184,74,0.12)',
  goldBorder: 'rgba(226,184,74,0.25)',

  // Texto
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.40)',

  // Semântico
  success: '#5AE4A7',
  successBg: 'rgba(90,228,167,0.10)',
  error: '#EF5350',
  errorBg: 'rgba(239,83,80,0.10)',
  errorBorder: 'rgba(239,83,80,0.20)',
  warn: '#FFB74D',
  warnBg: 'rgba(255,183,77,0.10)',
  warnBorder: 'rgba(255,183,77,0.25)',
  whatsapp: '#25D366',
};

export const fonts = {
  text: "'Plus Jakarta Sans', sans-serif",  // Texto e interface
  number: "'Sora', sans-serif",             // Números e preços
};

// Import no index.html ou App.jsx:
// <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">

// Estilos reutilizáveis
export const styles = {
  // Card glass padrão
  card: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    backdropFilter: 'blur(10px)',
  },

  // Card glass selecionado (dourado)
  cardSelected: {
    background: colors.goldBg,
    border: `1px solid ${colors.goldBorder}`,
    borderRadius: 14,
  },

  // Botão primário (dourado)
  btnPrimary: {
    background: colors.gold,
    color: colors.bgDeep,
    border: 'none',
    borderRadius: 12,
    fontWeight: 800,
    fontFamily: fonts.text,
    cursor: 'pointer',
    padding: '13px 16px',
    fontSize: 13,
    width: '100%',
  },

  // Botão secundário (glass)
  btnSecondary: {
    background: colors.card,
    color: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    fontWeight: 700,
    fontFamily: fonts.text,
    cursor: 'pointer',
    padding: '13px 16px',
    fontSize: 13,
  },

  // Preço (fonte Sora, dourado)
  price: {
    fontFamily: fonts.number,
    fontWeight: 800,
    color: colors.gold,
  },

  // Preço grande (total)
  priceTotal: {
    fontFamily: fonts.number,
    fontWeight: 900,
    fontSize: 20,
    color: colors.gold,
  },
};

// Formatar preço brasileiro
export function formatPrice(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Formatar nome do produto (CAIXA ALTA → Title Case)
export function formatProductName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\b(Kg|Ml|Lt|Un|Und|20l|500ml|350ml|200ml|1l|5kg|800g|900ml)\b/gi, m => m.toUpperCase())
    .replace(/\bRefrig\b/gi, 'Refrigerante')
    .replace(/\bAntart\b/gi, 'Antarctica')
    .replace(/\bMin\b/gi, 'Mineral')
    .replace(/\bGarraf\b/gi, 'Garrafão')
    .replace(/\bAbs\b/gi, 'Absorvente')
    .replace(/\bC\/ab\b/gi, 'Com Abas')
    .replace(/\bBco\b/gi, 'Branco')
    .replace(/\bTp1\b/gi, 'Tipo 1');
}
