import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { criarPedido, gerarPix, getMe, getPagBankPublicKey, getPedidos, isAuthErrorMessage, pagarCartao, simularFretePorCep } from '../lib/api';
import { criptografarCartaoPagBank } from '../lib/pagbank';
import { useCart } from '../context/CartContext';

const ETAPAS = {
  CARRINHO: 'carrinho',
  ENTREGA: 'entrega',
  PAGAMENTO: 'pagamento',
  PIX: 'pix',
  STATUS: 'status'
};

const PARCELAMENTO_MINIMO_CREDITO = 100;
const PARCELAMENTO_MAXIMO_CREDITO = 3;

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

function normalizarNumeroCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 19);
}

function formatarNumeroCartao(valor) {
  const digits = normalizarNumeroCartao(valor);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatarMesCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 2);
}

function formatarAnoCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

function formatarCvvCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

const STATUS_PEDIDO_LABELS = {
  pendente: 'Aguardando confirmação',
  preparando: 'Em preparação',
  enviado: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pago: 'Pago'
};

const STATUS_PAGAMENTO_LABELS = {
  WAITING: 'Aguardando pagamento',
  IN_ANALYSIS: 'Em análise',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pagamento aprovado',
  DECLINED: 'Pagamento recusado',
  CANCELED: 'Pagamento cancelado',
  EXPIRED: 'Pagamento expirado'
};

function formatarStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_PEDIDO_LABELS[status] || 'Em análise';
}

function formatarStatusPagamento(statusRaw) {
  const status = String(statusRaw || '').trim().toUpperCase();
  return STATUS_PAGAMENTO_LABELS[status] || 'Em processamento';
}

