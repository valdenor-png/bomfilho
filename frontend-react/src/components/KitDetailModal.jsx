import React from 'react';
import { colors, fonts, formatPrice } from '../theme';
import { formatProductName } from '../theme';

export default function KitDetailModal({ kit, onClose, onAddKit }) {
  if (!kit) return null;

  const savings = kit.originalPrice - kit.price;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#163D35', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 28px', width: '100%', maxWidth: 480,
        animation: 'slideUp 0.3s ease-out', maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 10, color: colors.gold, fontWeight: 700, margin: '0 0 4px', fontFamily: fonts.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🎁 Kit Pronto
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: colors.white, margin: 0, fontFamily: fonts.text }}>
              {kit.name}
            </h2>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: '4px 0 0', fontFamily: fonts.text }}>
              {kit.description}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.08)', border: `1px solid ${colors.border}`,
            color: colors.textMuted, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Badge economia */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16,
        }}>
          <span style={{
            padding: '5px 10px', borderRadius: 8,
            background: 'rgba(239,83,80,0.12)', border: '1px solid rgba(239,83,80,0.25)',
            color: '#EF5350', fontSize: 11, fontWeight: 800, fontFamily: fonts.number,
          }}>
            Economize {formatPrice(savings)}
          </span>
          <span style={{
            padding: '5px 10px', borderRadius: 8,
            background: 'rgba(226,184,74,0.12)', border: '1px solid rgba(226,184,74,0.25)',
            color: colors.gold, fontSize: 11, fontWeight: 700, fontFamily: fonts.number,
          }}>
            {kit.items.length} itens
          </span>
        </div>

        {/* Lista de itens */}
        <p style={{ fontSize: 12, fontWeight: 700, color: colors.white, margin: '0 0 8px', fontFamily: fonts.text }}>
          Itens do kit:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {kit.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`,
              borderRadius: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>📦</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 600, color: colors.white, margin: 0,
                  fontFamily: fonts.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {formatProductName(item.name)}
                </p>
                <p style={{ fontSize: 10, color: colors.textMuted, margin: '1px 0 0', fontFamily: fonts.text }}>
                  Qtd: {item.qty}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Preço */}
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.border}`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: 10, color: colors.textMuted, margin: 0, fontFamily: fonts.text }}>Preço original</p>
            <span style={{
              fontSize: 13, color: colors.textMuted, textDecoration: 'line-through', fontFamily: fonts.number,
            }}>{formatPrice(kit.originalPrice)}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: colors.gold, margin: 0, fontWeight: 600, fontFamily: fonts.text }}>Preço do kit</p>
            <span style={{
              fontSize: 22, fontWeight: 900, color: colors.gold, fontFamily: fonts.number,
            }}>{formatPrice(kit.price)}</span>
          </div>
        </div>

        {/* Botão adicionar tudo */}
        <button onClick={() => { onAddKit(kit); onClose(); }} style={{
          width: '100%', padding: 14, borderRadius: 14, border: 'none',
          background: colors.gold, color: '#0D2B24',
          fontFamily: fonts.text, fontSize: 15, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(226,184,74,0.25)',
        }}>
          Adicionar kit ao carrinho
        </button>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
