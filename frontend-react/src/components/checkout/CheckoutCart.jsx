/**
 * Componentes de carrinho e resumo do checkout — extraídos de PagamentoPage.
 */
import React, { useState } from 'react';
import SmartImage from '../ui/SmartImage';
import { formatarMoeda } from '../../lib/checkoutUtils';

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove
}) {
  const quantidade = Math.max(1, Number(item?.quantidade || 1));
  const precoUnitario = Number(item?.preco || 0);
  const subtotal = Number((precoUnitario * quantidade).toFixed(2));
  const imagem = String(item?.imagem || '').trim();
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const exibirImagem = Boolean(imagem) && !imagemFalhou;

  return (
    <article className="cart-item-row" aria-label={`Item ${item.nome}`}>
      <div className="cart-item-media" aria-hidden="true">
        {exibirImagem ? (
          <SmartImage
            src={imagem}
            alt=""
            className="cart-item-image"
            loading="lazy"
            onError={() => setImagemFalhou(true)}
          />
        ) : (
          <span className="cart-item-emoji" aria-hidden="true">{item.emoji || '📦'}</span>
        )}
      </div>

      <div className="cart-item-main">
        <p className="cart-item-name">{item.nome}</p>
        <p className="cart-item-unitary"><strong>{formatarMoeda(precoUnitario)}</strong></p>
      </div>

      <div className="cart-item-qty" aria-label={`Quantidade de ${item.nome}`}>
        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => onUpdateQuantity(item.id, Math.max(1, quantidade - 1))}
          disabled={quantidade <= 1}
          aria-label={`Diminuir quantidade de ${item.nome}`}
        >
          -
        </button>

        <span className="cart-item-qty-value" aria-live="polite" aria-atomic="true">{quantidade}</span>

        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => onUpdateQuantity(item.id, quantidade + 1)}
          aria-label={`Aumentar quantidade de ${item.nome}`}
        >
          +
        </button>
      </div>

      <div className="cart-item-subtotal">
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <button
        type="button"
        className="cart-item-remove-btn"
        onClick={() => onRemove(item.id)}
        aria-label={`Remover ${item.nome} do carrinho`}
      >
        Remover
      </button>
    </article>
  );
}

export function CheckoutSummaryCard({
  subtotal,
  taxaServico = 0,
  tipoEntrega = 'entrega',
  economiaFrete = 0,
  onContinue,
  disabled
}) {
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';
  const taxaServicoNumerico = Number(taxaServico || 0);
  const totalPrevisto = Number((Number(subtotal || 0) + taxaServicoNumerico).toFixed(2));

  return (
    <aside className="checkout-cart-summary-card" aria-label="Resumo da etapa de carrinho">
      <h3>Resumo</h3>

      <div className="checkout-cart-summary-row">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Frete</span>
        <strong>{retirada ? 'Grátis' : 'Na entrega'}</strong>
      </div>

      <div className="checkout-cart-summary-divider" aria-hidden="true" />

      <div className="checkout-cart-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(totalPrevisto)}</strong>
      </div>

      <button
        className="btn-primary checkout-cart-summary-btn checkout-cart-summary-btn-desktop"
        type="button"
        onClick={onContinue}
        disabled={disabled}
      >
        Ir para entrega
      </button>

      {disabled ? <p className="checkout-cart-summary-note">Adicione itens para continuar</p> : null}
    </aside>
  );
}

export function CheckoutCrossSellRail({
  title = 'Pode combinar com isso 👀',
  subtitle = 'Que tal adicionar também?',
  produtos = [],
  carregando = false,
  onAdd
}) {
  if (!carregando && !produtos.length) {
    return null;
  }

  return (
    <section className="checkout-cross-sell" aria-label="Sugestões para complementar a compra">
      <div className="checkout-cross-sell-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      <div className="checkout-cross-sell-rail" role="list">
        {carregando ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <article key={`skeleton-${idx}`} className="checkout-cross-sell-card is-loading" role="listitem" aria-hidden="true" />
          ))
        ) : produtos.map((produto) => (
          <article key={produto.id} className="checkout-cross-sell-card" role="listitem">
            <div className="checkout-cross-sell-media" aria-hidden="true">
              {produto.imagem ? (
                <SmartImage src={produto.imagem} alt="" className="checkout-cross-sell-image" loading="lazy" />
              ) : (
                <span className="checkout-cross-sell-emoji">{produto.emoji || '🛍️'}</span>
              )}
            </div>

            <p className="checkout-cross-sell-name">{produto.nome}</p>
            <strong className="checkout-cross-sell-price">{formatarMoeda(produto.preco)}</strong>

            <button
              type="button"
              className="checkout-cross-sell-add-btn"
              onClick={() => onAdd(produto)}
              aria-label={`Adicionar ${produto.nome}`}
            >
              +
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OrderSummaryCard({
  itens,
  subtotal,
  frete,
  taxaServico = 0,
  total,
  tipoEntrega = 'entrega',
  economiaFrete = 0,
  veiculoLabel,
  className = ''
}) {
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';

  return (
    <aside className={`checkout-order-summary ${className}`.trim()} aria-label="Resumo do pedido">
      <h3>Resumo</h3>

      <div className="checkout-order-summary-row">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : retirada ? 'Grátis' : formatarMoeda(frete)}</strong>
      </div>

      <div className="checkout-order-summary-divider" aria-hidden="true" />

      <div className="checkout-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}
