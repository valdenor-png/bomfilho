import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'bomfilho_saved_lists';
const MAX_LISTS = 10;

export function useSavedLists() {
  const [lists, setLists] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setLists(stored);
    } catch {
      setLists([]);
    }
  }, []);

  const persist = useCallback((updated) => {
    setLists(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const saveList = useCallback((name, cartItems) => {
    if (lists.length >= MAX_LISTS) return null;
    const newList = {
      id: crypto.randomUUID?.() || `list_${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      items: cartItems.map(item => ({
        productId: item.id || item.productId || item.produto_id,
        name: item.name || item.title || item.nome || '',
        quantity: item.quantity || item.qty || item.quantidade || 1,
        price: item.price || item.unitPrice || item.preco || 0,
        weight: item.weight || item.peso_gramas || null,
        img: item.img || item.image || item.image_url || null,
      })),
    };
    const updated = [newList, ...lists];
    persist(updated);
    return newList;
  }, [lists, persist]);

  const deleteList = useCallback((listId) => {
    persist(lists.filter(l => l.id !== listId));
  }, [lists, persist]);

  const renameList = useCallback((listId, newName) => {
    persist(lists.map(l => l.id === listId ? { ...l, name: newName.trim() } : l));
  }, [lists, persist]);

  const markUsed = useCallback((listId) => {
    persist(lists.map(l => l.id === listId ? { ...l, lastUsedAt: new Date().toISOString() } : l));
  }, [lists, persist]);

  return { lists, saveList, deleteList, renameList, markUsed, count: lists.length, isFull: lists.length >= MAX_LISTS };
}
