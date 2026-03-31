import React from 'react';
import { ADMIN_COLORS as C, ADMIN_FONTS as F } from './ui/adminTheme';

/**
 * AdminTopbar
 *
 * Props:
 * - title: string (título da página atual)
 * - onMenuClick: () => void (abre sidebar mobile)
 * - onRefresh: () => void (botão atualizar)
 * - currentTime: string (ex: '08:56')
 * - statusOk: boolean (mostra badge "Tudo OK" ou "Problema")
 */
export default function AdminTopbar({
  title = 'Admin',
  onMenuClick,
  onRefresh,
  currentTime = '',
  statusOk = true,
}) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      padding: '12px 20px',
      background: C.bgTopbar,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: F.body,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onMenuClick}
          style={{
            background: 'none', border: 'none',
            color: C.textSecondary, fontSize: 22,
            cursor: 'pointer', padding: 4, lineHeight: 1,
          }}
          aria-label="Menu"
        >☰</button>
        <span style={{
          fontWeight: 700, fontSize: 16, color: C.textPrimary,
        }}>{title}</span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Status badge */}
        <div style={{
          padding: '5px 14px', borderRadius: 20,
          background: statusOk ? C.successBg : C.dangerBg,
          border: `1px solid ${statusOk ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
          fontSize: 12, fontWeight: 600,
          color: statusOk ? C.success : C.danger,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 10 }}>{statusOk ? '✓' : '!'}</span>
          {statusOk ? 'Tudo OK' : 'Atenção'}
        </div>

        {/* Time */}
        {currentTime && (
          <span style={{
            fontFamily: F.mono, fontSize: 13, color: C.textMuted,
          }}>{currentTime}</span>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '6px 14px',
            color: C.textSecondary, fontSize: 12,
            cursor: 'pointer', fontWeight: 500,
            fontFamily: F.body,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = C.borderActive}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
        >
          ↻ Atualizar
        </button>
      </div>
    </header>
  );
}
