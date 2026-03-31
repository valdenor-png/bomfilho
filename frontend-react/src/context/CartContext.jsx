import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCartEventPayload,
  buildProductEventPayload,
  captureCommerceEvent
} from '../lib/commerceTracking';
import {
  buildCartItemKey,
  buildNomeCarrinho,
  calcularSubtotalPeso,
  hasTruthyFlag,
  isItemPeso,
  isProdutoAlcoolico,
  isProdutoVisivelNoCatalogo,
  resolvePesoConfig,
  resolveUnidadeVenda,
  sanitizePesoGramas
} from '../lib/produtoCatalogoRules';
import { useToast } from './ToastContext';

const CART_KEY = 'bomfilho_cart';
const AGE_GATE_KEY = 'bf_alcool_18_confirmado';

const CartContext = createContext(null);

function normalizarQuantidade(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.floor(parsed));
  }
  return 1;
}

function calcularSubtotalItem(item) {
  if (isItemPeso(item)) {
    return calcularSubtotalPeso(item.preco, item.peso_gramas, item.quantidade);
  }

  return Number((Number(item.preco || 0) * normalizarQuantidade(item.quantidade)).toFixed(2));
}

function resumirCarrinho(itens = []) {
  return itens.reduce(
    (acc, item) => ({
      itens: acc.itens + normalizarQuantidade(item?.quantidade || 1),
      total: acc.total + calcularSubtotalItem(item)
    }),
    { itens: 0, total: 0 }
  );
}

