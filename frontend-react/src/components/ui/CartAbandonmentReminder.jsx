import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { colors, fonts } from '../../theme';

const LAST_CART_KEY = 'bomfilho_cart_last_active';
const REMINDER_DISMISSED_KEY = 'bomfilho_cart_reminder_dismissed';
const REMINDER_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutos

export default function CartAbandonmentReminder() {
  const { itens } = useCart();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!itens || itens.length === 0) return;

    // Atualizar timestamp do carrinho
    const lastActive = localStorage.getItem(LAST_CART_KEY);
    const dismissed = localStorage.getItem(REMINDER_DISMISSED_KEY);
    const now = Date.now();

    if (!lastActive) {
      localStorage.setItem(LAST_CART_KEY, String(now));
      return;
    }

    const elapsed = now - Number(lastActive);
    if (elapsed > REMINDER_THRESHOLD_MS && dismissed !== 'true') {
      setVisible(true);
    }

    localStorage.setItem(LAST_CART_KEY, String(now));
  }, [itens]);

  const handleGo = () => {
    setVisible(false);
    localStorage.setItem(REMINDER_DISMISSED_KEY, 'true');
    navigate('/pagamento');
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(REMINDER_DISMISSED_KEY, 'true');
  };

  // Reset dismissed flag when cart is emptied
  useEffect(() => {
    if (!itens || itens.length === 0) {
      localStorage.removeItem(REMINDER_DISMISSED_KEY);
      localStorage.removeItem(LAST_CART_KEY);
    }
  }, [itens]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12, maxWidth: 456, margin: '0 auto', zIndex: 1050,
      background: colors.bgDark || '#132E27', border: `1px solid ${colors.goldBorder}`,
      borderRadius: 16, padding: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'lgpdSlideUp 0.4s ease-out', fontFamily: fonts.text,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{'\u{1F6D2}'}</span>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 13, color: colors.white, display: 'block' }}>
            Voce tem {itens.length} {itens.length === 1 ? 'item' : 'itens'} no carrinho!
          </strong>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            Finalize sua compra antes que acabe
          </span>
        </div>
        <button onClick={handleDismiss} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontSize: 14, cursor: 'pointer', padding: 4, flexShrink: 0,
        }}>x</button>
      </div>
      <button onClick={handleGo} style={{
        width: '100%', padding: 11, borderRadius: 12,
        background: colors.gold, border: 'none', color: colors.bgDeep,
        fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
      }}>
        Finalizar compra
      </button>
    </div>
  );
}
