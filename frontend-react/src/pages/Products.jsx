import React from 'react';
// pages/Products.jsx — Catálogo de produtos
// Props: cart, onAdd, onRemove, products (array da API), initialCategory

import { useState, useEffect } from 'react';
import { colors, fonts } from '../theme';
import Icon, { categoryIcons } from '../components/Icon';
import ProductCard from '../components/ProductCard';

const categories = [
  { id: 'all', name: 'Todos' },
  { id: 'ofertas', name: 'Ofertas' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'mercearia', name: 'Mercearia' },
  { id: 'hortifruti', name: 'Hortifruti' },
  { id: 'higiene', name: 'Higiene' },
  { id: 'limpeza', name: 'Limpeza' },
];

export default function Products({ cart = {}, onAdd, onRemove, products = [], initialCategory }) {
  const [category, setCategory] = useState(initialCategory || 'all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const filtered = products.filter(p => {
    const matchCat = category === 'all'
      || (category === 'ofertas' ? (p.tag === 'Oferta' || p.oldPrice) : p.category === category);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Agrupar por categoria quando em "Todos" sem busca
  const grouped = {};
  if (category === 'all' && !search) {
    filtered.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
  }
  const showGrouped = category === 'all' && !search;

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Busca */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, marginTop: 8,
        background: colors.card, borderRadius: 11,
        padding: '2px 3px 2px 10px', border: `1px solid ${colors.border}`,
      }}>
        <Icon name="search" size={13} color={colors.textMuted} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar produtos..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12, color: colors.white, padding: '7px 0', fontFamily: fonts.text,
          }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textMuted, fontSize: 15, padding: '2px 6px',
          }}>
            x
          </button>
        )}
      </div>

      {/* Pills de categoria */}
      <div style={{ display: 'flex', gap: 5, marginTop: 8, overflowX: 'auto' }}>
        {categories.map(cat => {
          const active = category === cat.id;
          return (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
              padding: '6px 11px', borderRadius: 9,
              background: active ? colors.gold : colors.card,
              border: active ? 'none' : `1px solid ${colors.border}`,
              cursor: 'pointer', fontFamily: fonts.text, whiteSpace: 'nowrap',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: active ? colors.bgDeep : colors.textSecondary,
              }}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contagem */}
      <p style={{
        fontSize: 10, color: colors.textMuted,
        margin: '8px 0 5px', fontFamily: fonts.number,
      }}>
        {filtered.length} produtos
      </p>

      {/* Listagem */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Icon name="search" size={36} color={colors.textMuted} />
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, marginTop: 8 }}>
            Nada encontrado
          </p>
          <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
            Tente buscar por outro produto
          </p>
        </div>
      ) : showGrouped ? (
        // Agrupado por categoria
        Object.entries(grouped).map(([catKey, prods]) => {
          const catInfo = categories.find(c => c.id === catKey);
          return (
            <div key={catKey} style={{ marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                <h3 style={{
                  fontSize: 13, fontWeight: 800, color: colors.white,
                  display: 'flex', alignItems: 'center', gap: 4, fontFamily: fonts.text,
                }}>
                  <Icon name={categoryIcons[catKey] || 'package'} size={14} color={colors.textSecondary} strokeWidth={1.5} />
                  {catInfo?.name || catKey}
                </h3>
                <button onClick={() => setCategory(catKey)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.gold, fontWeight: 700, fontSize: 11, fontFamily: fonts.text,
                  whiteSpace: 'nowrap', flexShrink: 0, paddingRight: 2,
                }}>
                  Ver →
                </button>
              </div>
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto' }}>
                {prods.map(p => (
                  <div key={p.id} style={{ minWidth: 135, maxWidth: 135, flex: '0 0 auto' }}>
                    <ProductCard product={p} qty={cart[p.id] || 0} onAdd={onAdd} onRemove={onRemove} compact />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      ) : (
        // Grid filtrado
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} qty={cart[p.id] || 0} onAdd={onAdd} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
