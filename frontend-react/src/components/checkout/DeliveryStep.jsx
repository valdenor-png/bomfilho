import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, MapPin } from '../../icons';
import { useCheckout, CHECKOUT_ACTIONS } from '../../context/CheckoutContext';
import {
  buscarEnderecoViaCep,
  getUberDeliveryQuote,
  simularFretePorCep
} from '../../lib/api';
import {
  CEP_MERCADO,
  LIMITE_BIKE_KM,
  NUMERO_MERCADO,
  VEICULOS_ENTREGA,
  formatarCep,
  formatarMoeda,
  normalizarCep,
} from '../../lib/checkoutUtils';
import { DeliveryOptionCard, DeliveryAddressLookupCard, PickupStoreCard } from '../checkout';

export default function DeliveryStep({
  modalUberInterno,
  mensagemFrete,
  bloqueioAgua20LAtivo,
  bloqueioAgua20LMotivo,
  avisoRestricaoVeiculo,
  semOpcaoEntregaDisponivel,
  bikeDisponivel,
  opcoesEntregaCompactas,
  economiaFreteRetirada,
  enderecoEntregaResumo,
  enderecoEntregaComplemento,
  enderecoContaSalvo,
  temEnderecoContaSalvo,
  enderecoContaSalvoResumo,
  enderecoSalvoJaSelecionado,
  uberQuoteDisponivel,
  setUberQuoteDisponivel,
  itens,
  resumoTotal,
}) {
  const { dispatch, tipoEntrega, veiculoEntrega, simulacaoFrete, cepEntrega, numeroEntrega, enderecoCepEntrega } = useCheckout();

  // Estados locais deste step
  const [erroEntrega, setErroEntrega] = useState('');
  const [erroEnderecoCepEntrega, setErroEnderecoCepEntrega] = useState('');
  const [buscandoEnderecoCepEntrega, setBuscandoEnderecoCepEntrega] = useState(false);
  const [cepEnderecoConsultado, setCepEnderecoConsultado] = useState('');
  const [simulandoFrete, setSimulandoFrete] = useState(false);
  const [simulacoesFretePorVeiculo, setSimulacoesFretePorVeiculo] = useState({});
  const buscaEnderecoRef = useRef(0);

  const cepEntregaNormalizado = normalizarCep(cepEntrega);
  const cepEntregaValido = cepEntregaNormalizado.length === 8;
  const cepEntregaIncompleto = cepEntregaNormalizado.length > 0 && cepEntregaNormalizado.length < 8;

  const setEntregaData = useCallback((payload) => {
    dispatch({ type: CHECKOUT_ACTIONS.SET_ENTREGA_DATA, payload });
  }, [dispatch]);

  const consultarEnderecoCepEntrega = useCallback(async (cep, { mostrarErro = true } = {}) => {
    const cepNorm = normalizarCep(cep);
    if (cepNorm.length !== 8) {
      setBuscandoEnderecoCepEntrega(false);
      setEntregaData({ enderecoCepEntrega: null });
      setCepEnderecoConsultado('');
      if (mostrarErro && cepNorm.length > 0) {
        setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
      } else {
        setErroEnderecoCepEntrega('');
      }
      return null;
    }

    if (cepEnderecoConsultado === cepNorm && enderecoCepEntrega) {
      return enderecoCepEntrega;
    }

    const requestId = ++buscaEnderecoRef.current;
    setBuscandoEnderecoCepEntrega(true);
    setErroEnderecoCepEntrega('');

    try {
      const endereco = await buscarEnderecoViaCep(cepNorm);
      if (requestId !== buscaEnderecoRef.current) return null;
      setEntregaData({ enderecoCepEntrega: endereco });
      setCepEnderecoConsultado(cepNorm);
      return endereco;
    } catch (error) {
      if (requestId !== buscaEnderecoRef.current) return null;
      setEntregaData({ enderecoCepEntrega: null });
      setCepEnderecoConsultado('');
      if (mostrarErro) {
        const msg = String(error?.message || '').trim();
        if (msg === 'CEP não encontrado') {
          setErroEnderecoCepEntrega('Não encontramos endereço para este CEP.');
        } else if (msg === 'CEP inválido') {
          setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
        } else {
          setErroEnderecoCepEntrega(msg || 'Não foi possível consultar o endereço deste CEP.');
        }
      }
      return null;
    } finally {
      if (requestId === buscaEnderecoRef.current) {
        setBuscandoEnderecoCepEntrega(false);
      }
    }
  }, [cepEnderecoConsultado, enderecoCepEntrega, setEntregaData]);

  const formaRecebimentoSelecionada = tipoEntrega === 'retirada' ? 'retirada' : veiculoEntrega;
  const retiradaSelecionada = tipoEntrega === 'retirada';

  const selecionarFormaRecebimento = useCallback((forma) => {
    if (forma === 'retirada') {
      setEntregaData({ tipoEntrega: 'retirada', veiculoEntrega: 'retirada' });
    } else {
      setEntregaData({ tipoEntrega: 'entrega', veiculoEntrega: forma });
    }
    setErroEntrega('');
  }, [setEntregaData]);

  // Debounce busca CEP
  useEffect(() => {
    if (!cepEntregaNormalizado || cepEntregaNormalizado.length !== 8) {
      setEntregaData({ enderecoCepEntrega: null });
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
      setCepEnderecoConsultado('');
      return;
    }
    const timer = setTimeout(() => {
      void consultarEnderecoCepEntrega(cepEntregaNormalizado, { mostrarErro: true });
    }, 260);
    return () => clearTimeout(timer);
  }, [cepEntregaNormalizado, consultarEnderecoCepEntrega, setEntregaData]);

  // Auto-simulação de frete
  useEffect(() => {
    let ativo = true;

    if (retiradaSelecionada) {
      setSimulacoesFretePorVeiculo({});
      return () => { ativo = false; };
    }

    if (cepEntregaNormalizado.length !== 8 || !String(numeroEntrega || '').trim()) {
      setSimulacoesFretePorVeiculo({});
      setEntregaData({ simulacaoFrete: null });
      return () => { ativo = false; };
    }

    async function carregarFretes() {
      setSimulandoFrete(true);
      const enderecoPayload = {
        cep: formatarCep(cepEntregaNormalizado),
        numero: String(numeroEntrega || '').trim(),
        logradouro: String(enderecoCepEntrega?.logradouro || '').trim(),
        bairro: String(enderecoCepEntrega?.bairro || '').trim(),
        cidade: String(enderecoCepEntrega?.cidade || '').trim(),
        estado: String(enderecoCepEntrega?.estado || '').trim()
      };

      const [bikeRaw, uberRaw] = await Promise.all([
        simularFretePorCep({ cep: cepEntregaNormalizado, veiculo: 'bike' }).catch(() => null),
        uberQuoteDisponivel
          ? getUberDeliveryQuote({
            endereco: enderecoPayload,
            carrinho: itens.map((item) => ({ nome: item.nome, categoria: item.categoria, quantidade: Number(item.quantidade || 1) })),
            valorCarrinho: Number(resumoTotal || 0)
          }).catch((e) => { if (Number(e?.status || 0) === 503) setUberQuoteDisponivel(false); return null; })
          : Promise.resolve(null)
      ]);

      if (!ativo) return;

      const bikeMap = bikeRaw ? {
        veiculo: 'bike', frete: Number(bikeRaw?.frete || 0),
        distancia_km: Number(bikeRaw?.distancia_km || 0),
        eta_seconds: null, estimate_id: null,
        cep_destino: formatarCep(cepEntregaNormalizado),
        cep_origem: CEP_MERCADO, numero_origem: NUMERO_MERCADO,
        opcao_exibida: 'bike', modal_interno: 'bike'
      } : null;

      const uberMap = uberRaw ? {
        veiculo: modalUberInterno, frete: Number(uberRaw?.preco || 0),
        distancia_km: bikeMap?.distancia_km || null,
        eta_seconds: Number(uberRaw?.eta_segundos || 0) || null,
        estimate_id: String(uberRaw?.estimate_id || '').trim() || null,
        cep_destino: formatarCep(cepEntregaNormalizado),
        cep_origem: CEP_MERCADO, numero_origem: NUMERO_MERCADO,
        opcao_exibida: 'uber', modal_interno: modalUberInterno
      } : null;

      const mapa = { bike: bikeMap, uber: uberMap };
      setSimulacoesFretePorVeiculo(mapa);

      const disponiveis = opcoesEntregaCompactas.filter((key) => {
        if (key === 'bike') {
          const d = Number(bikeMap?.distancia_km || 0);
          return Boolean(bikeMap) && Number.isFinite(d) && d > 0 && d <= LIMITE_BIKE_KM;
        }
        return Boolean(mapa[key]);
      });

      const veiculoAtualValido = disponiveis.includes(veiculoEntrega);
      const proximoVeiculo = veiculoAtualValido ? veiculoEntrega : (disponiveis[0] || veiculoEntrega);

      setEntregaData({
        veiculoEntrega: proximoVeiculo !== veiculoEntrega ? proximoVeiculo : veiculoEntrega,
        simulacaoFrete: mapa[proximoVeiculo] || null,
      });
      setErroEntrega(disponiveis.length ? '' : 'Sem opção de entrega disponível para este CEP.');
      setSimulandoFrete(false);
    }

    void carregarFretes();
    return () => { ativo = false; };
  }, [retiradaSelecionada, cepEntregaNormalizado, numeroEntrega, enderecoCepEntrega, itens, resumoTotal, opcoesEntregaCompactas, veiculoEntrega, modalUberInterno, uberQuoteDisponivel]);

  const simulacaoUber = simulacoesFretePorVeiculo['uber'] || null;

  return (
    <div className="checkout-delivery-layout">
      <div className="card-box checkout-delivery-main">
        <section className="checkout-delivery-section" aria-label="Forma de recebimento">
          <div className="checkout-delivery-section-head"><h3>Formas de recebimento</h3></div>
          <div className="delivery-mode-toggle" role="radiogroup" aria-label="Forma de recebimento">
            {['retirada', 'bike', 'uber'].map((forma) => (
              <button
                key={forma}
                type="button"
                role="radio"
                aria-checked={formaRecebimentoSelecionada === forma}
                className={`delivery-mode-toggle-btn ${formaRecebimentoSelecionada === forma ? 'is-active' : ''}`.trim()}
                onClick={() => selecionarFormaRecebimento(forma)}
                disabled={forma === 'uber' && !uberQuoteDisponivel}
                title={forma === 'uber' && !uberQuoteDisponivel ? 'Uber indisponível no momento' : ''}
              >
                {forma === 'retirada' ? 'Retirada na loja' : forma === 'bike' ? 'Bike' : 'Uber'}
              </button>
            ))}
          </div>
        </section>

        {formaRecebimentoSelecionada === 'uber' ? (
          <article className="delivery-uber-info" role="status" aria-live="polite" aria-label="Informações da entrega via Uber">
            <div className="delivery-uber-info-head">
              <span className="delivery-uber-info-icon" aria-hidden="true"><AlertTriangle size={16} strokeWidth={2} /></span>
              <p className="delivery-uber-info-title">Entrega realizada pela Uber</p>
            </div>
            <p className="delivery-uber-info-text">
              Sua entrega será feita por um parceiro logístico da Uber. Você poderá acompanhar o andamento da entrega e terá mais segurança no processo.
            </p>
          </article>
        ) : null}

        {!retiradaSelecionada ? (
          <div className="checkout-delivery-compact-head">
            <span aria-hidden="true"><MapPin size={16} strokeWidth={2} /></span>
            <div>
              <p className="checkout-delivery-compact-label">Entregar em:</p>
              <strong>{enderecoEntregaResumo}</strong>
              {enderecoEntregaComplemento ? (
                <p className="checkout-delivery-compact-subline">{enderecoEntregaComplemento}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="checkout-delivery-compact-switch"
              onClick={() => { document.getElementById('cep-entrega')?.focus(); }}
            >
              Trocar
            </button>
          </div>
        ) : null}

        {retiradaSelecionada ? (
          <>
            <PickupStoreCard economiaFrete={economiaFreteRetirada} />
            <p
              className={`delivery-feedback is-${mensagemFrete.tone}`}
              role={['error', 'warning'].includes(mensagemFrete.tone) ? 'alert' : 'status'}
              aria-live="polite"
            >
              {mensagemFrete.text}
            </p>
          </>
        ) : (
          <section className="checkout-delivery-section checkout-delivery-compact checkout-delivery-minimal" aria-label="Entrega">
            {temEnderecoContaSalvo ? (
              <div className="checkout-saved-address-option" role="status" aria-live="polite">
                <p className="checkout-saved-address-label">Endereço salvo na conta</p>
                <p className="checkout-saved-address-text">{enderecoContaSalvoResumo}</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const cepNorm = normalizarCep(enderecoContaSalvo?.cep || '');
                    const numeroNorm = String(enderecoContaSalvo?.numero || '').replace(/\D/g, '').slice(0, 10);
                    if (cepNorm.length !== 8) return;
                    setEntregaData({
                      cepEntrega: formatarCep(cepNorm),
                      numeroEntrega: numeroNorm || numeroEntrega,
                      enderecoCepEntrega: {
                        cep: formatarCep(cepNorm),
                        logradouro: String(enderecoContaSalvo?.logradouro || '').trim(),
                        bairro: String(enderecoContaSalvo?.bairro || '').trim(),
                        cidade: String(enderecoContaSalvo?.cidade || '').trim(),
                        estado: String(enderecoContaSalvo?.estado || '').trim().toUpperCase(),
                        complemento: String(enderecoContaSalvo?.complemento || '').trim(),
                      }
                    });
                    setErroEnderecoCepEntrega('');
                    setErroEntrega('');
                  }}
                  disabled={enderecoSalvoJaSelecionado}
                >
                  {enderecoSalvoJaSelecionado ? 'Endereço salvo em uso' : 'Usar endereço salvo'}
                </button>
              </div>
            ) : null}

            <div className="delivery-input-labels" aria-hidden="true">
              <span>CEP</span><span>Número</span>
            </div>

            <div className="delivery-cep-row">
              <div className="delivery-cep-input-wrap">
                <input
                  id="cep-entrega"
                  className="field-input entrega-cep-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={9}
                  placeholder="00000-000"
                  value={cepEntrega}
                  onChange={(e) => {
                    const cepF = formatarCep(e.target.value);
                    const cepN = normalizarCep(cepF);
                    setEntregaData({ cepEntrega: cepF });
                    setErroEntrega('');
                    if (cepN !== cepEnderecoConsultado) {
                      setEntregaData({ enderecoCepEntrega: null });
                      setErroEnderecoCepEntrega('');
                      setCepEnderecoConsultado('');
                    }
                  }}
                />
              </div>
              <input
                id="numero-entrega"
                className="field-input entrega-numero-input"
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="Número"
                value={numeroEntrega}
                onChange={(e) => setEntregaData({ numeroEntrega: String(e.target.value || '').replace(/\D/g, '').slice(0, 10) })}
              />
            </div>

            <button
              type="button"
              className="btn-secondary entrega-calcular-btn"
              onClick={() => { void carregarSimulacaoManual(); }}
              disabled={!cepEntregaValido || !String(numeroEntrega || '').trim() || simulandoFrete}
            >
              {simulandoFrete ? 'Calculando...' : 'Calcular entrega'}
            </button>

            {cepEntregaNormalizado ? (
              <DeliveryAddressLookupCard
                cep={formatarCep(cepEntregaNormalizado)}
                endereco={enderecoCepEntrega}
                carregando={buscandoEnderecoCepEntrega}
                erro={erroEnderecoCepEntrega}
                cepIncompleto={cepEntregaIncompleto}
              />
            ) : null}

            <p
              className={`delivery-feedback is-${mensagemFrete.tone}`}
              role={['error', 'warning'].includes(mensagemFrete.tone) ? 'alert' : 'status'}
              aria-live="polite"
            >
              {mensagemFrete.text}
            </p>

            {avisoRestricaoVeiculo ? (
              <p className="delivery-feedback is-warning" role="status">{avisoRestricaoVeiculo}</p>
            ) : null}

            {bloqueioAgua20LAtivo ? (
              <p className="delivery-feedback is-warning" role="alert">{bloqueioAgua20LMotivo}</p>
            ) : null}

            {veiculoEntrega === 'uber' && simulacaoUber ? (
              <p className="delivery-feedback is-neutral" role="status">Modal definido automaticamente para seu pedido</p>
            ) : null}

            <div className="delivery-options-grid" role="radiogroup" aria-label="Escolha como receber">
              {opcoesEntregaCompactas.map((key) => {
                const veiculo = key === 'bike' ? VEICULOS_ENTREGA.bike : { ...VEICULOS_ENTREGA.moto, label: 'Entrega Uber' };
                const sim = simulacoesFretePorVeiculo[key];
                const disabledBike = key === 'bike' && !bikeDisponivel;
                const titulo = key === 'bike' ? 'Bike' : 'Entrega Uber';
                const descricao = key === 'bike'
                  ? `Entrega local até ${LIMITE_BIKE_KM.toFixed(1)} km`
                  : 'Entrega para fora do raio da bike ou pedidos maiores';
                return (
                  <DeliveryOptionCard
                    key={key}
                    veiculo={{ ...veiculo, label: titulo, descricao }}
                    selecionado={veiculoEntrega === key}
                    precoLabel={sim ? formatarMoeda(Number(sim.frete || 0)) : 'A calcular'}
                    disabled={disabledBike}
                    disabledReason={disabledBike ? `Disponível apenas até ${LIMITE_BIKE_KM.toFixed(1)} km` : ''}
                    onSelect={() => {
                      setEntregaData({ tipoEntrega: 'entrega', veiculoEntrega: key, simulacaoFrete: sim || null });
                      setErroEntrega('');
                    }}
                  />
                );
              })}
            </div>

            {semOpcaoEntregaDisponivel ? (
              <div className="delivery-empty-state" role="alert">
                <span aria-hidden="true"><AlertTriangle size={18} strokeWidth={2} /></span>
                <div>
                  <strong>Sem opção de entrega disponível para este CEP.</strong>
                  <p>Verifique o CEP informado ou tente outro endereço para continuar.</p>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );

  async function carregarSimulacaoManual() {
    await consultarEnderecoCepEntrega(cepEntregaNormalizado, { mostrarErro: false });
  }
}
