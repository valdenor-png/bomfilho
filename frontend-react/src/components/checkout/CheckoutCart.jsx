/**
 * Componentes de carrinho e resumo do checkout - extraidos de PagamentoPage.
 */
import React, { useState } from 'react';
import { AlertTriangle, Package } from '../../icons';
import formatProductName from '../../lib/formatProductName';
import SmartImage from '../ui/SmartImage';
import { formatarMoeda } from '../../lib/checkoutUtils';
import {
  calcularSubtotalPeso,
  formatPesoSelecionado,
  isItemPeso,
  resolvePesoConfig,
  sanitizePesoGramas
} from '../../lib/produtoCatalogoRules';

export function CartItemRow({
  item,
  onUpdateQuantity,
  onUpdateWeight,
  onRemove,
  warningMessage = ''
}) {
  const atualizarQuantidade = typeof onUpdateQuantity === 'function' ? onUpdateQuantity : () => {};
  const atualizarPeso = typeof onUpdateWeight === 'function' ? onUpdateWeight : () => {};
  const removerItem = typeof onRemove === 'function' ? onRemove : () => {};
  const quantidade = Math.max(1, Number(item?.quantidade || 1));
  const precoUnitario = Number(item?.preco || 0);
  const itemPeso = isItemPeso(item);
  const pesoConfig = itemPeso ? resolvePesoConfig(item, 'peso') : null;
  const pesoSelecionado = itemPeso
    ? sanitizePesoGramas(item?.peso_gramas, pesoConfig)
    : null;
  const subtotal = itemPeso
    ? calcularSubtotalPeso(precoUnitario, pesoSelecionado, quantidade)
    : Number((precoUnitario * quantidade).toFixed(2));
  const imagem = String(item?.imagem || '').trim();
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const exibirImagem = Boolean(imagem) && !imagemFalhou;
  const itemKey = String(item?.cart_key || item?.id || '').trim();
  const warningId = `cart-item-warning-${itemKey.replace(/[^a-z0-9_-]/gi, '-') || 'item'}`;
  const unidadeLabel = itemPeso
    ? `${formatarMoeda(precoUnitario)}/kg`
    : formatarMoeda(precoUnitario);

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
          <span className="cart-item-emoji" aria-hidden="true">
            <Package size={18} />
          </span>
        )}
      </div>

      <div className="cart-item-main">
        <p className="cart-item-name">{formatProductName(item.nome)}</p>
        {warningMessage ? (
          <div className="cart-item-warning-wrap">
            <button
              type="button"
              className="cart-item-warning-trigger"
              aria-label="Aviso de entrega para este item"
              aria-expanded={warningOpen}
              aria-describedby={warningOpen ? warningId : undefined}
              title={warningMessage}
              onMouseEnter={() => setWarningOpen(true)}
              onMouseLeave={() => setWarningOpen(false)}
              onFocus={() => setWarningOpen(true)}
              onBlur={() => setWarningOpen(false)}
              onClick={() => setWarningOpen((current) => !current)}
            >
              <AlertTriangle size={14} aria-hidden="true" />
            </button>

            <div
              id={warningId}
              role="tooltip"
              className={`cart-item-warning-popover${warningOpen ? ' is-visible' : ''}`}
            >
              {warningMessage}
            </div>
          </div>
        ) : null}

        <p className="cart-item-unitary"><strong>{unidadeLabel}</strong></p>

        {itemPeso ? (
          <div className="cart-item-weight-control">
            <button
              type="button"
              className="cart-item-weight-btn"
              onClick={() => atualizarPeso(itemKey, Math.max(pesoConfig?.peso_min_gramas || 1, Number(pesoSelecionado || 0) - Number(pesoConfig?.peso_step_gramas || 1)))}
              aria-label={`Diminuir gramagem de ${item.nome}`}
              disabled={Number(pesoSelecionado || 0) <= Number(pesoConfig?.peso_min_gramas || 1)}
            >
              -
            </button>

            <input
              type="number"
              className="cart-item-weight-input"
              min={Number(pesoConfig?.peso_min_gramas || 1)}
              step={Number(pesoConfig?.peso_step_gramas || 1)}
              inputMode="numeric"
              value={String(pesoSelecionado || '')}
              onChange={(event) => {
                const digits = String(event.target.value || '').replace(/\D/g, '');
                if (!digits) {
                  atualizarPeso(itemKey, Number(pesoConfig?.peso_min_gramas || 1));
                  return;
                }
                atualizarPeso(itemKey, Number(digits));
              }}
              aria-label={`Peso em gramas para ${item.nome}`}
            />

            <button
              type="button"
              className="cart-item-weight-btn"
              onClick={() => atualizarPeso(itemKey, Number(pesoSelecionado || 0) + Number(pesoConfig?.peso_step_gramas || 1))}
              aria-label={`Aumentar gramagem de ${item.nome}`}
            >
              +
            </button>

            <span className="cart-item-weight-label">{formatPesoSelecionado(pesoSelecionado)}</span>
          </div>
        ) : null}
      </div>

      <div className="cart-item-qty" aria-label={`Quantidade de ${item.nome}`}>
        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => atualizarQuantidade(itemKey, Math.max(1, quantidade - 1))}
          disabled={quantidade <= 1}
          aria-label={`Diminuir quantidade de ${item.nome}`}
        >
          -
        </button>

        <span className="cart-item-qty-value" aria-live="polite" aria-atomic="true">{quantidade}</span>

        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => atualizarQuantidade(itemKey, quantidade + 1)}
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
        onClick={() => removerItem(itemKey)}
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
  disabled,
  showContinueButton = true
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
        <strong>{retirada ? 'Gratis' : 'Na entrega'}</strong>
      </div>

      <div className="checkout-cart-summary-divider" aria-hidden="true" />

      <div className="checkout-cart-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(totalPrevisto)}</strong>
      </div>

      {showContinueButton ? (
        <button
          className="btn-primary checkout-cart-summary-btn checkout-cart-summary-btn-desktop"
          type="button"
          onClick={onContinue}
          disabled={disabled}
        >
          Ir para entrega
        </button>
      ) : null}

      {disabled ? <p className="checkout-cart-summary-note">Adicione itens para continuar</p> : null}
    </aside>
  );
}

