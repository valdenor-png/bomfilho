import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const HISTORY_KEY = 'bomfilho_search_history';
const MAX_HISTORY = 10;
const DEBOUNCE_MS = 80;

function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function formatName(name) {
  if (!name) return '';
  const units = ['kg', 'g', 'ml', 'lt', 'l', 'un', 'und', 'cx', 'pct', 'pc'];
  return name.toLowerCase().split(/\s+/).map(w => {
    if (units.includes(w) || w.length <= 2) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function fuzzyMatch(a, b) {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (longer.length - shorter.length > 1) return false;
  let mismatches = 0, si = 0, li = 0;
  while (si < shorter.length && li < longer.length) {
    if (shorter[si] !== longer[li]) {
      mismatches++;
      if (mismatches > 1) return false;
      if (shorter.length !== longer.length) { li++; continue; }
    }
    si++; li++;
  }
  return true;
}

function calcScore(query, p) {
  const name = p._sn;
  const words = p._sw;
  if (name.startsWith(query)) return 100 + (1 / name.length) * 10;
  if (words.some(w => w.startsWith(query))) return 50 + (1 / name.length) * 10;
  if (name.includes(query)) return 20;
  if (query.length >= 3) {
    for (const w of words) {
      if (w.length >= query.length - 1 && fuzzyMatch(query, w)) return 5;
    }
  }
  return 0;
}

function getPopular(index) {
  const bycat = {};
  for (const p of index) {
    const cat = p.category || p.categoria || 'Outros';
    if (!bycat[cat] || (p.price || p.preco || 999) < (bycat[cat].price || bycat[cat].preco || 999)) {
      bycat[cat] = p;
    }
  }
  return Object.values(bycat).slice(0, 5);
}

export function useSmartSearch(products) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); }
    catch { setHistory([]); }
  }, []);

  const searchIndex = useMemo(() => {
    if (!products?.length) return [];
    return products.map(p => ({
      ...p,
      _sn: normalizeText(p.name || p.nome || ''),
      _dn: formatName(p.name || p.nome || ''),
      _sw: normalizeText(p.name || p.nome || '').split(/\s+/),
      _sc: normalizeText(p.category || p.categoria || ''),
    }));
  }, [products]);

  const generate = useCallback((q) => {
    if (!q.trim()) {
      const sections = [];
      if (history.length > 0) {
        sections.push({
          type: 'section', label: 'Buscas recentes',
          items: history.slice(0, 5).map(h => ({ type: 'history', text: h, removable: true })),
        });
      }
      const popular = getPopular(searchIndex);
      if (popular.length > 0) {
        sections.push({
          type: 'section', label: 'Populares',
          items: popular.map(p => ({ type: 'product', product: p })),
        });
      }
      return sections;
    }

    const nq = normalizeText(q);
    const sections = [];

    // Single pass: collect matching categories + scored products
    const catCounts = {};
    const catOrder = [];
    const scored = [];
    for (const p of searchIndex) {
      const cat = p.category || p.categoria;
      if (p._sc.includes(nq)) {
        if (!catCounts[cat]) { catCounts[cat] = 0; catOrder.push(cat); }
        catCounts[cat]++;
      }
      const score = calcScore(nq, p);
      if (score > 0) scored.push({ product: p, score });
    }
    scored.sort((a, b) => b.score - a.score);

    const cats = catOrder.slice(0, 2);
    if (cats.length > 0) {
      sections.push({
        type: 'section', label: 'Categorias',
        items: cats.map(c => ({ type: 'category', text: c, count: catCounts[c] })),
      });
    }

    scored.length = Math.min(scored.length, 8);

    if (scored.length > 0) {
      sections.push({
        type: 'section', label: 'Produtos',
        items: scored.map(r => ({ type: 'product', product: r.product })),
      });
    }

    if (sections.length === 0) {
      sections.push({ type: 'empty', query: q });
    }

    return sections;
  }, [searchIndex, history]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSuggestions(generate(query));
    }, query.trim() ? DEBOUNCE_MS : 0);
    return () => clearTimeout(debounceRef.current);
  }, [query, generate]);

  const saveToHistory = useCallback((term) => {
    if (!term.trim()) return;
    const c = term.trim();
    const updated = [c, ...history.filter(h => h !== c)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const removeFromHistory = useCallback((term) => {
    const updated = history.filter(h => h !== term);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  return { query, setQuery, suggestions, isOpen, setIsOpen, saveToHistory, removeFromHistory, clearSearch };
}
