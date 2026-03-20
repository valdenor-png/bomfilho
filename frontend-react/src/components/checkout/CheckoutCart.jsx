/**
 * Componentes de carrinho e resumo do checkout — extraídos de PagamentoPage.
 */
import React, { useState } from 'react';
import SmartImage from '../ui/SmartImage';
import { formatarMoeda, formatarQuantidadeItens } from '../../lib/checkoutUtils';

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove
}) {
  const quantidade = Math.max(1, Number(item?.quantidade || 1));
  const precoUnitario = Number(item?.preco || 0);
  const subtotal = Number((precoUnitario * quantidade).toFixed(2));
  const imagem = String(item?.imagem || '').trim();
  const categoria = String(item?.categoria || '').trim();
  const unidade = String(item?.unidade || '').trim();
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const exibirImagem = Boolean(imagem) && !imagemFalhou;

  const unidadeLabel = unidade
    ? unidade.toLowerCase() === 'un'
      ? 'Unidade'
      : unidade
    : '';

  const meta = [categoria, unidadeLabel].filter(Boolean).join(' • ');

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
        <p className="cart-item-meta">{meta || 'Produto selecionado para o pedido'}</p>
        <p className="cart-item-unitary">
          Unitário: <strong>{formatarMoeda(precoUnitario)}</strong>
        </p>
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

        <input
          className="cart-item-qty-input"
          type="number"
          min="1"
          value={quantidade}
          onChange={(event) => {
            const digits = String(event.target.value || '').replace(/\D/g, '');
            const proximaQuantidade = Number.parseInt(digits || '1', 10);
            onUpdateQuantity(item.id, Math.max(1, Number.isFinite(proximaQuantidade) ? proximaQuantidade : 1));
          }}
          aria-label={`Quantidade de ${item.nome}`}
        />

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
        <span>Subtotal</span>
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
  itens,
  produtosDistintos,
  subtotal,
  taxaServico = 0,
  tipoEntrega = 'entrega',
  economiaFrete = 0,
  onContinue,
  onClearCart,
  disabled
}) {
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';
  const taxaServicoNumerico = Number(taxaServico || 0);
  const totalPrevisto = Number((Number(subtotal || 0) + taxaServicoNumerico).toFixed(2));

  return (
    <aside className="checkout-cart-summary-card" aria-label="Resumo da etapa de carrinho">
      <p className="checkout-cart-summary-kicker">Resumo do carrinho</p>
      <h3>Revisão da compra</h3>

      <div className="checkout-cart-summary-row">
        <span>Itens</span>
        <strong>{formatarQuantidadeItens(itens)}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Produtos diferentes</span>
        <strong>{produtosDistintos}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Frete</span>
        <strong>{retirada ? 'Sem frete' : 'Calculado na etapa de entrega'}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Taxa de servico (3%)</span>
        <strong>{formatarMoeda(taxaServicoNumerico)}</strong>
      </div>

      {retirada ? (
        <div className="checkout-cart-summary-row is-savings">
          <span>Economia no frete</span>
          <strong>{Number(economiaFrete || 0) > 0 ? formatarMoeda(economiaFrete) : 'Sem custo adicional'}</strong>
        </div>
      ) : null}

      <div className="checkout-cart-summary-divider" aria-hidden="true" />

      <div className="checkout-cart-summary-row is-total">
        <span>Total previsto</span>
        <strong>{formatarMoeda(totalPrevisto)}</strong>
      </div>

      <button
        className="btn-primary checkout-cart-summary-btn"
        type="button"
        onClick={onContinue}
        disabled={disabled}
      >
        Continuar para entrega • {formatarMoeda(totalPrevisto)}
      </button>

      <button
        className="btn-secondary checkout-cart-summary-clear-btn"
        type="button"
        onClick={onClearCart}
        disabled={disabled}
      >
        Esvaziar carrinho
      </button>

      <p className="checkout-cart-summary-note">Você só confirma o pagamento nas próximas etapas. Frete e prazo aparecem na entrega.</p>
    </aside>
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
  const itensExibicao = Number.isFinite(Number(itens))
    ? formatarQuantidadeItens(Number(itens))
    : itens;
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';

  return (
    <aside className={`checkout-order-summary ${className}`.trim()} aria-label="Resumo do pedido">
      <p className="checkout-order-summary-kicker">Resumo do pedido</p>
      <h3>Total da compra</h3>

      <div className="checkout-order-summary-row">
        <span>Itens</span>
        <strong>{itensExibicao}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Produtos</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : retirada ? 'Sem frete' : formatarMoeda(frete)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Atendimento</span>
        <strong>{veiculoLabel}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Taxa de servico (3%)</span>
        <strong>{formatarMoeda(Number(taxaServico || 0))}</strong>
      </div>

      {retirada ? (
        <div className="checkout-order-summary-row is-savings">
          <span>Economia no frete</span>
          <strong>{Number(economiaFrete || 0) > 0 ? formatarMoeda(economiaFrete) : 'Sem custo adicional'}</strong>
        </div>
      ) : null}

      <div className="checkout-order-summary-divider" aria-hidden="true" />

      <div className="checkout-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}
