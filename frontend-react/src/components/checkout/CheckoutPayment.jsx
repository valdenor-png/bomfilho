/**
 * Componentes de seleção e resumo de pagamento — extraídos de PagamentoPage.
 */
import React from 'react';
import { formatarMoeda, formatarQuantidadeItens } from '../../lib/checkoutUtils';

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
      <ul className="payment-method-list">
        {details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
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
  const itensNumerico = Number(itens);
  const itensExibicao = Number.isFinite(Number(itens))
    ? formatarQuantidadeItens(Number(itens))
    : itens;
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';
  const subtotalNumerico = Number(subtotal || 0);
  const totalNumerico = Number(total || 0);
  const freteNumerico = frete === null ? null : Number(frete || 0);
  const taxaServicoNumerico = Number(taxaServico || 0);
  const valorMedioPorItem = Number.isFinite(itensNumerico) && itensNumerico > 0
    ? Number((totalNumerico / itensNumerico).toFixed(2))
    : null;
  const linhaConferencia = freteNumerico === null
    ? 'Total parcial exibido. O frete sera somado apos a simulacao de entrega.'
    : retirada
      ? `Conferencia: ${formatarMoeda(subtotalNumerico)} + ${formatarMoeda(taxaServicoNumerico)} (taxa) + sem frete = ${formatarMoeda(totalNumerico)}.`
      : `Conferencia: ${formatarMoeda(subtotalNumerico)} + ${formatarMoeda(taxaServicoNumerico)} (taxa) + ${formatarMoeda(freteNumerico)} = ${formatarMoeda(totalNumerico)}.`;

  return (
    <aside className={`payment-order-summary ${className}`.trim()} aria-label="Resumo financeiro da etapa de pagamento">
      <p className="payment-order-summary-kicker">Resumo do pedido</p>
      <h3>Quanto você vai pagar</h3>

      <div className="payment-order-summary-row">
        <span>Itens</span>
        <strong>{itensExibicao}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Produtos</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : retirada ? 'Sem frete' : formatarMoeda(frete)}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Taxa de servico (3%)</span>
        <strong>{formatarMoeda(taxaServicoNumerico)}</strong>
      </div>

      {valorMedioPorItem !== null ? (
        <div className="payment-order-summary-row is-average">
          <span>Media por item</span>
          <strong>{formatarMoeda(valorMedioPorItem)}</strong>
        </div>
      ) : null}

      {retirada ? (
        <div className="payment-order-summary-row is-savings">
          <span>Economia no frete</span>
          <strong>{Number(economiaFrete || 0) > 0 ? formatarMoeda(economiaFrete) : 'Sem custo adicional'}</strong>
        </div>
      ) : null}

      <div className="payment-order-summary-row">
        <span>Pagamento</span>
        <strong>{metodo}</strong>
      </div>

      <div className="payment-order-summary-divider" aria-hidden="true" />

      <div className="payment-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>

      <p className="payment-order-summary-clarity">{linhaConferencia}</p>
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
        : 'Obrigatório para pagamentos via PIX e cartão no PagBank.';

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
