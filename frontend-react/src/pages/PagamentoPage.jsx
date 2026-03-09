import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { criarPedido, gerarPix, getMe, getPedidos, isAuthErrorMessage, simularFretePorCep } from '../lib/api';
import { useCart } from '../context/CartContext';

const ETAPAS = {
  CARRINHO: 'carrinho',
  ENTREGA: 'entrega',
  PAGAMENTO: 'pagamento',
  PIX: 'pix',
  STATUS: 'status'
};

const CEP_MERCADO = '68740-180';
const NUMERO_MERCADO = '70';
const LIMITE_BIKE_KM = 1;

const VEICULOS_ENTREGA = {
  bike: {
    label: 'Bike',
    imagem: '/img/veiculos/bike.svg',
    consumo: 'Sem combustível',
    fatorReparo: 1.1,
    observacao: `Até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado`
  },
  moto: {
    label: 'Moto',
    imagem: '/img/veiculos/moto.svg',
    consumo: '30 km/l',
    fatorReparo: 1.5,
    observacao: 'Equilíbrio entre velocidade e custo'
  },
  carro: {
    label: 'Carro',
    imagem: '/img/veiculos/carro.svg',
    consumo: '12 km/l',
    fatorReparo: 2.2,
    observacao: 'Ideal para pedidos maiores'
  }
};

