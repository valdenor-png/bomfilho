import React, { useState, useEffect } from 'react';
import { colors, fonts } from '../../theme';

const DISMISS_KEY = 'bomfilho_pwa_dismissed';

export default function InstallPWABanner() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setTimeout(() => setVisible(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!visible || !installPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12,
      maxWidth: 456, margin: '0 auto',
      zIndex: 1050,
      background: colors.bgDark || '#132E27',
      border: `1px solid ${colors.goldBorder}`,
      borderRadius: 16, padding: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'lgpdSlideUp 0.4s ease-out',
      fontFamily: fonts.text,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: colors.gold, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {'\u{1F4F2}'}
        </div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 13, color: colors.white, display: 'block' }}>
            Instale o BomFilho
          </strong>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            Acesse direto da tela do celular
          </span>
        </div>
        <button onClick={handleDismiss} style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.4)', fontSize: 16,
          cursor: 'pointer', padding: 4, flexShrink: 0,
        }}>x</button>
      </div>
      <button onClick={handleInstall} style={{
        width: '100%', marginTop: 12, padding: '10px 0',
        borderRadius: 12, background: colors.gold,
        border: 'none', color: colors.bgDeep,
        fontWeight: 800, fontSize: 13, cursor: 'pointer',
        fontFamily: fonts.text,
        boxShadow: '0 4px 12px rgba(226,184,74,0.3)',
      }}>
        Instalar agora
      </button>
    </div>
  );
}
