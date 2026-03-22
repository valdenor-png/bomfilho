/**
 * Componentes de seleção e resumo de pagamento — extraídos de PagamentoPage.
 */
import React from 'react';
import { formatarMoeda } from '../../lib/checkoutUtils';

export function PaymentMethodCard({
  icon,
  title,
  headline,
  details,
  selecionado,
  onSelect,
  disabled = false
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      className={`payment-method-card ${selecionado ? 'is-selected' : ''}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <div className="payment-method-card-head">
        <p className="payment-method-title-row">
          <span className="payment-method-icon" aria-hidden="true">{icon}</span>
          <span className="payment-method-title">{title}</span>
          {selecionado ? <span className="payment-method-badge">Selecionado</span> : null}
        </p>
        {selecionado ? <span className="payment-method-check" aria-hidden="true">✓</span> : null}
      </div>

      <p className="payment-method-headline">{headline}</p>

      {selecionado ? (
        <ul className="payment-method-list">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}

export function PaymentSelectionSummary({ title, description }) {
  return (
    <article className="payment-selection-summary" aria-label="Resumo da forma de pagamento selecionada">
      <div className="payment-selection-summary-head">
        <p className="payment-selection-summary-kicker">Forma selecionada</p>
        <h3>{title}</h3>
      </div>

      {description.map((line) => (
        <p className="payment-selection-summary-line" key={line}>{line}</p>
      ))}
    </article>
  );
}

export function PaymentOrderSummary({ itens, subtotal, frete, taxaServico = 0, total, metodo, tipoEntrega = 'entrega', economiaFrete = 0, className = '' }) {
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';

  return (
    <aside className={`payment-order-summary ${className}`.trim()} aria-label="Resumo financeiro da etapa de pagamento">
      <h3>Resumo</h3>

      <div className="payment-order-summary-row">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Entrega</span>
        <strong>{frete === null ? 'A calcular' : retirada ? 'Grátis' : formatarMoeda(frete)}</strong>
      </div>

      <div className="payment-order-summary-divider" aria-hidden="true" />

      <div className="payment-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}

export function TaxIdInput({ value, onChange, onBlur, requiredError, invalidError, validFeedback }) {
  const feedbackTone = requiredError || invalidError ? 'is-error' : validFeedback ? 'is-valid' : 'is-neutral';
  const feedbackText = requiredError
    ? 'Campo obrigatório para concluir o pagamento.'
    : invalidError
      ? 'Documento inválido. Digite CPF com 11 dígitos ou CNPJ com 14 dígitos.'
      : validFeedback
        ? 'Documento válido para processar o pagamento.'
          : 'Obrigatório para pagamentos via PIX e cartão no Mercado Pago.';

  return (
    <div className={`payment-taxid ${feedbackTone}`.trim()}>
      <label htmlFor="documento-pagador" className="payment-taxid-label">
        CPF/CNPJ do pagador
      </label>

      <input
        id="documento-pagador"
        className="field-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00 ou 00.000.000/0000-00"
        maxLength={18}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={requiredError || invalidError ? 'true' : undefined}
      />

      <p className={`payment-taxid-feedback ${feedbackTone}`.trim()} role={requiredError || invalidError ? 'alert' : 'status'}>
        {feedbackText}
      </p>
    </div>
  );
}
