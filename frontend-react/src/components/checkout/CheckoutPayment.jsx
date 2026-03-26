/**
 * Componentes de seleção e resumo de pagamento extraídos de PagamentoPage.
 */
import React from 'react';
import { Icon } from '../../icons';
import { formatarMoeda } from '../../lib/checkoutUtils';

const PAYMENT_METHOD_ICON_NAMES = Object.freeze({
  pix: 'IconPix',
  'credit-card': 'IconCreditCard',
  'debit-card': 'IconDebitCard'
});

function toSafeText(value) {
  return String(value || '').trim();
}

function resolvePaymentMethodIconName(icon) {
  const raw = toSafeText(icon);
  const key = raw.toLowerCase();
  if (!key) {
    return 'IconInfo';
  }

  if (PAYMENT_METHOD_ICON_NAMES[key]) {
    return PAYMENT_METHOD_ICON_NAMES[key];
  }

  // Aceita nome de icone direto quando vier da API/admin.
  if (raw.startsWith('Icon')) {
    return raw;
  }

  return 'IconInfo';
}

function PaymentMethodGlyph({ icon }) {
  if (typeof Icon !== 'function') {
    return null;
  }

  const iconName = resolvePaymentMethodIconName(icon);
  return <Icon name={iconName} size={18} strokeWidth={1.9} />;
}

export function PaymentMethodCard({
  method,
  item,
  paymentMethod,
  id,
  label,
  icon,
  title,
  headline,
  selected,
  selecionado,
  onSelect,
  disabled = false
}) {
  const sourceMethod = [method, item, paymentMethod].find((candidate) => candidate && typeof candidate === 'object') || {};
  const resolvedId = toSafeText(id || sourceMethod.id || sourceMethod.key || sourceMethod.value);
  const resolvedTitle = toSafeText(title || label || sourceMethod.label || sourceMethod.title) || 'Método de pagamento';
  const resolvedHeadline = toSafeText(headline || sourceMethod.headline || sourceMethod.description);
  const resolvedIcon = toSafeText(icon || sourceMethod.icon);
  const isSelected = Boolean(selected ?? selecionado ?? sourceMethod.selected);
  const isDisabled = Boolean(disabled || sourceMethod.disabled);
  const isSelectable = typeof onSelect === 'function';
  const handleSelect = () => {
    if (!isSelectable || isDisabled) {
      return;
    }

    if (resolvedId) {
      onSelect(resolvedId);
      return;
    }

    onSelect();
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      className={`payment-method-card ${isSelected ? 'is-selected' : ''}`}
      onClick={() => handleSelect()}
      disabled={isDisabled || !isSelectable}
    >
      <div className="payment-method-card-head">
        <p className="payment-method-title-row">
          <span className="payment-method-icon" aria-hidden="true">
            <PaymentMethodGlyph icon={resolvedIcon} />
          </span>
          <span className="payment-method-title">{resolvedTitle}</span>
          {isSelected ? <span className="payment-method-badge">Ativo</span> : null}
        </p>
        {isSelected ? <span className="payment-method-check" aria-hidden="true">OK</span> : null}
      </div>

      {resolvedHeadline ? <p className="payment-method-headline">{resolvedHeadline}</p> : null}
    </button>
  );
}

export function PaymentSelectionSummary({ title, description }) {
  const linhasDescricao = Array.isArray(description)
    ? description.map((line) => toSafeText(line)).filter(Boolean)
    : [];

  return (
    <article className="payment-selection-summary" aria-label="Resumo da forma de pagamento selecionada">
      <div className="payment-selection-summary-head">
        <p className="payment-selection-summary-kicker">Forma selecionada</p>
        <h3>{toSafeText(title) || 'Pagamento selecionado'}</h3>
      </div>

      {linhasDescricao.length > 0
        ? linhasDescricao.map((line) => (
          <p className="payment-selection-summary-line" key={line}>{line}</p>
        ))
        : <p className="payment-selection-summary-line">Revise os dados antes de confirmar.</p>}
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
