import React, { useState, useEffect, useCallback } from 'react';
import { colors, fonts } from '../theme';

export default function Toast({ message, visible, onHide }) {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (visible) {
      // Small delay so the enter animation triggers
      requestAnimationFrame(() => setShow(true));
      setLeaving(false);

      const timer = setTimeout(() => {
        setLeaving(true);
        setTimeout(() => {
          setShow(false);
          setLeaving(false);
          if (onHide) onHide();
        }, 300);
      }, 2200);

      return () => clearTimeout(timer);
    } else {
      setShow(false);
      setLeaving(false);
    }
  }, [visible, onHide]);

  if (!visible && !show) return null;

  return (
    <div
      className={`bf-toast ${show && !leaving ? 'bf-toast--enter' : ''} ${leaving ? 'bf-toast--exit' : ''}`}
      style={{
        position: 'fixed', top: 62, left: '50%',
        zIndex: 9999,
        pointerEvents: 'none',
        transform: 'translateX(-50%)',
      }}
    >
      <div style={{
        background: 'rgba(19,61,53,0.94)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '1px solid rgba(90,228,167,0.2)',
        borderRadius: 12,
        padding: '9px 18px',
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(90,228,167,0.08)',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(90,228,167,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: colors.white,
          fontFamily: fonts.text, whiteSpace: 'nowrap',
        }}>
          {message}
        </span>
      </div>
    </div>
  );
}
