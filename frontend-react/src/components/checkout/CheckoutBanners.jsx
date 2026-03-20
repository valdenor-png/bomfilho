/**
 * Banners e barras de ação do checkout — extraídos de PagamentoPage.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { formatarMoeda } from '../../lib/checkoutUtils';

export function CheckoutContextBanner({ tone = 'neutral', title, description, chips = [] }) {
  return (
    <article
      className={`checkout-context-banner is-${tone}`.trim()}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className="checkout-context-title">{title}</p>
      <p className="checkout-context-description">{description}</p>

      {chips.length > 0 ? (
        <ul className="checkout-context-chips" aria-label="Orientações rápidas desta etapa">
          {chips.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function CheckoutGuidanceChips({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <ul className="checkout-guidance-chips" aria-label="Passos recomendados">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function CheckoutMobileActionBar({
  visible,
  stepLabel,
  totalLabel,
  caption,
  primaryLabel,
  onPrimaryClick,
  primaryDisabled = false,
  secondaryLabel = '',
  secondaryTo = '',
  onSecondaryClick,
  secondaryDisabled = false
}) {
  if (!visible || !primaryLabel) {
    return null;
  }

  return (
    <div className="checkout-mobile-action-bar" aria-label="Ações rápidas da etapa atual">
      <div className="checkout-mobile-action-meta">
        <p className="checkout-mobile-action-step">{stepLabel}</p>
        <strong className="checkout-mobile-action-total">{totalLabel}</strong>
        {caption ? <p className="checkout-mobile-action-caption">{caption}</p> : null}
      </div>

      <div className="checkout-mobile-action-buttons">
        {secondaryLabel ? (
          secondaryTo ? (
            <Link className="btn-secondary checkout-mobile-secondary-btn" to={secondaryTo}>
              {secondaryLabel}
            </Link>
          ) : (
            <button
              className="btn-secondary checkout-mobile-secondary-btn"
              type="button"
              onClick={onSecondaryClick}
              disabled={secondaryDisabled}
            >
              {secondaryLabel}
            </button>
          )
        ) : null}

        <button
          className="btn-primary checkout-mobile-primary-btn"
          type="button"
          onClick={onPrimaryClick}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

export function CheckoutSecurityTrust({
  formaPagamento = 'pix',
  total = 0,
  frete = null,
  retiradaSelecionada = false,
  recaptchaEnabled = false,
  compact = false
}) {
  const metodoLabel = formaPagamento === 'debito'
    ? 'Cartao de debito'
    : formaPagamento === 'credito'
      ? 'Cartao de credito'
      : 'PIX';

  const linhaFrete = retiradaSelecionada
    ? 'Retirada na loja ativa: sem custo de frete.'
    : frete === null
      ? 'Frete exibido separadamente assim que o CEP for confirmado.'
      : `Frete separado no resumo: ${formatarMoeda(frete)}.`;

  const linhaMetodo = formaPagamento === 'pix'
    ? 'QR Code oficial e codigo copia e cola vinculados ao seu pedido.'
    : 'Dados de cartao protegidos por tokenizacao antes de enviar ao gateway.';

  return (
    <article
      className={`checkout-security-trust ${compact ? 'is-compact' : ''}`.trim()}
      aria-label="Seguranca e clareza de valores no checkout"
    >
      <div className="checkout-security-trust-head">
        <p className="checkout-security-trust-kicker">Confianca no checkout</p>
        <strong>Pagamento protegido e total transparente</strong>
      </div>

      <ul className="checkout-security-trust-list">
        <li>{recaptchaEnabled ? 'Validacao antiabuso ativa nesta etapa.' : 'Ambiente com protecao ativa para finalizacao.'}</li>
        <li>{linhaMetodo}</li>
        <li>{linhaFrete}</li>
      </ul>

      <p className="checkout-security-trust-total">
        Metodo atual: <strong>{metodoLabel}</strong> • Total em revisao: <strong>{formatarMoeda(total)}</strong>
      </p>
    </article>
  );
}
