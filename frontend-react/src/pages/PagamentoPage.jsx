import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { tryGetRecaptchaToken } from '../lib/recaptchaEnterprise';
import {
  buscarEnderecoViaCep,
  criarPedido,
  getPedidoById,
  getEndereco,
  getMe,
  getPedidoStatus,
  cancelarPedidoRevisao,
  isAuthErrorMessage,
  mpGerarPix,
  mpGetPublicKey,
  mpPagarCartao,
  getUberDeliveryQuote,
  simularFretePorCep
} from '../lib/api';
import {
  CHECKOUT_RECAPTCHA_ENABLED,
  RECAPTCHA_SITE_KEY
} from '../config/api';
import {
  buildCartEventPayload,
  buildOrderItemsPayload,
  captureCommerceEvent
} from '../lib/commerceTracking';
import {
  GROWTH_UPDATE_EVENT_NAME,
  getGrowthInsights
} from '../lib/conversionGrowth';
import { useCart } from '../context/CartContext';
import { useReviewTracker } from '../context/ReviewTrackerContext';

// Utilit?rios e constantes extra?dos do checkout.
import {
  ETAPAS,
  PARCELAMENTO_MINIMO_CREDITO,
  PARCELAMENTO_MAXIMO_CREDITO,
  TAXA_SERVICO_PERCENTUAL,
  SESSAO_3DS_TTL_MS,
  CEP_MERCADO,
  NUMERO_MERCADO,
  LIMITE_BIKE_KM,
  STATUS_3DS_LABELS,
  VEICULOS_ENTREGA,
  FORMAS_PAGAMENTO_OPCOES,
  gerarQrCodeDataUrl,
  formatarMoeda,
  formatarTipoEntrega,
  erroEntregaEhCobertura,
  normalizarCep,
  formatarCep,
  normalizarDocumentoFiscal,
  validarCpf,
  validarDocumentoFiscal3DS,
  formatarDocumentoFiscal,
  montarResumoRespostaGatewayHomologacao,
  resolverModalEntregaUber,
  estimarPesoCarrinhoKg,
  obterStatusPixVisual,
  formatarStatusPedido
} from '../lib/checkoutUtils';
import {
  calcularSubtotalPeso,
  isItemPeso,
} from '../lib/produtoCatalogoRules';

// Sub-componentes do checkout.
import {
  ClientReviewStep,
} from '../components/checkout';
import { CheckoutContext, CHECKOUT_ACTIONS } from '../context/CheckoutContext';
import CartStep from '../components/checkout/CartStep';
import DeliveryStep from '../components/checkout/DeliveryStep';
import PaymentStep from '../components/checkout/PaymentStep';
import MerchantReviewStep from '../components/checkout/MerchantReviewStep';
import PixPaymentStep from '../components/checkout/PixPaymentStep';
import OrderStatusStep from '../components/checkout/OrderStatusStep';
import InternalTopBar from '../components/navigation/InternalTopBar';

const CHECKOUT_ENDERECO_CACHE_KEY = 'bf_checkout_endereco_preferido';
const CHECKOUT_CPF_NOTA_CACHE_KEY = 'bf_checkout_cpf_nota';
const STATUS_REVISAO_ATIVOS = new Set(['aguardando_revisao', 'pendente', 'pagamento_recusado']);
const STATUS_TERMINAIS_PIX_POLLING = new Set(['pago', 'entregue', 'pagamento_recusado', 'cancelado', 'expirado', 'retirado']);
const PIX_POLLING_DURACAO_MAXIMA_MS = 4 * 60 * 1000;
const PIX_POLLING_MAX_TENTATIVAS = 50;

function statusEhElegivelParaFluxoRevisao(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_REVISAO_ATIVOS.has(status);
}

function calcularSubtotalLinhaRevisao(item = {}) {
  const subtotalInformado = Number(item?.subtotal);
  if (Number.isFinite(subtotalInformado) && subtotalInformado >= 0) {
    return Number(subtotalInformado.toFixed(2));
  }

  const preco = Number(item?.preco || 0);
  const quantidade = Math.max(1, Math.floor(Number(item?.quantidade || 1)));
  if (isItemPeso(item)) {
    return calcularSubtotalPeso(preco, item?.peso_gramas, quantidade);
  }

  return Number((preco * quantidade).toFixed(2));
}

function salvarEnderecoCheckoutNoCache(endereco = {}) {
  try {
    localStorage.setItem(CHECKOUT_ENDERECO_CACHE_KEY, JSON.stringify({
      cep: String(endereco?.cep || '').trim(),
      numero: String(endereco?.numero || '').trim(),
      logradouro: String(endereco?.logradouro || '').trim(),
      bairro: String(endereco?.bairro || '').trim(),
      cidade: String(endereco?.cidade || '').trim(),
      estado: String(endereco?.estado || '').trim().toUpperCase()
    }));
  } catch {
    // Fallback silencioso quando storage não está disponível.
  }
}

function lerEnderecoCheckoutDoCache() {
  try {
    const raw = localStorage.getItem(CHECKOUT_ENDERECO_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      cep: String(parsed.cep || '').trim(),
      numero: String(parsed.numero || '').trim(),
      logradouro: String(parsed.logradouro || '').trim(),
      bairro: String(parsed.bairro || '').trim(),
      cidade: String(parsed.cidade || '').trim(),
      estado: String(parsed.estado || '').trim().toUpperCase()
    };
  } catch {
    return null;
  }
}

function salvarCpfNotaNoCache(cpf = '') {
  try {
    const digits = normalizarDocumentoFiscal(cpf);
    if (digits.length === 11) {
      localStorage.setItem(CHECKOUT_CPF_NOTA_CACHE_KEY, digits);
      return;
    }

    localStorage.removeItem(CHECKOUT_CPF_NOTA_CACHE_KEY);
  } catch {
    // Fallback silencioso quando storage não está disponível.
  }
}

function lerCpfNotaDoCache() {
  try {
    const raw = localStorage.getItem(CHECKOUT_CPF_NOTA_CACHE_KEY);
    const digits = normalizarDocumentoFiscal(raw);
    return digits.length === 11 ? digits : '';
  } catch {
    return '';
  }
}

