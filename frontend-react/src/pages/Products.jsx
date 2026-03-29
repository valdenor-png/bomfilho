import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { colors, fonts } from '../theme';
import Icon, { categoryIcons } from '../components/Icon';
import ProductCard from '../components/ProductCard';
import { sanitizeInput } from '../lib/sanitize';

const MAX_PER_CATEGORY = 10;

const categories = [
  { id: 'all', name: 'Todos' },
  { id: 'ofertas', name: 'Ofertas' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'mercearia', name: 'Mercearia' },
  { id: 'hortifruti', name: 'Hortifruti' },
  { id: 'higiene', name: 'Higiene' },
  { id: 'limpeza', name: 'Limpeza' },
];

const scrollRowStyle = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  scrollSnapType: 'x proximity',
  scrollbarWidth: 'none',
  paddingBottom: 4,
  margin: '0 -16px',
  padding: '0 16px 4px',
};

const scrollCardStyle = {
  minWidth: 140,
  maxWidth: 140,
  flexShrink: 0,
  scrollSnapAlign: 'start',
};

function HorizontalRow({ products, cart, onAdd, onRemove }) {
  return (
    <div style={scrollRowStyle} className="hide-scrollbar">
      {products.map(p => (
        <div key={p.id} style={scrollCardStyle}>
          <ProductCard product={p} qty={cart[p.id] || 0} onAdd={onAdd} onRemove={onRemove} compact />
        </div>
      ))}
    </div>
  );
}

export default function Products({ cart = {}, onAdd, onRemove, products = [], initialCategory, onSearch }) {
  const [category, setCategory] = useState(initialCategory || 'all');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search || search.length < 2 || !onSearch) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await onSearch(search);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, onSearch]);

  const displayProducts = searchResults || products;
  const filtered = displayProducts.filter(p => {
    if (searchResults) return true;
    const matchCat = category === 'all'
      || (category === 'ofertas' ? (p.tag === 'Oferta' || p.oldPrice) : p.category === category);
    return matchCat;
  });

  // Agrupar por categoria, max 10 por categoria
  const grouped = {};
  if (category === 'all' && !search && !searchResults) {
    filtered.forEach(p => {
      const cat = p.category || 'outros';
      if (!grouped[cat]) grouped[cat] = [];
      if (grouped[cat].length < MAX_PER_CATEGORY) grouped[cat].push(p);
    });
  } else if (!searchResults) {
    // Categoria específica selecionada — ainda agrupar como seção única
    grouped[category] = filtered.slice(0, MAX_PER_CATEGORY);
  }

  // Busca mostra tudo horizontal numa seção só
  if (searchResults) {
    grouped['resultados'] = filtered.slice(0, 30);
  }

  const showGrouped = Object.keys(grouped).length > 0;

  const totalFiltered = filtered.length;

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
          onChange={e => setSearch(sanitizeInput(e.target.value))}
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
          }}>x</button>
        )}
      </div>

      {/* Pills de categoria */}
      <div style={{ display: 'flex', gap: 5, marginTop: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const active = category === cat.id;
          return (
            <button key={cat.id} onClick={() => { setCategory(cat.id); setSearch(''); setSearchResults(null); }} style={{
              padding: '6px 11px', borderRadius: 9,
              background: active ? colors.gold : colors.card,
              border: active ? 'none' : `1px solid ${colors.border}`,
              cursor: 'pointer', fontFamily: fonts.text, whiteSpace: 'nowrap',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: active ? colors.bgDeep : colors.textSecondary,
              }}>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Contagem */}
      <p style={{
        fontSize: 10, color: colors.textMuted,
        margin: '8px 0 5px', fontFamily: fonts.number,
      }}>
        {searching ? 'Buscando...' : `${totalFiltered} produtos`}
      </p>

      {/* Listagem */}
      {totalFiltered === 0 ? (
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
        Object.entries(grouped).map(([catKey, prods]) => {
          if (!prods || prods.length === 0) return null;
          const catInfo = categories.find(c => c.id === catKey);
          const label = catKey === 'resultados' ? `Resultados para "${search}"` : (catInfo?.name || catKey);
          return (
            <div key={catKey} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                <h3 style={{
                  fontSize: 13, fontWeight: 800, color: colors.white,
                  display: 'flex', alignItems: 'center', gap: 4, fontFamily: fonts.text,
                }}>
                  {catKey !== 'resultados' && (
                    <Icon name={categoryIcons[catKey] || 'package'} size={14} color={colors.textSecondary} strokeWidth={1.5} />
                  )}
                  {label}
                </h3>
                {category === 'all' && catKey !== 'resultados' && (
                  <button onClick={() => setCategory(catKey)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: colors.gold, fontWeight: 700, fontSize: 11, fontFamily: fonts.text,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>Ver →</button>
                )}
              </div>
              <HorizontalRow products={prods} cart={cart} onAdd={onAdd} onRemove={onRemove} />
            </div>
          );
        })
      ) : null}

      {/* CSS para esconder scrollbar */}
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