function normalizarCep(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarCep(valor) {
  const cep = normalizarCep(valor);
  if (cep.length <= 5) {
    return cep;
  }

  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function normalizarDocumentoFiscal(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function formatarDocumentoFiscal(valor) {
  const digits = normalizarDocumentoFiscal(valor);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function PagamentoPage() {
  const { itens, resumo, updateItemQuantity, removeItem, clearCart } = useCart();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultadoPix, setResultadoPix] = useState(null);
  const [etapaAtual, setEtapaAtual] = useState(ETAPAS.CARRINHO);
  const [statusPedidoAtual, setStatusPedidoAtual] = useState('');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [cepEntrega, setCepEntrega] = useState('');
  const [veiculoEntrega, setVeiculoEntrega] = useState('moto');
  const [simulacaoFrete, setSimulacaoFrete] = useState(null);
  const [simulandoFrete, setSimulandoFrete] = useState(false);
  const [erroEntrega, setErroEntrega] = useState('');
  const [documentoPagador, setDocumentoPagador] = useState('');

  const itensPedido = useMemo(
    () =>
      itens.map((item) => ({
        produto_id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        quantidade: Number(item.quantidade || 1)
      })),
    [itens]
  );

  const freteAtual = Number(simulacaoFrete?.frete || 0);

  const totalComFreteAtual = useMemo(
    () => Number((Number(resumo.total || 0) + freteAtual).toFixed(2)),
    [resumo.total, freteAtual]
  );

  const freteSelecionado = Number(resultadoPedido?.frete_entrega ?? simulacaoFrete?.frete ?? 0);
  const distanciaSelecionada = Number(resultadoPedido?.distancia_entrega_km ?? simulacaoFrete?.distancia_km ?? 0);
  const distanciaSelecionadaTexto = distanciaSelecionada > 0 ? `${distanciaSelecionada.toFixed(2)} km` : '-';
  const veiculoSelecionadoResumo = VEICULOS_ENTREGA[resultadoPedido?.veiculo_entrega] || VEICULOS_ENTREGA[simulacaoFrete?.veiculo] || VEICULOS_ENTREGA[veiculoEntrega] || VEICULOS_ENTREGA.moto;
  const cepDestinoSelecionado = String(resultadoPedido?.cep_destino_entrega || simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-');
  const cepOrigemSelecionado = String(resultadoPedido?.cep_origem_entrega || simulacaoFrete?.cep_origem || CEP_MERCADO);
  const numeroOrigemSelecionado = String(resultadoPedido?.numero_origem_entrega || simulacaoFrete?.numero_origem || NUMERO_MERCADO);
  const totalProdutosPedido = Number(resultadoPedido?.total_produtos ?? resumo.total ?? 0);
  const totalComEntregaPedido = Number(resultadoPedido?.total ?? Number((totalProdutosPedido + freteSelecionado).toFixed(2)));

  useEffect(() => {
    let ativo = true;
    setVerificandoSessao(true);

    getMe()
      .then(() => {
        if (ativo) {
          setAutenticado(true);
        }
      })
      .catch((error) => {
        if (!ativo) {
          return;
        }

        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        } else {
          setAutenticado(false);
          setErro(error.message || 'Não foi possível validar sua sessão.');
        }
      })
      .finally(() => {
        if (ativo) {
          setVerificandoSessao(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!resultadoPedido?.pedido_id || autenticado !== true) {
      return;
    }

    let ativo = true;

    async function atualizarStatus() {
      try {
        const data = await getPedidos();
        const pedido = (data.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
        if (ativo && pedido?.status) {
          const novoStatus = String(pedido.status);
          setStatusPedidoAtual(novoStatus);
          if (novoStatus === 'pago' || novoStatus === 'entregue') {
            setPagamentoConfirmado(true);
          }
        }
      } catch (error) {
        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        }
      }
    }

    atualizarStatus();
    const interval = setInterval(atualizarStatus, 15000);

    return () => {
      ativo = false;
      clearInterval(interval);
    };
  }, [resultadoPedido?.pedido_id, autenticado]);

  async function executarSimulacaoFrete({ mostrarErro = true } = {}) {
    const cepNormalizado = normalizarCep(cepEntrega);
    if (cepNormalizado.length !== 8) {
      const mensagem = 'Informe um CEP válido com 8 dígitos.';
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(mensagem);
      }
      return null;
    }

    setErroEntrega('');
    setSimulandoFrete(true);

    try {
      const data = await simularFretePorCep({
        cep: cepNormalizado,
        veiculo: veiculoEntrega
      });
      setSimulacaoFrete(data);
      return data;
    } catch (error) {
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(error.message || 'Não foi possível calcular o frete pelo CEP.');
      }
      return null;
    } finally {
      setSimulandoFrete(false);
    }
  }

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoPedido(null);
    setErro('');

    if (autenticado !== true) {
      setAutenticado(false);
      setErro('Faça login na conta para concluir pedido e gerar PIX.');
      return;
    }

    if (itensPedido.length === 0) {
      setErro('Adicione produtos ao carrinho para criar o pedido.');
      return;
    }

    const cepNormalizado = normalizarCep(cepEntrega);
    if (cepNormalizado.length !== 8) {
      setErroEntrega('Informe um CEP válido com 8 dígitos para calcular a entrega.');
      setEtapaAtual(ETAPAS.ENTREGA);
      return;
    }

    let freteSimulado = simulacaoFrete;
    const cepSimulacaoAtual = normalizarCep(simulacaoFrete?.cep_destino);
    const veiculoSimulacaoAtual = String(simulacaoFrete?.veiculo || '').toLowerCase();
    const precisaNovaSimulacao = !freteSimulado || cepSimulacaoAtual !== cepNormalizado || veiculoSimulacaoAtual !== veiculoEntrega;

    if (precisaNovaSimulacao) {
      freteSimulado = await executarSimulacaoFrete();
      if (!freteSimulado) {
        setEtapaAtual(ETAPAS.ENTREGA);
        return;
      }
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar PIX.');
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    setCarregando(true);
    try {
      const data = await criarPedido({
        itens: itensPedido,
        formaPagamento: 'pix',
        taxId: documentoDigits,
        entrega: {
          veiculo: veiculoEntrega,
          cep_destino: formatarCep(cepNormalizado),
          frete_estimado: Number(freteSimulado?.frete || 0),
          distancia_km: Number(freteSimulado?.distancia_km || 0),
          fator_reparo: VEICULOS_ENTREGA[veiculoEntrega]?.fatorReparo || 1
        }
      });

      setResultadoPedido(data);
      setStatusPedidoAtual('pendente');
      clearCart();
      setEtapaAtual(ETAPAS.PIX);

      if (data?.pix_codigo) {
        setResultadoPix({
          status: data.pix_erro ? 'fallback' : 'waiting',
          qr_data: data.pix_codigo,
          qr_code_base64: null
        });
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleIrParaPix() {
    if (resultadoPedido?.pedido_id) {
      setEtapaAtual(ETAPAS.PIX);
      return;
    }
    await handleCriarPedido();
  }

  async function handleGerarPix(pedidoId) {
    setResultadoPix(null);
    setErro('');

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o PIX.');
      return;
    }

    setCarregando(true);
    try {
      const data = await gerarPix(pedidoId, documentoDigits);
      setResultadoPix(data);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.ENTREGA) return 1;
    if (etapa === ETAPAS.PAGAMENTO) return 2;
    if (etapa === ETAPAS.PIX) return 3;
    return 4;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const labelStatus = statusPedidoAtual || resultadoPedido?.status || 'pendente';

  if (verificandoSessao) {
    return (
      <section className="page">
        <h1>Finalizar pedido</h1>
        <p>Verificando sua sessão...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Finalizar pedido</h1>
      <p>Fluxo em etapas: carrinho, entrega por CEP, forma de pagamento, PIX e confirmação.</p>

      {autenticado === false ? (
        <div className="card-box">
          <p><strong>Faça login para concluir o pedido e gerar PIX.</strong></p>
          <p>Você pode revisar e editar o carrinho normalmente antes do login.</p>
          <Link to="/conta" className="btn-primary" style={{ display: 'inline-block', marginTop: '0.4rem' }}>
            Ir para Conta
          </Link>
        </div>
      ) : null}

      <div className="checkout-steps" aria-label="Etapas do checkout">
        {['Carrinho', 'Entrega', 'Pagamento', 'PIX', 'Confirmação'].map((titulo, index) => (
          <div key={titulo} className={`checkout-step ${etapaIndex >= index ? 'active' : ''}`}>
            <span className="checkout-step-index">{index + 1}</span>
            <span className="checkout-step-label">{titulo}</span>
          </div>
        ))}
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}

      {etapaAtual === ETAPAS.CARRINHO ? (
        <div className="card-box">
          <p><strong>Etapa 1: Carrinho</strong></p>
          {itens.length === 0 ? (
            <>
              <p className="muted-text">Carrinho vazio. Adicione produtos na página de produtos.</p>
              <Link to="/produtos" className="btn-secondary" style={{ display: 'inline-block' }}>
                Voltar para produtos
              </Link>
            </>
          ) : (
            <div className="produto-lista">
              {itens.map((item) => (
                <div className="produto-item" key={item.id}>
                  <div>
                    <p><strong>{item.emoji || '📦'} {item.nome}</strong></p>
                    <p>R$ {Number(item.preco || 0).toFixed(2)}</p>
                  </div>
                  <div className="cart-item-actions">
                    <input
                      className="qtd-input"
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                    />
                    <button className="btn-secondary" type="button" onClick={() => removeItem(item.id)}>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pedido-resumo">
            <p><strong>Resumo:</strong> {resumo.itens} item(ns)</p>
            <p><strong>Total previsto:</strong> R$ {resumo.total.toFixed(2)}</p>
          </div>

          <button className="btn-primary" type="button" onClick={() => setEtapaAtual(ETAPAS.ENTREGA)} disabled={itens.length === 0}>
            Ir para entrega
          </button>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.ENTREGA ? (
        <div className="card-box">
          <p><strong>Etapa 2: Entrega</strong></p>
          <p className="muted-text">Informe o CEP de entrega e escolha o veículo para calcular o frete.</p>
          <p className="muted-text">Mercado: CEP {CEP_MERCADO}, número {NUMERO_MERCADO}. Bike atende até {LIMITE_BIKE_KM.toFixed(1)} km.</p>

          <label htmlFor="cep-entrega"><strong>CEP de entrega</strong></label>
          <div className="entrega-cep-row">
            <input
              id="cep-entrega"
              className="field-input entrega-cep-input"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              placeholder="00000-000"
              value={cepEntrega}
              onChange={(event) => {
                setCepEntrega(formatarCep(event.target.value));
                setSimulacaoFrete(null);
                setErroEntrega('');
              }}
            />

            <button
              className="btn-primary entrega-calcular-btn"
              type="button"
              onClick={() => {
                void executarSimulacaoFrete();
              }}
              disabled={simulandoFrete || normalizarCep(cepEntrega).length !== 8}
            >
              {simulandoFrete ? 'Calculando...' : 'Calcular frete'}
            </button>
          </div>

          <div className="entrega-veiculos-grid" role="radiogroup" aria-label="Seleção de veículo de entrega">
            {Object.entries(VEICULOS_ENTREGA).map(([key, veiculo]) => {
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={veiculoEntrega === key}
                  className={`entrega-veiculo-btn ${veiculoEntrega === key ? 'active' : ''}`}
                  onClick={() => {
                    setVeiculoEntrega(key);
                    setSimulacaoFrete(null);
                    setErroEntrega('');
                  }}
                >
                  <span className="entrega-veiculo-head">
                    <img
                      className="entrega-veiculo-img"
                      src={veiculo.imagem}
                      alt={`Veículo ${veiculo.label}`}
                      loading="lazy"
                    />
                    <span className="entrega-veiculo-info">
                      <span className="entrega-veiculo-nome">{veiculo.label}</span>
                      <span className="entrega-veiculo-consumo">{veiculo.consumo}</span>
                    </span>
                  </span>
                  <span className="entrega-veiculo-meta">
                    Fator reparo {veiculo.fatorReparo.toFixed(1)}x • {veiculo.observacao}
                  </span>
                </button>
              );
            })}
          </div>

          {erroEntrega ? <p className="error-text">{erroEntrega}</p> : null}

          <div className="pedido-resumo">
            <p><strong>Veículo selecionado:</strong> {VEICULOS_ENTREGA[veiculoEntrega]?.label || 'Moto'}</p>
            <p><strong>CEP destino:</strong> {simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-'}</p>
            <p><strong>Distância estimada:</strong> {simulacaoFrete ? `${Number(simulacaoFrete.distancia_km || 0).toFixed(2)} km` : '-'}</p>
            <p><strong>Frete estimado:</strong> {simulacaoFrete ? `R$ ${freteAtual.toFixed(2)}` : '-'}</p>
            <p><strong>Total com entrega:</strong> {simulacaoFrete ? `R$ ${totalComFreteAtual.toFixed(2)}` : '-'}</p>
          </div>

          <div className="entrega-acoes-row">
            <button
              className="btn-secondary entrega-voltar-carrinho-btn"
              type="button"
              onClick={() => setEtapaAtual(ETAPAS.CARRINHO)}
              aria-label="Voltar para carrinho"
              title="Voltar para carrinho"
            >
              <span className="entrega-voltar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            <button
              className="btn-primary entrega-ir-pagamento-btn"
              type="button"
              onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
              disabled={itens.length === 0 || !simulacaoFrete || simulandoFrete}
            >
              Ir para pagamento
            </button>
          </div>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
        <div className="card-box">
          <p><strong>Etapa 3: Escolha a forma de pagamento</strong></p>
          <p className="muted-text">
            {simulacaoFrete
              ? `Frete via ${VEICULOS_ENTREGA[veiculoEntrega]?.label || 'Moto'}: R$ ${freteAtual.toFixed(2)} (${Number(simulacaoFrete.distancia_km || 0).toFixed(2)} km)`
              : 'Calcule o frete por CEP na etapa Entrega para continuar.'}
          </p>
          {autenticado === true ? (
            <>
              <div className="card-box" style={{ marginTop: '0.3rem' }}>
                <p><strong>✅ PIX</strong> (única opção disponível)</p>
                <p className="muted-text" style={{ marginTop: '0.2rem' }}>Pagamento instantâneo via QR Code ou copia e cola.</p>
              </div>

              <label htmlFor="documento-pagador"><strong>CPF/CNPJ do pagador</strong></label>
              <input
                id="documento-pagador"
                className="field-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="CPF ou CNPJ"
                maxLength={18}
                value={documentoPagador}
                onChange={(event) => {
                  setDocumentoPagador(formatarDocumentoFiscal(event.target.value));
                }}
              />
              <p className="muted-text" style={{ marginTop: '0.2rem' }}>
                Obrigatório para emissão do PIX no PagBank em produção.
              </p>

              <button
                className="btn-primary"
                type="button"
                onClick={handleIrParaPix}
                disabled={carregando || simulandoFrete || (itens.length === 0 && !resultadoPedido?.pedido_id) || (!resultadoPedido?.pedido_id && !simulacaoFrete)}
              >
                {carregando ? 'Preparando pagamento...' : 'Continuar com PIX'}
              </button>
            </>
          ) : (
            <>
              <p className="muted-text">Entre na sua conta para continuar para o PIX.</p>
              <Link to="/conta" className="btn-primary" style={{ display: 'inline-block' }}>
                Ir para Conta
              </Link>
            </>
          )}
          <button className="btn-secondary" type="button" onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}>
            Voltar para entrega
          </button>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
        <div className="card-box">
          <p><strong>Etapa 4: Fazer pagamento PIX</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido #{resultadoPedido.pedido_id} criado.</p>
              <p>Total dos produtos: R$ {totalProdutosPedido.toFixed(2)}</p>
              <p>
                Frete ({veiculoSelecionadoResumo.label}, {distanciaSelecionadaTexto}, CEP {cepDestinoSelecionado}):
                {' '}R$ {freteSelecionado.toFixed(2)}
              </p>
              <p className="muted-text">Origem: {cepOrigemSelecionado}, nº {numeroOrigemSelecionado}</p>
              <p><strong>Total com entrega: R$ {totalComEntregaPedido.toFixed(2)}</strong></p>
            </>
          ) : null}

          <button
            className="btn-secondary"
            type="button"
            disabled={carregando || !resultadoPedido?.pedido_id}
            onClick={() => handleGerarPix(resultadoPedido.pedido_id)}
          >
            {carregando ? 'Gerando PIX...' : 'Gerar/Atualizar QR Code PIX'}
          </button>

          {resultadoPix ? (
            <>
              <p>Status do PIX: {resultadoPix.status || '-'}</p>
              {resultadoPix.qr_data ? (
                <textarea
                  className="field-input"
                  rows={4}
                  readOnly
                  value={resultadoPix.qr_data}
                />
              ) : null}
              {resultadoPix.qr_code_base64 ? (
                <img
                  className="pix-image"
                  src={`data:image/png;base64,${resultadoPix.qr_code_base64}`}
                  alt="QR Code PIX"
                />
              ) : null}
            </>
          ) : (
            <p className="muted-text">Clique em gerar PIX para exibir QR Code e código copia e cola.</p>
          )}

          <button className="btn-primary" type="button" onClick={() => {
            setPagamentoConfirmado(true);
            setEtapaAtual(ETAPAS.STATUS);
          }}>
            Confirmar pagamento
          </button>
          <button className="btn-secondary" type="button" onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}>
            Voltar
          </button>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <div className="card-box">
          <p><strong>Etapa 5: Status do pedido</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido: #{resultadoPedido.pedido_id}</p>
              <p>Total com entrega estimado: R$ {totalComEntregaPedido.toFixed(2)}</p>
              <p>
                Situação atual: <span className="pedido-status-badge">{labelStatus}</span>
              </p>
              {pagamentoConfirmado ? (
                <div className="pagamento-ok" aria-label="Pagamento confirmado com sucesso">
                  <span className="pagamento-ok-icon">✅</span>
                  <span>Pagamento efetuado com sucesso</span>
                </div>
              ) : null}
              <p className="muted-text">Atualização automática a cada 15 segundos.</p>
            </>
          ) : (
            <p className="muted-text">Crie um pedido antes de acompanhar status.</p>
          )}

          <div className="card-box" style={{ marginTop: '0.4rem' }}>
            <p><strong>Ajuda rápida</strong></p>
            <p>Se o QR não abrir no banco, copie o código PIX e cole no app manualmente.</p>
            <p>Após o pagamento, a loja confirma e inicia a preparação/envio do pedido.</p>
          </div>

          <button className="btn-secondary" type="button" onClick={() => setEtapaAtual(ETAPAS.PIX)}>
            Voltar para PIX
          </button>
        </div>
      ) : null}
    </section>
  );
}

