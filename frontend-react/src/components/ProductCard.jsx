import React from 'react';
// components/ProductCard.jsx — Card de produto
// Props: product, qty, onAdd(id), onRemove(id), compact
// product: { id, name, description, price, oldPrice?, category, tag?, image_url? }

import { useState } from 'react';
import { colors, fonts, formatPrice, formatProductName } from '../theme';
import Icon, { ProductPlaceholder } from './Icon';

export default function ProductCard({ product, qty = 0, onAdd, onRemove, compact = false }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colors.cardHover : colors.card,
        backdropFilter: 'blur(10px)',
        borderRadius: compact ? 11 : 14,
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 10px 28px rgba(0,0,0,0.18)' : '0 1px 6px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', height: '100%',
      }}
    >
      {/* Área da imagem */}
      <div style={{
        height: compact ? 80 : 96,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.03)',
        position: 'relative',
      }}>
        {/* Badge oferta ou estoque baixo */}
        {product.tag ? (
          <span style={{
            position: 'absolute', top: 6, left: 6,
            fontSize: 8, fontWeight: 800,
            padding: '2px 6px', borderRadius: 5,
            background: colors.gold, color: colors.bgDeep,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {product.tag}
          </span>
        ) : product.estoque != null && product.estoque > 0 && product.estoque <= 5 ? (
          <span style={{
            position: 'absolute', top: 6, left: 6,
            fontSize: 7, fontWeight: 800,
            padding: '2px 6px', borderRadius: 5,
            background: 'rgba(239,83,80,0.15)', color: '#EF5350',
            border: '1px solid rgba(239,83,80,0.3)',
          }}>
            {product.estoque === 1 ? 'Ultimo!' : `Ultimas ${product.estoque}`}
          </span>
        ) : null}

        {/* Badge desconto */}
        {discount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            fontSize: 8, fontWeight: 800,
            padding: '2px 5px', borderRadius: 4,
            background: colors.goldBg, color: colors.gold,
            border: `1px solid ${colors.goldBorder}`,
            fontFamily: fonts.number,
          }}>
            -{discount}%
          </span>
        )}

        {/* Badge peso */}
        {product.isPeso && (
          <span style={{
            position: 'absolute', bottom: 6, left: 6, zIndex: 2,
            fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
            background: 'rgba(226,184,74,0.15)', color: colors.gold,
            border: '1px solid rgba(226,184,74,0.3)', fontFamily: fonts.text,
          }}>⚖️ Por kg</span>
        )}

        {/* Imagem ou placeholder */}
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.name}
            onError={() => setImgError(true)}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ProductPlaceholder category={product.category} size={compact ? 26 : 32} />
        )}
      </div>

      {/* Info */}
      <div style={{
        padding: compact ? '6px 9px 9px' : '9px 11px 11px',
        flex: 1, display: 'flex', flexDirection: 'column',
      }}>
        <p style={{
          fontSize: compact ? 11 : 12.5, fontWeight: 700,
          color: colors.white, lineHeight: 1.3, margin: 0,
          minHeight: compact ? 24 : 30,
          fontFamily: fonts.text,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {formatProductName(product.name)}
        </p>

        <p style={{
          fontSize: 9, color: colors.textMuted,
          margin: '2px 0 0', fontFamily: fonts.text,
        }}>
          {product.description}
        </p>

        <div style={{
          marginTop: 'auto', paddingTop: 7,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {/* Preço */}
          <div>
            {product.oldPrice && (
              <span style={{
                fontSize: 9, color: colors.textMuted,
                textDecoration: 'line-through', display: 'block',
                fontFamily: fonts.number,
              }}>
                {formatPrice(product.oldPrice)}
              </span>
            )}
            <span style={{
              fontSize: compact ? 13 : 15, fontWeight: 800,
              color: colors.gold, fontFamily: fonts.number,
            }}>
              {formatPrice(product.price)}
              {product.isPeso && <span style={{ fontSize: '0.65em', opacity: 0.6, fontFamily: fonts.text }}>/kg</span>}
            </span>
          </div>

          {/* Controle de quantidade */}
          {qty > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: colors.gold, borderRadius: 9, padding: 2,
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(product.id); }}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: 'none', background: 'rgba(0,0,0,0.12)',
                  color: colors.bgDeep, cursor: 'pointer',
                  fontSize: 14, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {'\u2212'}
              </button>
              <span style={{
                fontFamily: fonts.number, fontWeight: 800,
                fontSize: 13, color: colors.bgDeep,
                minWidth: 18, textAlign: 'center',
              }}>
                {qty}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onAdd(product.id); }}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: 'none', background: 'rgba(0,0,0,0.1)',
                  color: colors.bgDeep, cursor: 'pointer',
                  fontSize: 14, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(product.id); }}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: colors.gold, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(226,184,74,0.25)',
              }}
            >
              <Icon name="plus" size={13} color={colors.bgDeep} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