export function CheckoutCrossSellRail({
  title = 'Pode combinar com isso',
  subtitle = 'Que tal adicionar tambem?',
  produtos = [],
  carregando = false,
  alwaysVisible = false,
  onAdd
}) {
  const listaProdutos = Array.isArray(produtos) ? produtos : [];
  const onAddProduto = typeof onAdd === 'function' ? onAdd : () => {};

  if (!alwaysVisible && !carregando && !listaProdutos.length) {
    return null;
  }

  return (
    <section className="checkout-cross-sell" aria-label="Sugestoes para complementar a compra">
      <div className="checkout-cross-sell-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      <div className="checkout-cross-sell-rail" role="list">
        {carregando ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <article key={`skeleton-${idx}`} className="checkout-cross-sell-card is-loading" role="listitem" aria-hidden="true" />
          ))
        ) : listaProdutos.length ? (
          listaProdutos.map((produto) => (
            <article key={produto.id} className="checkout-cross-sell-card" role="listitem">
              <div className="checkout-cross-sell-media" aria-hidden="true">
                {produto.imagem ? (
                  <SmartImage src={produto.imagem} alt="" className="checkout-cross-sell-image" loading="lazy" />
                ) : (
                  <span className="checkout-cross-sell-placeholder" aria-hidden="true">
                    <Package size={18} strokeWidth={2} />
                  </span>
                )}
              </div>

              {Number.isFinite(Number(produto?.estoque)) ? (
                <span className={`checkout-cross-sell-stock ${Number(produto.estoque) > 0 ? 'is-in-stock' : 'is-low-stock'}`.trim()}>
                  {Number(produto.estoque) > 0 ? 'Em estoque' : 'Estoque baixo'}
                </span>
              ) : null}

              <p className="checkout-cross-sell-name">{produto.nome}</p>
              <strong className="checkout-cross-sell-price">{formatarMoeda(produto.preco)}</strong>

              <button
                type="button"
                className="checkout-cross-sell-add-btn"
                onClick={() => onAddProduto(produto)}
                aria-label={`Adicionar ${produto.nome}`}
              >
                Adicionar
              </button>
            </article>
          ))
        ) : (
          <article className="checkout-cross-sell-card checkout-cross-sell-card-empty" role="listitem">
            <div className="checkout-cross-sell-media" aria-hidden="true">
              <span className="checkout-cross-sell-placeholder" aria-hidden="true">
                <Package size={18} strokeWidth={2} />
              </span>
            </div>
            <p className="checkout-cross-sell-name">Buscando opcoes para completar sua compra...</p>
          </article>
        )}
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
        <strong>{frete === null ? 'A calcular' : retirada ? 'Gratis' : formatarMoeda(frete)}</strong>
      </div>

      <div className="checkout-order-summary-divider" aria-hidden="true" />

      <div className="checkout-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}
