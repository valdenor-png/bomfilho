import React, { useState, useEffect } from 'react';
import { colors, fonts } from '../../theme';

const CONSENT_KEY = 'bomfilho_lgpd_consent';

export default function LGPDBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      accepted: true,
      date: new Date().toISOString(),
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12,
      maxWidth: 456,
      margin: '0 auto',
      zIndex: 1100,
      background: colors.bgDark || '#132E27',
      border: `1px solid ${colors.border}`,
      borderRadius: 16,
      padding: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'lgpdSlideUp 0.4s ease-out',
      fontFamily: fonts.text,
    }}>
      <p style={{
        margin: '0 0 12px',
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 1.45,
      }}>
        Usamos dados armazenados no seu navegador para manter seu carrinho,
        preferencias e historico de compras. Ao continuar navegando, voce
        concorda com nossa{' '}
        <a
          href="/politica-de-privacidade"
          style={{ color: colors.gold, textDecoration: 'underline' }}
        >
          Politica de Privacidade
        </a>.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleAccept}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 10,
            background: colors.gold,
            border: 'none',
            color: colors.bgDeep,
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: fonts.text,
          }}
        >
          Aceitar e continuar
        </button>
        <a
          href="/politica-de-privacidade"
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${colors.border}`,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            fontFamily: fonts.text,
          }}
        >
          Saiba mais
        </a>
      </div>

      <style>{`
        @keyframes lgpdSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
