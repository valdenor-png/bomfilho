import React, { useEffect, useRef, useState } from 'react';
import { colors, fonts } from '../theme';
import Icon from './Icon';

export default React.memo(function Header({ cartCount = 0, onCartClick, scrolled = false }) {
  const [bounce, setBounce] = useState(false);
  const prevCount = useRef(cartCount);

  // Bounce the cart badge when count changes (not on mount)
  useEffect(() => {
    if (cartCount !== prevCount.current && cartCount > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 500);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  return (
    <header
      className="bf-header"
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0 16px',
        background: scrolled ? 'rgba(23,74,64,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
        transition: 'background 0.4s cubic-bezier(.4,0,.2,1), backdrop-filter 0.4s cubic-bezier(.4,0,.2,1), border-color 0.4s cubic-bezier(.4,0,.2,1)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 52,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <img
            src="/img/logo.svg"
            alt="BomFilho Supermercado"
            style={{ width: 140, height: 'auto' }}
          />
        </div>

        {/* Right side: location + cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Location pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9.5, fontFamily: fonts.text,
            background: 'rgba(255,255,255,0.06)', padding: '5px 10px',
            borderRadius: 8, border: `1px solid rgba(255,255,255,0.08)`,
            transition: 'background 0.2s',
          }}>
            <Icon name="pin" size={9} color={colors.gold} fill={colors.gold} strokeWidth={0} />
            <span style={{ fontWeight: 600, color: colors.white }}>Castanhal</span>
          </div>

          {/* Cart button */}
          <button
            onClick={onCartClick}
            className="bf-header-cart-btn"
            style={{
              position: 'relative',
              width: 36, height: 36, borderRadius: 10,
              background: cartCount > 0
                ? `linear-gradient(135deg, ${colors.gold} 0%, #C9A03A 100%)`
                : 'rgba(255,255,255,0.06)',
              border: cartCount > 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
              transform: bounce ? 'scale(1.15)' : 'scale(1)',
              boxShadow: cartCount > 0 ? '0 4px 16px rgba(226,184,74,0.3)' : 'none',
            }}
          >
            <Icon
              name="bag"
              size={15}
              color={cartCount > 0 ? colors.bgDeep : colors.textSecondary}
            />
            {cartCount > 0 && (
              <div
                style={{
                  position: 'absolute', top: -4, right: -4,
                  minWidth: 17, height: 17, borderRadius: 9,
                  background: colors.bgDeep, color: colors.gold,
                  fontSize: 8.5, fontWeight: 800,
                  fontFamily: fonts.number,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1.5px solid ${colors.gold}`,
                  padding: '0 3px',
                  animation: bounce ? 'bf-badge-pop 0.5s cubic-bezier(.36,1.56,.64,1)' : 'none',
                }}
              >
                {cartCount}
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
});
