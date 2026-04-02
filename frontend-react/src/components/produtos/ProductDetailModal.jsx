import React, { useState, useMemo } from 'react';
import { colors, fonts, formatPrice } from '../../theme';
import { getSaleType, formatDisplayName, formatPriceUnit } from '../../lib/productUtils';
import Icon from '../Icon';

const CAT_EMOJI = {
  'bebidas': '\u{1F964}', 'mercearia': '\u{1F6D2}', 'hortifruti': '\u{1F96C}',
  'frios': '\u{1F9CA}', 'higiene': '\u{1F9F4}', 'limpeza': '\u{1F9F9}',
};

const WEIGHT_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3];

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState(0.5);
  const [adding, setAdding] = useState(false);
  const [imgError, setImgError] = useState(false);

  const saleType = useMemo(() => product ? getSaleType(product) : 'unidade', [product]);
  const displayName = useMemo(() => formatDisplayName(product?.name || product?.nome), [product]);
  const price = product?.price || product?.preco || 0;
  const total = saleType === 'peso' ? price * weight : price * quantity;
  const cat = product?.category || product?.categoria || '';
  const emoji = CAT_EMOJI[cat.toLowerCase()] || '\u{1F4E6}';
  const img = product?.image_url || product?.imagem || '';

  if (!isOpen || !product) return null;

  const handleAdd = () => {
    setAdding(true);
    if (saleType === 'peso') {
      onAddToCart({ id: product.id, weight, total });
    } else {
      for (let i = 0; i < quantity; i++) onAddToCart({ id: product.id });
    }
    setTimeout(() => { setAdding(false); setQuantity(1); setWeight(0.5); onClose(); }, 400);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, maxHeight: '90vh',
        background: '#174A40', borderRadius: '24px 24px 0 0',
        border: `1px solid rgba(255,255,255,0.08)`,
        overflowY: 'auto', paddingBottom: 90, position: 'relative',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', position: 'sticky', top: 0, zIndex: 2, background: '#174A40' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Imagem */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          {img && !imgError ? (
            <>
              <img src={img} alt={displayName} loading="lazy" onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }} />
              <span style={{
                position: 'absolute', bottom: 12, right: 12, padding: '4px 10px', borderRadius: 12,
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: fonts.text,
              }}>
                Foto ilustrativa. Preco valido somente no app.
              </span>
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 56, opacity: 0.6 }}>{emoji}</span>
            </div>
          )}
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12, width: 36, height: 36,
            borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="close" size={16} color="#fff" />
          </button>
          <span style={{
            position: 'absolute', bottom: 12, left: 12, padding: '5px 12px', borderRadius: 20,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: fonts.text,
          }}>
            {emoji} {cat}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 16px 16px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.3, fontFamily: fonts.text }}>
            {displayName}
          </h2>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontFamily: fonts.number, fontWeight: 900, fontSize: 22, color: colors.gold }}>
              {formatPriceUnit(product)}
            </span>
            {saleType === 'peso' && (
              <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: fonts.text }}>
                Preco por kg - Ajuste o peso abaixo
              </span>
            )}
          </div>

          {saleType === 'peso' ? (
            /* PESO selector */
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fonts.text }}>
                Quanto voce quer?
              </label>

              {/* Presets */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {WEIGHT_PRESETS.map(w => (
                  <button key={w} onClick={() => setWeight(w)} style={{
                    padding: '8px 14px', borderRadius: 10,
                    background: weight === w ? 'rgba(226,184,74,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${weight === w ? 'rgba(226,184,74,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: weight === w ? colors.gold : 'rgba(255,255,255,0.7)',
                    fontFamily: fonts.number, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>
                    {w < 1 ? `${(w * 1000).toFixed(0)}g` : `${w}kg`}
                  </button>
                ))}
              </div>

              {/* Slider row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <button onClick={() => setWeight(Math.max(0.1, +(weight - 0.1).toFixed(1)))} style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)', border: `1px solid rgba(255,255,255,0.1)`,
                  color: colors.gold, fontSize: 18, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{'\u2212'}</button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <input type="range" min="0.1" max="5" step="0.1" value={weight}
                    onChange={e => setWeight(+e.target.value)}
                    style={{ width: '100%', accentColor: colors.gold }}
                  />
                  <div style={{ fontFamily: fonts.number, fontWeight: 900, fontSize: 22, color: '#fff', marginTop: 4 }}>
                    {weight < 1 ? `${(weight * 1000).toFixed(0)}g` : `${weight.toFixed(1).replace('.', ',')}kg`}
                  </div>
                </div>
                <button onClick={() => setWeight(Math.min(5, +(weight + 0.1).toFixed(1)))} style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)', border: `1px solid rgba(255,255,255,0.1)`,
                  color: colors.gold, fontSize: 18, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>+</button>
              </div>

              {/* Nota */}
              <p style={{
                margin: '10px 0 0', padding: '8px 12px', borderRadius: 10,
                background: 'rgba(226,184,74,0.08)', border: `1px solid rgba(226,184,74,0.15)`,
                fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, fontFamily: fonts.text,
              }}>
                O peso final pode variar levemente. Sera ajustado na separacao.
              </p>
            </div>
          ) : (
            /* QUANTITY selector */
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fonts.text }}>
                Quantidade
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', width: 'fit-content',
                background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 14, overflow: 'hidden',
              }}>
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}
                  style={{
                    width: 52, height: 48, background: 'none', border: 'none',
                    color: colors.gold, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', opacity: quantity <= 1 ? 0.3 : 1,
                  }}>
                  <Icon name="minus" size={16} color={colors.gold} />
                </button>
                <span style={{
                  minWidth: 52, textAlign: 'center',
                  fontFamily: fonts.number, fontWeight: 800, fontSize: 18, color: '#fff',
                }}>{quantity}</span>
                <button onClick={() => setQuantity(Math.min(50, quantity + 1))}
                  style={{
                    width: 52, height: 48, background: 'none', border: 'none',
                    color: colors.gold, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Icon name="plus" size={16} color={colors.gold} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer fixo */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
          zIndex: 210, display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(23,74,64,0.95)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ minWidth: 80 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontFamily: fonts.text }}>Total</span>
            <span style={{ display: 'block', fontFamily: fonts.number, fontWeight: 900, fontSize: 17, color: colors.gold }}>
              {formatPrice(total)}
            </span>
          </div>
          <button onClick={handleAdd} disabled={adding} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: 14, borderRadius: 14,
            background: adding ? '#5AE4A7' : colors.gold,
            border: 'none', color: '#174A40', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', fontFamily: fonts.text,
            boxShadow: '0 4px 16px rgba(226,184,74,0.35)',
          }}>
            {adding ? 'Adicionado!' : 'Adicionar ao carrinho'}
          </button>
        </div>
      </div>
    </div>
  );
}
