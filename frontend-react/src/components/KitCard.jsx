import React from 'react';
import { colors, fonts, formatPrice } from '../theme';

export default function KitCard({ kit, onAdd, onViewDetails, compact = false }) {
  const savings = kit.originalPrice - kit.price;

  return (
    <div onClick={() => onViewDetails && onViewDetails(kit)} style={{
      background: 'rgba(226,184,74,0.06)',
      border: '1px solid rgba(226,184,74,0.15)',
      borderRadius: 14, padding: compact ? 12 : 14,
      position: 'relative', overflow: 'hidden', height: '100%',
      display: 'flex', flexDirection: 'column',
      cursor: 'pointer', transition: 'all 0.2s ease',
    }}>
      {/* Badge economia */}
      <span style={{
        position: 'absolute', top: 8, right: 8,
        fontSize: 8, fontWeight: 800, padding: '2px 6px',
        borderRadius: 5, background: '#EF5350', color: '#FFF',
        fontFamily: fonts.number,
      }}>
        -{formatPrice(savings)}
      </span>

      {/* Mini grid dos itens */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 3,
        marginBottom: 8, marginTop: 2,
      }}>
        {kit.items.slice(0, 4).map((item, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
          }}>
            {'\u{1F4E6}'}
          </div>
        ))}
        {kit.items.length > 4 && (
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700,
          }}>
            +{kit.items.length - 4}
          </div>
        )}
      </div>

      {/* Info */}
      <p style={{
        fontSize: compact ? 12 : 13, fontWeight: 800, color: '#fff',
        margin: 0, fontFamily: fonts.text, lineHeight: 1.2,
      }}>
        {kit.name}
      </p>
      <p style={{
        fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0',
        fontFamily: fonts.text, flex: 1,
      }}>
        {kit.items.length} itens
      </p>

      {/* Preco + botao */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 8,
      }}>
        <div>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.4)',
            textDecoration: 'line-through', fontFamily: fonts.number,
            marginRight: 4,
          }}>
            {formatPrice(kit.originalPrice)}
          </span>
          <span style={{
            fontSize: compact ? 14 : 16, fontWeight: 900,
            color: colors.gold, fontFamily: fonts.number,
          }}>
            {formatPrice(kit.price)}
          </span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onAdd(kit); }} style={{
          padding: '7px 12px', background: colors.gold,
          border: 'none', borderRadius: 8, color: colors.bgDeep,
          fontWeight: 800, fontSize: 11, cursor: 'pointer',
          fontFamily: fonts.text,
        }}>
          +
        </button>
      </div>
    </div>
  );
}
