import { useState, useEffect, useRef } from 'react';

const HISTORY_KEY = 'bomfilho_search_history';
const MAX_HISTORY = 15;

export function useSmartSearch(products) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(h);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions(history.slice(0, 5).map(h => ({
        type: 'history', text: h,
      })));
      return;
    }

    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase().trim();
      const words = q.split(/\s+/);

      const matches = products
        .filter(p => {
          const name = (p.name || p.nome || '').toLowerCase();
          if (name.includes(q)) return true;
          return words.every(w => name.includes(w));
        })
        .slice(0, 6)
        .map(p => ({
          type: 'product',
          text: p.name || p.nome,
          price: p.price || p.preco,
          id: p.id,
          category: p.category || p.categoria,
        }));

      const catSet = new Set();
      const categories = products
        .filter(p => (p.category || '').toLowerCase().includes(q))
        .reduce((acc, p) => {
          if (!catSet.has(p.category)) {
            catSet.add(p.category);
            acc.push({ type: 'category', text: p.category });
          }
          return acc;
        }, [])
        .slice(0, 2);

      const historyMatches = history
        .filter(h => h.toLowerCase().includes(q))
        .slice(0, 2)
        .map(h => ({ type: 'history', text: h }));

      setSuggestions([...historyMatches, ...categories, ...matches]);
    }, 150);

    return () => clearTimeout(debounceRef.current);
  }, [query, products, history]);

  const saveToHistory = (term) => {
    if (!term.trim()) return;
    const updated = [term, ...history.filter(h => h !== term)].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    setSuggestions([]);
  };

  return { query, setQuery, suggestions, showSuggestions, setShowSuggestions, saveToHistory, clearHistory };
}