function BotaoVoltarSeta({ onClick, label, disabled = false }) {
  return (
    <button
      className="btn-secondary entrega-voltar-carrinho-btn"
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function LinkVoltarSeta({ to, label }) {
  return (
    <Link
      to={to}
      className="btn-secondary entrega-voltar-carrinho-btn"
      aria-label={label}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
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
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [pagBankPublicKey, setPagBankPublicKey] = useState('');
  const [buscandoChavePublica, setBuscandoChavePublica] = useState(false);
  const [tokenCartao, setTokenCartao] = useState('');
  const [criptografandoCartao, setCriptografandoCartao] = useState(false);
  const [nomeTitularCartao, setNomeTitularCartao] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [mesExpiracaoCartao, setMesExpiracaoCartao] = useState('');
  const [anoExpiracaoCartao, setAnoExpiracaoCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [parcelasCartao, setParcelasCartao] = useState('1');
  const [resultadoCartao, setResultadoCartao] = useState(null);

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
  const totalReferenciaParcelamento = Number(resultadoPedido?.total ?? totalComFreteAtual ?? 0);
  const parcelamentoCreditoDisponivel = totalReferenciaParcelamento >= PARCELAMENTO_MINIMO_CREDITO;
  const parcelasCartaoEfetivas = (() => {
    if (formaPagamento === 'debito') {
      return 1;
    }

    if (!parcelamentoCreditoDisponivel) {
      return 1;
    }

    const parcelasSelecionadas = Number.parseInt(parcelasCartao, 10);
    if (!Number.isFinite(parcelasSelecionadas) || parcelasSelecionadas < 1) {
      return 1;
    }

    return Math.min(PARCELAMENTO_MAXIMO_CREDITO, parcelasSelecionadas);
  })();
  const pagamentoCartaoSelecionado = formaPagamento === 'credito' || formaPagamento === 'debito';
  const tituloFormaPagamento = formaPagamento === 'pix'
    ? 'PIX'
    : formaPagamento === 'debito'
      ? 'Cartão de Débito'
      : 'Cartão de Crédito';

  useEffect(() => {
    if (formaPagamento !== 'credito') {
      return;
    }

    if (!parcelamentoCreditoDisponivel && parcelasCartao !== '1') {
      setParcelasCartao('1');
      return;
    }

    const parcelasSelecionadas = Number.parseInt(parcelasCartao, 10);
    if (Number.isFinite(parcelasSelecionadas) && parcelasSelecionadas > PARCELAMENTO_MAXIMO_CREDITO) {
      setParcelasCartao(String(PARCELAMENTO_MAXIMO_CREDITO));
    }
  }, [formaPagamento, parcelamentoCreditoDisponivel, parcelasCartao]);

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

  function limparTokenCartaoGerado() {
    setTokenCartao('');
    setResultadoCartao(null);
  }

  async function carregarChavePublicaPagBank() {
    if (pagBankPublicKey) {
      return pagBankPublicKey;
    }

    setBuscandoChavePublica(true);
    try {
      const data = await getPagBankPublicKey();
      const chave = String(data?.public_key || '').trim();
      if (!chave) {
        throw new Error('Não foi possível iniciar o pagamento com cartão no momento.');
      }

      setPagBankPublicKey(chave);
      return chave;
    } finally {
      setBuscandoChavePublica(false);
    }
  }

  async function handleCriptografarCartao() {
    setErro('');

    if (!pagamentoCartaoSelecionado) {
      return '';
    }

    const holder = String(nomeTitularCartao || '').trim();
    const number = normalizarNumeroCartao(numeroCartao);
    const expMonth = formatarMesCartao(mesExpiracaoCartao);
    const expYear = formatarAnoCartao(anoExpiracaoCartao);
    const securityCode = formatarCvvCartao(cvvCartao);

    if (holder.length < 3) {
      throw new Error('Informe o nome completo do titular do cartão.');
    }

    if (number.length < 13) {
      throw new Error('Número do cartão inválido.');
    }

    const mes = Number.parseInt(expMonth, 10);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error('Mês de expiração inválido.');
    }

    if (expYear.length !== 4) {
      throw new Error('Ano de expiração inválido.');
    }

    if (![3, 4].includes(securityCode.length)) {
      throw new Error('CVV inválido.');
    }

    setCriptografandoCartao(true);
    try {
      const publicKey = await carregarChavePublicaPagBank();
      const encryptedCard = await criptografarCartaoPagBank({
        publicKey,
        holder,
        number,
        expMonth,
        expYear,
        securityCode
      });

      setTokenCartao(encryptedCard);
      return encryptedCard;
    } finally {
      setCriptografandoCartao(false);
    }
  }

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoCartao(null);
    setResultadoPedido(null);
    setErro('');

    if (autenticado !== true) {
      setAutenticado(false);
      setErro('Faça login para concluir o pedido.');
      return;
    }

    if (itensPedido.length === 0) {
      setErro('Adicione produtos ao carrinho para continuar.');
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
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (pagamentoCartaoSelecionado) {
      try {
        await carregarChavePublicaPagBank();
      } catch (error) {
        setErro(error.message || 'Não foi possível preparar o pagamento com cartão.');
        setEtapaAtual(ETAPAS.PAGAMENTO);
        return;
      }
    }

    setCarregando(true);
    try {
      const data = await criarPedido({
        itens: itensPedido,
        formaPagamento,
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
      const formaRetornada = String(data?.forma_pagamento || formaPagamento || '').toLowerCase();
      if (formaRetornada === 'debito') {
        setFormaPagamento('debito');
      } else if (['cartao', 'credito'].includes(formaRetornada)) {
        setFormaPagamento('credito');
      } else {
        setFormaPagamento('pix');
      }
      setStatusPedidoAtual('pendente');
      clearCart();
      setEtapaAtual(ETAPAS.PIX);

      if (formaPagamento === 'pix' && data?.pix_codigo) {
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

  async function handleIrParaPagamento() {
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

  async function handlePagarCartao(pedidoId) {
    setResultadoCartao(null);
    setErro('');

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento com cartão.');
      return;
    }

    let tokenNormalizado = String(tokenCartao || '').trim();
    if (!tokenNormalizado) {
      try {
        tokenNormalizado = await handleCriptografarCartao();
      } catch (error) {
        setErro(error.message || 'Não foi possível validar os dados do cartão.');
        return;
      }
    }

    setCarregando(true);
    try {
      const data = await pagarCartao(pedidoId, {
        taxId: documentoDigits,
        tokenCartao: tokenNormalizado,
        parcelas: parcelasCartaoEfetivas,
        tipoCartao: formaPagamento
      });

      setResultadoCartao(data);

      const statusPagBank = String(data?.status || '').toUpperCase();
      const statusInterno = String(data?.status_interno || '').toLowerCase();
      if (statusPagBank === 'PAID' || statusInterno === 'pago' || statusInterno === 'entregue') {
        setStatusPedidoAtual(statusInterno || 'pago');
        setPagamentoConfirmado(true);
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

  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.ENTREGA) return 1;
    if (etapa === ETAPAS.PAGAMENTO) return 2;
    if (etapa === ETAPAS.PIX) return 3;
    return 4;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const labelStatus = formatarStatusPedido(statusPedidoAtual || resultadoPedido?.status || 'pendente');
  const tituloEtapa4 = formaPagamento === 'pix' ? 'PIX' : tituloFormaPagamento;
  const carrinhoVazio = itens.length === 0;
  const statusCartaoAtual = String(resultadoCartao?.status || '').toUpperCase();
  const statusInternoCartaoAtual = String(resultadoCartao?.status_interno || '').toLowerCase();
  const cartaoRecusado = statusCartaoAtual === 'DECLINED' || statusCartaoAtual === 'CANCELED';
  const cartaoProcessado = Boolean(resultadoCartao) && !cartaoRecusado;
  const cartaoAprovado = statusCartaoAtual === 'PAID' || statusInternoCartaoAtual === 'pago' || statusInternoCartaoAtual === 'entregue';

  if (verificandoSessao) {
    return (
      <section className="page">
        <h1>Finalizar pedido</h1>
        <p>Validando sua sessão...</p>
      </section>
    );
  }

  return (
    <section className={`page ${etapaAtual === ETAPAS.CARRINHO ? 'page-checkout-carrinho' : ''}`}>
      <h1>Finalizar pedido</h1>
      <p>Revise seu carrinho, confirme a entrega, escolha o pagamento e acompanhe a confirmação do pedido.</p>

      <div className="checkout-steps" aria-label="Etapas do checkout">
        {['Carrinho', 'Entrega', 'Pagamento', tituloEtapa4, 'Confirmação'].map((titulo, index) => (
          <div key={titulo} className={`checkout-step ${etapaIndex >= index ? 'active' : ''}`}>
            <span className="checkout-step-index">{index + 1}</span>
            <span className="checkout-step-label">{titulo}</span>
          </div>
        ))}
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}

      {etapaAtual === ETAPAS.CARRINHO ? (
        <>
          <div className="card-box">
            <p><strong>Etapa 1: Carrinho</strong></p>
            {carrinhoVazio ? (
              <p className="muted-text">Seu carrinho está vazio. Adicione produtos para continuar.</p>
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
          </div>

          <div className="checkout-carrinho-bar" role="region" aria-label="Resumo do carrinho, retorno para produtos e avanço para entrega">
            <div className="checkout-carrinho-bar-voltar-slot">
              <LinkVoltarSeta to="/produtos" label="Voltar para buscar produtos" />
            </div>

            <div className="checkout-carrinho-bar-info">
              <span><strong>Resumo:</strong> {resumo.itens} item(ns)</span>
              <span className="checkout-carrinho-bar-separador" aria-hidden="true">|</span>
              <span><strong>Total previsto:</strong> R$ {resumo.total.toFixed(2)}</span>
              {carrinhoVazio ? (
                <>
                  <span className="checkout-carrinho-bar-separador" aria-hidden="true">|</span>
                  <span className="checkout-carrinho-bar-aviso">Adicione itens para continuar</span>
                </>
              ) : null}
            </div>

            <div className="checkout-carrinho-bar-acoes">
              <button
                className="btn-primary checkout-carrinho-bar-botao"
                type="button"
                onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
                disabled={carrinhoVazio}
              >
                Continuar para entrega
              </button>
            </div>
          </div>

        </>
      ) : null}

      {etapaAtual === ETAPAS.ENTREGA ? (
        <div className="card-box">
          <p><strong>Etapa 2: Entrega</strong></p>
          <p className="muted-text">Informe o CEP e selecione o tipo de entrega para calcular o frete.</p>
          <p className="muted-text">Origem da loja: CEP {CEP_MERCADO}, nº {NUMERO_MERCADO}. Bike disponível até {LIMITE_BIKE_KM.toFixed(1)} km.</p>

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
              {simulandoFrete ? 'Calculando frete...' : 'Calcular frete'}
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
                    Estimativa operacional {veiculo.fatorReparo.toFixed(1)}x • {veiculo.observacao}
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
            <BotaoVoltarSeta
              onClick={() => setEtapaAtual(ETAPAS.CARRINHO)}
              label="Voltar para carrinho"
            />

            <button
              className="btn-primary entrega-ir-pagamento-btn"
              type="button"
              onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
              disabled={itens.length === 0 || !simulacaoFrete || simulandoFrete}
            >
              Continuar para pagamento
            </button>
          </div>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
        <div className="card-box">
          <p><strong>Etapa 3: Pagamento</strong></p>
          <p className="muted-text">
            {simulacaoFrete
              ? `Frete via ${VEICULOS_ENTREGA[veiculoEntrega]?.label || 'Moto'}: R$ ${freteAtual.toFixed(2)} (${Number(simulacaoFrete.distancia_km || 0).toFixed(2)} km)`
              : 'Calcule o frete por CEP na etapa Entrega para continuar.'}
          </p>
          {autenticado === true ? (
            <>
              <div className="card-box" style={{ marginTop: '0.3rem' }}>
                <p><strong>Forma selecionada:</strong> {tituloFormaPagamento}</p>
                <p className="muted-text" style={{ marginTop: '0.2rem' }}>
                  PIX gera QR Code na hora. Cartões são processados com segurança pelo PagBank.
                </p>
              </div>

              <div className="entrega-veiculos-grid" role="radiogroup" aria-label="Seleção da forma de pagamento">
                <button
                  type="button"
                  role="radio"
                  aria-checked={formaPagamento === 'pix'}
                  className={`entrega-veiculo-btn ${formaPagamento === 'pix' ? 'active' : ''}`}
                  onClick={() => {
                    setFormaPagamento('pix');
                    setErro('');
                    limparTokenCartaoGerado();
                  }}
                >
                  <span className="entrega-veiculo-head">
                    <span className="entrega-veiculo-info">
                      <span className="entrega-veiculo-nome">
                        <span aria-hidden="true">💠 </span>
                        PIX
                      </span>
                      <span className="entrega-veiculo-consumo">QR Code e código Copia e Cola</span>
                    </span>
                  </span>
                  <span className="entrega-veiculo-meta">Confirmação automática após aprovação do pagamento</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={formaPagamento === 'credito'}
                  className={`entrega-veiculo-btn ${formaPagamento === 'credito' ? 'active' : ''}`}
                  onClick={() => {
                    setFormaPagamento('credito');
                    setErro('');
                    limparTokenCartaoGerado();
                  }}
                >
                  <span className="entrega-veiculo-head">
                    <span className="entrega-veiculo-info">
                      <span className="entrega-veiculo-nome">
                        <span aria-hidden="true">💳 </span>
                        Cartão de Crédito
                      </span>
                      <span className="entrega-veiculo-consumo">Parcelamento disponível em até 3x</span>
                    </span>
                  </span>
                  <span className="entrega-veiculo-meta">Para pedidos a partir de R$ 100,00</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={formaPagamento === 'debito'}
                  className={`entrega-veiculo-btn ${formaPagamento === 'debito' ? 'active' : ''}`}
                  onClick={() => {
                    setFormaPagamento('debito');
                    setParcelasCartao('1');
                    setErro('');
                    limparTokenCartaoGerado();
                  }}
                >
                  <span className="entrega-veiculo-head">
                    <span className="entrega-veiculo-info">
                      <span className="entrega-veiculo-nome">
                        <span aria-hidden="true">🏧 </span>
                        Cartão de Débito
                      </span>
                      <span className="entrega-veiculo-consumo">Pagamento à vista no cartão</span>
                    </span>
                  </span>
                  <span className="entrega-veiculo-meta">Confirmação após aprovação da operadora</span>
                </button>
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
                Obrigatório para pagamentos via PIX e cartão no PagBank.
              </p>

              {pagamentoCartaoSelecionado ? (
                <>
                  <label htmlFor="nome-titular-cartao" style={{ marginTop: '0.6rem' }}><strong>Nome do titular</strong></label>
                  <input
                    id="nome-titular-cartao"
                    className="field-input"
                    type="text"
                    autoComplete="off"
                    placeholder="Nome igual ao cartão"
                    value={nomeTitularCartao}
                    onChange={(event) => {
                      setNomeTitularCartao(event.target.value);
                      limparTokenCartaoGerado();
                    }}
                  />

                  <label htmlFor="numero-cartao" style={{ marginTop: '0.4rem' }}><strong>Número do cartão</strong></label>
                  <input
                    id="numero-cartao"
                    className="field-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    value={numeroCartao}
                    onChange={(event) => {
                      setNumeroCartao(formatarNumeroCartao(event.target.value));
                      limparTokenCartaoGerado();
                    }}
                  />

                  <div className="entrega-cep-row" style={{ marginTop: '0.4rem' }}>
                    <input
                      className="field-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                      placeholder="MM"
                      maxLength={2}
                      value={mesExpiracaoCartao}
                      onChange={(event) => {
                        setMesExpiracaoCartao(formatarMesCartao(event.target.value));
                        limparTokenCartaoGerado();
                      }}
                    />
                    <input
                      className="field-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                      placeholder="AAAA"
                      maxLength={4}
                      value={anoExpiracaoCartao}
                      onChange={(event) => {
                        setAnoExpiracaoCartao(formatarAnoCartao(event.target.value));
                        limparTokenCartaoGerado();
                      }}
                    />
                    <input
                      className="field-input"
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="CVV"
                      maxLength={4}
                      value={cvvCartao}
                      onChange={(event) => {
                        setCvvCartao(formatarCvvCartao(event.target.value));
                        limparTokenCartaoGerado();
                      }}
                    />
                  </div>

                  {formaPagamento === 'credito' ? (
                    <>
                      <label htmlFor="parcelas-cartao" style={{ marginTop: '0.4rem' }}><strong>Parcelas</strong></label>
                      <select
                        id="parcelas-cartao"
                        className="field-input"
                        value={parcelasCartao}
                        onChange={(event) => setParcelasCartao(event.target.value)}
                      >
                        {Array.from({ length: parcelamentoCreditoDisponivel ? PARCELAMENTO_MAXIMO_CREDITO : 1 }, (_, idx) => idx + 1).map((parcela) => (
                          <option key={parcela} value={String(parcela)}>
                            {parcela}x
                          </option>
                        ))}
                      </select>

                      <p className="muted-text" style={{ marginTop: '0.3rem' }}>
                        {parcelamentoCreditoDisponivel
                          ? `Parcelamento liberado para este pedido (até ${PARCELAMENTO_MAXIMO_CREDITO}x).`
                          : `Parcelamento disponível apenas para pedidos a partir de R$ ${PARCELAMENTO_MINIMO_CREDITO.toFixed(2)}.`}
                      </p>
                    </>
                  ) : (
                    <p className="muted-text" style={{ marginTop: '0.3rem' }}>
                      No débito, o pagamento é sempre à vista (1x).
                    </p>
                  )}

                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={criptografandoCartao || buscandoChavePublica}
                    onClick={() => {
                      void handleCriptografarCartao().catch((error) => {
                        setErro(error.message || 'Não foi possível validar os dados do cartão.');
                      });
                    }}
                  >
                    {criptografandoCartao ? 'Validando dados do cartão...' : 'Validar cartão com segurança'}
                  </button>

                  <p className="muted-text" style={{ marginTop: '0.2rem' }}>
                    {tokenCartao
                      ? 'Dados do cartão validados com sucesso.'
                      : 'Os dados do cartão são protegidos antes do envio para pagamento.'}
                  </p>
                </>
              ) : null}

              <button
                className="btn-primary"
                type="button"
                onClick={handleIrParaPagamento}
                disabled={carregando || simulandoFrete || buscandoChavePublica || (itens.length === 0 && !resultadoPedido?.pedido_id) || (!resultadoPedido?.pedido_id && !simulacaoFrete)}
              >
                {carregando ? 'Preparando pagamento...' : formaPagamento === 'pix' ? 'Continuar com PIX' : `Continuar com ${tituloFormaPagamento}`}
              </button>
            </>
          ) : (
            <>
              <p className="muted-text">Faça login para continuar para o pagamento.</p>
              <div className="entrega-acoes-row">
                <BotaoVoltarSeta
                  onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
                  label="Voltar para entrega"
                />
                <Link to="/conta" className="btn-primary entrega-ir-pagamento-btn">
                  Ir para Conta
                </Link>
              </div>
            </>
          )}
          {autenticado === true ? (
            <BotaoVoltarSeta
              onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
              label="Voltar para entrega"
            />
          ) : null}
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
        <div className="card-box">
          <p><strong>Etapa 4: {formaPagamento === 'pix' ? 'Pagamento via PIX' : `Pagamento com ${tituloFormaPagamento.toLowerCase()}`}</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido #{resultadoPedido.pedido_id} criado com sucesso.</p>
              <p>Total dos produtos: R$ {totalProdutosPedido.toFixed(2)}</p>
              <p>
                Frete ({veiculoSelecionadoResumo.label}, {distanciaSelecionadaTexto}, CEP {cepDestinoSelecionado}):
                {' '}R$ {freteSelecionado.toFixed(2)}
              </p>
              <p className="muted-text">Origem: {cepOrigemSelecionado}, nº {numeroOrigemSelecionado}</p>
              <p><strong>Total com entrega: R$ {totalComEntregaPedido.toFixed(2)}</strong></p>
            </>
          ) : null}

          {formaPagamento === 'pix' ? (
            <>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregando || !resultadoPedido?.pedido_id}
                onClick={() => handleGerarPix(resultadoPedido.pedido_id)}
              >
                {carregando ? 'Gerando PIX...' : 'Gerar ou atualizar QR Code PIX'}
              </button>

              {resultadoPix ? (
                <>
                  <p>Status do PIX: {formatarStatusPagamento(resultadoPix.status)}</p>
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
                <p className="muted-text">Clique em gerar PIX para visualizar o QR Code e o código Copia e Cola.</p>
              )}
            </>
          ) : (
            <>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregando || criptografandoCartao || !resultadoPedido?.pedido_id}
                onClick={() => handlePagarCartao(resultadoPedido.pedido_id)}
              >
                {carregando ? `Processando ${tituloFormaPagamento.toLowerCase()}...` : `Pagar com ${tituloFormaPagamento}`}
              </button>

              {resultadoCartao ? (
                <>
                  <p>Status do pagamento: {formatarStatusPagamento(resultadoCartao.status)}</p>
                  <p>Status do pedido: {formatarStatusPedido(resultadoCartao.status_interno || 'pendente')}</p>
                  <p>Referência do pedido no PagBank: {resultadoCartao.pagbank_order_id || '-'}</p>
                  <p>Referência da transação: {resultadoCartao.payment_id || '-'}</p>
                  <p>Método: {resultadoCartao.tipo_cartao === 'debito' ? 'Cartão de Débito' : 'Cartão de Crédito'}</p>
                  <p>Parcelas: {resultadoCartao.tipo_cartao === 'debito' ? '1x' : `${resultadoCartao.parcelas || parcelasCartaoEfetivas}x`}</p>
                  {cartaoRecusado ? (
                    <p className="error-text">Pagamento não aprovado. Revise os dados do cartão e tente novamente.</p>
                  ) : null}
                </>
              ) : (
                <p className="muted-text">Revise os dados e clique no botão para concluir o pagamento no cartão.</p>
              )}
            </>
          )}

          <button
            className="btn-primary"
            type="button"
            disabled={pagamentoCartaoSelecionado && !cartaoProcessado}
            onClick={() => {
              setPagamentoConfirmado(formaPagamento === 'pix' ? true : cartaoAprovado);
              setEtapaAtual(ETAPAS.STATUS);
            }}
          >
            {formaPagamento === 'pix' ? 'Já paguei via PIX' : 'Continuar para confirmação'}
          </button>
          <BotaoVoltarSeta
            onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
            label="Voltar para pagamento"
          />
        </div>
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <div className="card-box">
          <p><strong>Etapa 5: Acompanhamento do pedido</strong></p>
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
                  <span>Pagamento confirmado com sucesso.</span>
                </div>
              ) : null}
              <p className="muted-text">Atualização automática a cada 15 segundos.</p>
            </>
          ) : (
            <p className="muted-text">Finalize um pedido para acompanhar o status.</p>
          )}

          <div className="card-box" style={{ marginTop: '0.4rem' }}>
            <p><strong>Precisa de ajuda?</strong></p>
            <p>
              {formaPagamento === 'pix'
                ? 'Se o QR Code não abrir no seu banco, copie o código PIX e cole manualmente no aplicativo.'
                : 'Se o pagamento não for aprovado, revise os dados do cartão e tente novamente.'}
            </p>
            <p>Após a confirmação do pagamento, iniciamos a preparação e o envio do pedido.</p>
          </div>

          <BotaoVoltarSeta
            onClick={() => setEtapaAtual(ETAPAS.PIX)}
            label={`Voltar para ${tituloEtapa4}`}
          />
        </div>
      ) : null}
    </section>
  );
}

