// components/BottomNav.jsx — Navegação inferior
// Props: active ("home"|"produtos"|"pedidos"|"conta"), onNavigate(screen)

import { colors, fonts } from '../theme';
import Icon from './Icon';

const tabs = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'produtos', label: 'Produtos', icon: 'grid' },
  { id: 'pedidos', label: 'Pedidos', icon: 'clipboard' },
  { id: 'conta', label: 'Conta', icon: 'user' },
];

export default function BottomNav({ active = 'home', onNavigate }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0,
      left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'rgba(23,74,64,0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${colors.border}`,
      zIndex: 150,
      display: 'flex', justifyContent: 'space-around',
      padding: '4px 0 8px',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer', padding: '3px 14px',
              fontFamily: fonts.text,
            }}
          >
            <Icon
              name={tab.icon}
              size={18}
              color={isActive ? colors.gold : colors.textMuted}
              fill={isActive ? colors.gold : 'none'}
              strokeWidth={isActive ? 1.5 : 2}
            />
            <span style={{
              fontSize: 8, fontWeight: 700,
              color: isActive ? colors.gold : colors.textMuted,
            }}>
              {tab.label}
            </span>
            {isActive && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: colors.gold,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
