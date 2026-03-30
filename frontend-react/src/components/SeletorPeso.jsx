import React, { useState } from 'react';
import { colors, fonts, formatPrice } from '../theme';
import { formatPeso } from '../lib/pesoUtils';

const atalhos = [0.25, 0.5, 1, 2];

export default function SeletorPeso({ product, onConfirm, onClose }) {
  const [pesoKg, setPesoKg] = useState(0.5);
  const preco = Number(product?.price || product?.preco || 0);
  const subtotal = pesoKg * preco;
  const incremento = 0.1;
  const minimo = 0.1;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#163D35', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 32px', width: '100%', maxWidth: 480,
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>⚖️</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
            Quanto você quer?
          </h3>
          <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 4px', fontFamily: fonts.text }}>
            {product?.name || product?.nome}
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.gold, margin: 0, fontFamily: fonts.number }}>
            {formatPrice(preco)}/kg
          </p>
        </div>

        {/* Atalhos rápidos */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {atalhos.map(p => (
            <button key={p} onClick={() => setPesoKg(p)} style={{
              padding: '8px 16px', borderRadius: 10,
              border: pesoKg === p ? 'none' : `1.5px solid rgba(226,184,74,0.25)`,
              background: pesoKg === p ? colors.gold : 'rgba(226,184,74,0.08)',
              color: pesoKg === p ? '#0D2B24' : 'rgba(255,255,255,0.7)',
              fontFamily: fonts.number, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {formatPeso(p)}
            </button>
          ))}
        </div>

        {/* Controle fino */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
          <button onClick={() => setPesoKg(prev => Math.max(minimo, +(prev - incremento).toFixed(2)))}
            disabled={pesoKg <= minimo} style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            background: colors.gold, color: '#0D2B24',
            fontSize: 20, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: pesoKg <= minimo ? 0.3 : 1,
          }}>−</button>

          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <span style={{ fontFamily: fonts.number, fontSize: 32, fontWeight: 700, color: colors.white, display: 'block', lineHeight: 1 }}>
              {pesoKg >= 1 ? pesoKg.toFixed(1) : (pesoKg * 1000).toFixed(0)}
            </span>
            <span style={{ fontFamily: fonts.text, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {pesoKg >= 1 ? 'kg' : 'g'}
            </span>
          </div>

          <button onClick={() => setPesoKg(prev => +(prev + incremento).toFixed(2))} style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            background: colors.gold, color: '#0D2B24',
            fontSize: 20, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
        </div>

        {/* Subtotal */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: fonts.text }}>Subtotal:</span>
          <span style={{ fontFamily: fonts.number, fontSize: 18, fontWeight: 700, color: colors.gold }}>
            {formatPrice(subtotal)}
          </span>
        </div>

        {/* Aviso */}
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '0 0 16px', fontFamily: fonts.text }}>
          ℹ️ O peso final pode variar levemente. Cobraremos o valor exato após pesagem.
        </p>

        {/* Confirmar */}
        <button onClick={() => onConfirm(pesoKg)} style={{
          width: '100%', padding: 14, borderRadius: 14, border: 'none',
          background: colors.gold, color: '#0D2B24',
          fontFamily: fonts.text, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Adicionar {formatPeso(pesoKg)}
        </button>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
