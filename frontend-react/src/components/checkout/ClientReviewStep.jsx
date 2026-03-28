/**
 * ClientReviewStep — tela de revisão do pedido estilo iFood.
 *
 * Etapa intermediária entre PAGAMENTO e a criação real do pedido.
 * O usuário pode revisar itens, endereço e forma de pagamento antes
 * de confirmar. Apenas ao clicar em "Confirmar" o pedido é criado
 * via API (handleCriarPedido em PagamentoPage).
 *
 * Props:
 *   itensPedido     — array de itens com { produto_id, nome, quantidade, subtotal }
 *   retiradaSelecionada — boolean
 *   enderecoResumo  — string resumida do endereço de entrega
 *   veiculoEntrega  — 'bike' | 'uber' | 'moto' | 'carro'
 *   tituloFormaPagamento — 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito'
 *   subtotal        — subtotal dos produtos (número)
 *   frete           — valor do frete (número | null)
 *   taxaServico     — taxa de serviço (número)
 *   total           — total geral (número)
 *   carregando      — boolean (desabilita botão)
 *   onConfirmar     — callback disparado ao confirmar o pedido
 *   onEditar        — callback(etapa: string) chamado ao clicar em "Editar"
 */
import React from 'react';
import { formatarMoeda } from '../../lib/checkoutUtils';

const VEICULOS_LABEL = Object.freeze({
  bike: 'Bike (entrega ecológica)',
  moto: 'Moto',
  carro: 'Carro',
  uber: 'Entrega via Uber',
});

export default function ClientReviewStep({
  itensPedido = [],
  retiradaSelecionada = false,
  enderecoResumo = '',
  veiculoEntrega = 'uber',
  tituloFormaPagamento = 'PIX',
  subtotal = 0,
  frete = null,
  taxaServico = 0,
  total = 0,
  carregando = false,
  onConfirmar,
  onEditar,
}) {
  const freteLabel = retiradaSelecionada
    ? 'Grátis (retirada)'
    : frete != null
      ? formatarMoeda(frete)
      : 'A calcular';

  const labelVeiculo = !retiradaSelecionada
    ? (VEICULOS_LABEL[veiculoEntrega] || veiculoEntrega)
    : null;

  return (
    <div className="checkout-client-review-layout">
      <div className="card-box checkout-client-review-main">

        <div className="checkout-client-review-header">
          <p className="checkout-pix-kicker">Etapa 3</p>
          <h2>Confirmar pedido</h2>
          <p className="muted-text">Revise as informações antes de confirmar.</p>
        </div>

        {/* Itens do carrinho */}
        <section className="checkout-client-review-section" aria-label="Itens do pedido">
          <div className="checkout-client-review-section-head">
            <h3>Itens do carrinho</h3>
            <button
              type="button"
              className="checkout-client-review-edit-link"
              onClick={() => onEditar?.('carrinho')}
            >
              Editar
            </button>
          </div>
          <ul className="checkout-client-review-items" aria-label="Lista de itens">
            {itensPedido.map((item) => (
              <li key={item.produto_id} className="checkout-client-review-item">
                <span className="checkout-client-review-item-qty">{item.quantidade}×</span>
                <span className="checkout-client-review-item-name">{item.nome}</span>
                <span className="checkout-client-review-item-price">
                  {formatarMoeda(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Entrega */}
        <section className="checkout-client-review-section" aria-label="Entrega">
          <div className="checkout-client-review-section-head">
            <h3>Entrega</h3>
            <button
              type="button"
              className="checkout-client-review-edit-link"
              onClick={() => onEditar?.('entrega')}
            >
              Editar
            </button>
          </div>
          <p className="checkout-client-review-detail">
            {retiradaSelecionada ? 'Retirada na loja' : (enderecoResumo || 'Endereço não informado')}
          </p>
          {labelVeiculo ? (
            <p className="checkout-client-review-detail muted-text">{labelVeiculo}</p>
          ) : null}
        </section>

        {/* Pagamento */}
        <section className="checkout-client-review-section" aria-label="Pagamento">
          <div className="checkout-client-review-section-head">
            <h3>Pagamento</h3>
            <button
              type="button"
              className="checkout-client-review-edit-link"
              onClick={() => onEditar?.('pagamento')}
            >
              Editar
            </button>
          </div>
          <p className="checkout-client-review-detail">{tituloFormaPagamento}</p>
        </section>

        {/* Totais */}
        <section className="checkout-client-review-section checkout-client-review-totals" aria-label="Resumo de valores">
          <div className="checkout-client-review-total-row">
            <span>Subtotal</span>
            <span>{formatarMoeda(subtotal)}</span>
          </div>
          <div className="checkout-client-review-total-row">
            <span>Frete</span>
            <span>{freteLabel}</span>
          </div>
          {taxaServico > 0 ? (
            <div className="checkout-client-review-total-row">
              <span>Taxa de serviço</span>
              <span>{formatarMoeda(taxaServico)}</span>
            </div>
          ) : null}
          <div className="checkout-client-review-total-row is-total">
            <strong>Total</strong>
            <strong>{formatarMoeda(total)}</strong>
          </div>
        </section>

        {/* CTA desktop */}
        <div className="checkout-client-review-actions">
          <button
            type="button"
            className="btn-primary checkout-client-review-confirm"
            onClick={onConfirmar}
            disabled={carregando}
          >
            {carregando
              ? 'Confirmando pedido...'
              : `Confirmar e fazer pedido · ${formatarMoeda(total)}`}
          </button>
        </div>

      </div>
    </div>
  );
}
