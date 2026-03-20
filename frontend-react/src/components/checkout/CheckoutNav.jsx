/**
 * Componentes de navegação do checkout — extraídos de PagamentoPage.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { CHECKOUT_STEPS } from '../../lib/checkoutUtils';

export function BotaoVoltarSeta({ onClick, label, disabled = false, text = '', className = '' }) {
  return (
    <button
      className={`btn-secondary entrega-voltar-carrinho-btn ${text ? 'has-text' : ''} ${className}`.trim()}
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text ? <span className="entrega-voltar-label">{text}</span> : null}
    </button>
  );
}

export function LinkVoltarSeta({ to, label, text = '', className = '' }) {
  return (
    <Link
      to={to}
      className={`btn-secondary entrega-voltar-carrinho-btn ${text ? 'has-text' : ''} ${className}`.trim()}
      aria-label={label}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text ? <span className="entrega-voltar-label">{text}</span> : null}
    </Link>
  );
}

export function CheckoutStepper({ currentIndex }) {
  return (
    <ol className="checkout-steps" aria-label="Etapas do checkout">
      {CHECKOUT_STEPS.map((titulo, index) => {
        const estado = index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li
            key={titulo}
            className={`checkout-step is-${estado}`}
            aria-current={estado === 'current' ? 'step' : undefined}
          >
            <span className="checkout-step-index" aria-hidden="true">
              {estado === 'completed' ? '✓' : index + 1}
            </span>
            <span className="checkout-step-label">{titulo}</span>
          </li>
        );
      })}
    </ol>
  );
}
