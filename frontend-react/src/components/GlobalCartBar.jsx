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
  onCheckoutPrimaryAction
}) {
  const navigate = useNavigate();

  if (!visible || Number(resumo?.itens || 0) <= 0) {
    return null;
  }

  const totalLabel = formatarMoeda(Number(resumo?.total || 0));
  const itensLabel = formatarQuantidade(resumo?.itens);

  const ctaLabel = isCheckoutRoute
    ? String(checkoutContext?.primaryLabel || 'Continuar pedido').trim()
    : 'Ver carrinho';

  const caption = isCheckoutRoute
    ? String(checkoutContext?.caption || '').trim()
    : 'Continue de onde parou';

  const disabled = isCheckoutRoute && Boolean(checkoutContext?.primaryDisabled);

  return (
    <div className={`global-cart-bar ${hasBottomNav ? 'is-with-bottom-nav' : ''}`.trim()} role="region" aria-label="Resumo rápido do carrinho">
      <div className="global-cart-bar-meta">
        <p className="global-cart-bar-kicker">{itensLabel}</p>
        <strong className="global-cart-bar-total">{totalLabel}</strong>
        {caption ? <p className="global-cart-bar-caption">{caption}</p> : null}
      </div>

      <button
        type="button"
        className="btn-primary global-cart-bar-cta"
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
  );
}
