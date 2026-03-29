import React from 'react';
import { useState, useEffect } from 'react';
import { colors, fonts } from '../theme';

export default function Toast({ message, visible, onHide }) {
  useEffect(() => {
    if (visible && onHide) {
      const timer = setTimeout(onHide, 2000);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 66, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, animation: 'toastIn 0.3s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(23,74,64,0.95)', backdropFilter: 'blur(12px)',
        border: `1px solid ${colors.border}`, borderRadius: 10,
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.white, fontFamily: fonts.text, whiteSpace: 'nowrap' }}>
          {message}
        </span>
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
