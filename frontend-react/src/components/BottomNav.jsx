import React from 'react';
import { colors, fonts } from '../theme';
import Icon from './Icon';

const tabs = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'produtos', label: 'Produtos', icon: 'grid' },
  { id: 'pedidos', label: 'Pedidos', icon: 'clipboard' },
  { id: 'conta', label: 'Conta', icon: 'user' },
];

export default React.memo(function BottomNav({ active = 'home', onNavigate }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0,
      left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'rgba(19,61,53,0.92)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      zIndex: 150,
      display: 'flex', justifyContent: 'space-around',
      padding: '6px 0 10px',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className="bf-nav-tab"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 16px',
              fontFamily: fonts.text,
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s cubic-bezier(.4,0,.2,1)',
            }}
          >
            {/* Active pill indicator */}
            <div style={{
              position: 'absolute', top: -6,
              width: isActive ? 20 : 0,
              height: 2.5,
              borderRadius: 2,
              background: colors.gold,
              transition: 'width 0.3s cubic-bezier(.4,0,.2,1), opacity 0.3s',
              opacity: isActive ? 1 : 0,
              boxShadow: isActive ? '0 0 8px rgba(226,184,74,0.4)' : 'none',
            }} />

            <div style={{
              transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
              transform: isActive ? 'translateY(-1px) scale(1.05)' : 'translateY(0) scale(1)',
            }}>
              <Icon
                name={tab.icon}
                size={19}
                color={isActive ? colors.gold : 'rgba(255,255,255,0.35)'}
                fill={isActive ? colors.gold : 'none'}
                strokeWidth={isActive ? 1.5 : 2}
              />
            </div>
            <span style={{
              fontSize: 8.5, fontWeight: isActive ? 800 : 600,
              color: isActive ? colors.gold : 'rgba(255,255,255,0.35)',
              transition: 'color 0.25s, font-weight 0.25s',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
