/**
 * Componentes de seleção e resumo de pagamento — extraídos de PagamentoPage.
 */
import React from 'react';
import { formatarMoeda } from '../../lib/checkoutUtils';

function PaymentMethodGlyph({ icon }) {
  const key = String(icon || '').trim().toLowerCase();

  if (key === 'pix') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label="PIX" focusable="false">
        <path d="M7.5 5.5a2.5 2.5 0 0 1 3.54 0L12 6.46l.96-.96a2.5 2.5 0 0 1 3.54 3.54L15.54 10l.96.96a2.5 2.5 0 0 1-3.54 3.54L12 13.54l-.96.96a2.5 2.5 0 0 1-3.54-3.54L8.46 10l-.96-.96a2.5 2.5 0 0 1 0-3.54Z" fill="currentColor" />
      </svg>
    );
  }

  if (key === 'debit-card' || key === 'credit-card') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label={key === 'debit-card' ? 'Cartão de débito' : 'Cartão de crédito'} focusable="false">
        <rect x="3" y="5" width="18" height="14" rx="2.2" ry="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="3" y="8.2" width="18" height="2.4" fill="currentColor" />
        {key === 'credit-card' ? <circle cx="8.2" cy="15.3" r="1.4" fill="currentColor" /> : <rect x="6.8" y="14.2" width="3" height="2.2" rx="0.5" fill="currentColor" />}
      </svg>
    );
  }

  return <span>{String(icon || '').trim() || 'P'}</span>;
}

export function PaymentMethodCard({
  icon,
  title,
  headline,
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
          <span className="payment-method-icon" aria-hidden="true">
            <PaymentMethodGlyph icon={icon} />
          </span>
          <span className="payment-method-title">{title}</span>
          {selecionado ? <span className="payment-method-badge">Ativo</span> : null}
        </p>
        {selecionado ? <span className="payment-method-check" aria-hidden="true">OK</span> : null}
      </div>

      <p className="payment-method-headline">{headline}</p>
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
  const taxaServicoNumero = Number(taxaServico || 0);

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

      {taxaServicoNumero > 0 ? (
        <div className="payment-order-summary-row">
          <span>Taxa de serviço</span>
          <strong>{formatarMoeda(taxaServicoNumero)}</strong>
        </div>
      ) : null}

      <div className="payment-order-summary-divider" aria-hidden="true" />

      <div className="payment-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>

      <p className="payment-order-summary-meta">Pagamento por {metodo}</p>
    </aside>
  );
}

export function TaxIdInput({
  value,
  onChange,
  onBlur,
  requiredError,
  invalidError,
  validFeedback,
  id = 'documento-pagador',
  label = 'CPF/CNPJ do pagador',
  placeholder = '000.000.000-00 ou 00.000.000/0000-00',
  helperText = 'Obrigatório para pagamentos via PIX e cartão no Mercado Pago.',
  requiredMessage = 'Campo obrigatório para concluir o pagamento.',
  invalidMessage = 'Documento inválido. Digite CPF com 11 dígitos ou CNPJ com 14 dígitos.',
  validMessage = 'Documento válido para processar o pagamento.'
}) {
  const feedbackTone = requiredError || invalidError ? 'is-error' : validFeedback ? 'is-valid' : 'is-neutral';
  const feedbackText = requiredError
    ? requiredMessage
    : invalidError
      ? invalidMessage
      : validFeedback
        ? validMessage
        : helperText;

  return (
    <div className={`payment-taxid ${feedbackTone}`.trim()}>
      <label htmlFor={id} className="payment-taxid-label">
        {label}
      </label>

      <input
        id={id}
        className="field-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
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
