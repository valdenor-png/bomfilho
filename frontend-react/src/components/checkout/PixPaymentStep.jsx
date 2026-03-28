import {
  CheckoutSecurityTrust,
  PaymentOrderSummary,
  PixStatusCard,
  PixQrCodeCard,
  PixCopyCodeCard,
  PixInstructionsCard,
} from '../checkout';
import { formatarStatusPagamento, formatarStatusPedido } from '../../lib/checkoutUtils';

export default function PixPaymentStep({
  formaPagamento,
  tituloFormaPagamento,
  // PIX data
  qrCodePixSrc,
  codigoPixAtual,
  statusPixVisual,
  feedbackCopiaPix,
  onCopiarCodigoPix,
  // PIX actions
  textoBotaoGerarPix,
  bloqueioGeracaoPix,
  pixDisponivelParaPagar,
  podeContinuarConfirmacaoPix,
  onGerarPix,
  // Card payment (when formaPagamento !== 'pix')
  debitoSelecionado,
  status3DSTone,
  status3DSLabel,
  sessao3DSExpirando,
  sessao3DS,
  resultadoCartao,
  cartaoRecusado,
  parcelasCartaoEfetivas,
  onPagarCartao,
  documentoValidoPagamento,
  // 3DS homologacao
  eventosHomologacao3DS,
  feedbackEvidencia3DS,
  feedbackEvidencia3DSTone,
  onCopiarEvidencia3DS,
  onBaixarEvidencia3DS,
  // Shared
  carregando,
  resultadoPedido,
  totalComEntregaPedido,
  freteSelecionado,
  retiradaSelecionada,
  recaptchaCheckoutEnabled,
  // Summary sidebar
  itensResumoPixExibicao,
  resumoPedidoSnapshot,
  totalProdutosPedido,
  taxaServicoPedido,
  growthCheckoutPaymentPriceClass,
}) {
  return (
    <div className="checkout-pix-layout">
      <div className="card-box checkout-pix-main">
        <div className="checkout-pix-header">
          <p className="muted-text">
            {formaPagamento === 'pix'
              ? 'Escaneie o QR Code ou copie o código para pagar.'
              : `Finalize com ${tituloFormaPagamento.toLowerCase()} para continuar.`}
          </p>
        </div>

        <CheckoutSecurityTrust
          formaPagamento={formaPagamento}
          total={totalComEntregaPedido}
          frete={freteSelecionado}
          retiradaSelecionada={retiradaSelecionada}
          recaptchaEnabled={recaptchaCheckoutEnabled}
          compact
        />

        {formaPagamento === 'pix' ? (
          <>
            <section className="checkout-pix-payment-panel" aria-label="Pagamento PIX">
              <div className="checkout-pix-payment-grid">
                <PixQrCodeCard qrCodeSrc={qrCodePixSrc} carregando={carregando} />

                <PixCopyCodeCard
                  codigoPix={codigoPixAtual}
                  onCopy={() => { void onCopiarCodigoPix(); }}
                  feedbackCopia={feedbackCopiaPix}
                  disabled={carregando}
                />
              </div>

              <PixInstructionsCard />
            </section>

            <PixStatusCard statusVisual={statusPixVisual} />
          </>
        ) : (
          <section className="checkout-pix-payment-panel" aria-label="Pagamento com cartão">
            {debitoSelecionado ? (
              <>
                <p className={`payment-action-feedback ${status3DSTone}`.trim()} role="status">
                  {status3DSLabel}
                </p>
                {sessao3DSExpirando && sessao3DS ? (
                  <p className="payment-action-feedback is-warning" role="alert">
                    Sua sessão de autenticação 3DS está expirando. Finalize o pagamento em breve ou ela será renovada automaticamente.
                  </p>
                ) : null}
              </>
            ) : null}

            <button
              className="btn-secondary"
              type="button"
              disabled={carregando || !resultadoPedido?.pedido_id || !documentoValidoPagamento}
              onClick={onPagarCartao}
            >
              {carregando
                ? debitoSelecionado
                  ? status3DSLabel
                  : `Processando ${tituloFormaPagamento.toLowerCase()}...`
                : `Pagar com ${tituloFormaPagamento}`}
            </button>

            {resultadoCartao ? (
              <>
                <p>Status do pagamento: {formatarStatusPagamento(resultadoCartao.status)}</p>
                <p>Status do pedido: {formatarStatusPedido(resultadoCartao.status_interno || 'pendente')}</p>
                <p>Referência do gateway: {resultadoCartao.payment_id || resultadoCartao.gateway_order_id || '-'}</p>
                <p>Referência lógica: {resultadoCartao.reference_id || '-'}</p>
                <p>Referência da transação: {resultadoCartao.payment_id || '-'}</p>
                <p>Método: {resultadoCartao.tipo_cartao === 'debito' ? 'Cartão de Débito' : 'Cartão de Crédito'}</p>
                <p>Parcelas: {resultadoCartao.tipo_cartao === 'debito' ? '1x' : `${resultadoCartao.parcelas || parcelasCartaoEfetivas}x`}</p>
                {debitoSelecionado ? (
                  <>
                    <p>Charge status: {String(resultadoCartao.status_charge || '-').toUpperCase()}</p>
                    <p>Charge 3DS status: {String(resultadoCartao.status_charge_threeds || '-').toUpperCase()}</p>
                    <p>Payment response code: {resultadoCartao.payment_response?.code || resultadoCartao.authorization_code || '-'}</p>
                    <p>Payment response message: {resultadoCartao.payment_response?.message || resultadoCartao.message || '-'}</p>
                  </>
                ) : null}
                {cartaoRecusado ? (
                  <p className="error-text">Pagamento não aprovado. Revise os dados do cartão e tente novamente.</p>
                ) : null}
              </>
            ) : (
              <p className="muted-text">Revise os dados e conclua o pagamento para liberar a confirmação do pedido.</p>
            )}

            {debitoSelecionado && eventosHomologacao3DS.length > 0 ? (
              <div className="payment-homologacao-logs" aria-label="Evidencia sanitizada de homologacao 3DS">
                <p className="payment-homologacao-logs-title">Evidência de homologação 3DS (dados mascarados)</p>

                <div className="payment-homologacao-logs-actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => { void onCopiarEvidencia3DS(); }}
                  >
                    Copiar log sanitizado
                  </button>

                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={onBaixarEvidencia3DS}
                  >
                    Baixar JSON sanitizado
                  </button>
                </div>

                {feedbackEvidencia3DS ? (
                  <p className={`payment-action-feedback ${feedbackEvidencia3DSTone}`.trim()} role="status">
                    {feedbackEvidencia3DS}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>

      <aside className="checkout-pix-side">
        <PaymentOrderSummary
          itens={itensResumoPixExibicao}
          subtotal={Number(resultadoPedido?.total_produtos ?? resumoPedidoSnapshot?.subtotal ?? totalProdutosPedido)}
          frete={freteSelecionado}
          taxaServico={taxaServicoPedido}
          total={totalComEntregaPedido}
          metodo={formaPagamento === 'pix' ? 'PIX' : tituloFormaPagamento}
          className={growthCheckoutPaymentPriceClass}
        />

        {formaPagamento === 'pix' ? (
          <div className="card-box checkout-pix-actions-card">
            <p className="pix-order-meta">Pedido #{resultadoPedido?.pedido_id || '-'}</p>

            <button
              className={`${pixDisponivelParaPagar ? 'btn-secondary' : 'btn-primary'} checkout-pix-generate-btn`.trim()}
              type="button"
              disabled={bloqueioGeracaoPix}
              onClick={onGerarPix}
            >
              {textoBotaoGerarPix}
            </button>

            {!podeContinuarConfirmacaoPix ? (
              <p className="pix-action-helper">A confirmação só é liberada após aprovação do pagamento PIX.</p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
