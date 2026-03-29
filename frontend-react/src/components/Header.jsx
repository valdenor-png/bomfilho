import React from 'react';
// components/Header.jsx — Header do BomFilho
// Props: cartCount, onCartClick, scrolled
// O scrolled deve ser controlado pelo pai com useEffect no scroll

import { colors, fonts } from '../theme';
import Icon from './Icon';

export default function Header({ cartCount = 0, onCartClick, scrolled = false }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      padding: '0 16px',
      background: scrolled ? 'rgba(31,92,80,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? `1px solid ${colors.border}` : '1px solid transparent',
      transition: 'all 0.3s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 48,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: colors.gold,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(226,184,74,0.3)',
          }}>
            <Icon name="cart" size={14} color="#fff" />
          </div>
          <div>
            <div style={{
              fontWeight: 900, fontSize: 15,
              fontFamily: fonts.text, color: colors.white,
            }}>
              Bom<span style={{ color: colors.gold }}>Filho</span>
            </div>
            <div style={{
              fontSize: 7, color: colors.textMuted,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              supermercado
            </div>
          </div>
        </div>

        {/* Direita: localização + carrinho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Pill de localização */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontFamily: fonts.text,
            background: colors.card, padding: '4px 8px',
            borderRadius: 7, border: `1px solid ${colors.border}`,
          }}>
            <Icon name="pin" size={9} color={colors.gold} fill={colors.gold} strokeWidth={0} />
            <span style={{ fontWeight: 600, color: colors.white }}>Castanhal</span>
          </div>

          {/* Botão carrinho */}
          <button onClick={onCartClick} style={{
            position: 'relative',
            width: 32, height: 32, borderRadius: 8,
            background: cartCount > 0 ? colors.gold : colors.card,
            border: cartCount > 0 ? 'none' : `1px solid ${colors.border}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="bag" size={14} color={cartCount > 0 ? colors.bgDeep : colors.textSecondary} />
            {cartCount > 0 && (
              <div style={{
                position: 'absolute', top: -3, right: -3,
                width: 15, height: 15, borderRadius: '50%',
                background: colors.bgDeep, color: colors.gold,
                fontSize: 8, fontWeight: 800,
                fontFamily: fonts.number,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${colors.gold}`,
              }}>
                {cartCount}
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
