import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';
import Badge from './Badge';

// <ProductRow id={p.id} nome={p.nome} categoria={p.categoria} preco={p.preco} estoque={p.estoque} onRemove={...} />

export default function ProductRow({ id, nome, categoria, preco, estoque, onRemove, style }) {
  const estoqueColor = estoque <= 0 ? colors.red : estoque <= 5 ? colors.orange : colors.green;
  const precoFormatted = `R$ ${Number(preco || 0).toFixed(2).replace('.', ',')}`;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '50px 1fr 100px 80px 60px 60px',
      gap: 8, alignItems: 'center',
      padding: '8px 12px', borderRadius: 8,
      borderBottom: `1px solid ${colors.borderDim}`,
      fontSize: 12,
      transition: 'background 0.1s',
      ...style,
    }}>
      <span style={{ fontFamily: fonts.numbers, color: colors.dim, fontSize: 11 }}>{id}</span>
      <span style={{ fontWeight: 600, color: colors.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nome}
      </span>
      <span>
        {categoria ? <Badge tone="muted" label={categoria} /> : <span style={{ color: colors.dim }}>—</span>}
      </span>
      <span style={{ fontFamily: fonts.numbers, fontWeight: 600, color: colors.gold }}>{precoFormatted}</span>
      <span style={{ fontFamily: fonts.numbers, fontWeight: 700, color: estoqueColor }}>{estoque}</span>
      <div style={{ textAlign: 'center' }}>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: colors.redBg, border: `1px solid ${colors.redBorder}`,
              color: colors.red, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
