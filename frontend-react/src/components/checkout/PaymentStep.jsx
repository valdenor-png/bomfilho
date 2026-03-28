import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FORMAS_PAGAMENTO_OPCOES,
  PARCELAMENTO_MAXIMO_CREDITO,
  formatarMoeda,
  formatarDocumentoFiscal,
  normalizarDocumentoFiscal,
  normalizarNumeroCartao,
  formatarNumeroCartao,
  formatarMesCartao,
  formatarAnoCartao,
  normalizarAnoCartaoParaComparacao,
  normalizarAnoCartaoParaTokenizacao,
  formatarCvvCartao,
  validarCpf,
} from '../../lib/checkoutUtils';
import { tokenizeCard } from '../../lib/paymentTokenization';
import { IS_DEVELOPMENT } from '../../config/api';
import {
  PaymentMethodCard,
  PaymentSelectionSummary,
  PaymentOrderSummary,
  TaxIdInput,
} from '../checkout';

const PaymentStep = forwardRef(function PaymentStep({
  // Payment method
  formaPagamento,
  onFormaPagamentoChange,
  // Document
  documentoPagador,
  onDocumentoPagadorChange,
  // CPF nota
  cpfNotaFiscal,
  onCpfNotaFiscalChange,
  // Parcelas
  parcelasCartao,
  onParcelasCartaoChange,
  // Token / gateway
  tokenCartao,
  onLimparTokenCartao,
  buscandoChavePublica,
  // Auth
  autenticado,
  // Erro
  erro,
  onErroChange,
  // Loading
  carregando,
  // Delivery context for frete info display
  retiradaSelecionada,
  simulacaoFrete,
  resultadoPedido,
  economiaFreteRetirada,
  atendimentoSelecionadoLabel,
  distanciaSelecionadaTexto,
  tipoEntrega,
  // Financial summary
  resumoFretePagamento,
  resumoTaxaServicoPagamento,
  resumoTotalPagamento,
  resumoItensPagamento,
  totalProdutosPedido,
  // Parcelas context
  parcelamentoCreditoDisponivel,
  valorMinimoParcelamentoTexto,
  // 3DS display
  debitoSelecionado,
  status3DSTone,
  status3DSLabel,
  idAutenticacao3DS,
  sessao3DSExpirando,
  sessao3DS,
  resultado3DS,
  // Bloqueio
  bloqueioPagamento,
  mensagemBloqueioPagamento,
  // Growth
  growthCheckoutPaymentPriceClass,
  // Callbacks for syncing computed state
  onDadosCartaoCompletosChange,
  onValidarCartao,
  pagamentoCartaoSelecionado,
  formaPagamentoAtual,
}, ref) {
  // --- Local state (card fields + UI flags) ---
  const [documentoTocado, setDocumentoTocado] = useState(false);
  const [cpfNotaFiscalAtivo, setCpfNotaFiscalAtivo] = useState(false);
  const [cpfNotaFiscalTocado, setCpfNotaFiscalTocado] = useState(false);
  const [nomeTitularCartao, setNomeTitularCartao] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [mesExpiracaoCartao, setMesExpiracaoCartao] = useState('');
  const [anoExpiracaoCartao, setAnoExpiracaoCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [criptografandoCartao, setCriptografandoCartao] = useState(false);

  // --- Derived values (card validation) ---
  const nomeTitularCartaoValido = String(nomeTitularCartao || '').trim().length >= 3;
  const numeroCartaoValido = normalizarNumeroCartao(numeroCartao).length >= 13;
  const mesCartaoNumero = Number.parseInt(formatarMesCartao(mesExpiracaoCartao), 10);
  const mesCartaoValido = Number.isInteger(mesCartaoNumero) && mesCartaoNumero >= 1 && mesCartaoNumero <= 12;
  const anoCartaoNormalizado = normalizarAnoCartaoParaComparacao(anoExpiracaoCartao);
  const anoCartaoNumero = Number.parseInt(anoCartaoNormalizado, 10);
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const anoCartaoValido = anoCartaoNormalizado.length === 4
    && Number.isInteger(anoCartaoNumero)
    && (anoCartaoNumero > anoAtual || (anoCartaoNumero === anoAtual && mesCartaoValido && mesCartaoNumero >= mesAtual));
  const cvvCartaoValido = [3, 4].includes(formatarCvvCartao(cvvCartao).length);
  const dadosCartaoCompletos = nomeTitularCartaoValido && numeroCartaoValido && mesCartaoValido && anoCartaoValido && cvvCartaoValido;

  // Sync dadosCartaoCompletos to PagamentoPage; reset on unmount
  useEffect(() => {
    onDadosCartaoCompletosChange(dadosCartaoCompletos);
    return () => onDadosCartaoCompletosChange(false);
  }, [dadosCartaoCompletos, onDadosCartaoCompletosChange]);

  // --- Derived values (document) ---
  const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
  const documentoValidoPagamento = documentoDigits.length === 11 || documentoDigits.length === 14;
  const documentoObrigatorioNaoPreenchido = documentoTocado && documentoDigits.length === 0;
  const documentoInvalidoPagamento = documentoTocado && documentoDigits.length > 0 && !documentoValidoPagamento;
  const documentoValidoFeedback = documentoTocado && documentoValidoPagamento;
  const cpfPagadorSugestao = documentoDigits.length === 11 && validarCpf(documentoDigits)
    ? formatarDocumentoFiscal(documentoDigits)
    : '';

  // --- Derived values (CPF nota) ---
  const cpfNotaDigits = normalizarDocumentoFiscal(cpfNotaFiscal).slice(0, 11);
  const cpfNotaValido = cpfNotaDigits.length === 11 && validarCpf(cpfNotaDigits);
  const cpfNotaInvalido = cpfNotaFiscalTocado && cpfNotaDigits.length > 0 && !cpfNotaValido;
  const cpfNotaFeedbackValido = cpfNotaFiscalTocado && cpfNotaValido;

  // --- Methods available to PagamentoPage ---
  const metodosPagamentoDisponiveis = useMemo(() => {
    const candidatos = [
      { id: 'pix', ...(FORMAS_PAGAMENTO_OPCOES?.pix || {}), disabled: false },
      { id: 'credito', ...(FORMAS_PAGAMENTO_OPCOES?.credito || {}), disabled: buscandoChavePublica },
      { id: 'debito', ...(FORMAS_PAGAMENTO_OPCOES?.debito || {}), disabled: buscandoChavePublica }
    ];
    return candidatos
      .filter(Boolean)
      .map((metodo) => ({
        id: String(metodo?.id || '').trim().toLowerCase(),
        icon: String(metodo?.icon || '').trim(),
        title: String(metodo?.title || '').trim(),
        headline: String(metodo?.headline || '').trim(),
        disabled: Boolean(metodo?.disabled)
      }))
      .filter((metodo) => Boolean(metodo.id) && Boolean(metodo.title));
  }, [buscandoChavePublica]);

  const limparCamposCartaoLocal = useCallback(() => {
    onLimparTokenCartao();
  }, [onLimparTokenCartao]);

  // --- Imperative handle for PagamentoPage to call tokenization ---
  useImperativeHandle(ref, () => ({
    async criptografarCartao(publicKey) {
      const holder = String(nomeTitularCartao || '').trim();
      const number = normalizarNumeroCartao(numeroCartao);
      const expMonth = formatarMesCartao(mesExpiracaoCartao);
      const expYear = normalizarAnoCartaoParaTokenizacao(anoExpiracaoCartao);
      const securityCode = formatarCvvCartao(cvvCartao);

      if (holder.length < 3) throw new Error('Informe o nome completo do titular do cartão.');
      if (number.length < 13) throw new Error('Número do cartão inválido.');
      const mes = Number.parseInt(expMonth, 10);
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error('Mês de expiração inválido.');
      if (expYear.length !== 2) throw new Error('Ano de expiração inválido.');
      if (![3, 4].includes(securityCode.length)) throw new Error('CVV inválido.');

      setCriptografandoCartao(true);
      try {
        const tokenizacao = await tokenizeCard({
          publicKey,
          holder,
          number,
          expMonth,
          expYear,
          securityCode,
          identificationNumber: normalizarDocumentoFiscal(documentoPagador)
        });

        const token = String(tokenizacao?.token || '').trim();
        if (!token) throw new Error('Não foi possível tokenizar o cartão no Mercado Pago.');

        return {
          token,
          paymentMethodId: String(tokenizacao?.paymentMethodId || '').trim(),
          issuerId: Number.isFinite(Number(tokenizacao?.issuerId)) ? Number(tokenizacao.issuerId) : null,
        };
      } finally {
        setCriptografandoCartao(false);
      }
    },
    isDadosCartaoCompletos() {
      return dadosCartaoCompletos;
    },
    getCardFields() {
      return {
        nomeTitularCartao: String(nomeTitularCartao || '').trim(),
        numeroCartao,
        mesExpiracaoCartao,
        anoExpiracaoCartao,
        cvvCartao,
      };
    },
  }), [nomeTitularCartao, numeroCartao, mesExpiracaoCartao, anoExpiracaoCartao, cvvCartao, documentoPagador, dadosCartaoCompletos]);

  return (
    <div className="checkout-payment-layout">
      <div className="card-box checkout-payment-main">
        <div className="checkout-payment-header">
          <h2>Pagamento</h2>
          <p className="muted-text">Escolha o método e revise seus dados de forma rápida.</p>
        </div>

        <p className={`payment-frete-info ${(retiradaSelecionada || simulacaoFrete || resultadoPedido?.pedido_id) ? 'is-ready' : 'is-warning'}`}>
          {retiradaSelecionada
            ? `Retirada na loja selecionada. Sem frete${Number(economiaFreteRetirada || 0) > 0 ? ` · Economia ${formatarMoeda(economiaFreteRetirada)}` : ''}.`
            : (simulacaoFrete || resultadoPedido?.pedido_id)
              ? `Frete ${atendimentoSelecionadoLabel}: ${formatarMoeda(resumoFretePagamento)} · Distância ${distanciaSelecionadaTexto}`
              : 'Frete não calculado. Volte para entrega e simule o CEP antes de continuar.'}
        </p>

        {autenticado === true ? (
          <>
            <section className="checkout-payment-section" aria-label="Métodos de pagamento disponíveis">
              <div className="checkout-payment-section-head">
                <h3>Forma de pagamento</h3>
                <p>Selecione uma opção para continuar.</p>
              </div>

              <div className="payment-methods-grid" role="radiogroup" aria-label="Seleção da forma de pagamento">
                {metodosPagamentoDisponiveis.map((metodoPagamento) => (
                  <PaymentMethodCard
                    key={metodoPagamento.id}
                    method={metodoPagamento}
                    selected={formaPagamento === metodoPagamento.id}
                    disabled={metodoPagamento.disabled}
                    onSelect={(selectedId) => {
                      const formaSelecionada = String(selectedId || metodoPagamento.id || '').trim().toLowerCase();
                      if (!['pix', 'credito', 'debito'].includes(formaSelecionada)) return;
                      onFormaPagamentoChange(formaSelecionada);
                      if (formaSelecionada === 'debito') onParcelasCartaoChange('1');
                      onErroChange('');
                      limparCamposCartaoLocal();
                    }}
                  />
                ))}
              </div>

              {buscandoChavePublica ? (
                <p className="payment-method-unavailable" role="status">
                  Métodos no cartão temporariamente indisponíveis enquanto preparamos a conexão segura com o gateway.
                </p>
              ) : null}
            </section>

            <PaymentSelectionSummary
              title={formaPagamentoAtual.summaryTitle}
              description={formaPagamentoAtual.summaryDescription}
            />

            <TaxIdInput
              value={documentoPagador}
              id="documento-pagador"
              label="CPF/CNPJ do pagador"
              helperText="Necessário para processar PIX e cartão com segurança."
              onChange={(event) => {
                onDocumentoPagadorChange(formatarDocumentoFiscal(event.target.value));
                if (erro) onErroChange('');
              }}
              onBlur={() => setDocumentoTocado(true)}
              requiredError={documentoObrigatorioNaoPreenchido}
              invalidError={documentoInvalidoPagamento}
              validFeedback={documentoValidoFeedback}
            />

            <section className="checkout-payment-section checkout-payment-fiscal" aria-label="CPF na nota fiscal">
              <div className="checkout-payment-section-head">
                <h3>CPF na nota</h3>
                <p>Opcional. Use apenas para emissão fiscal.</p>
              </div>

              {!cpfNotaFiscalAtivo ? (
                <div className="payment-fiscal-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setCpfNotaFiscalAtivo(true); setCpfNotaFiscalTocado(false); }}>
                    Adicionar CPF na nota
                  </button>
                  {cpfPagadorSugestao ? (
                    <button type="button" className="btn-secondary" onClick={() => { onCpfNotaFiscalChange(cpfPagadorSugestao); setCpfNotaFiscalAtivo(true); setCpfNotaFiscalTocado(true); }}>
                      Usar CPF do pagador ({cpfPagadorSugestao})
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="payment-fiscal-editor">
                  <TaxIdInput
                    value={cpfNotaFiscal}
                    id="cpf-nota-fiscal"
                    label="CPF na nota (opcional)"
                    placeholder="000.000.000-00"
                    helperText="Se informado, será usado apenas para emissão da nota fiscal."
                    invalidMessage="CPF inválido. Confira os 11 dígitos."
                    validMessage="CPF fiscal válido."
                    onChange={(event) => { onCpfNotaFiscalChange(formatarDocumentoFiscal(event.target.value)); if (erro) onErroChange(''); }}
                    onBlur={() => setCpfNotaFiscalTocado(true)}
                    requiredError={false}
                    invalidError={cpfNotaInvalido}
                    validFeedback={cpfNotaFeedbackValido}
                  />
                  <div className="payment-fiscal-actions">
                    <button type="button" className="btn-secondary" onClick={() => { onCpfNotaFiscalChange(''); setCpfNotaFiscalAtivo(false); setCpfNotaFiscalTocado(false); }}>
                      Remover CPF da nota
                    </button>
                  </div>
                </div>
              )}
            </section>

            {pagamentoCartaoSelecionado ? (
              <section className="payment-card-panel" aria-label="Dados do cartão">
                <div className="payment-card-panel-head">
                  <h3>{formaPagamento === 'credito' ? 'Dados do cartão de crédito' : 'Dados do cartão de débito'}</h3>
                  <p>Preencha os dados exatamente como no cartão para reduzir chance de recusa.</p>
                </div>

                <div className="payment-card-grid">
                  <div className="payment-card-field payment-card-field-span-2">
                    <label htmlFor="nome-titular-cartao">Nome impresso no cartão</label>
                    <input id="nome-titular-cartao" className="field-input" type="text" autoComplete="off"
                      placeholder="Nome igual ao cartão" value={nomeTitularCartao}
                      onChange={(e) => { setNomeTitularCartao(e.target.value); limparCamposCartaoLocal(); }} />
                  </div>
                  <div className="payment-card-field payment-card-field-span-2">
                    <label htmlFor="numero-cartao">Número do cartão</label>
                    <input id="numero-cartao" className="field-input" type="text" inputMode="numeric" autoComplete="cc-number"
                      placeholder="0000 0000 0000 0000" value={numeroCartao}
                      onChange={(e) => { setNumeroCartao(formatarNumeroCartao(e.target.value)); limparCamposCartaoLocal(); }} />
                  </div>
                  <div className="payment-card-field">
                    <label htmlFor="mes-expiracao-cartao">Mês</label>
                    <input id="mes-expiracao-cartao" className="field-input" type="text" inputMode="numeric" autoComplete="cc-exp-month"
                      placeholder="MM" maxLength={2} value={mesExpiracaoCartao}
                      onChange={(e) => { setMesExpiracaoCartao(formatarMesCartao(e.target.value)); limparCamposCartaoLocal(); }} />
                  </div>
                  <div className="payment-card-field">
                    <label htmlFor="ano-expiracao-cartao">Ano</label>
                    <input id="ano-expiracao-cartao" className="field-input" type="text" inputMode="numeric" autoComplete="cc-exp-year"
                      placeholder="AA ou AAAA" maxLength={4} value={anoExpiracaoCartao}
                      onChange={(e) => { setAnoExpiracaoCartao(formatarAnoCartao(e.target.value)); limparCamposCartaoLocal(); }} />
                  </div>
                  <div className="payment-card-field">
                    <label htmlFor="cvv-cartao">CVV</label>
                    <input id="cvv-cartao" className="field-input" type="password" inputMode="numeric" autoComplete="cc-csc"
                      placeholder="CVV" maxLength={4} value={cvvCartao}
                      onChange={(e) => { setCvvCartao(formatarCvvCartao(e.target.value)); limparCamposCartaoLocal(); }} />
                  </div>
                  {formaPagamento === 'credito' ? (
                    <div className="payment-card-field payment-card-field-span-2">
                      <label htmlFor="parcelas-cartao">Parcelas</label>
                      <select id="parcelas-cartao" className="field-input" value={parcelasCartao} onChange={(e) => onParcelasCartaoChange(e.target.value)}>
                        {Array.from({ length: parcelamentoCreditoDisponivel ? PARCELAMENTO_MAXIMO_CREDITO : 1 }, (_, idx) => idx + 1).map((parcela) => (
                          <option key={parcela} value={String(parcela)}>{parcela}x</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                {formaPagamento === 'credito' ? (
                  <p className="payment-card-note">
                    {parcelamentoCreditoDisponivel
                      ? `Parcelamento liberado para este pedido (até ${PARCELAMENTO_MAXIMO_CREDITO}x).`
                      : `Parcelamento disponível apenas para pedidos a partir de R$ ${valorMinimoParcelamentoTexto}.`}
                  </p>
                ) : (
                  <p className="payment-card-note">No débito, o pagamento é sempre à vista (1x).</p>
                )}

                <div className="payment-card-actions">
                  <button
                    className="btn-secondary payment-validate-card-btn"
                    type="button"
                    disabled={criptografandoCartao || buscandoChavePublica}
                    onClick={() => {
                      void onValidarCartao().catch((error) => {
                        onErroChange(error.message || 'Não foi possível validar os dados do cartão.');
                      });
                    }}
                  >
                    {criptografandoCartao ? 'Validando dados do cartão...' : 'Validar cartão com segurança'}
                  </button>

                  <p className={`payment-card-token-feedback ${tokenCartao ? 'is-success' : ''}`.trim()}>
                    {tokenCartao
                      ? 'Dados do cartão validados com sucesso.'
                      : 'Os dados do cartão são protegidos antes do envio para pagamento.'}
                  </p>

                  {debitoSelecionado ? (
                    <>
                      <p className={`payment-action-feedback ${status3DSTone}`.trim()} role="status">
                        {status3DSLabel}
                        {idAutenticacao3DS ? ` ID: ${idAutenticacao3DS}` : ''}
                      </p>

                      {sessao3DSExpirando && sessao3DS ? (
                        <p className="payment-action-feedback is-warning" role="alert">
                          Sua sessão de autenticação 3DS está expirando. Finalize o pagamento em breve ou ela será renovada automaticamente.
                        </p>
                      ) : null}

                      {IS_DEVELOPMENT && resultado3DS?.trace_id ? (
                        <p className="muted-text">Trace 3DS: {resultado3DS.trace_id}</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="payment-login-state">
            <p className="muted-text">Faça login para continuar com o pagamento e acompanhar seu pedido.</p>
            <div className="checkout-payment-actions">
              <Link to="/conta" className="btn-primary entrega-ir-pagamento-btn checkout-payment-primary-btn">
                Ir para Conta
              </Link>
            </div>
          </div>
        )}
      </div>

      <aside className="checkout-payment-side">
        <PaymentOrderSummary
          itens={resumoItensPagamento}
          subtotal={totalProdutosPedido}
          frete={resumoFretePagamento}
          taxaServico={resumoTaxaServicoPagamento}
          total={resumoTotalPagamento}
          metodo={formaPagamentoAtual.title}
          tipoEntrega={tipoEntrega}
          economiaFrete={economiaFreteRetirada}
          className={growthCheckoutPaymentPriceClass}
        />

        {autenticado === true ? (
          <div className="card-box checkout-payment-actions-card">
            <article className="payment-readiness-card" aria-label="Estado da etapa de pagamento">
              <p className="payment-readiness-title">Pronto para revisar</p>
              <p className="payment-readiness-description">
                {mensagemBloqueioPagamento || `Método selecionado: ${formaPagamentoAtual.title}.`}
              </p>
            </article>

            {buscandoChavePublica ? (
              <p className="payment-action-feedback is-loading" role="status">Preparando conexão segura com o gateway de cartão...</p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
});

export default PaymentStep;
