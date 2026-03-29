import React from 'react';
// components/Icon.jsx — Ícones SVG do BomFilho
// Uso: <Icon name="cart" size={18} color="#E2B84A" />
// Uso com fill: <Icon name="flame" size={14} color="#E2B84A" fill="#E2B84A" />

import { colors } from '../theme';

// Todos os paths SVG usados no site
const paths = {
  // Navegação
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 18l6-6-6-6',
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',

  // Ações
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  search: 'M21 21l-4.35-4.35M11 3a8 8 0 100 16 8 8 0 000-16z',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z',

  // Comércio
  bag: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  cart: 'M9 21a1 1 0 100-2 1 1 0 000 2zM20 21a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6',
  package: 'M16.5 9.4l-9-5.19M21 16V8l-8-4.58a2 2 0 00-2 0L3 8v8l8 4.58a2 2 0 002 0L21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',

  // Categorias
  wine: 'M8 22h8M12 18v4M12 18a7 7 0 007-7c0-2-1-3-1-5H6c0 2-1 3-1 5a7 7 0 007 7z',
  leaf: 'M11 20A7 7 0 019.8 6.9C15.5 4.9 20 2 20 2s-1.2 6.4-1.2 10.5A7 7 0 0111 20z',
  basket: 'M5.5 21h13l1-7H4.5l1 7zM6 14l3-8M18 14l-3-8M2 14h20',
  drop: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z',
  sparkle: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z',
  snowflake: 'M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07',

  // Locais e entrega
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z',
  store: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',

  // UI
  flame: 'M12 22c4.97 0 8-3.03 8-8 0-2.5-1.5-5-3-6.5-.5-.5-1 0-1 .5 0 1.5-.5 3-2 4-2.5-3-4-5-4-9 0-.5-.5-1-1-.5C5.5 5 4 8.5 4 14c0 4.97 3.03 8 8 8z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  alert: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  loader: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4',

  // Contato
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
  message: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',

  // Pagamento
  creditCard: 'M1 4h22v16H1zM1 10h22',
  ticket: 'M2 9a3 3 0 010-6h20a3 3 0 010 6M2 15a3 3 0 000 6h20a3 3 0 000-6M13 3v18',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4M12 8h.01',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  chart: 'M18 20V10M12 20V4M6 20v-6',
};

// Mapeamento categoria → ícone
export const categoryIcons = {
  bebidas: 'wine',
  mercearia: 'basket',
  hortifruti: 'leaf',
  higiene: 'drop',
  limpeza: 'sparkle',
  frios: 'snowflake',
};

export default function Icon({ name, size = 18, color = colors.textSecondary, fill = 'none', strokeWidth = 2 }) {
  const d = paths[name];
  if (!d) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

// Placeholder de produto por categoria
export function ProductPlaceholder({ category, size = 36 }) {
  const iconName = categoryIcons[category] || 'package';
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.03)',
    }}>
      <Icon name={iconName} size={size} color="rgba(255,255,255,0.14)" strokeWidth={1.5} />
    </div>
  );
}
