import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  buildCartEventPayload,
  buildProductEventPayload,
  captureCommerceEvent
} from '../lib/commerceTracking';

const CART_KEY = 'bomfilho_cart';

const CartContext = createContext(null);

function resumirCarrinho(itens = []) {
  return itens.reduce(
    (acc, item) => ({
      itens: acc.itens + Math.max(1, Number(item?.quantidade || 1)),
      total: acc.total + (Number(item?.preco || 0) * Math.max(1, Number(item?.quantidade || 1)))
    }),
    { itens: 0, total: 0 }
  );
}

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && item.id)
      .map((item) => ({
        id: Number(item.id),
        nome: String(item.nome || ''),
        preco: Number(item.preco || 0),
        emoji: String(item.emoji || '📦'),
        imagem: String(item.imagem || '').trim(),
        categoria: String(item.categoria || '').trim(),
        unidade: String(item.unidade || '').trim(),
        quantidade: Math.max(1, Number(item.quantidade || 1))
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [itens, setItens] = useState(() => readCart());

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(itens));
  }, [itens]);

  function addItem(produto, quantidade = 1, meta = {}) {
    const qtd = Math.max(1, Number(quantidade || 1));
    let payloadEvento = null;

    setItens((atual) => {
      const index = atual.findIndex((item) => item.id === Number(produto.id));

      if (index === -1) {
        const proximo = [
          ...atual,
          {
            id: Number(produto.id),
            nome: String(produto.nome || ''),
            preco: Number(produto.preco || 0),
            emoji: String(produto.emoji || '📦'),
            imagem: String(produto.imagem || '').trim(),
            categoria: String(produto.categoria || '').trim(),
            unidade: String(produto.unidade || '').trim(),
            quantidade: qtd
          }
        ];

        const resumoProximo = resumirCarrinho(proximo);
        payloadEvento = {
          ...buildProductEventPayload(produto, {
            quantity: qtd,
            add_mode: 'new_item',
            source: String(meta?.source || 'catalog').trim() || 'catalog'
          }),
          ...buildCartEventPayload({ itens: proximo, resumo: resumoProximo })
        };

        return proximo;
      }

      const proximo = atual.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              nome: String(produto.nome || item.nome || '').trim() || item.nome,
              preco: Number(produto.preco || item.preco || 0),
              emoji: String(produto.emoji || item.emoji || '📦'),
              imagem: String(produto.imagem || item.imagem || '').trim(),
              categoria: String(produto.categoria || item.categoria || '').trim(),
              unidade: String(produto.unidade || item.unidade || '').trim(),
              quantidade: item.quantidade + qtd
            }
          : item
      );

      const resumoProximo = resumirCarrinho(proximo);
      payloadEvento = {
        ...buildProductEventPayload(produto, {
          quantity: qtd,
          add_mode: 'increase_item',
          source: String(meta?.source || 'catalog').trim() || 'catalog'
        }),
        ...buildCartEventPayload({ itens: proximo, resumo: resumoProximo })
      };

      return proximo;
    });

    if (payloadEvento) {
      captureCommerceEvent('add_to_cart', payloadEvento);
    }
  }

  function updateItemQuantity(id, quantidade) {
    const qtd = Math.max(1, Number(quantidade || 1));
    setItens((atual) =>
      atual.map((item) =>
        item.id === Number(id)
          ? { ...item, quantidade: qtd }
          : item
      )
    );
  }

  function removeItem(id) {
    setItens((atual) => atual.filter((item) => item.id !== Number(id)));
  }

  function clearCart() {
    setItens([]);
  }

  const resumo = useMemo(() => {
    return itens.reduce(
      (acc, item) => ({
        itens: acc.itens + item.quantidade,
        total: acc.total + item.preco * item.quantidade
      }),
      { itens: 0, total: 0 }
    );
  }, [itens]);

  const value = useMemo(
    () => ({
      itens,
      resumo,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart
    }),
    [itens, resumo]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de CartProvider');
  }
  return context;
}