function readAgeGateSession() {
  try {
    return sessionStorage.getItem(AGE_GATE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveAgeGateSession(value) {
  try {
    if (value) {
      sessionStorage.setItem(AGE_GATE_KEY, '1');
    } else {
      sessionStorage.removeItem(AGE_GATE_KEY);
    }
  } catch {
    // no-op
  }
}

function normalizeCartItem(rawItem = {}) {
  const id = Number(rawItem?.id || rawItem?.produto_id || 0);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  if (!isProdutoVisivelNoCatalogo(rawItem)) {
    return null;
  }

  const unidadeVenda = resolveUnidadeVenda(rawItem);
  const quantidade = normalizarQuantidade(rawItem?.quantidade || 1);
  const pesoConfig = resolvePesoConfig(rawItem, unidadeVenda);
  const pesoGramas = unidadeVenda === 'peso'
    ? sanitizePesoGramas(rawItem?.peso_gramas, pesoConfig)
    : null;

  const nomeBase = String(rawItem?.nome_base || rawItem?.nome || rawItem?.nome_produto || '').trim() || 'Produto';
  const nome = unidadeVenda === 'peso'
    ? buildNomeCarrinho({ ...rawItem, nome: nomeBase }, unidadeVenda, pesoGramas)
    : nomeBase;

  const cartKey = String(rawItem?.cart_key || '').trim() || buildCartItemKey({
    id,
    unidadeVenda,
    pesoGramas
  });

  const ehAlcoolico = Boolean(isProdutoAlcoolico(rawItem));

  return {
    id,
    cart_key: cartKey,
    nome,
    nome_base: nomeBase,
    preco: Number(rawItem?.preco || 0),
    emoji: String(rawItem?.emoji || ''),
    imagem: String(rawItem?.imagem || rawItem?.imagem_url || '').trim(),
    categoria: String(rawItem?.categoria || '').trim(),
    unidade: String(rawItem?.unidade || '').trim(),
    quantidade,
    unidade_venda: unidadeVenda,
    peso_gramas: pesoGramas,
    peso_min_gramas: pesoConfig.peso_min_gramas,
    peso_step_gramas: pesoConfig.peso_step_gramas,
    peso_padrao_gramas: pesoConfig.peso_padrao_gramas,
    permite_fracionado: hasTruthyFlag(rawItem?.permite_fracionado, true),
    requer_maioridade: hasTruthyFlag(rawItem?.requer_maioridade, ehAlcoolico),
    eh_alcoolico: ehAlcoolico
  };
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
      .map((item) => normalizeCartItem(item))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function itemMatchesTarget(item, target) {
  const targetText = String(target || '').trim();
  if (!targetText) {
    return false;
  }

  if (targetText.includes(':')) {
    return item.cart_key === targetText;
  }

  const id = Number(targetText);
  if (Number.isFinite(id) && id > 0) {
    return item.id === id;
  }

  return false;
}

export function CartProvider({ children }) {
  const [itens, setItens] = useState(() => readCart());
  const [ageGateConfirmado, setAgeGateConfirmado] = useState(() => readAgeGateSession());
  const [pendenciaAlcool, setPendenciaAlcool] = useState(null);
  const toast = useToast();

  // Refs to keep callbacks stable while reading latest values
  const ageGateRef = useRef(ageGateConfirmado);
  ageGateRef.current = ageGateConfirmado;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(itens));
  }, [itens]);

  const addItem = useCallback(function addItem(produto, quantidade = 1, meta = {}) {
    if (!isProdutoVisivelNoCatalogo(produto || {})) {
      toastRef.current.error('Este item nao esta disponivel para venda online.');
      return false;
    }

    const unidadeVenda = resolveUnidadeVenda({ ...produto, unidade_venda: meta?.unidade_venda });
    const pesoConfig = resolvePesoConfig({ ...produto, ...meta }, unidadeVenda);
    const pesoGramas = unidadeVenda === 'peso'
      ? sanitizePesoGramas(meta?.peso_gramas, pesoConfig)
      : null;

    const itemBase = normalizeCartItem({
      ...produto,
      quantidade,
      unidade_venda: unidadeVenda,
      peso_gramas: pesoGramas,
      peso_min_gramas: pesoConfig.peso_min_gramas,
      peso_step_gramas: pesoConfig.peso_step_gramas,
      peso_padrao_gramas: pesoConfig.peso_padrao_gramas,
      permite_fracionado: pesoConfig.permite_fracionado,
      requer_maioridade: meta?.requer_maioridade ?? produto?.requer_maioridade,
      eh_alcoolico: meta?.eh_alcoolico ?? isProdutoAlcoolico(produto)
    });

    if (!itemBase) {
      return false;
    }

    if (itemBase.eh_alcoolico && !ageGateRef.current && !meta?.skipAgeGate) {
      setPendenciaAlcool({ produto, quantidade, meta: { ...meta, peso_gramas: pesoGramas } });
      return false;
    }

    let payloadEvento = null;
    const qtd = normalizarQuantidade(quantidade || 1);

    setItens((atual) => {
      const index = atual.findIndex((item) => item.cart_key === itemBase.cart_key);

      if (index === -1) {
        const proximo = [...atual, itemBase];
        const resumoProximo = resumirCarrinho(proximo);
        payloadEvento = {
          ...buildProductEventPayload(produto, {
            quantity: qtd,
            add_mode: 'new_item',
            source: String(meta?.source || 'catalog').trim() || 'catalog',
            unidade_venda: itemBase.unidade_venda,
            peso_gramas: itemBase.peso_gramas
          }),
          ...buildCartEventPayload({ itens: proximo, resumo: resumoProximo })
        };

        return proximo;
      }

      const proximo = atual.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return normalizeCartItem({
          ...item,
          ...itemBase,
          quantidade: normalizarQuantidade(item.quantidade + qtd)
        });
      });

      const resumoProximo = resumirCarrinho(proximo);
      payloadEvento = {
        ...buildProductEventPayload(produto, {
          quantity: qtd,
          add_mode: 'increase_item',
          source: String(meta?.source || 'catalog').trim() || 'catalog',
          unidade_venda: itemBase.unidade_venda,
          peso_gramas: itemBase.peso_gramas
        }),
        ...buildCartEventPayload({ itens: proximo, resumo: resumoProximo })
      };

      return proximo;
    });

    if (payloadEvento) {
      captureCommerceEvent('add_to_cart', payloadEvento);
    }

    toastRef.current.success(`${itemBase.nome} adicionado ao carrinho`);
    return true;
  }, []);

  const updateItemQuantity = useCallback((itemKeyOrId, quantidade) => {
    const qtd = normalizarQuantidade(quantidade || 1);
    setItens((atual) =>
      atual.map((item) =>
        itemMatchesTarget(item, itemKeyOrId)
          ? { ...item, quantidade: qtd }
          : item
      )
    );
  }, []);

  const updateItemWeight = useCallback((itemKeyOrId, pesoGramas) => {
    setItens((atual) => {
      const index = atual.findIndex((item) => itemMatchesTarget(item, itemKeyOrId));
      if (index === -1) {
        return atual;
      }

      const itemAtual = atual[index];
      if (!isItemPeso(itemAtual)) {
        return atual;
      }

      const config = resolvePesoConfig(itemAtual, 'peso');
      const pesoNovo = sanitizePesoGramas(pesoGramas, config);
      const atualizado = normalizeCartItem({
        ...itemAtual,
        peso_gramas: pesoNovo,
        nome: buildNomeCarrinho(itemAtual, 'peso', pesoNovo)
      });

      if (!atualizado) {
        return atual;
      }

      const indexDuplicado = atual.findIndex((item, idx) => idx !== index && item.cart_key === atualizado.cart_key);
      if (indexDuplicado >= 0) {
        const duplicado = atual[indexDuplicado];
        const merged = normalizeCartItem({
          ...duplicado,
          quantidade: normalizarQuantidade(duplicado.quantidade + atualizado.quantidade)
        });

        return atual
          .filter((_, idx) => idx !== index && idx !== indexDuplicado)
          .concat(merged);
      }

      return atual.map((item, idx) => (idx === index ? atualizado : item));
    });
  }, []);

  const removeItem = useCallback((itemKeyOrId) => {
    setItens((atual) => atual.filter((item) => !itemMatchesTarget(item, itemKeyOrId)));
  }, []);

  const clearCart = useCallback(() => {
    setItens([]);
  }, []);

  const confirmarMaioridadeAlcool = useCallback(() => {
    setAgeGateConfirmado(true);
    saveAgeGateSession(true);
    setPendenciaAlcool((prev) => {
      if (prev) {
        // Schedule addItem on next tick so state is settled
        queueMicrotask(() => {
          addItem(prev.produto, prev.quantidade, {
            ...prev.meta,
            skipAgeGate: true
          });
        });
      }
      return null;
    });
  }, [addItem]);

  const cancelarMaioridadeAlcool = useCallback(() => {
    setPendenciaAlcool(null);
    toastRef.current.info('Adicao de bebida alcoolica cancelada.');
  }, []);

  const resumo = useMemo(() => resumirCarrinho(itens), [itens]);

  const alcoholAgeGate = useMemo(() => ({
    open: Boolean(pendenciaAlcool),
    confirmed: ageGateConfirmado,
    produtoNome: String(pendenciaAlcool?.produto?.nome || '').trim() || 'Bebida alcoolica',
    confirmar: confirmarMaioridadeAlcool,
    cancelar: cancelarMaioridadeAlcool
  }), [ageGateConfirmado, pendenciaAlcool, confirmarMaioridadeAlcool, cancelarMaioridadeAlcool]);

  const value = useMemo(
    () => ({
      itens,
      resumo,
      addItem,
      updateItemQuantity,
      updateItemWeight,
      removeItem,
      clearCart,
      alcoholAgeGate
    }),
    [itens, resumo, addItem, updateItemQuantity, updateItemWeight, removeItem, clearCart, alcoholAgeGate]
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
