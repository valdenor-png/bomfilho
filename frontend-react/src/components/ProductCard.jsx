import React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { colors, fonts, formatPrice, formatProductName } from '../theme';
import Icon, { ProductPlaceholder } from './Icon';

function ProductCard({ product, qty = 0, onAdd, onRemove, compact = false }) {
  const [imgError, setImgError] = useState(false);
  const [addPulse, setAddPulse] = useState(false);
  const prevQty = useRef(qty);
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  // Trigger pulse when qty increases
  useEffect(() => {
    if (qty > prevQty.current && qty > 0) {
      setAddPulse(true);
      const t = setTimeout(() => setAddPulse(false), 400);
      prevQty.current = qty;
      return () => clearTimeout(t);
    }
    prevQty.current = qty;
  }, [qty]);

  const handleAdd = useCallback((e) => {
    e.stopPropagation();
    onAdd(product.id);
  }, [onAdd, product.id]);

  const handleRemove = useCallback((e) => {
    e.stopPropagation();
    onRemove(product.id);
  }, [onRemove, product.id]);

  return (
    <div
      className="bf-product-card"
      style={{
        background: colors.card,
        borderRadius: compact ? 12 : 14,
        overflow: 'hidden',
        border: `1px solid ${colors.border}`,
        display: 'flex', flexDirection: 'column', height: '100%',
        transition: 'transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s cubic-bezier(.4,0,.2,1)',
        willChange: 'transform',
      }}
    >
      {/* Image area */}
      <div style={{
        height: compact ? 84 : 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.03)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Badge: oferta ou estoque baixo */}
        {product.tag ? (
          <span style={{
            position: 'absolute', top: 6, left: 6, zIndex: 2,
            fontSize: 7.5, fontWeight: 800,
            padding: '2.5px 7px', borderRadius: 6,
            background: `linear-gradient(135deg, ${colors.gold} 0%, #C9A03A 100%)`,
            color: colors.bgDeep,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            boxShadow: '0 2px 8px rgba(226,184,74,0.3)',
          }}>
            {product.tag}
          </span>
        ) : product.estoque != null && product.estoque > 0 && product.estoque <= 5 ? (
          <span style={{
            position: 'absolute', top: 6, left: 6, zIndex: 2,
            fontSize: 7, fontWeight: 800,
            padding: '2.5px 7px', borderRadius: 6,
            background: 'rgba(239,83,80,0.15)', color: '#EF5350',
            border: '1px solid rgba(239,83,80,0.3)',
          }}>
            {product.estoque === 1 ? 'Ultimo!' : `Ultimas ${product.estoque}`}
          </span>
        ) : null}

        {/* Badge: desconto */}
        {discount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            fontSize: 8, fontWeight: 800,
            padding: '2.5px 6px', borderRadius: 5,
            background: colors.goldBg, color: colors.gold,
            border: `1px solid ${colors.goldBorder}`,
            fontFamily: fonts.number,
          }}>
            -{discount}%
          </span>
        )}

        {/* Badge: peso */}
        {product.isPeso && (
          <span style={{
            position: 'absolute', bottom: 6, left: 6, zIndex: 2,
            fontSize: 8, fontWeight: 700, padding: '2.5px 7px', borderRadius: 6,
            background: 'rgba(226,184,74,0.15)', color: colors.gold,
            border: '1px solid rgba(226,184,74,0.3)', fontFamily: fonts.text,
          }}>/kg</span>
        )}

        {/* Image */}
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.name}
            onError={() => setImgError(true)}
            loading="lazy"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 0.35s cubic-bezier(.4,0,.2,1)',
            }}
          />
        ) : (
          <ProductPlaceholder category={product.category} size={compact ? 26 : 32} />
        )}
      </div>

      {/* Info */}
      <div style={{
        padding: compact ? '7px 10px 10px' : '9px 12px 12px',
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

        <div style={{
          marginTop: 'auto', paddingTop: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {/* Price */}
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
              fontSize: compact ? 13.5 : 15, fontWeight: 800,
              color: colors.gold, fontFamily: fonts.number,
            }}>
              {formatPrice(product.price)}
              {product.isPeso && <span style={{ fontSize: '0.65em', opacity: 0.6, fontFamily: fonts.text }}>/kg</span>}
            </span>
          </div>

          {/* Qty controls with animation */}
          {qty > 0 ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 1,
                background: `linear-gradient(135deg, ${colors.gold} 0%, #C9A03A 100%)`,
                borderRadius: 10, padding: 2,
                boxShadow: '0 2px 10px rgba(226,184,74,0.3)',
                animation: addPulse ? 'bf-cart-pop 0.4s cubic-bezier(.36,1.56,.64,1)' : 'none',
              }}
            >
              <button
                onClick={handleRemove}
                className="bf-qty-btn"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: 'none', background: 'rgba(0,0,0,0.12)',
                  color: colors.bgDeep, cursor: 'pointer',
                  fontSize: 15, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                {'\u2212'}
              </button>
              <span style={{
                fontFamily: fonts.number, fontWeight: 800,
                fontSize: 13, color: colors.bgDeep,
                minWidth: 20, textAlign: 'center',
                transition: 'transform 0.2s cubic-bezier(.4,0,.2,1)',
                transform: addPulse ? 'scale(1.2)' : 'scale(1)',
              }}>
                {qty}
              </span>
              <button
                onClick={handleAdd}
                className="bf-qty-btn"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: 'none', background: 'rgba(0,0,0,0.08)',
                  color: colors.bgDeep, cursor: 'pointer',
                  fontSize: 15, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="bf-add-btn"
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: `linear-gradient(135deg, ${colors.gold} 0%, #C9A03A 100%)`,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(226,184,74,0.3)',
                transition: 'transform 0.2s cubic-bezier(.4,0,.2,1), box-shadow 0.2s',
              }}
            >
              <Icon name="plus" size={14} color={colors.bgDeep} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProductCard);
