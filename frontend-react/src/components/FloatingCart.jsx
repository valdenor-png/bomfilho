import React from 'react';
// components/FloatingCart.jsx — Barra flutuante dourada do carrinho
// Props: itemCount, total, onClick

import { colors, fonts, formatPrice } from '../theme';
import Icon from './Icon';

export default function FloatingCart({ itemCount = 0, total = 0, onClick }) {
  if (itemCount === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 52, left: 0, right: 0,
      zIndex: 200, padding: '0 14px',
      pointerEvents: 'none',
    }}>
      <div
        onClick={onClick}
        style={{
          maxWidth: 480, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: colors.gold,
          borderRadius: 13, padding: '10px 14px',
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(226,184,74,0.3)',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="bag" size={12} color={colors.bgDeep} />
          </div>
          <div>
            <p style={{
              fontWeight: 800, fontSize: 12,
              color: colors.bgDeep, margin: 0,
              fontFamily: fonts.text,
            }}>
              Ver carrinho
            </p>
            <p style={{
              fontSize: 9, color: colors.bgDeep, opacity: 0.7,
              margin: 0, fontFamily: fonts.number,
            }}>
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </div>

        <span style={{
          fontWeight: 900, fontSize: 14,
          color: colors.bgDeep, fontFamily: fonts.number,
        }}>
          {formatPrice(total)}
        </span>
      </div>
    </div>
  );
}
