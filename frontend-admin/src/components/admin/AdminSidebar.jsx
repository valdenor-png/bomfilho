import React, { useState } from 'react';
import { ADMIN_COLORS as C, ADMIN_FONTS as F } from './ui/adminTheme';

/* ============================================================
   Sidebar items config — ajuste os paths e labels conforme
   suas rotas reais do React Router.
   ============================================================ */
const NAV_SECTIONS = [
  {
    title: 'VISÃO GERAL',
    items: [
      { icon: '📊', label: 'Central de Comando', key: 'comando',  path: '/admin' },
      { icon: '⚡', label: 'Operação ao Vivo',   key: 'operacao', path: '/admin/operacao' },
    ],
  },
  {
    title: 'GESTÃO',
    items: [
      { icon: '📋', label: 'Histórico de Pedidos', key: 'historico',  path: '/admin/pedidos' },
      { icon: '📦', label: 'Catálogo',              key: 'catalogo',   path: '/admin/catalogo' },
      { icon: '👥', label: 'Clientes',              key: 'clientes',   path: '/admin/clientes' },
      { icon: '📥', label: 'Importação',            key: 'importacao', path: '/admin/importacao' },
    ],
  },
  {
    title: 'FINANCEIRO',
    items: [
      { icon: '💰', label: 'Financeiro',  key: 'financeiro',      path: '/admin/financeiro' },
      { icon: '📈', label: 'Financeiro+', key: 'financeiro_plus', path: '/admin/financeiro-avancado' },
    ],
  },
  {
    title: 'INTELIGÊNCIA',
    items: [
      { icon: '🚚', label: 'Uber Direct',        key: 'uber',  path: '/admin/uber' },
      { icon: '🔍', label: 'Saúde do Catálogo',  key: 'saude', path: '/admin/saude-catalogo' },
    ],
  },
];

/* ---- Subcomponents ---- */

function SidebarItem({ icon, label, active, onClick, badge, onHover, onLeave }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontFamily: F.body,
        color: active ? C.gold : C.textSecondary,
        background: active ? 'rgba(226,184,74,0.08)' : 'transparent',
        borderLeft: active ? `3px solid ${C.gold}` : '3px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          background: C.danger, color: '#fff', fontSize: 10,
          fontWeight: 700, padding: '2px 7px', borderRadius: 10,
          fontFamily: F.mono,
        }}>{badge}</span>
      )}
    </div>
  );
}

function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.textMuted,
        letterSpacing: 1.5, textTransform: 'uppercase',
        padding: '14px 16px 6px', fontFamily: F.mono,
      }}>{title}</div>
      {children}
    </div>
  );
}

/* ---- Main Component ---- */

/**
 * AdminSidebar
 *
 * Props:
 * - isOpen: boolean (controla visibilidade no mobile)
 * - onClose: () => void (fecha sidebar no mobile)
 * - activeKey: string (key do item ativo, ex: 'comando')
 * - onNavigate: (path, key) => void (callback de navegação)
 * - badges: { [key]: string } (badges de notificação, ex: { operacao: '1' })
 * - userName: string (nome do usuário logado)
 * - currentTime: string (horário atual, ex: '08:56')
 */
export default function AdminSidebar({
  isOpen = false,
  onClose,
  activeKey = 'comando',
  onNavigate,
  badges = {},
  userName = 'Admin',
  currentTime = '',
}) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const handleNav = (path, key) => {
    if (onNavigate) onNavigate(path, key);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: C.bgSidebar,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
        position: 'fixed',
        top: 0,
        left: isOpen ? 0 : -260,
        zIndex: 50,
        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 18px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.teal}, ${C.tealLight})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: C.gold,
            fontFamily: F.mono,
            boxShadow: '0 4px 12px rgba(31,92,80,0.4)',
          }}>B</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>BomFilho</div>
            <div style={{
              fontSize: 9, fontWeight: 700, color: C.gold,
              letterSpacing: 2, textTransform: 'uppercase',
              fontFamily: F.mono,
            }}>ADMIN</div>
          </div>
        </div>

        {/* Status */}
        <div style={{
          margin: '14px 16px 6px', padding: '8px 12px', borderRadius: 8,
          background: C.successBg,
          border: `1px solid ${C.successBorder}`,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: C.success,
            animation: 'adminPulse 2s infinite',
          }} />
          <span style={{ color: C.success, fontWeight: 600 }}>Operação normal</span>
          {currentTime && (
            <span style={{
              marginLeft: 'auto', color: C.textMuted,
              fontFamily: F.mono, fontSize: 11,
            }}>{currentTime}</span>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '6px 8px' }}>
          {NAV_SECTIONS.map((section) => (
            <SidebarSection key={section.title} title={section.title}>
              {section.items.map((item) => (
                <SidebarItem
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  active={activeKey === item.key}
                  badge={badges[item.key]}
                  onClick={() => handleNav(item.path, item.key)}
                  onHover={() => setHoveredKey(item.key)}
                  onLeave={() => setHoveredKey(null)}
                />
              ))}
            </SidebarSection>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '14px 18px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: C.teal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: C.gold,
          }}>
            {(userName || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>
              {userName}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Admin</div>
          </div>
          <span style={{ fontSize: 14, cursor: 'pointer', color: C.textMuted }}>⚙️</span>
        </div>
      </aside>
    </>
  );
}