export default function PagamentoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { itens, resumo, clearCart } = useCart();
  const { tracker: reviewTrackerGlobal, trackOrder, clearTracking } = useReviewTracker();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [cancelandoRevisao, setCancelandoRevisao] = useState(false);
  const [erro, setErro] = useState('');
  const [retomandoPedidoExistente, setRetomandoPedidoExistente] = useState(false);
  const [ultimaAtualizacaoRevisao, setUltimaAtualizacaoRevisao] = useState('');
  const [, setDadosUsuarioCheckout] = useState(null);
  const [resultadoPix, setResultadoPix] = useState(null);
  const [qrCodePixDataUrl, setQrCodePixDataUrl] = useState('');
  const [feedbackCopiaPix, setFeedbackCopiaPix] = useState('');
  const [verificandoStatusPix, setVerificandoStatusPix] = useState(false);
  const [resumoPedidoSnapshot, setResumoPedidoSnapshot] = useState(null);
  const [itensPedidoSnapshot, setItensPedidoSnapshot] = useState([]);
  const [etapaAtual, setEtapaAtual] = useState(ETAPAS.CARRINHO);
  const [statusPedidoAtual, setStatusPedidoAtual] = useState('');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [tipoEntrega, setTipoEntrega] = useState('entrega');
  const [cepEntrega, setCepEntrega] = useState('');
  const [numeroEntrega, setNumeroEntrega] = useState('');
  const [enderecoContaSalvo, setEnderecoContaSalvo] = useState(null);
  const [veiculoEntrega, setVeiculoEntrega] = useState('uber');
  const [ultimoFreteEntrega, setUltimoFreteEntrega] = useState(0);
  const [simulacaoFrete, setSimulacaoFrete] = useState(null);
  const [simulacoesFretePorVeiculo, setSimulacoesFretePorVeiculo] = useState({});
  const [uberQuoteDisponivel, setUberQuoteDisponivel] = useState(true);
  const [simulandoFrete, setSimulandoFrete] = useState(false);
  const [erroEntrega, setErroEntrega] = useState('');
  const [enderecoCepEntrega, setEnderecoCepEntrega] = useState(null);
  const [cepEnderecoConsultado, setCepEnderecoConsultado] = useState('');
  const [documentoPagador, setDocumentoPagador] = useState('');
  const [cpfNotaFiscal, setCpfNotaFiscal] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [gatewayPublicKey, setGatewayPublicKey] = useState('');
  const [buscandoChavePublica, setBuscandoChavePublica] = useState(false);
  const [tokenCartao, setTokenCartao] = useState('');
  const [parcelasCartao, setParcelasCartao] = useState('1');
  const [resultadoCartao, setResultadoCartao] = useState(null);
  const [dadosCartaoCompletos, setDadosCartaoCompletos] = useState(false);
  const [sessao3DS, setSessao3DS] = useState('');
  const [, setSessao3DSEnv] = useState('SANDBOX');
  const [sessao3DSGeradaEm, setSessao3DSGeradaEm] = useState(0);
  const [sessao3DSExpirando, setSessao3DSExpirando] = useState(false);
  const [status3DS, setStatus3DS] = useState('idle');
  const [resultado3DS, setResultado3DS] = useState(null);
  const [idAutenticacao3DS, setIdAutenticacao3DS] = useState('');
  const [eventosHomologacao3DS, setEventosHomologacao3DS] = useState([]);
  const [feedbackEvidencia3DS, setFeedbackEvidencia3DS] = useState('');
  const [growthVersion, setGrowthVersion] = useState(0);
  const paymentStepRef = useRef();
  const cartaoPaymentMethodIdRef = useRef('');
  const cartaoIssuerIdRef = useRef(null);
  const pagandoCartaoRef = useRef(false);
  const buscaEnderecoRef = useRef(0);
  const startCheckoutTrackedRef = useRef(false);
  const purchaseTrackedOrdersRef = useRef(new Set());
  const growthInsights = useMemo(() => getGrowthInsights({ windowDays: 7 }), [growthVersion]);
  const growthCheckoutPaymentConfig = growthInsights?.experiment?.ui?.checkoutPayment || {
    enabled: false,
    ctaPrefix: 'Finalizar pedido',
    badgeLabel: '',
    priceHighlight: 'none'
  };
  const growthCheckoutPaymentEnabled = Boolean(growthCheckoutPaymentConfig.enabled);
  const growthCheckoutPaymentPriceClass = growthCheckoutPaymentEnabled
    ? `is-growth-${String(growthCheckoutPaymentConfig.priceHighlight || 'none').trim() || 'none'}`
    : '';
  const pedidoRetomadaId = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const pedido = Number(params.get('pedido') || 0);
    return Number.isInteger(pedido) && pedido > 0 ? pedido : 0;
  }, [location.search]);
  const etapaRetomadaPreferida = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const etapa = String(params.get('etapa') || '').trim().toLowerCase();
    return ['revisao', 'pagamento', 'pix'].includes(etapa) ? etapa : '';
  }, [location.search]);

  const normalizarTextoSugestao = useCallback((valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim(), []);

  const sairDoFluxoRevisaoEncerrado = useCallback((mensagem = '') => {
    clearTracking();
    setResultadoPedido(null);
    setResumoPedidoSnapshot(null);
    setItensPedidoSnapshot([]);
    setResultadoPix(null);
    setQrCodePixDataUrl('');
    setStatusPedidoAtual('');
    setPagamentoConfirmado(false);
    setRetomandoPedidoExistente(false);
    setErro('');

    if (itens.length > 0) {
      setEtapaAtual(ETAPAS.CARRINHO);
      return;
    }

    navigate('/produtos', { replace: true });
  }, [clearTracking, itens.length, navigate]);

  useEffect(() => {
    if (!sessao3DSGeradaEm) {
      setSessao3DSExpirando(false);
      return undefined;
    }
    const AVISO_ANTECEDENCIA_MS = 2 * 60 * 1000;
    const tempoRestante = SESSAO_3DS_TTL_MS - (Date.now() - sessao3DSGeradaEm);
    if (tempoRestante <= AVISO_ANTECEDENCIA_MS) {
      setSessao3DSExpirando(true);
      return undefined;
    }
    setSessao3DSExpirando(false);
    const timer = setTimeout(() => {
      setSessao3DSExpirando(true);
    }, tempoRestante - AVISO_ANTECEDENCIA_MS);
    return () => clearTimeout(timer);
  }, [sessao3DSGeradaEm]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleGrowthUpdate = () => {
      setGrowthVersion((atual) => atual + 1);
    };

    window.addEventListener(GROWTH_UPDATE_EVENT_NAME, handleGrowthUpdate);
    return () => {
      window.removeEventListener(GROWTH_UPDATE_EVENT_NAME, handleGrowthUpdate);
    };
  }, []);

  const itensPedido = useMemo(
    () =>
      itens.map((item) => ({
        produto_id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        quantidade: Number(item.quantidade || 1),
        unidade_venda: String(item.unidade_venda || '').trim().toLowerCase(),
        peso_gramas: Number(item.peso_gramas || 0) > 0 ? Number(item.peso_gramas) : null,
        subtotal: calcularSubtotalLinhaRevisao(item)
      })),
    [itens]
  );

  const retiradaSelecionada = tipoEntrega === 'retirada';
  const itensRestritosEntrega = useMemo(() => {
    return itens.some((item) => {
      const nome = normalizarTextoSugestao(item?.nome || '');
      return (
        nome.includes('agua 20')
        || nome.includes('galao')
        || nome.includes('botijao')
        || nome.includes('gas')
      );
    });
  }, [itens, normalizarTextoSugestao]);
  const opcoesEntregaCompactas = useMemo(
    () => (uberQuoteDisponivel ? ['bike', 'uber'] : ['bike']),
    [uberQuoteDisponivel]
  );
  const freteAtual = retiradaSelecionada ? 0 : Number(simulacaoFrete?.frete || 0);
  const economiaFreteRetirada = Number(ultimoFreteEntrega || simulacaoFrete?.frete || 0);
  const taxaServicoAtual = Number((Number(resumo.total || 0) * (TAXA_SERVICO_PERCENTUAL / 100)).toFixed(2));
  const pesoEstimadoCarrinhoKg = useMemo(() => estimarPesoCarrinhoKg(itens), [itens]);

  const totalComFreteAtual = useMemo(
    () => Number((Number(resumo.total || 0) + freteAtual + taxaServicoAtual).toFixed(2)),
    [resumo.total, freteAtual, taxaServicoAtual]
  );

  const freteSelecionado = Number(resultadoPedido?.frete_entrega ?? (retiradaSelecionada ? 0 : simulacaoFrete?.frete ?? 0));
  const distanciaSelecionada = retiradaSelecionada
    ? 0
    : Number(resultadoPedido?.distancia_entrega_km ?? simulacaoFrete?.distancia_km ?? 0);
  const distanciaSelecionadaTexto = distanciaSelecionada > 0 ? `${distanciaSelecionada.toFixed(2)} km` : '-';
  const limiteBikeTexto = LIMITE_BIKE_KM.toFixed(1).replace('.', ',');
  const avisosRestricaoEntregaPorItem = useMemo(() => {
    const avisos = new Map();
    const distanciaValida = Number(distanciaSelecionada || 0) > 0;

    if (tipoEntrega !== 'entrega') {
      return avisos;
    }

    itens.forEach((item) => {
      const nomeNormalizado = normalizarTextoSugestao(item?.nome || '');
      const ehAgua = nomeNormalizado.includes('agua') || nomeNormalizado.includes('água');
      const ehVolume20l =
        nomeNormalizado.includes('20l')
        || nomeNormalizado.includes('20 l')
        || nomeNormalizado.includes('20lt')
        || nomeNormalizado.includes('20 litros')
        || nomeNormalizado.includes('20litros')
        || nomeNormalizado.includes('galao 20')
        || nomeNormalizado.includes('galão 20');

      if (!ehAgua || !ehVolume20l) {
        return;
      }

      let mensagem = `Ãgua 20L: entregamos só por Bike, em até ${limiteBikeTexto} km do mercado.`;

      if (veiculoEntrega !== 'bike') {
        mensagem += ' Selecione Bike para continuar.';
      }

      if (distanciaValida && Number(distanciaSelecionada) > LIMITE_BIKE_KM) {
        mensagem += ` Distância atual: ${distanciaSelecionada.toFixed(2)} km (acima do limite).`;
      } else if (!distanciaValida) {
        mensagem += ' Calcule a entrega para validar a distância.';
      }

      avisos.set(Number(item?.id), mensagem);
    });

    return avisos;
  }, [distanciaSelecionada, itens, limiteBikeTexto, normalizarTextoSugestao, tipoEntrega, veiculoEntrega]);
  const atendimentoSelecionadoLabel = retiradaSelecionada
    ? formatarTipoEntrega('retirada')
    : 'Uber Direct';
  const totalProdutosPedido = Number(resultadoPedido?.total_produtos ?? resumo.total ?? 0);
  const taxaServicoPedido = Number(resultadoPedido?.taxa_servico ?? taxaServicoAtual ?? 0);
  const totalComEntregaPedido = Number(resultadoPedido?.total ?? Number((totalProdutosPedido + freteSelecionado + taxaServicoPedido).toFixed(2)));
  const totalReferenciaParcelamento = Number(resultadoPedido?.total ?? totalComFreteAtual ?? 0);
  const parcelamentoCreditoDisponivel = totalReferenciaParcelamento >= PARCELAMENTO_MINIMO_CREDITO;
  const totalRevisaoSnapshot = useMemo(() => {
    const subtotal = Number(resumoPedidoSnapshot?.subtotal ?? 0);
    const frete = Number(resumoPedidoSnapshot?.frete ?? 0);
    const taxaServico = Number(resumoPedidoSnapshot?.taxa_servico ?? 0);
    return Number((subtotal + frete + taxaServico).toFixed(2));
  }, [resumoPedidoSnapshot]);
  const valorMinimoParcelamentoTexto = PARCELAMENTO_MINIMO_CREDITO.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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
  const debitoSelecionado = formaPagamento === 'debito';
  const recaptchaCheckoutEnabled = CHECKOUT_RECAPTCHA_ENABLED && Boolean(RECAPTCHA_SITE_KEY);
  const tituloFormaPagamento = formaPagamento === 'pix'
    ? 'PIX'
    : formaPagamento === 'debito'
      ? 'Cartão de Débito'
      : 'Cartão de Crédito';
  const status3DSLabel = STATUS_3DS_LABELS[status3DS] || STATUS_3DS_LABELS.idle;
  const status3DSTone = ['concluida', 'pagamento_aprovado'].includes(status3DS)
    ? 'is-success'
    : ['nao_suportado', 'trocar_metodo', 'erro'].includes(status3DS)
      ? 'is-warning'
      : ['iniciando', 'aguardando_validacao', 'desafio', 'processando_pagamento'].includes(status3DS)
        ? 'is-loading'
        : '';
  const cepEntregaNormalizado = normalizarCep(cepEntrega);
  const enderecoEntregaResumo = useMemo(() => {
    const rua = String(enderecoCepEntrega?.logradouro || '').trim();
    const bairro = String(enderecoCepEntrega?.bairro || '').trim();
    const cidade = String(enderecoCepEntrega?.cidade || '').trim();
    const estado = String(enderecoCepEntrega?.estado || '').trim();
    const numero = String(numeroEntrega || '').trim();

    if (!rua || !numero) {
      return 'Informe CEP e número';
    }

    const linha = `${rua}, ${numero}`;
    const complemento = [bairro, cidade, estado].filter(Boolean).join(' · ');
    return complemento ? `${linha} - ${complemento}` : linha;
  }, [enderecoCepEntrega, numeroEntrega]);
  const enderecoEntregaComplemento = useMemo(() => {
    const bairro = String(enderecoCepEntrega?.bairro || '').trim();
    const cidade = String(enderecoCepEntrega?.cidade || '').trim();
    const estado = String(enderecoCepEntrega?.estado || '').trim().toUpperCase();
    const partes = [bairro, cidade && estado ? `${cidade}/${estado}` : (cidade || estado)].filter(Boolean);
    return partes.join(' - ');
  }, [enderecoCepEntrega]);
  const temEnderecoContaSalvo = useMemo(() => {
    const cep = normalizarCep(enderecoContaSalvo?.cep || '');
    return cep.length === 8;
  }, [enderecoContaSalvo]);
  const enderecoContaSalvoResumo = useMemo(() => {
    if (!temEnderecoContaSalvo) {
      return '';
    }

    const logradouro = String(enderecoContaSalvo?.logradouro || '').trim();
    const numero = String(enderecoContaSalvo?.numero || '').trim();
    const bairro = String(enderecoContaSalvo?.bairro || '').trim();
    const cidade = String(enderecoContaSalvo?.cidade || '').trim();
    const estado = String(enderecoContaSalvo?.estado || '').trim().toUpperCase();
    const cep = formatarCep(enderecoContaSalvo?.cep || '');

    const linhaPrincipal = [logradouro, numero].filter(Boolean).join(', ');
    const linhaSecundaria = [bairro, cidade && estado ? `${cidade}/${estado}` : (cidade || estado), cep].filter(Boolean).join(' - ');
    return [linhaPrincipal, linhaSecundaria].filter(Boolean).join(' · ');
  }, [enderecoContaSalvo, temEnderecoContaSalvo]);
  const enderecoSalvoJaSelecionado = useMemo(() => {
    if (!temEnderecoContaSalvo) {
      return false;
    }

    const cepAtual = normalizarCep(cepEntrega);
    const cepSalvo = normalizarCep(enderecoContaSalvo?.cep || '');
    const numeroAtual = String(numeroEntrega || '').replace(/\D/g, '').slice(0, 10);
    const numeroSalvo = String(enderecoContaSalvo?.numero || '').replace(/\D/g, '').slice(0, 10);
    if (!numeroSalvo) {
      return cepAtual === cepSalvo;
    }

    return cepAtual === cepSalvo && numeroAtual === numeroSalvo;
  }, [cepEntrega, enderecoContaSalvo, numeroEntrega, temEnderecoContaSalvo]);
  const freteCalculado = retiradaSelecionada ? true : Boolean(simulacaoFrete);
  const temAgua20LNoCarrinho = useMemo(() => {
    return itens.some((item) => {
      const nome = normalizarTextoSugestao(item?.nome || '');
      const ehAgua = nome.includes('agua') || nome.includes('água');
      const ehVolume20l =
        nome.includes('20l')
        || nome.includes('20 l')
        || nome.includes('20lt')
        || nome.includes('20 litros')
        || nome.includes('20litros')
        || nome.includes('galao 20')
        || nome.includes('galão 20');

      return ehAgua && ehVolume20l;
    });
  }, [itens, normalizarTextoSugestao]);
  const distanciaEntregaAtualKm = Number(simulacaoFrete?.distancia_km || 0);
  const bloqueioAgua20LMotivo = useMemo(() => {
    if (retiradaSelecionada || !temAgua20LNoCarrinho) {
      return '';
    }

    const limiteTexto = LIMITE_BIKE_KM.toFixed(1).replace('.', ',');

    if (veiculoEntrega !== 'bike') {
      return `Ãgua 20L: selecione Bike. Esse item só vai por Bike em até ${limiteTexto} km.`;
    }

    if (!freteCalculado || distanciaEntregaAtualKm <= 0) {
      return 'Ãgua 20L: calcule a entrega para validar a distância máxima da Bike.';
    }

    if (distanciaEntregaAtualKm > LIMITE_BIKE_KM) {
      return `Ãgua 20L: distância ${distanciaEntregaAtualKm.toFixed(2)} km. Limite para Bike: ${limiteTexto} km.`;
    }

    return '';
  }, [distanciaEntregaAtualKm, freteCalculado, retiradaSelecionada, temAgua20LNoCarrinho, veiculoEntrega]);
  const bloqueioAgua20LAtivo = Boolean(bloqueioAgua20LMotivo);
  const semOpcaoEntregaDisponivel = retiradaSelecionada
    ? false
    : (!simulandoFrete && !simulacaoFrete && erroEntregaEhCobertura(erroEntrega));
  const podeAvancarParaPagamento = retiradaSelecionada
    ? (itens.length > 0 && !simulandoFrete)
    : (itens.length > 0 && freteCalculado && !simulandoFrete && !semOpcaoEntregaDisponivel && !bloqueioAgua20LAtivo && String(numeroEntrega || '').trim().length > 0);
  const simulacaoBike = simulacoesFretePorVeiculo.bike || null;
  const distanciaBikeKm = Number(simulacaoBike?.distancia_km || 0);
  const bikeDisponivel = !simulacaoBike
    ? true
    : (Number.isFinite(distanciaBikeKm) && distanciaBikeKm > 0 && distanciaBikeKm <= LIMITE_BIKE_KM);
  const modalUberInterno = useMemo(
    () => resolverModalEntregaUber(itens, distanciaBikeKm, pesoEstimadoCarrinhoKg, Number(resumo.itens || 0)),
    [itens, distanciaBikeKm, pesoEstimadoCarrinhoKg, resumo.itens]
  );
  const avisoRestricaoVeiculo = itensRestritosEntrega
    ? 'Alguns itens exigem entrega em veículo maior'
    : '';

  useEffect(() => {
    if (etapaAtual === ETAPAS.PAGAMENTO && bloqueioAgua20LAtivo) {
      setEtapaAtual(ETAPAS.ENTREGA);
    }
  }, [bloqueioAgua20LAtivo, etapaAtual]);

  // Consolida feedback da simulação para manter mensagens consistentes na UX da entrega.
  const mensagemFrete = useMemo(() => {
    if (retiradaSelecionada) {
      return {
        tone: 'success',
        text: Number(economiaFreteRetirada || 0) > 0
          ? `Retirada na loja selecionada. Economia estimada de frete: ${formatarMoeda(economiaFreteRetirada)}.`
          : 'Retirada na loja selecionada. Sem cobranca de frete.'
      };
    }

    if (simulandoFrete) {
      return { tone: 'loading', text: 'Calculando entrega...' };
    }

    if (erroEntrega) {
      if (erroEntregaEhCobertura(erroEntrega)) {
        return { tone: 'warning', text: erroEntrega };
      }
      return { tone: 'error', text: erroEntrega };
    }

    if (simulacaoFrete) {
      return {
        tone: 'success',
        text: `Entrega calculada: ${formatarMoeda(freteAtual)}`
      };
    }

    return {
      tone: 'neutral',
      text: 'Informe CEP e número para calcular a entrega.'
    };
  }, [economiaFreteRetirada, erroEntrega, freteAtual, retiradaSelecionada, simulacaoFrete, simulandoFrete]);

  useEffect(() => {
    let ativo = true;

    if (retiradaSelecionada) {
      setSimulacoesFretePorVeiculo({});
      return () => {
        ativo = false;
      };
    }

    if (cepEntregaNormalizado.length !== 8) {
      setSimulacoesFretePorVeiculo({});
      setSimulacaoFrete(null);
      return () => {
        ativo = false;
      };
    }

    if (!String(numeroEntrega || '').trim()) {
      setSimulacoesFretePorVeiculo({});
      setSimulacaoFrete(null);
      return () => {
        ativo = false;
      };
    }

    async function carregarFretesOpcoes() {
      setSimulandoFrete(true);

      const enderecoPayload = {
        cep: formatarCep(cepEntregaNormalizado),
        numero: String(numeroEntrega || '').trim(),
        logradouro: String(enderecoCepEntrega?.logradouro || '').trim(),
        bairro: String(enderecoCepEntrega?.bairro || '').trim(),
        cidade: String(enderecoCepEntrega?.cidade || '').trim(),
        estado: String(enderecoCepEntrega?.estado || '').trim()
      };

      const carrinhoPayload = itens.map((item) => ({
        nome: item.nome,
        categoria: item.categoria,
        quantidade: Number(item.quantidade || 1)
      }));

      const [bikeRaw, uberRaw] = await Promise.all([
        simularFretePorCep({ cep: cepEntregaNormalizado, veiculo: 'bike' }).catch(() => null),
        uberQuoteDisponivel
          ? getUberDeliveryQuote({
            endereco: enderecoPayload,
            carrinho: carrinhoPayload,
            valorCarrinho: Number(resumo.total || 0)
          }).catch((erroUber) => {
            if (Number(erroUber?.status || 0) === 503) {
              setUberQuoteDisponivel(false);
            }
            return null;
          })
          : Promise.resolve(null)
      ]);

      if (!ativo) {
        return;
      }

      const bikeMap = bikeRaw
        ? {
          veiculo: 'bike',
          frete: Number(bikeRaw?.frete || 0),
          distancia_km: Number(bikeRaw?.distancia_km || 0),
          eta_seconds: null,
          estimate_id: null,
          cep_destino: formatarCep(cepEntregaNormalizado),
          cep_origem: CEP_MERCADO,
          numero_origem: NUMERO_MERCADO,
          opcao_exibida: 'bike',
          modal_interno: 'bike'
        }
        : null;

      const uberMap = uberRaw
        ? {
          veiculo: modalUberInterno,
          frete: Number(uberRaw?.preco || 0),
          distancia_km: bikeMap?.distancia_km || null,
          eta_seconds: Number(uberRaw?.eta_segundos || 0) || null,
          estimate_id: String(uberRaw?.estimate_id || '').trim() || null,
          cep_destino: formatarCep(cepEntregaNormalizado),
          cep_origem: CEP_MERCADO,
          numero_origem: NUMERO_MERCADO,
          opcao_exibida: 'uber',
          modal_interno: modalUberInterno
        }
        : null;

      const mapa = {
        bike: bikeMap,
        uber: uberMap
      };
      setSimulacoesFretePorVeiculo(mapa);

      const opcoesDisponiveis = opcoesEntregaCompactas.filter((key) => {
        if (key === 'bike') {
          const sim = bikeMap;
          const distancia = Number(sim?.distancia_km || 0);
          return Boolean(sim) && Number.isFinite(distancia) && distancia > 0 && distancia <= LIMITE_BIKE_KM;
        }
        return Boolean(mapa[key]);
      });

      const veiculoAtualValido = opcoesDisponiveis.includes(veiculoEntrega);
      const proximoVeiculo = veiculoAtualValido ? veiculoEntrega : (opcoesDisponiveis[0] || veiculoEntrega);
      if (proximoVeiculo !== veiculoEntrega) {
        setVeiculoEntrega(proximoVeiculo);
      }

      setSimulacaoFrete(mapa[proximoVeiculo] || null);
      setErroEntrega(opcoesDisponiveis.length ? '' : 'Sem opção de entrega disponível para este CEP.');
      setSimulandoFrete(false);
    }

    void carregarFretesOpcoes();

    return () => {
      ativo = false;
    };
  }, [retiradaSelecionada, cepEntregaNormalizado, numeroEntrega, enderecoCepEntrega, itens, resumo.total, opcoesEntregaCompactas, veiculoEntrega, modalUberInterno, uberQuoteDisponivel]);

  const consultarEnderecoCepEntrega = useCallback(async (cep, { mostrarErro = true } = {}) => {
    const cepNormalizado = normalizarCep(cep);

    if (cepNormalizado.length !== 8) {
      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');
      if (mostrarErro && cepNormalizado.length > 0) {
      } else {
      }
      return null;
    }

    if (cepEnderecoConsultado === cepNormalizado && enderecoCepEntrega) {
      return enderecoCepEntrega;
    }

    // Evita que uma resposta antiga sobrescreva o endereço de um CEP mais novo.
    const requestId = ++buscaEnderecoRef.current;

    try {
      const endereco = await buscarEnderecoViaCep(cepNormalizado);

      if (requestId !== buscaEnderecoRef.current) {
        return null;
      }

      setEnderecoCepEntrega(endereco);
      setCepEnderecoConsultado(cepNormalizado);
      return endereco;
    } catch (error) {
      if (requestId !== buscaEnderecoRef.current) {
        return null;
      }

      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');

      if (mostrarErro) {
        const mensagem = String(error?.message || '').trim();
        if (mensagem === 'CEP não encontrado') {
        } else if (mensagem === 'CEP inválido') {
        } else {
        }
      }

      return null;
    } finally {
      if (requestId === buscaEnderecoRef.current) {
      }
    }
  }, [cepEnderecoConsultado, enderecoCepEntrega]);

  useEffect(() => {
    const cepNormalizado = cepEntregaNormalizado;

    if (!cepNormalizado || cepNormalizado.length !== 8) {
      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');
      return;
    }

    const timer = setTimeout(() => {
      // Busca automática do endereço assim que o CEP fica completo.
      void consultarEnderecoCepEntrega(cepNormalizado, { mostrarErro: true });
    }, 260);

    return () => clearTimeout(timer);
  }, [cepEntregaNormalizado, consultarEnderecoCepEntrega]);

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
    const cpfCache = lerCpfNotaDoCache();
    if (cpfCache.length === 11) {
      setCpfNotaFiscal(formatarDocumentoFiscal(cpfCache));
    }
  }, []);

  useEffect(() => {
    salvarCpfNotaNoCache(cpfNotaFiscal);
  }, [cpfNotaFiscal]);

  useEffect(() => {
    const cache = lerEnderecoCheckoutDoCache();
    if (!cache) {
      return;
    }

    setEnderecoContaSalvo((atual) => {
      if (atual && normalizarCep(atual.cep || '').length === 8) {
        return atual;
      }

      const cepCache = normalizarCep(cache.cep);
      if (cepCache.length !== 8) {
        return atual;
      }

      return {
        cep: formatarCep(cepCache),
        numero: String(cache.numero || '').trim(),
        logradouro: String(cache.logradouro || '').trim(),
        bairro: String(cache.bairro || '').trim(),
        cidade: String(cache.cidade || '').trim(),
        estado: String(cache.estado || '').trim().toUpperCase(),
        complemento: ''
      };
    });

    const cepCacheNormalizado = normalizarCep(cache.cep);
    if (cepCacheNormalizado.length === 8) {
      setCepEntrega((atual) => (normalizarCep(atual).length === 8 ? atual : formatarCep(cepCacheNormalizado)));
      setCepEnderecoConsultado(cepCacheNormalizado);
      setEnderecoCepEntrega((atual) => {
        if (atual && String(atual.logradouro || '').trim()) {
          return atual;
        }

        return {
          cep: formatarCep(cepCacheNormalizado),
          logradouro: cache.logradouro,
          bairro: cache.bairro,
          cidade: cache.cidade,
          estado: cache.estado,
          complemento: ''
        };
      });
    }

    const numeroCache = String(cache.numero || '').replace(/\D/g, '').slice(0, 10);
    if (numeroCache) {
      setNumeroEntrega((atual) => (String(atual || '').trim() ? atual : numeroCache));
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    setVerificandoSessao(true);

    getMe()
      .then(async (data) => {
        if (ativo) {
          setAutenticado(true);
          const usuario = data?.usuario || null;
          setDadosUsuarioCheckout(usuario);

          try {
            const dataEndereco = await getEndereco();
            if (!ativo) {
              return;
            }

            const enderecoConta = dataEndereco?.endereco || null;
            const cepContaNormalizado = normalizarCep(enderecoConta?.cep || '');
            const numeroConta = String(enderecoConta?.numero || '').trim();
            const numeroContaNormalizado = numeroConta.replace(/\D/g, '').slice(0, 10);
            const enderecoContaMapeado = {
              cep: formatarCep(cepContaNormalizado),
              numero: numeroConta,
              logradouro: String(enderecoConta?.rua || enderecoConta?.logradouro || '').trim(),
              bairro: String(enderecoConta?.bairro || '').trim(),
              cidade: String(enderecoConta?.cidade || '').trim(),
              estado: String(enderecoConta?.estado || '').trim().toUpperCase(),
              complemento: String(enderecoConta?.complemento || '').trim()
            };
            setEnderecoContaSalvo(cepContaNormalizado.length === 8 ? enderecoContaMapeado : null);

            if (cepContaNormalizado.length === 8) {
              setCepEntrega((atual) => (normalizarCep(atual).length === 8 ? atual : formatarCep(cepContaNormalizado)));
              setCepEnderecoConsultado((atual) => (atual || cepContaNormalizado));
              setEnderecoCepEntrega((atual) => {
                if (atual && String(atual.logradouro || '').trim()) {
                  return atual;
                }

                return {
                  cep: formatarCep(cepContaNormalizado),
                  logradouro: enderecoContaMapeado.logradouro,
                  bairro: enderecoContaMapeado.bairro,
                  cidade: enderecoContaMapeado.cidade,
                  estado: enderecoContaMapeado.estado,
                  complemento: enderecoContaMapeado.complemento
                };
              });
            }

            if (numeroContaNormalizado) {
              setNumeroEntrega((atual) => (String(atual || '').trim() ? atual : numeroContaNormalizado));
            }

            if (cepContaNormalizado.length === 8) {
              salvarEnderecoCheckoutNoCache({
                cep: formatarCep(cepContaNormalizado),
                numero: numeroContaNormalizado,
                logradouro: enderecoContaMapeado.logradouro,
                bairro: enderecoContaMapeado.bairro,
                cidade: enderecoContaMapeado.cidade,
                estado: enderecoContaMapeado.estado
              });
            }
          } catch {
            // Se não houver endereço salvo, mantém fallback atual.
            setEnderecoContaSalvo(null);
          }
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
    const cepNormalizado = normalizarCep(cepEntrega);
    const numeroNormalizado = String(numeroEntrega || '').replace(/\D/g, '').slice(0, 10);
    if (cepNormalizado.length !== 8 || !numeroNormalizado) {
      return;
    }

    salvarEnderecoCheckoutNoCache({
      cep: formatarCep(cepNormalizado),
      numero: numeroNormalizado,
      logradouro: String(enderecoCepEntrega?.logradouro || '').trim(),
      bairro: String(enderecoCepEntrega?.bairro || '').trim(),
      cidade: String(enderecoCepEntrega?.cidade || '').trim(),
      estado: String(enderecoCepEntrega?.estado || '').trim().toUpperCase()
    });
  }, [cepEntrega, numeroEntrega, enderecoCepEntrega]);

  useEffect(() => {
    if (autenticado !== true) {
      return;
    }

    const trackerOrderId = Number(reviewTrackerGlobal?.orderId || 0);
    const orderIdAtual = Number(resultadoPedido?.pedido_id || 0);
    const orderIdOrigem = pedidoRetomadaId > 0
      ? pedidoRetomadaId
      : (trackerOrderId > 0 ? trackerOrderId : 0);

    if (!orderIdOrigem || (orderIdAtual > 0 && orderIdAtual === orderIdOrigem)) {
      return;
    }

    let ativo = true;
    setRetomandoPedidoExistente(true);
    setErro('');

    async function retomarPedidoExistente() {
      try {
        const [statusData, detalhesData] = await Promise.all([
          getPedidoStatus(orderIdOrigem),
          getPedidoById(orderIdOrigem).catch(() => null)
        ]);

        if (!ativo) {
          return;
        }

        const pedidoDetalhe = detalhesData?.pedido || {};
        const itensDetalhe = Array.isArray(detalhesData?.itens) ? detalhesData.itens : [];
        const statusRetomado = String(statusData?.status || pedidoDetalhe?.status || '').toLowerCase();
        const formaRetornada = String(statusData?.forma_pagamento || pedidoDetalhe?.forma_pagamento || 'pix').toLowerCase();
        const tipoEntregaRetomada = String(statusData?.tipo_entrega || pedidoDetalhe?.tipo_entrega || '').toLowerCase() === 'retirada'
          ? 'retirada'
          : 'entrega';

        if (!statusEhElegivelParaFluxoRevisao(statusRetomado)) {
          trackOrder(orderIdOrigem, statusData || { status: statusRetomado });
          sairDoFluxoRevisaoEncerrado('Esse pedido em revisão já foi encerrado. Monte um novo carrinho para continuar.');
          return;
        }

        setResultadoPedido((atual) => ({
          ...atual,
          ...pedidoDetalhe,
          ...statusData,
          pedido_id: orderIdOrigem,
          status: statusRetomado || atual?.status,
          forma_pagamento: formaRetornada || atual?.forma_pagamento,
          tipo_entrega: tipoEntregaRetomada,
          total: Number(pedidoDetalhe?.total ?? statusData?.total ?? atual?.total ?? 0)
        }));

        const itensSnapshot = itensDetalhe.map((item) => ({
          produto_id: Number(item?.produto_id || 0),
          nome: String(item?.nome_produto || item?.nome || 'Item'),
          preco: Number(item?.preco || 0),
          quantidade: Math.max(1, Number(item?.quantidade || 1)),
          unidade_venda: String(item?.unidade_venda || '').trim().toLowerCase(),
          peso_gramas: Number(item?.peso_gramas || 0) > 0 ? Number(item.peso_gramas) : null,
          subtotal: Number(item?.subtotal || 0)
        }));

        if (itensSnapshot.length > 0) {
          const subtotalItensSnapshot = Number(
            itensSnapshot.reduce((acc, item) => acc + calcularSubtotalLinhaRevisao(item), 0).toFixed(2)
          );
          setItensPedidoSnapshot(itensSnapshot);
          setResumoPedidoSnapshot({
            itens: itensSnapshot.reduce((acc, item) => acc + Number(item.quantidade || 0), 0),
            subtotal: Number(detalhesData?.pedido?.total_produtos ?? subtotalItensSnapshot),
            frete: Number(detalhesData?.pedido?.frete_entrega || 0),
            taxa_servico: Number(detalhesData?.pedido?.taxa_servico || 0)
          });
        }

        if (formaRetornada === 'debito') {
          setFormaPagamento('debito');
        } else if (['cartao', 'credito'].includes(formaRetornada)) {
          setFormaPagamento('credito');
        } else {
          setFormaPagamento('pix');
        }

        setTipoEntrega(tipoEntregaRetomada);
        setStatusPedidoAtual(statusRetomado);
        setUltimaAtualizacaoRevisao(new Date().toISOString());
        trackOrder(orderIdOrigem, statusData || { status: statusRetomado });

        if (statusRetomado === 'pendente' || statusRetomado === 'pagamento_recusado') {
          setEtapaAtual(ETAPAS.PIX);
        } else {
          setEtapaAtual(etapaRetomadaPreferida === 'pagamento' || etapaRetomadaPreferida === 'pix'
            ? ETAPAS.PIX
            : ETAPAS.REVISAO);
        }
      } catch (error) {
        if (!ativo) {
          return;
        }

        if (isAuthErrorMessage(error?.message)) {
          setAutenticado(false);
        } else if (pedidoRetomadaId > 0) {
          setErro(error?.message || 'Não foi possível retomar o pedido informado.');
        }
      } finally {
        if (ativo) {
          setRetomandoPedidoExistente(false);
        }
      }
    }

    void retomarPedidoExistente();

    return () => {
      ativo = false;
    };
  }, [
    autenticado,
    etapaRetomadaPreferida,
    pedidoRetomadaId,
    resultadoPedido?.pedido_id,
    reviewTrackerGlobal?.orderId,
    sairDoFluxoRevisaoEncerrado,
    trackOrder
  ]);

  useEffect(() => {
    if (!resultadoPedido?.pedido_id || autenticado !== true || etapaAtual !== ETAPAS.STATUS) {
      return;
    }

    let ativo = true;
    let emAndamento = false;
    let statusAbortController = null;

    async function atualizarStatus() {
      if (!ativo || emAndamento) {
        return;
      }

      emAndamento = true;
      if (statusAbortController) {
        statusAbortController.abort();
      }
      statusAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

      try {
        const data = await getPedidoStatus(resultadoPedido.pedido_id, {
          signal: statusAbortController?.signal
        });

        if (ativo && data?.status) {
          const novoStatus = String(data.status || '').toLowerCase();
          setStatusPedidoAtual(novoStatus);
          setUltimaAtualizacaoRevisao(new Date().toISOString());
          trackOrder(resultadoPedido.pedido_id, data);

          if (novoStatus === 'pago' || novoStatus === 'entregue') {
            setPagamentoConfirmado(true);
          }
        }
      } catch (error) {
        const erroCancelado = error?.name === 'AbortError'
          || error?.code === 'API_ABORTED'
          || Number(error?.status || 0) === 499;
        if (erroCancelado) {
          return;
        }
        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        }
      } finally {
        emAndamento = false;
      }
    }

    void atualizarStatus();
    const interval = setInterval(atualizarStatus, 15000);

    return () => {
      ativo = false;
      clearInterval(interval);
      if (statusAbortController) {
        statusAbortController.abort();
      }
      emAndamento = false;
    };
  }, [resultadoPedido?.pedido_id, autenticado, etapaAtual, trackOrder]);

  async function executarSimulacaoFrete({ mostrarErro = true } = {}) {
    if (retiradaSelecionada) {
      setSimulacaoFrete(null);
      setErroEntrega('');
      return null;
    }

    const cepNormalizado = normalizarCep(cepEntrega);
    if (cepNormalizado.length !== 8) {
      const mensagem = 'Informe um CEP válido com 8 dígitos.';
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(mensagem);
      }
      return null;
    }

    if (!String(numeroEntrega || '').trim()) {
      const mensagem = 'Informe o número do endereço para calcular a entrega.';
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(mensagem);
      }
      return null;
    }

    if (!enderecoCepEntrega || cepEnderecoConsultado !== cepNormalizado) {
      void consultarEnderecoCepEntrega(cepNormalizado, { mostrarErro: false });
    }

    setErroEntrega('');
    setSimulandoFrete(true);

    try {
      let payloadSimulacao = null;

      if (veiculoEntrega === 'bike') {
        const data = await simularFretePorCep({ cep: cepNormalizado, veiculo: 'bike' });
        payloadSimulacao = {
          veiculo: 'bike',
          frete: Number(data?.frete || 0),
          distancia_km: Number(data?.distancia_km || 0),
          eta_seconds: null,
          estimate_id: null,
          cep_destino: formatarCep(cepNormalizado),
          cep_origem: CEP_MERCADO,
          numero_origem: NUMERO_MERCADO,
          opcao_exibida: 'bike',
          modal_interno: 'bike'
        };
      } else {
        if (!uberQuoteDisponivel) {
          throw new Error('Entrega Uber indisponível no momento. Escolha Bike para continuar.');
        }

        const data = await getUberDeliveryQuote({
          endereco: {
            cep: formatarCep(cepNormalizado),
            numero: String(numeroEntrega || '').trim(),
            logradouro: String(enderecoCepEntrega?.logradouro || '').trim(),
            bairro: String(enderecoCepEntrega?.bairro || '').trim(),
            cidade: String(enderecoCepEntrega?.cidade || '').trim(),
            estado: String(enderecoCepEntrega?.estado || '').trim()
          },
          carrinho: itens.map((item) => ({
            nome: item.nome,
            categoria: item.categoria,
            quantidade: Number(item.quantidade || 1)
          })),
          valorCarrinho: Number(resumo.total || 0)
        });

        payloadSimulacao = {
          veiculo: modalUberInterno,
          frete: Number(data?.preco || 0),
          distancia_km: distanciaBikeKm || null,
          eta_seconds: Number(data?.eta_segundos || 0) || null,
          estimate_id: String(data?.estimate_id || '').trim() || null,
          cep_destino: formatarCep(cepNormalizado),
          cep_origem: CEP_MERCADO,
          numero_origem: NUMERO_MERCADO,
          opcao_exibida: 'uber',
          modal_interno: modalUberInterno
        };
      }

      setSimulacaoFrete(payloadSimulacao);
      setUltimoFreteEntrega(Number(payloadSimulacao?.frete || 0));
      return payloadSimulacao;
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

  function limparResultadoAutenticacao3DS() {
    setStatus3DS('idle');
    setResultado3DS(null);
    setIdAutenticacao3DS('');
    setSessao3DS('');
    setSessao3DSEnv('SANDBOX');
    setSessao3DSGeradaEm(0);
  }

  function limparTokenCartaoGerado() {
    setTokenCartao('');
    cartaoPaymentMethodIdRef.current = '';
    cartaoIssuerIdRef.current = null;
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
  }

  function montarPacoteEvidenciaHomologacao3DS() {
    return {
      generated_at: new Date().toISOString(),
      flow: 'debit_3ds_auth',
      pedido_id: Number.parseInt(String(resultadoPedido?.pedido_id || ''), 10) || null,
      reference_id: String(
        resultadoCartao?.reference_id
          || (resultadoPedido?.pedido_id ? `pedido_${resultadoPedido.pedido_id}` : '')
      ).trim() || null,
      payment_summary: resultadoCartao
        ? montarResumoRespostaGatewayHomologacao({
          responsePayload: resultadoCartao,
          pedidoId: resultadoPedido?.pedido_id
        })
        : null,
      events: eventosHomologacao3DS
    };
  }

  async function carregarChavePublicaGateway() {
    if (gatewayPublicKey) {
      return gatewayPublicKey;
    }

    setBuscandoChavePublica(true);
    try {
      const data = await mpGetPublicKey();
      const chave = String(data?.public_key || '').trim();
      if (!chave) {
        throw new Error('Não foi possível iniciar o pagamento com cartão no momento.');
      }

      setGatewayPublicKey(chave);
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

    if (!paymentStepRef.current?.criptografarCartao) {
      setEtapaAtual(ETAPAS.PAGAMENTO);
      throw new Error('Sessão do cartão expirou. Preencha os dados novamente.');
    }

    const publicKey = await carregarChavePublicaGateway();
    const result = await paymentStepRef.current.criptografarCartao(publicKey);

    setTokenCartao(result.token);
    cartaoPaymentMethodIdRef.current = result.paymentMethodId;
    cartaoIssuerIdRef.current = result.issuerId;
    return result.token;
  }

  async function handleCriarPedido() {
    if (carregando) return;

    setResultadoPix(null);
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
    setResultadoPedido(null);
    setResumoPedidoSnapshot(null);
    setItensPedidoSnapshot([]);
    setQrCodePixDataUrl('');
    setFeedbackCopiaPix('');
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
    let freteSimulado = null;

    if (!retiradaSelecionada) {
      if (cepNormalizado.length !== 8) {
        setErroEntrega('Informe um CEP válido com 8 dígitos para calcular a entrega.');
        setEtapaAtual(ETAPAS.ENTREGA);
        return;
      }

      freteSimulado = simulacaoFrete;
      const cepSimulacaoAtual = normalizarCep(simulacaoFrete?.cep_destino);
      const opcaoSimulacaoAtual = String(simulacaoFrete?.opcao_exibida || '').toLowerCase();
      const modalSimulacaoAtual = String(simulacaoFrete?.modal_interno || simulacaoFrete?.veiculo || '').toLowerCase();
      const precisaNovaSimulacao = !freteSimulado
        || cepSimulacaoAtual !== cepNormalizado
        || opcaoSimulacaoAtual !== veiculoEntrega
        || (veiculoEntrega === 'uber' && modalSimulacaoAtual !== modalUberInterno);

      if (precisaNovaSimulacao) {
        freteSimulado = await executarSimulacaoFrete();
        if (!freteSimulado) {
          setEtapaAtual(ETAPAS.ENTREGA);
          return;
        }
      }
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (formaPagamento === 'debito' && !validarDocumentoFiscal3DS(documentoDigits)) {
      setErro('Para débito com autenticação 3DS, informe um CPF ou CNPJ válido.');
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (pagamentoCartaoSelecionado) {
      try {
        await carregarChavePublicaGateway();
      } catch (error) {
        setErro(error.message || 'Não foi possível preparar o pagamento com cartão.');
        setEtapaAtual(ETAPAS.PAGAMENTO);
        return;
      }
    }

    setCarregando(true);

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = await tryGetRecaptchaToken('checkout_criar_pedido', RECAPTCHA_SITE_KEY, recaptchaCheckoutEnabled);
    } catch {
      setErro('Proteção de segurança indisponível. Tente novamente em instantes.');
      setCarregando(false);
      return;
    }

    try {
      const entregaPayload = retiradaSelecionada
        ? null
        : {
          veiculo: veiculoEntrega === 'bike' ? 'bike' : modalUberInterno,
          cep_destino: formatarCep(cepNormalizado),
          frete_estimado: Number(freteSimulado?.frete || 0),
          distancia_km: Number(freteSimulado?.distancia_km || 0),
          fator_reparo: VEICULOS_ENTREGA[veiculoEntrega === 'bike' ? 'bike' : modalUberInterno]?.fatorReparo || 1,
          estimate_id: freteSimulado?.estimate_id || null,
          opcao_cliente: veiculoEntrega,
          modal_uber_interno: veiculoEntrega === 'bike' ? 'bike' : modalUberInterno,
          numero_destino: String(numeroEntrega || '').trim()
        };

      const data = await criarPedido({
        itens: itensPedido,
        formaPagamento,
        tipoEntrega,
        taxId: documentoDigits,
        cpfNota: cpfNotaValido ? cpfNotaDigits : '',
        recaptchaToken: recaptchaTokenAcao,
        entrega: entregaPayload
      });

      setResultadoPedido(data);
      const itensSnapshot = itensPedido.reduce((accumulator, item) => {
        return accumulator + Number(item.quantidade || 0);
      }, 0);
      const subtotalItensSnapshot = Number(
        itensPedido.reduce((acc, item) => acc + calcularSubtotalLinhaRevisao(item), 0).toFixed(2)
      );
      setResumoPedidoSnapshot({
        itens: itensSnapshot,
        subtotal: Number(data?.total_produtos ?? subtotalItensSnapshot),
        frete: Number(data?.frete_entrega ?? freteSimulado?.frete ?? 0),
        taxa_servico: Number(data?.taxa_servico ?? taxaServicoAtual ?? 0)
      });
      setItensPedidoSnapshot(
        itensPedido.map((item) => ({
          produto_id: item.produto_id,
          nome: item.nome,
          preco: Number(item.preco || 0),
          quantidade: Number(item.quantidade || 1),
          unidade_venda: String(item.unidade_venda || '').trim().toLowerCase(),
          peso_gramas: Number(item.peso_gramas || 0) > 0 ? Number(item.peso_gramas) : null,
          subtotal: Number(item.subtotal || 0)
        }))
      );
      const formaRetornada = String(data?.forma_pagamento || formaPagamento || '').toLowerCase();
      if (formaRetornada === 'debito') {
        setFormaPagamento('debito');
      } else if (['cartao', 'credito'].includes(formaRetornada)) {
        setFormaPagamento('credito');
      } else {
        setFormaPagamento('pix');
      }
      setStatusPedidoAtual('aguardando_revisao');
      setUltimaAtualizacaoRevisao(new Date().toISOString());
      trackOrder(data?.pedido_id, {
        ...data,
        status: 'aguardando_revisao',
        pedido_id: data?.pedido_id || data?.id
      });
      clearCart();
      setEtapaAtual(ETAPAS.REVISAO);
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
      // Se já está pendente (aprovado), vai direto pro pagamento
      if (statusPedidoAtual === 'pendente' || statusPedidoAtual === 'pagamento_recusado') {
        setEtapaAtual(ETAPAS.PIX);
      } else {
        setEtapaAtual(ETAPAS.REVISAO);
      }
      return;
    }
    await handleCriarPedido();
  }

  async function handleCancelarPedidoEmRevisao() {
    const pedidoId = Number(resultadoPedido?.pedido_id || 0);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || cancelandoRevisao) {
      return;
    }

    const confirmarCancelamento = typeof window !== 'undefined'
      ? window.confirm('Deseja cancelar este pedido em revisão? O estoque será devolvido e você poderá montar outro pedido.')
      : true;

    if (!confirmarCancelamento) {
      return;
    }

    setCancelandoRevisao(true);
    setErro('');

    try {
      const data = await cancelarPedidoRevisao(pedidoId, {
        motivo: 'Cancelado pelo cliente durante revisão.'
      });

      trackOrder(pedidoId, data || { status: 'cancelado' });
      sairDoFluxoRevisaoEncerrado('Pedido cancelado. Você pode montar outro carrinho normalmente.');
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message || 'Não foi possível cancelar o pedido em revisão.');
    } finally {
      setCancelandoRevisao(false);
    }
  }

  function handleContinuarPagamento() {
    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    if (!(documentoDigits.length === 11 || documentoDigits.length === 14)) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      return;
    }

    setErro('');
    setEtapaAtual(ETAPAS.REVISAO_CLIENTE);
  }

  // Polling de revis?o: verifica a cada 10s se o pedido foi aprovado.
  useEffect(() => {
    if (etapaAtual !== ETAPAS.REVISAO || !resultadoPedido?.pedido_id) return undefined;

    let ativo = true;
    let emAndamento = false;
    let statusAbortController = null;

    const executarPolling = async () => {
      if (!ativo || emAndamento) {
        return;
      }

      emAndamento = true;
      if (statusAbortController) {
        statusAbortController.abort();
      }
      statusAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

      try {
        const data = await getPedidoStatus(resultadoPedido.pedido_id, {
          signal: statusAbortController?.signal
        });
        const novoStatus = String(data?.status || '').toLowerCase();

        if (!ativo) return;

        setUltimaAtualizacaoRevisao(new Date().toISOString());
        trackOrder(resultadoPedido.pedido_id, data || { status: novoStatus });

        if (novoStatus === 'pendente' || novoStatus === 'pagamento_recusado') {
          setStatusPedidoAtual(novoStatus);
          setEtapaAtual(ETAPAS.PIX);
        } else if (novoStatus === 'pago') {
          setStatusPedidoAtual('pago');
          setPagamentoConfirmado(true);
          setEtapaAtual(ETAPAS.STATUS);
        } else if (novoStatus === 'cancelado' || novoStatus === 'expirado') {
          setStatusPedidoAtual(novoStatus);
          sairDoFluxoRevisaoEncerrado('Seu pedido em revis?o foi encerrado. Voc? pode montar um novo carrinho.');
        } else if (novoStatus) {
          setStatusPedidoAtual(novoStatus);
        }
      } catch (error) {
        const erroCancelado = error?.name === 'AbortError'
          || error?.code === 'API_ABORTED'
          || Number(error?.status || 0) === 499;
        if (erroCancelado) {
          return;
        }
        // Silencioso: tenta novamente no proximo tick.
      } finally {
        emAndamento = false;
      }
    };

    void executarPolling();
    const intervalo = setInterval(() => {
      void executarPolling();
    }, 3000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
      if (statusAbortController) {
        statusAbortController.abort();
      }
      emAndamento = false;
    };
  }, [etapaAtual, resultadoPedido?.pedido_id, sairDoFluxoRevisaoEncerrado, trackOrder]);

  useEffect(() => {
    if (etapaAtual !== ETAPAS.PIX || formaPagamento !== 'pix' || !resultadoPedido?.pedido_id) {
      return undefined;
    }

    let ativo = true;
    let emAndamento = false;
    let tentativa = 0;
    let timeoutId = null;
    let statusAbortController = null;
    const inicioObservacao = Date.now();

    const resolverDelay = () => {
      if (tentativa < 10) return 4000;
      if (tentativa < 30) return 7000;
      return 12000;
    };

    const agendarProxima = () => {
      if (!ativo) {
        return;
      }

      const observacaoExpirada = (Date.now() - inicioObservacao) >= PIX_POLLING_DURACAO_MAXIMA_MS;
      const tentativasExcedidas = tentativa >= PIX_POLLING_MAX_TENTATIVAS;

      if (observacaoExpirada || tentativasExcedidas) {
        setResultadoPix((atual) => {
          if (!atual || atual.status === 'PAID' || atual.status === 'APPROVED') {
            return atual;
          }
          return { ...atual, status: 'OBSERVATION_ENDED' };
        });
        return;
      }

      timeoutId = setTimeout(() => {
        void executarPolling();
      }, resolverDelay());
    };

    const executarPolling = async () => {
      if (!ativo || emAndamento) {
        return;
      }

      emAndamento = true;
      if (statusAbortController) {
        statusAbortController.abort();
      }
      statusAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

      try {
        const data = await getPedidoStatus(resultadoPedido.pedido_id, {
          signal: statusAbortController?.signal
        });

        if (!ativo) {
          return;
        }

        const novoStatus = String(data?.status || '').toLowerCase();
        if (novoStatus) {
          setStatusPedidoAtual(novoStatus);
          setUltimaAtualizacaoRevisao(new Date().toISOString());
          trackOrder(resultadoPedido.pedido_id, data || { status: novoStatus });

          const aprovado = novoStatus === 'pago' || novoStatus === 'entregue';
          setPagamentoConfirmado(aprovado);

          setResultadoPix((atual) => {
            const base = atual || {};
            const mpStatusGateway = String(data?.mp_status || '').trim().toUpperCase();
            const statusGateway = mpStatusGateway
              || (aprovado
                ? 'PAID'
                : novoStatus === 'cancelado'
                  ? 'CANCELED'
                  : novoStatus === 'pagamento_recusado'
                    ? 'DECLINED'
                    : novoStatus === 'expirado'
                      ? 'EXPIRED'
                      : String(base.status || 'WAITING').toUpperCase());

            return {
              ...base,
              status: statusGateway,
              status_interno: novoStatus,
              pix_codigo: String(data?.pix_codigo || base.pix_codigo || base.qr_data || '').trim(),
              qr_data: String(data?.pix_codigo || base.qr_data || base.pix_codigo || '').trim(),
              pix_qrcode: String(data?.pix_qrcode || base.pix_qrcode || '').trim(),
              qr_code_base64: String(data?.pix_qr_base64 || data?.qr_code_base64 || base.qr_code_base64 || '').trim()
            };
          });

          if (STATUS_TERMINAIS_PIX_POLLING.has(novoStatus)) {
            return;
          }
        }

        tentativa += 1;
        agendarProxima();
      } catch (error) {
        const erroCancelado = error?.name === 'AbortError'
          || error?.code === 'API_ABORTED'
          || Number(error?.status || 0) === 499;
        if (erroCancelado) {
          return;
        }

        if (isAuthErrorMessage(error?.message)) {
          setAutenticado(false);
          return;
        }

        tentativa += 1;
        agendarProxima();
      } finally {
        emAndamento = false;
      }
    };

    void executarPolling();

    return () => {
      ativo = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (statusAbortController) {
        statusAbortController.abort();
      }
      emAndamento = false;
    };
  }, [etapaAtual, formaPagamento, resultadoPedido?.pedido_id, trackOrder]);

  useEffect(() => {
    const statusAtual = String(statusPedidoAtual || resultadoPedido?.status || '').toLowerCase();
    if (statusAtual !== 'pago') {
      return;
    }

    if (etapaAtual === ETAPAS.STATUS) {
      return;
    }

    setPagamentoConfirmado(true);
    setEtapaAtual(ETAPAS.STATUS);
  }, [etapaAtual, resultadoPedido?.status, statusPedidoAtual]);

  useEffect(() => {
    const statusAtual = String(statusPedidoAtual || resultadoPedido?.status || '').toLowerCase();
    if (statusAtual !== 'pago' || !resultadoPedido?.pedido_id) {
      return undefined;
    }

    const timer = setTimeout(() => {
      navigate('/pedidos', {
        replace: true,
        state: { pedidoRecemPagoId: resultadoPedido.pedido_id }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate, resultadoPedido?.pedido_id, resultadoPedido?.status, statusPedidoAtual]);

  // Auto-gerar PIX via Mercado Pago ao entrar na etapa de pagamento.
  useEffect(() => {
    if (etapaAtual !== ETAPAS.PIX) return;
    if (!resultadoPedido?.pedido_id) return;
    if (resultadoPix) return; // Já tem PIX gerado
    if (formaPagamento !== 'pix') return;
    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) return;

    handleGerarPixMercadoPago(resultadoPedido.pedido_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    etapaAtual,
    formaPagamento,
    resultadoPedido?.pedido_id,
    resultadoPix,
    documentoPagador
  ]);

  // Gerar PIX via Mercado Pago.
  async function handleGerarPixMercadoPago(pedidoId) {
    if (!pedidoId || carregando) return;

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o PIX.');
      return;
    }

    setResultadoPix(null);
    setFeedbackCopiaPix('');
    setErro('');
    setCarregando(true);

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = await tryGetRecaptchaToken('checkout_pix', RECAPTCHA_SITE_KEY, recaptchaCheckoutEnabled);
    } catch {
      setErro('Proteção de segurança indisponível. Tente novamente em instantes.');
      setCarregando(false);
      return;
    }

    try {
      const data = await mpGerarPix(pedidoId, documentoDigits, recaptchaTokenAcao);
      setResultadoPix({
        status: String(data?.status || 'pending').toUpperCase() === 'PENDING' ? 'WAITING' : String(data?.status || 'WAITING').toUpperCase(),
        status_interno: 'pendente',
        qr_data: String(data?.pix_codigo || '').trim(),
        qr_code_base64: data?.qr_code_base64 || null,
        pix_codigo: String(data?.pix_codigo || '').trim(),
        pix_qrcode: String(data?.pix_qrcode || '').trim()
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message || 'Não foi possível gerar o PIX. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  // Pagar com cart?o via Mercado Pago.
  async function handlePagarCartaoMercadoPago(pedidoId) {
    if (carregando) return;

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagar com cartão.');
      return;
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = await tryGetRecaptchaToken('checkout_cartao', RECAPTCHA_SITE_KEY, recaptchaCheckoutEnabled);
    } catch {
      setErro('Proteção de segurança indisponível. Tente novamente em instantes.');
      return;
    }

    let tokenParaPagamento = String(tokenCartao || '').trim();
    if (!tokenParaPagamento) {
      if (!dadosCartaoCompletos) {
        setErro('Preencha os dados do cartão para continuar.');
        return;
      }

      try {
        tokenParaPagamento = await handleCriptografarCartao();
      } catch (error) {
        setErro(error?.message || 'Não foi possível validar os dados do cartão.');
        return;
      }
    }

    setCarregando(true);
    setErro('');
    try {
      const tentarPagamentoCartao = (tokenAtual) => mpPagarCartao(pedidoId, {
        token: tokenAtual,
        parcelas: Number(parcelasCartao) || 1,
        taxId: documentoDigits,
        paymentMethodId: cartaoPaymentMethodIdRef.current,
        issuerId: cartaoIssuerIdRef.current,
        recaptchaToken: recaptchaTokenAcao
      });

      let data;
      try {
        data = await tentarPagamentoCartao(tokenParaPagamento);
      } catch (erroPagamento) {
        const mensagemErro = String(erroPagamento?.serverMessage || erroPagamento?.message || '').toLowerCase();
        const tokenInvalido = mensagemErro.includes('invalid card_token_id');

        if (!tokenInvalido || !dadosCartaoCompletos) {
          throw erroPagamento;
        }

        // Token MP pode expirar entre etapas; refaz tokenização e tenta uma única vez.
        setTokenCartao('');
        const novoToken = await handleCriptografarCartao();
        data = await tentarPagamentoCartao(novoToken);
      }

      if (data?.status === 'approved' || data?.status_interno === 'pago') {
        setStatusPedidoAtual('pago');
        setPagamentoConfirmado(true);
        setEtapaAtual(ETAPAS.STATUS);
      } else if (data?.status === 'rejected') {
        setErro('Pagamento recusado. Verifique os dados do cartão e tente novamente.');
      } else {
        setErro('Pagamento em análise. Aguarde a confirmação.');
      }
    } catch (error) {
      setErro(error.message || 'Não foi possível processar o pagamento.');
    } finally {
      setCarregando(false);
    }
  }

  async function handleVerificarPagamentoPix() {
    if (!resultadoPedido?.pedido_id) {
      return;
    }

    setErro('');
    setVerificandoStatusPix(true);

    try {
      const data = await getPedidoStatus(resultadoPedido.pedido_id);
      const statusInterno = String(data?.status || '').toLowerCase();
      if (!statusInterno) {
        throw new Error('Nao foi possivel localizar o pedido para verificar o pagamento.');
      }

      setStatusPedidoAtual(statusInterno);
      setUltimaAtualizacaoRevisao(new Date().toISOString());
      trackOrder(resultadoPedido.pedido_id, data || { status: statusInterno });

      const aprovado = statusInterno === 'pago' || statusInterno === 'entregue';
      setPagamentoConfirmado(aprovado);

      setResultadoPix((atual) => {
        const base = atual || {};
        const mpStatusGateway = String(data?.mp_status || '').trim().toUpperCase();
        const statusGateway = mpStatusGateway
          || (aprovado
            ? 'PAID'
            : statusInterno === 'cancelado'
              ? 'CANCELED'
              : statusInterno === 'pagamento_recusado'
                ? 'DECLINED'
                : statusInterno === 'expirado'
                  ? 'EXPIRED'
                  : String(base.status || 'WAITING').toUpperCase());

        return {
          ...base,
          status: statusGateway,
          status_interno: statusInterno,
          pix_codigo: String(data?.pix_codigo || base.pix_codigo || base.qr_data || '').trim(),
          qr_data: String(data?.pix_codigo || base.qr_data || base.pix_codigo || '').trim(),
          pix_qrcode: String(data?.pix_qrcode || base.pix_qrcode || '').trim(),
          qr_code_base64: String(data?.pix_qr_base64 || data?.qr_code_base64 || base.qr_code_base64 || '').trim()
        };
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message || 'Nao foi possivel atualizar o status do pagamento PIX.');
    } finally {
      setVerificandoStatusPix(false);
    }
  }

  async function handleCopiarCodigoPix() {
    if (!codigoPixAtual) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigoPixAtual);
      } else {
        const campoTemporario = document.createElement('textarea');
        campoTemporario.value = codigoPixAtual;
        campoTemporario.setAttribute('readonly', '');
        campoTemporario.style.position = 'absolute';
        campoTemporario.style.left = '-9999px';
        document.body.appendChild(campoTemporario);
        campoTemporario.select();
        document.execCommand('copy');
        document.body.removeChild(campoTemporario);
      }

      setFeedbackCopiaPix('Código copiado com sucesso.');
    } catch {
      setFeedbackCopiaPix('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    }
  }

  async function handleCopiarEvidenciaHomologacao3DS() {
    if (!eventosHomologacao3DS.length) {
      return;
    }

    const conteudo = JSON.stringify(montarPacoteEvidenciaHomologacao3DS(), null, 2);

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(conteudo);
      } else {
        const campoTemporario = document.createElement('textarea');
        campoTemporario.value = conteudo;
        campoTemporario.setAttribute('readonly', '');
        campoTemporario.style.position = 'absolute';
        campoTemporario.style.left = '-9999px';
        document.body.appendChild(campoTemporario);
        campoTemporario.select();
        document.execCommand('copy');
        document.body.removeChild(campoTemporario);
      }

      setFeedbackEvidencia3DS('Log sanitizado de homologacao 3DS copiado.');
    } catch {
      setFeedbackEvidencia3DS('Nao foi possivel copiar o log de homologacao automaticamente.');
    }
  }

  function handleBaixarEvidenciaHomologacao3DS() {
    if (!eventosHomologacao3DS.length) {
      return;
    }

    const conteudo = JSON.stringify(montarPacoteEvidenciaHomologacao3DS(), null, 2);
    const pedidoIdArquivo = Number.parseInt(String(resultadoPedido?.pedido_id || ''), 10) || 'sem-pedido';
    const nomeArquivo = `gateway-hml-debito-3ds-pedido-${pedidoIdArquivo}-${Date.now()}.json`;
    const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedbackEvidencia3DS(`Arquivo de homologacao gerado: ${nomeArquivo}`);
  }


  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.ENTREGA) return 1;
    if (etapa === ETAPAS.PAGAMENTO) return 2;
    if (etapa === ETAPAS.REVISAO_CLIENTE) return 3;
    if (etapa === ETAPAS.REVISAO) return 3;
    if (etapa === ETAPAS.PIX) return 3;
    return 4;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const tituloEtapaAtual = (() => {
    if (etapaAtual === ETAPAS.CARRINHO) return 'Carrinho';
    if (etapaAtual === ETAPAS.ENTREGA) return 'Entrega';
    if (etapaAtual === ETAPAS.PAGAMENTO) return 'Pagamento';
    if (etapaAtual === ETAPAS.REVISAO_CLIENTE) return 'Confirmar pedido';
    if (etapaAtual === ETAPAS.REVISAO) return 'Revisão';
    if (etapaAtual === ETAPAS.PIX) return formaPagamento === 'pix' ? 'Pagamento' : `Pagamento com ${tituloFormaPagamento}`;
    return 'Confirmação';
  })();
  const subtituloEtapaAtual = `Etapa ${etapaIndex + 1} de 5`;
  const subtituloEtapaAtualTexto = etapaAtual === ETAPAS.PAGAMENTO
    ? 'Escolha como pagar e confirme seu pedido em segundos.'
    : etapaAtual === ETAPAS.REVISAO_CLIENTE
      ? 'Revise seu pedido antes de confirmar.'
      : subtituloEtapaAtual;
  const labelStatus = formatarStatusPedido(statusPedidoAtual || resultadoPedido?.status || 'pendente');
  const statusRevisaoAtual = String(statusPedidoAtual || resultadoPedido?.status || '').toLowerCase();
  const podeCancelarRevisaoPedido = ['aguardando_revisao', 'pendente', 'pagamento_recusado'].includes(statusRevisaoAtual)
    && Number(resultadoPedido?.pedido_id || 0) > 0;
  const textoUltimaAtualizacaoRevisao = (() => {
    const syncIso = ultimaAtualizacaoRevisao || reviewTrackerGlobal?.lastSyncAt || '';
    const syncMs = Number(new Date(syncIso || 0).getTime());
    if (!Number.isFinite(syncMs) || syncMs <= 0) {
      return 'Atualização automática ativa a cada poucos segundos';
    }

    const elapsedSec = Math.max(0, Math.floor((Date.now() - syncMs) / 1000));
    if (elapsedSec < 5) {
      return 'Atualizado agora';
    }

    if (elapsedSec < 60) {
      return `Atualizado há ${elapsedSec}s`;
    }

    return `Atualizado há ${Math.floor(elapsedSec / 60)} min`;
  })();
  const carrinhoVazio = itens.length === 0;
  const statusCartaoAtual = String(resultadoCartao?.status || '').toUpperCase();
  const statusInternoCartaoAtual = String(resultadoCartao?.status_interno || '').toLowerCase();
  const cartaoRecusado = ['DECLINED', 'REJECTED', 'CANCELED'].includes(statusCartaoAtual)
    || statusInternoCartaoAtual === 'pagamento_recusado';
  const cartaoProcessado = Boolean(resultadoCartao) && !cartaoRecusado;
  const cartaoAprovado = statusCartaoAtual === 'PAID' || statusInternoCartaoAtual === 'pago' || statusInternoCartaoAtual === 'entregue';
  const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
  const documentoValidoPagamento = documentoDigits.length === 11 || documentoDigits.length === 14;
  const feedbackEvidencia3DSTone = feedbackEvidencia3DS
    ? (String(feedbackEvidencia3DS).toLowerCase().includes('nao foi possivel')
      || String(feedbackEvidencia3DS).toLowerCase().includes('não foi possível')
      ? 'is-warning'
      : 'is-success')
    : '';
  const cpfNotaDigits = normalizarDocumentoFiscal(cpfNotaFiscal).slice(0, 11);
  const cpfNotaValido = cpfNotaDigits.length === 11 && validarCpf(cpfNotaDigits);
  const cartaoProntoParaContinuar = !pagamentoCartaoSelecionado || Boolean(tokenCartao) || dadosCartaoCompletos;
  const formaPagamentoAtual = FORMAS_PAGAMENTO_OPCOES[formaPagamento]
    || FORMAS_PAGAMENTO_OPCOES.pix
    || {
      title: 'Pagamento',
      summaryTitle: 'Forma de pagamento',
      summaryDescription: ['Selecione um método para continuar.'],
      ctaText: 'Continuar'
    };
  const resumoFretePagamento = resultadoPedido?.pedido_id
    ? freteSelecionado
    : retiradaSelecionada
      ? 0
      : simulacaoFrete
        ? freteAtual
        : null;
  const resumoTaxaServicoPagamento = resultadoPedido?.pedido_id
    ? taxaServicoPedido
    : taxaServicoAtual;
  const resumoTotalPagamento = resultadoPedido?.pedido_id
    ? totalComEntregaPedido
    : retiradaSelecionada
      ? Number((Number(resumo.total || 0) + taxaServicoAtual).toFixed(2))
      : simulacaoFrete
        ? totalComFreteAtual
        : Number((Number(resumo.total || 0) + taxaServicoAtual).toFixed(2));
  const resumoItensPagamento = Number(resultadoPedido?.itens_count || resumoPedidoSnapshot?.itens || resumo.itens || 0);
  const pagamentoSemFreteCalculado = !retiradaSelecionada && !resultadoPedido?.pedido_id && !simulacaoFrete;
  const pagamentoSemItens = itens.length === 0 && !resultadoPedido?.pedido_id;
  const bloqueioPagamento = pagamentoSemItens
    || pagamentoSemFreteCalculado
    || carregando
    || simulandoFrete
    || buscandoChavePublica
    || !documentoValidoPagamento
    || (pagamentoCartaoSelecionado && !cartaoProntoParaContinuar);
  const mensagemBloqueioPagamento = pagamentoSemItens
    ? 'Seu carrinho está vazio. Adicione produtos para seguir com o pagamento.'
    : pagamentoSemFreteCalculado
      ? 'Frete ainda não calculado. Volte para entrega e calcule o CEP para continuar.'
      : documentoDigits.length === 0
        ? 'Informe CPF/CNPJ para habilitar a continuação.'
        : !documentoValidoPagamento
          ? 'Documento inválido. Use CPF com 11 dígitos ou CNPJ com 14 dígitos.'
          : pagamentoCartaoSelecionado && !cartaoProntoParaContinuar
            ? 'Complete os dados do cartão para habilitar a continuação.'
        : '';
  const codigoPixAtual = String(resultadoPix?.qr_data || resultadoPix?.pix_codigo || resultadoPedido?.pix_codigo || '').trim();
  const qrCodeBase64Atual = String(resultadoPix?.qr_code_base64 || '').trim();
  const qrCodeRemotoAtual = String(resultadoPix?.pix_qrcode || resultadoPedido?.pix_qrcode || '').trim();
  const qrCodePixSrc = qrCodeBase64Atual
    ? `data:image/png;base64,${qrCodeBase64Atual}`
    : qrCodeRemotoAtual || qrCodePixDataUrl;
  const statusPixVisual = obterStatusPixVisual({
    status: resultadoPix?.status,
    statusInterno: resultadoPix?.status_interno || statusPedidoAtual || resultadoPedido?.status,
    pagamentoConfirmado
  });
  const pixPagamentoAprovado = statusPixVisual.aprovado;
  const textoBotaoGerarPix = carregando
    ? 'Gerando QR Code PIX...'
    : codigoPixAtual || qrCodePixSrc
      ? 'Atualizar QR Code'
      : 'Gerar QR Code PIX';
  const itensResumoPix = Number(resultadoPedido?.itens_count || resumoPedidoSnapshot?.itens || 0);
  const itensResumoPixExibicao = itensResumoPix > 0
    ? itensResumoPix
    : resumoItensPagamento > 0
      ? resumoItensPagamento
      : '-';
  const podeContinuarConfirmacaoPix = pixPagamentoAprovado || pagamentoConfirmado;
  const bloqueioGeracaoPix = carregando
    || verificandoStatusPix
    || !resultadoPedido?.pedido_id
    || !documentoValidoPagamento;
  const bloqueioVerificacaoPix = verificandoStatusPix || carregando || !resultadoPedido?.pedido_id;
  const pixDisponivelParaPagar = Boolean(codigoPixAtual || qrCodePixSrc);
  const mensagemProcessamentoCheckout = etapaAtual === ETAPAS.PIX
    ? (formaPagamento === 'pix'
      ? 'Processando informações do PIX. Aguarde para evitar pagamentos duplicados.'
      : `Processando ${tituloFormaPagamento.toLowerCase()}. Aguarde a confirmação do gateway.`)
    : 'Processando as informações do seu pedido com segurança.';
  const pagamentoAprovadoCheckout = pagamentoConfirmado || pixPagamentoAprovado || cartaoAprovado;
  const handleVoltarEtapaAtual = useCallback(() => {
    if (etapaAtual === ETAPAS.CARRINHO) {
      navigate('/produtos');
      return;
    }

    if (etapaAtual === ETAPAS.ENTREGA) {
      setEtapaAtual(ETAPAS.CARRINHO);
      return;
    }

    if (etapaAtual === ETAPAS.PAGAMENTO) {
      setEtapaAtual(ETAPAS.ENTREGA);
      return;
    }

    if (etapaAtual === ETAPAS.REVISAO_CLIENTE) {
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (etapaAtual === ETAPAS.REVISAO) {
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (etapaAtual === ETAPAS.PIX) {
      setEtapaAtual(ETAPAS.REVISAO);
      return;
    }

    navigate('/pedidos');
  }, [etapaAtual, navigate]);

  const handleLimparCarrinhoCheckout = useCallback(() => {
    clearCart();
  }, [clearCart]);

  const exibirAcaoLimparNoTopo = etapaAtual === ETAPAS.CARRINHO && itens.length > 0;

  const mobileActionBarConfig = (() => {
    if (etapaAtual === ETAPAS.CARRINHO) {
      return {
        stepLabel: subtituloEtapaAtual,
        totalLabel: `Total parcial: ${formatarMoeda(resumo.total)}`,
        caption: '',
        primaryLabel: `Ir para entrega · ${formatarMoeda(Number(resumo.total || 0) + Number(taxaServicoAtual || 0))}`,
        onPrimaryClick: () => setEtapaAtual(ETAPAS.ENTREGA),
        primaryDisabled: carrinhoVazio
      };
    }

    if (etapaAtual === ETAPAS.ENTREGA) {
      const captionEntrega = bloqueioAgua20LAtivo
        ? bloqueioAgua20LMotivo
        : (simulacaoFrete ? '' : 'Calcule a entrega para continuar');

      return {
        stepLabel: 'Etapa 2 de 5',
        totalLabel: simulacaoFrete
          ? `Total com entrega ${formatarMoeda(totalComFreteAtual)}`
          : `Total com entrega ${formatarMoeda(Number(resumo.total || 0) + Number(taxaServicoAtual || 0))}`,
        caption: captionEntrega,
        primaryLabel: 'Ir para pagamento',
        onPrimaryClick: () => setEtapaAtual(ETAPAS.PAGAMENTO),
        primaryDisabled: !podeAvancarParaPagamento
      };
    }

    if (etapaAtual === ETAPAS.PAGAMENTO) {
      return {
        stepLabel: 'Etapa 3 de 5',
        totalLabel: `Total do pedido: ${formatarMoeda(resumoTotalPagamento)}`,
        caption: mensagemBloqueioPagamento || `Forma atual: ${formaPagamentoAtual.title}`,
        primaryLabel: carregando ? 'Processando...' : `Revisar pedido · ${formatarMoeda(resumoTotalPagamento)}`,
        onPrimaryClick: () => {
          void handleContinuarPagamento();
        },
        primaryDisabled: bloqueioPagamento,
        secondaryLabel: 'Voltar para entrega',
        onSecondaryClick: () => setEtapaAtual(ETAPAS.ENTREGA)
      };
    }

    if (etapaAtual === ETAPAS.REVISAO_CLIENTE) {
      return {
        stepLabel: 'Etapa 3 de 5',
        totalLabel: `Total do pedido: ${formatarMoeda(resumoTotalPagamento)}`,
        caption: 'Revise seu pedido antes de confirmar.',
        primaryLabel: carregando ? 'Confirmando...' : `Confirmar pedido · ${formatarMoeda(resumoTotalPagamento)}`,
        onPrimaryClick: () => { void handleIrParaPagamento(); },
        primaryDisabled: carregando,
        secondaryLabel: 'Voltar para pagamento',
        onSecondaryClick: () => setEtapaAtual(ETAPAS.PAGAMENTO)
      };
    }

    if (etapaAtual === ETAPAS.REVISAO) {
      return {
        stepLabel: 'Etapa 4 de 5',
        totalLabel: `Total do pedido: ${formatarMoeda(totalComEntregaPedido)}`,
        caption: ['cancelado', 'expirado'].includes(String(statusPedidoAtual || '').toLowerCase())
          ? 'Pedido encerrado.'
          : 'Aguardando revisão da equipe do mercado...',
        primaryLabel: 'Confirmar pedido',
        onPrimaryClick: () => setEtapaAtual(ETAPAS.PIX),
        primaryDisabled: !['pendente', 'pago', 'pagamento_recusado'].includes(String(statusPedidoAtual || '').toLowerCase())
      };
    }

    if (etapaAtual === ETAPAS.PIX) {
      if (formaPagamento === 'pix') {
        return {
          stepLabel: 'Etapa 4 de 5',
          totalLabel: `Total do pedido: ${formatarMoeda(totalComEntregaPedido)}`,
          caption: podeContinuarConfirmacaoPix
            ? 'Pagamento aprovado. Siga para confirmar o pedido.'
            : 'Após pagar no banco, confirme o status aqui.',
          primaryLabel: podeContinuarConfirmacaoPix
            ? 'Ir para confirmação'
            : (verificandoStatusPix ? 'Verificando pagamento PIX...' : 'Verificar pagamento PIX'),
          onPrimaryClick: () => {
            if (podeContinuarConfirmacaoPix) {
              setPagamentoConfirmado(true);
              setEtapaAtual(ETAPAS.STATUS);
              return;
            }
            void handleVerificarPagamentoPix();
          },
          primaryDisabled: podeContinuarConfirmacaoPix
            ? false
            : (bloqueioVerificacaoPix || !pixDisponivelParaPagar),
          secondaryLabel: textoBotaoGerarPix,
          onSecondaryClick: () => {
            if (resultadoPedido?.pedido_id) {
              void handleGerarPixMercadoPago(resultadoPedido.pedido_id);
            }
          },
          secondaryDisabled: bloqueioGeracaoPix
        };
      }

      return {
        stepLabel: 'Etapa 4 de 5',
        totalLabel: `Total do pedido: ${formatarMoeda(totalComEntregaPedido)}`,
        caption: cartaoAprovado
          ? 'Pagamento aprovado. Siga para a confirmação.'
          : 'Conclua o pagamento no cartão para continuar.',
        primaryLabel: 'Ir para confirmação',
        onPrimaryClick: () => {
          setPagamentoConfirmado(cartaoAprovado);
          setEtapaAtual(ETAPAS.STATUS);
        },
        primaryDisabled: !cartaoProcessado,
        secondaryLabel: 'Voltar para pagamento',
        onSecondaryClick: () => setEtapaAtual(ETAPAS.PAGAMENTO)
      };
    }

    return null;
  })();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const contextoCheckout = etapaAtual === ETAPAS.STATUS
      ? null
      : {
          stepLabel: mobileActionBarConfig?.stepLabel || '',
          totalLabel: mobileActionBarConfig?.totalLabel || '',
          caption: mobileActionBarConfig?.caption || '',
          primaryLabel: mobileActionBarConfig?.primaryLabel || '',
          primaryDisabled: Boolean(mobileActionBarConfig?.primaryDisabled)
        };

    window.dispatchEvent(new CustomEvent('bomfilho:checkout-context', { detail: contextoCheckout }));

    return () => {
      window.dispatchEvent(new CustomEvent('bomfilho:checkout-context', { detail: null }));
    };
  }, [
    etapaAtual,
    mobileActionBarConfig?.caption,
    mobileActionBarConfig?.primaryDisabled,
    mobileActionBarConfig?.primaryLabel,
    mobileActionBarConfig?.stepLabel,
    mobileActionBarConfig?.totalLabel
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function handleGlobalCheckoutPrimaryAction() {
      if (!mobileActionBarConfig?.onPrimaryClick || mobileActionBarConfig?.primaryDisabled) {
        return;
      }

      mobileActionBarConfig.onPrimaryClick();
    }

    window.addEventListener('bomfilho:checkout-primary-action', handleGlobalCheckoutPrimaryAction);
    return () => {
      window.removeEventListener('bomfilho:checkout-primary-action', handleGlobalCheckoutPrimaryAction);
    };
  }, [mobileActionBarConfig]);

  useEffect(() => {
    if (startCheckoutTrackedRef.current) {
      return;
    }

    if (itens.length === 0) {
      return;
    }

    const cartPayload = buildCartEventPayload({
      itens,
      resumo: { total: resumo.total }
    });

    captureCommerceEvent('start_checkout', {
      ...cartPayload,
      checkout_step: etapaAtual,
      checkout_step_index: getIndiceEtapa(etapaAtual) + 1,
      delivery_type_selected: tipoEntrega,
      payment_method_selected: formaPagamento,
      authenticated_session: autenticado === true,
      currency: 'BRL'
    });

    startCheckoutTrackedRef.current = true;
  }, [autenticado, etapaAtual, formaPagamento, itens, resumo.total, tipoEntrega]);

  useEffect(() => {
    const pedidoId = Number.parseInt(String(resultadoPedido?.pedido_id || ''), 10);
    if (!pedidoId || !pagamentoAprovadoCheckout) {
      return;
    }

    if (purchaseTrackedOrdersRef.current.has(pedidoId)) {
      return;
    }

    const subtotal = Number(resultadoPedido?.total_produtos ?? resumoPedidoSnapshot?.subtotal ?? 0);
    const frete = Number(resultadoPedido?.frete_entrega ?? resumoPedidoSnapshot?.frete ?? 0);
    const taxaServicoTracking = Number(resultadoPedido?.taxa_servico ?? resumoPedidoSnapshot?.taxa_servico ?? 0);
    const total = Number(resultadoPedido?.total ?? Number((subtotal + frete + taxaServicoTracking).toFixed(2)));
    const itensFonte = itensPedidoSnapshot.length
      ? itensPedidoSnapshot
      : Array.isArray(resultadoPedido?.itens)
        ? resultadoPedido.itens
        : [];
    const itensPedidoTracking = buildOrderItemsPayload(itensFonte);
    const itemsCount = Number(
      resultadoPedido?.itens_count
      ?? resumoPedidoSnapshot?.itens
      ?? itensPedidoTracking.length
      ?? 0
    );

    captureCommerceEvent('purchase', {
      order_id: pedidoId,
      payment_method: String(resultadoPedido?.forma_pagamento || formaPagamento || '').toLowerCase() || null,
      delivery_type: String(resultadoPedido?.tipo_entrega || tipoEntrega || '').toLowerCase() || null,
      payment_status: String(statusPedidoAtual || resultadoPedido?.status || '').toLowerCase() || null,
      currency: 'BRL',
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(frete.toFixed(2)),
      service_fee: Number(taxaServicoTracking.toFixed(2)),
      revenue: Number(total.toFixed(2)),
      items_count: itemsCount,
      line_items: itensPedidoTracking
    });

    purchaseTrackedOrdersRef.current.add(pedidoId);
  }, [
    formaPagamento,
    itensPedidoSnapshot,
    pagamentoAprovadoCheckout,
    resultadoPedido,
    resumoPedidoSnapshot,
    statusPedidoAtual,
    tipoEntrega
  ]);

  useEffect(() => {
    if (!feedbackCopiaPix) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFeedbackCopiaPix('');
    }, 2200);

    return () => clearTimeout(timeout);
  }, [feedbackCopiaPix]);

  useEffect(() => {
    let ativo = true;

    if (qrCodeBase64Atual || qrCodeRemotoAtual || !codigoPixAtual) {
      setQrCodePixDataUrl('');
      return () => {
        ativo = false;
      };
    }

    gerarQrCodeDataUrl(codigoPixAtual)
      .then((dataUrl) => {
        if (ativo) {
          setQrCodePixDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (ativo) {
          setQrCodePixDataUrl('');
        }
      });

    return () => {
      ativo = false;
    };
  }, [codigoPixAtual, qrCodeBase64Atual, qrCodeRemotoAtual]);

  if (verificandoSessao) {
    return (
      <section className="page">
        <h1>Finalizar pedido</h1>
        <p>Validando sua sessão...</p>
      </section>
    );
  }

  if (retomandoPedidoExistente && !resultadoPedido?.pedido_id) {
    return (
      <section className="page">
        <h1>Finalizar pedido</h1>
        <p>Retomando o status do seu pedido em revisão...</p>
      </section>
    );
  }

  const possuiPedidoRetomadaContexto = pedidoRetomadaId > 0
    || (Number(reviewTrackerGlobal?.orderId || 0) > 0 && statusEhElegivelParaFluxoRevisao(reviewTrackerGlobal?.status));

  if (itens.length === 0 && !resultadoPedido?.pedido_id && !possuiPedidoRetomadaContexto && !retomandoPedidoExistente) {
    return <Navigate to="/produtos" replace />;
  }

  const dispatch = (action) => {
    switch (action.type) {
      case CHECKOUT_ACTIONS.SET_ETAPA:
        setEtapaAtual(action.payload);
        break;
      case CHECKOUT_ACTIONS.SET_FORMA_PAGAMENTO:
        setFormaPagamento(action.payload);
        break;
      case CHECKOUT_ACTIONS.SET_ERRO:
        setErro(action.payload);
        break;
      case CHECKOUT_ACTIONS.SET_ENTREGA_DATA: {
        const p = action.payload || {};
        if ('tipoEntrega' in p) setTipoEntrega(p.tipoEntrega);
        if ('veiculoEntrega' in p) setVeiculoEntrega(p.veiculoEntrega);
        if ('simulacaoFrete' in p) setSimulacaoFrete(p.simulacaoFrete);
        if ('cepEntrega' in p) setCepEntrega(p.cepEntrega);
        if ('numeroEntrega' in p) setNumeroEntrega(p.numeroEntrega);
        if ('enderecoCepEntrega' in p) setEnderecoCepEntrega(p.enderecoCepEntrega);
        break;
      }
      default:
        break;
    }
  };

  const checkoutContextValue = {
    dispatch,
    etapaAtual,
    setEtapaAtual,
    resultadoPedido,
    formaPagamento,
    statusPedidoAtual,
    carregando,
    erro,
    autenticado,
    tipoEntrega,
    veiculoEntrega,
    cepEntrega,
    numeroEntrega,
    enderecoCepEntrega,
    simulacaoFrete,
    retiradaSelecionada,
    itensPedido,
    resumo,
    taxaServicoAtual,
    resumoTotalPagamento,
    tituloFormaPagamento,
    handleCriarPedido,
    handleIrParaPagamento,
  };

  return (
    <CheckoutContext.Provider value={checkoutContextValue}>
    <section className={`page checkout-page ${etapaAtual !== ETAPAS.STATUS ? 'has-mobile-action-bar' : ''}`.trim()}>
      <InternalTopBar
        className={`checkout-stage-header ${etapaAtual === ETAPAS.ENTREGA ? 'is-delivery-stage' : ''}`.trim()}
        title={tituloEtapaAtual}
        subtitle={subtituloEtapaAtualTexto}
        onBack={handleVoltarEtapaAtual}
        backIconOnly
        centerTitle
        rightActionLabel={exibirAcaoLimparNoTopo ? 'Limpar' : ''}
        onRightAction={exibirAcaoLimparNoTopo ? handleLimparCarrinhoCheckout : undefined}
        rightActionAriaLabel="Limpar produtos do carrinho"
        fallbackTo="/produtos"
        backLabel="Voltar para etapa anterior"
      />

      {erro ? (
        <article className="checkout-inline-feedback is-error" role="alert">
          <p className="checkout-inline-feedback-title">Não foi possível concluir esta ação.</p>
          <p className="checkout-inline-feedback-text">{erro}</p>
        </article>
      ) : null}

      {(carregando || verificandoStatusPix) ? (
        <article className="checkout-inline-feedback is-loading" role="status" aria-live="polite">
          <p className="checkout-inline-feedback-title">Atualizando seu pedido</p>
          <p className="checkout-inline-feedback-text">
            {verificandoStatusPix
              ? 'Consultando o status do pagamento PIX em tempo real.'
              : mensagemProcessamentoCheckout}
          </p>
        </article>
      ) : null}


      {etapaAtual === ETAPAS.CARRINHO ? (
        <CartStep
          taxaServicoAtual={taxaServicoAtual}
          avisosRestricaoEntregaPorItem={avisosRestricaoEntregaPorItem}
        />
      ) : null}

      {etapaAtual === ETAPAS.ENTREGA ? (
        <DeliveryStep
          modalUberInterno={modalUberInterno}
          mensagemFrete={mensagemFrete}
          bloqueioAgua20LAtivo={bloqueioAgua20LAtivo}
          bloqueioAgua20LMotivo={bloqueioAgua20LMotivo}
          avisoRestricaoVeiculo={avisoRestricaoVeiculo}
          semOpcaoEntregaDisponivel={semOpcaoEntregaDisponivel}
          bikeDisponivel={bikeDisponivel}
          opcoesEntregaCompactas={opcoesEntregaCompactas}
          economiaFreteRetirada={economiaFreteRetirada}
          enderecoEntregaResumo={enderecoEntregaResumo}
          enderecoEntregaComplemento={enderecoEntregaComplemento}
          enderecoContaSalvo={enderecoContaSalvo}
          temEnderecoContaSalvo={temEnderecoContaSalvo}
          enderecoContaSalvoResumo={enderecoContaSalvoResumo}
          enderecoSalvoJaSelecionado={enderecoSalvoJaSelecionado}
          uberQuoteDisponivel={uberQuoteDisponivel}
          setUberQuoteDisponivel={setUberQuoteDisponivel}
          itens={itens}
          resumoTotal={resumo.total}
        />
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
        <PaymentStep
          ref={paymentStepRef}
          formaPagamento={formaPagamento}
          onFormaPagamentoChange={(forma) => { setFormaPagamento(forma); limparTokenCartaoGerado(); }}
          documentoPagador={documentoPagador}
          onDocumentoPagadorChange={setDocumentoPagador}
          cpfNotaFiscal={cpfNotaFiscal}
          onCpfNotaFiscalChange={setCpfNotaFiscal}
          parcelasCartao={parcelasCartao}
          onParcelasCartaoChange={setParcelasCartao}
          tokenCartao={tokenCartao}
          onLimparTokenCartao={limparTokenCartaoGerado}
          buscandoChavePublica={buscandoChavePublica}
          autenticado={autenticado}
          erro={erro}
          onErroChange={setErro}
          carregando={carregando}
          retiradaSelecionada={retiradaSelecionada}
          simulacaoFrete={simulacaoFrete}
          resultadoPedido={resultadoPedido}
          economiaFreteRetirada={economiaFreteRetirada}
          atendimentoSelecionadoLabel={atendimentoSelecionadoLabel}
          distanciaSelecionadaTexto={distanciaSelecionadaTexto}
          tipoEntrega={tipoEntrega}
          resumoFretePagamento={resumoFretePagamento}
          resumoTaxaServicoPagamento={resumoTaxaServicoPagamento}
          resumoTotalPagamento={resumoTotalPagamento}
          resumoItensPagamento={resumoItensPagamento}
          totalProdutosPedido={totalProdutosPedido}
          parcelamentoCreditoDisponivel={parcelamentoCreditoDisponivel}
          valorMinimoParcelamentoTexto={valorMinimoParcelamentoTexto}
          debitoSelecionado={debitoSelecionado}
          status3DSTone={status3DSTone}
          status3DSLabel={status3DSLabel}
          idAutenticacao3DS={idAutenticacao3DS}
          sessao3DSExpirando={sessao3DSExpirando}
          sessao3DS={sessao3DS}
          resultado3DS={resultado3DS}
          bloqueioPagamento={bloqueioPagamento}
          mensagemBloqueioPagamento={mensagemBloqueioPagamento}
          growthCheckoutPaymentPriceClass={growthCheckoutPaymentPriceClass}
          onDadosCartaoCompletosChange={setDadosCartaoCompletos}
          onValidarCartao={handleCriptografarCartao}
          pagamentoCartaoSelecionado={pagamentoCartaoSelecionado}
          formaPagamentoAtual={formaPagamentoAtual}
        />
      ) : null}

      {/* ETAPA REVISÃO DO CLIENTE: confirmação antes de criar o pedido */}
      {etapaAtual === ETAPAS.REVISAO_CLIENTE ? (
        <ClientReviewStep
          itensPedido={itensPedido}
          retiradaSelecionada={retiradaSelecionada}
          enderecoResumo={enderecoEntregaResumo}
          veiculoEntrega={veiculoEntrega}
          tituloFormaPagamento={tituloFormaPagamento}
          subtotal={resumo.total}
          frete={retiradaSelecionada ? 0 : (simulacaoFrete?.frete ?? null)}
          taxaServico={taxaServicoAtual}
          total={resumoTotalPagamento}
          carregando={carregando}
          onConfirmar={() => { void handleIrParaPagamento(); }}
          onEditar={(etapa) => setEtapaAtual(etapa)}
        />
      ) : null}

      {etapaAtual === ETAPAS.REVISAO ? (
        <MerchantReviewStep
          resultadoPedido={resultadoPedido}
          statusRevisaoAtual={statusRevisaoAtual}
          textoUltimaAtualizacaoRevisao={textoUltimaAtualizacaoRevisao}
          podeCancelarRevisaoPedido={podeCancelarRevisaoPedido}
          cancelandoRevisao={cancelandoRevisao}
          onCancelarPedido={handleCancelarPedidoEmRevisao}
          onIrParaPagamento={() => setEtapaAtual(ETAPAS.PIX)}
          erro={erro}
          resumoPedidoSnapshot={resumoPedidoSnapshot}
          itensPedidoSnapshot={itensPedidoSnapshot}
          totalRevisaoSnapshot={totalRevisaoSnapshot}
        />
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
        <PixPaymentStep
          formaPagamento={formaPagamento}
          tituloFormaPagamento={tituloFormaPagamento}
          qrCodePixSrc={qrCodePixSrc}
          codigoPixAtual={codigoPixAtual}
          statusPixVisual={statusPixVisual}
          feedbackCopiaPix={feedbackCopiaPix}
          onCopiarCodigoPix={handleCopiarCodigoPix}
          textoBotaoGerarPix={textoBotaoGerarPix}
          bloqueioGeracaoPix={bloqueioGeracaoPix}
          pixDisponivelParaPagar={pixDisponivelParaPagar}
          podeContinuarConfirmacaoPix={podeContinuarConfirmacaoPix}
          onGerarPix={() => handleGerarPixMercadoPago(resultadoPedido.pedido_id)}
          debitoSelecionado={debitoSelecionado}
          status3DSTone={status3DSTone}
          status3DSLabel={status3DSLabel}
          sessao3DSExpirando={sessao3DSExpirando}
          sessao3DS={sessao3DS}
          resultadoCartao={resultadoCartao}
          cartaoRecusado={cartaoRecusado}
          parcelasCartaoEfetivas={parcelasCartaoEfetivas}
          onPagarCartao={() => handlePagarCartaoMercadoPago(resultadoPedido.pedido_id)}
          documentoValidoPagamento={documentoValidoPagamento}
          eventosHomologacao3DS={eventosHomologacao3DS}
          feedbackEvidencia3DS={feedbackEvidencia3DS}
          feedbackEvidencia3DSTone={feedbackEvidencia3DSTone}
          onCopiarEvidencia3DS={handleCopiarEvidenciaHomologacao3DS}
          onBaixarEvidencia3DS={handleBaixarEvidenciaHomologacao3DS}
          carregando={carregando}
          resultadoPedido={resultadoPedido}
          totalComEntregaPedido={totalComEntregaPedido}
          freteSelecionado={freteSelecionado}
          retiradaSelecionada={retiradaSelecionada}
          recaptchaCheckoutEnabled={recaptchaCheckoutEnabled}
          itensResumoPixExibicao={itensResumoPixExibicao}
          resumoPedidoSnapshot={resumoPedidoSnapshot}
          totalProdutosPedido={totalProdutosPedido}
          taxaServicoPedido={taxaServicoPedido}
          growthCheckoutPaymentPriceClass={growthCheckoutPaymentPriceClass}
        />
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <OrderStatusStep
          resultadoPedido={resultadoPedido}
          totalComEntregaPedido={totalComEntregaPedido}
          labelStatus={labelStatus}
          pagamentoConfirmado={pagamentoConfirmado}
          formaPagamento={formaPagamento}
        />
      ) : null}

    </section>
    </CheckoutContext.Provider>
  );
}
