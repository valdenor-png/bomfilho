/**
 * Componentes de entrega do checkout â€” extraÃ­dos de PagamentoPage.
 */
import React from 'react';
import { CircleCheck, Package, Store } from '../../icons';
import SmartImage from '../ui/SmartImage';
import { formatarMoeda, RETIRADA_LOJA_INFO } from '../../lib/checkoutUtils';

export function DeliveryOptionCard({
  veiculo,
  selecionado,
  recomendado,
  precoLabel,
  disabled = false,
  disabledReason = '',
  onSelect
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      aria-disabled={disabled ? 'true' : undefined}
      className={`delivery-option-card ${selecionado ? 'is-selected' : ''}`}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
    >
      <div className="delivery-option-head">
        <div className="delivery-option-icon-wrap" aria-hidden="true">
          <SmartImage src={veiculo.imagem} alt="" className="delivery-option-icon" loading="lazy" />
        </div>

        <div className="delivery-option-title-wrap">
          <p className="delivery-option-title-row">
            <span className="delivery-option-title">{veiculo.label}</span>
            {recomendado ? <span className="delivery-option-badge">Mais recomendado</span> : null}
          </p>
          <p className="delivery-option-description">{veiculo.descricao}</p>
        </div>

        {selecionado ? (
          <span className="delivery-option-check" aria-hidden="true">
            <CircleCheck size={16} strokeWidth={2.2} />
          </span>
        ) : null}
      </div>

      <p className="delivery-option-price">{precoLabel}</p>
      {disabledReason ? <p className="delivery-option-disabled-reason">{disabledReason}</p> : null}
    </button>
  );
}

export function DeliverySummaryCard({
  veiculoLabel,
  cepDestino,
  distanciaTexto,
  freteTexto,
  totalTexto,
  cepOrigem,
  numeroOrigem
}) {
  return (
    <article className="delivery-summary-card" aria-label="Resumo da entrega selecionada">
      <div className="delivery-summary-card-head">
        <div>
          <p className="delivery-summary-kicker">Entrega selecionada</p>
          <h3>{veiculoLabel}</h3>
        </div>
        <span className="delivery-summary-icon" aria-hidden="true">
          <Package size={18} strokeWidth={2} />
        </span>
      </div>

      <div className="delivery-summary-grid">
        <div>
          <span className="delivery-summary-label">CEP de destino</span>
          <strong>{cepDestino}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">DistÃ¢ncia estimada</span>
          <strong>{distanciaTexto}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Frete</span>
          <strong className="delivery-summary-frete">{freteTexto}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Total com entrega</span>
          <strong className="delivery-summary-total">{totalTexto}</strong>
        </div>
      </div>

      <p className="delivery-summary-origin">Origem: CEP {cepOrigem}, nÂº {numeroOrigem}</p>
    </article>
  );
}

export function DeliveryModeSelector({ tipoEntrega, onChange }) {
  return (
    <section className="checkout-delivery-section" aria-label="Tipo de atendimento">
      <div className="checkout-delivery-section-head">
        <h3>Como voce prefere receber?</h3>
        <p>Escolha entre entrega no endereco ou retirada na loja.</p>
      </div>

      <div className="delivery-mode-toggle" role="radiogroup" aria-label="Tipo de entrega">
        <button
          type="button"
          role="radio"
          aria-checked={tipoEntrega === 'entrega'}
          className={`delivery-mode-toggle-btn ${tipoEntrega === 'entrega' ? 'is-active' : ''}`.trim()}
          onClick={() => onChange('entrega')}
        >
          Entrega
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={tipoEntrega === 'retirada'}
          className={`delivery-mode-toggle-btn ${tipoEntrega === 'retirada' ? 'is-active' : ''}`.trim()}
          onClick={() => onChange('retirada')}
        >
          Retirada na loja
        </button>
      </div>
    </section>
  );
}

export function PickupStoreCard({ economiaFrete = 0 }) {
  const economiaTexto = Number(economiaFrete || 0) > 0
    ? formatarMoeda(economiaFrete)
    : 'Sem custo de frete';

  return (
    <article className="pickup-store-card" aria-label="Informacoes para retirada na loja">
      <div className="pickup-store-card-head">
        <div>
          <p className="pickup-store-kicker">Retirada na loja</p>
          <h3>{RETIRADA_LOJA_INFO.nome}</h3>
        </div>
        <span className="pickup-store-icon" aria-hidden="true">
          <Store size={18} strokeWidth={2} />
        </span>
      </div>

      <div className="pickup-store-grid">
        <div>
          <span>Endereco</span>
          <strong>{RETIRADA_LOJA_INFO.endereco}</strong>
        </div>
        <div>
          <span>Horario de funcionamento</span>
          <strong>{RETIRADA_LOJA_INFO.horario}</strong>
        </div>
        <div>
          <span>Tempo estimado para preparo</span>
          <strong>{RETIRADA_LOJA_INFO.tempo_estimado}</strong>
        </div>
        <div>
          <span>Economia no frete</span>
          <strong className="pickup-store-economia">{economiaTexto}</strong>
        </div>
      </div>

      <p className="pickup-store-instrucao">Apresente o numero do pedido no balcao ao retirar.</p>
    </article>
  );
}

export function DeliveryAddressLookupCard({
  cep,
  endereco,
  carregando,
  erro,
  cepIncompleto
}) {
  const estadoVisual = carregando
    ? 'loading'
    : erro
      ? 'error'
      : endereco
        ? 'success'
        : 'neutral';

  const rua = String(endereco?.logradouro || '').trim();
  const bairro = String(endereco?.bairro || '').trim();
  const cidade = String(endereco?.cidade || '').trim();
  const estado = String(endereco?.estado || '').trim();

  const linhaPrincipal = [rua, bairro].filter(Boolean).join(', ');
  const linhaSecundaria = [cidade, estado].filter(Boolean).join(' - ');

  return (
    <article
      className={`delivery-address-card is-${estadoVisual}`}
      role={estadoVisual === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className="delivery-address-kicker">EndereÃ§o do CEP {cep}</p>

      {carregando ? (
        <p className="delivery-address-line">Buscando endereÃ§o...</p>
      ) : erro ? (
        <p className="delivery-address-line">{erro}</p>
      ) : endereco ? (
        <>
          <p className="delivery-address-line">{linhaPrincipal || 'Logradouro nÃ£o identificado para este CEP.'}</p>
          <p className="delivery-address-subline">{linhaSecundaria || 'Cidade/UF nÃ£o identificada.'}</p>
        </>
      ) : cepIncompleto ? (
        <p className="delivery-address-line">Digite os 8 dÃ­gitos do CEP para identificar o endereÃ§o.</p>
      ) : (
        <p className="delivery-address-line">Informe um CEP para consultar o endereÃ§o.</p>
      )}
    </article>
  );
}

