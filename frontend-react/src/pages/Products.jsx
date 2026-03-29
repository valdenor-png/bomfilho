import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { colors, fonts, formatPrice } from '../theme';
import Icon, { categoryIcons } from '../components/Icon';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/produtos/ProductDetailModal';
import { sanitizeInput } from '../lib/sanitize';
import { useSmartSearch } from '../hooks/useSmartSearch';
import { SkeletonProductCard } from '../components/ui/Skeleton';
import SearchDropdown from '../components/search/SearchDropdown';

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

function HorizontalRow({ products, cart, onAdd, onRemove, onProductClick }) {
  return (
    <div style={scrollRowStyle} className="hide-scrollbar">
      {products.map(p => (
        <div key={p.id} style={scrollCardStyle} onClick={() => onProductClick && onProductClick(p)}>
          <ProductCard product={p} qty={cart[p.id] || 0} onAdd={onAdd} onRemove={onRemove} compact />
        </div>
      ))}
    </div>
  );
}

const DIETARY_FILTERS = [
  { key: 'sem_gluten', label: 'Sem Gluten', keywords: ['sem gluten', 'gluten free', 'tapioca'] },
  { key: 'integral', label: 'Integral', keywords: ['integral', 'aveia', 'granola', 'fibra'] },
  { key: 'zero', label: 'Zero/Diet', keywords: ['zero', 'diet', 'light', 'sem acucar'] },
  { key: 'organico', label: 'Organico', keywords: ['organico', 'organic', 'natural'] },
];

function matchesDietaryFilter(product, filterKey) {
  const filter = DIETARY_FILTERS.find(f => f.key === filterKey);
  if (!filter) return false;
  const name = (product.name || product.nome || '').toLowerCase();
  const tags = (product.tags || []).map(t => t.toLowerCase());
  return filter.keywords.some(kw => name.includes(kw) || tags.includes(filterKey));
}

export default function Products({ cart = {}, onAdd, onRemove, products = [], initialCategory, initialSearch, onSearch }) {
  const [category, setCategory] = useState(initialCategory || 'all');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [dietaryFilter, setDietaryFilter] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const debounceRef = useRef(null);
  const searchBoxRef = useRef(null);

  const { query, setQuery, suggestions, isOpen, setIsOpen, saveToHistory, removeFromHistory, clearSearch } = useSmartSearch(products);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  // Pre-fill search from Home
  useEffect(() => {
    if (initialSearch) {
      setQuery(initialSearch);
    }
  }, [initialSearch, setQuery]);

  // Debounced API search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2 || !onSearch) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await onSearch(query);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, onSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [setIsOpen]);

  const handleSelectProduct = (p) => {
    const name = p._dn || p.name || p.nome || '';
    saveToHistory(name);
    setIsOpen(false);
    // Scroll to product or add to cart
    if (onAdd) onAdd(p.id);
  };

  const handleSelectCategory = (catName) => {
    const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (cat) { setCategory(cat.id); setQuery(''); setSearchResults(null); }
    setIsOpen(false);
  };

  const handleHistoryClick = (term) => {
    setQuery(term);
    saveToHistory(term);
    setIsOpen(false);
  };

  const displayProducts = searchResults || products;
  const filtered = displayProducts.filter(p => {
    if (searchResults && !dietaryFilter) return true;
    const matchCat = searchResults ? true : (category === 'all'
      || (category === 'ofertas' ? (p.tag === 'Oferta' || p.oldPrice) : p.category === category));
    const matchDiet = !dietaryFilter || matchesDietaryFilter(p, dietaryFilter);
    return matchCat && matchDiet;
  });

  const grouped = {};
  if (category === 'all' && !query && !searchResults) {
    filtered.forEach(p => {
      const cat = p.category || 'outros';
      if (!grouped[cat]) grouped[cat] = [];
      if (grouped[cat].length < MAX_PER_CATEGORY) grouped[cat].push(p);
    });
  } else if (!searchResults) {
    grouped[category] = filtered.slice(0, MAX_PER_CATEGORY);
  }

  if (searchResults) {
    grouped['resultados'] = filtered.slice(0, 30);
  }

  const showGrouped = Object.keys(grouped).length > 0;
  const totalFiltered = filtered.length;

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Busca com autocomplete */}
      <div ref={searchBoxRef} style={{ position: 'relative', marginTop: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.08)',
          border: `1.5px solid ${isOpen ? 'rgba(226,184,74,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 14, padding: '0 14px', height: 46,
          boxShadow: isOpen ? '0 0 0 3px rgba(226,184,74,0.08)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}>
          <Icon name="search" size={16} color={isOpen ? colors.gold : 'rgba(255,255,255,0.4)'} />
          <input
            value={query}
            onChange={e => { setQuery(sanitizeInput(e.target.value)); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={e => { if (e.key === 'Enter' && query.trim()) { saveToHistory(query.trim()); setIsOpen(false); } }}
            placeholder="O que voce procura?"
            autoComplete="off"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: colors.white, fontFamily: fonts.text, fontWeight: 500, minWidth: 0,
            }}
          />
          {query && (
            <button onClick={() => { clearSearch(); setSearchResults(null); }} style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="close" size={12} color="rgba(255,255,255,0.5)" />
            </button>
          )}
        </div>

        {isOpen && (
          <SearchDropdown
            sections={suggestions}
            query={query}
            onSelectProduct={handleSelectProduct}
            onSelectCategory={handleSelectCategory}
            onSelectHistory={handleHistoryClick}
            onRemoveHistory={removeFromHistory}
          />
        )}
      </div>

      {/* Pills de categoria */}
      <div style={{ display: 'flex', gap: 5, marginTop: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(cat => {
          const active = category === cat.id;
          return (
            <button key={cat.id} onClick={() => { setCategory(cat.id); setQuery(''); setSearchResults(null); setShowSuggestions(false); }} style={{
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

      {/* Filtros por necessidade */}
      <div style={{ display: 'flex', gap: 5, marginTop: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {DIETARY_FILTERS.map(f => {
          const active = dietaryFilter === f.key;
          return (
            <button key={f.key} onClick={() => setDietaryFilter(active ? null : f.key)} style={{
              padding: '5px 10px', borderRadius: 16, whiteSpace: 'nowrap',
              background: active ? 'rgba(90,228,167,0.15)' : 'transparent',
              border: `1px solid ${active ? 'rgba(90,228,167,0.3)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', fontFamily: fonts.text,
              color: active ? '#5AE4A7' : 'rgba(255,255,255,0.45)',
              fontSize: 10, fontWeight: 600,
            }}>
              {f.label}
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

      {/* Skeleton loading */}
      {searching && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'hidden' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ minWidth: 140, maxWidth: 140, flexShrink: 0 }}>
              <SkeletonProductCard />
            </div>
          ))}
        </div>
      )}

      {/* Listagem */}
      {totalFiltered === 0 && !searching ? (
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
          const label = catKey === 'resultados' ? `Resultados para "${query}"` : (catInfo?.name || catKey);
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
              <HorizontalRow products={prods} cart={cart} onAdd={onAdd} onRemove={onRemove} onProductClick={setSelectedProduct} />
            </div>
          );
        })
      ) : null}

      {/* CSS para esconder scrollbar */}
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>

      {/* Product detail modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(item) => { onAdd(item.id); setSelectedProduct(null); }}
      />
    </div>
  );
}
