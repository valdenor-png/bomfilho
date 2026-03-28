import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarMoeda } from '../lib/checkoutUtils';

function formatarQuantidade(itens) {
  const total = Number(itens || 0);
  if (total === 1) {
    return '1 item';
  }
  return `${total} itens`;
}

export default function GlobalCartBar({
  visible,
  resumo,
  isCheckoutRoute,
  hasBottomNav = false,
  checkoutContext,
  onCheckoutPrimaryAction,
  onCheckoutSecondaryAction
}) {
  const navigate = useNavigate();

  const temItensNoCarrinho = Number(resumo?.itens || 0) > 0;
  const checkoutAtivo = isCheckoutRoute && checkoutContext;

  if (!visible || (!temItensNoCarrinho && !checkoutAtivo)) {
    return null;
  }

  const totalLabel = temItensNoCarrinho
    ? formatarMoeda(Number(resumo?.total || 0))
    : (checkoutAtivo ? String(checkoutContext?.totalLabel || '').trim() : '');
  const itensLabel = temItensNoCarrinho
    ? formatarQuantidade(resumo?.itens)
    : (checkoutAtivo ? String(checkoutContext?.stepLabel || '').trim() : '');

  const ctaLabel = isCheckoutRoute
    ? String(checkoutContext?.primaryLabel || 'Continuar pedido').trim()
    : 'Ver carrinho';

  const disabled = isCheckoutRoute && Boolean(checkoutContext?.primaryDisabled);
  const secondaryLabel = isCheckoutRoute ? String(checkoutContext?.secondaryLabel || '').trim() : '';
  const secondaryDisabled = isCheckoutRoute && Boolean(checkoutContext?.secondaryDisabled);

  return (
    <div className={`global-cart-bar-wrapper ${hasBottomNav ? 'is-with-bottom-nav' : ''}`}>
      <div className="global-cart-bar" role="region" aria-label="Resumo rápido do carrinho">
        <div className="global-cart-bar-info">
          <span className="global-cart-bar-kicker font-sora">{itensLabel}</span>
          <strong className="global-cart-bar-total font-sora">{totalLabel}</strong>
        </div>

        <div className="global-cart-bar-actions">
          {secondaryLabel ? (
            <button
              type="button"
              className="global-cart-bar-secondary"
              disabled={secondaryDisabled}
              onClick={onCheckoutSecondaryAction}
            >
              {secondaryLabel}
            </button>
          ) : null}

          <button
            type="button"
            className="global-cart-bar-cta"
            disabled={disabled}
            onClick={() => {
              if (isCheckoutRoute) {
                onCheckoutPrimaryAction();
                return;
              }
              navigate('/pagamento');
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
