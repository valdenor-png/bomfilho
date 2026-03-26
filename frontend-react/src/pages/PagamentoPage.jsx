import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { AlertTriangle, BadgeX, CircleCheck, ClipboardList, MapPin, ShoppingCart } from '../icons';
import {
  buscarEnderecoViaCep,
  criarPedido,
  criarSessao3DSGateway,
  gerarPix,
  getPedidoById,
  getEndereco,
  getProdutos,
  getMe,
  getPedidos,
  getPedidoStatus,
  cancelarPedidoRevisao,
  isAuthErrorMessage,
  mpGerarPix,
  mpGetPublicKey,
  mpPagarCartao,
  pagarCartao,
  getUberDeliveryQuote,
  simularFretePorCep
} from '../lib/api';
import {
  authenticate3DS,
  configure3DSSession,
  tokenizeCard
} from '../lib/paymentTokenization';
import {
  CHECKOUT_RECAPTCHA_ENABLED,
  IS_DEVELOPMENT,
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
  HOMOLOGACAO_3DS_MAX_EVENTOS,
  CEP_MERCADO,
  NUMERO_MERCADO,
  LIMITE_BIKE_KM,
  RETIRADA_LOJA_INFO,
  STATUS_3DS_LABELS,
  VEICULOS_ENTREGA,
  FORMAS_PAGAMENTO_OPCOES,
  PIX_QR_RENDER_OPTIONS,
  STATUS_PEDIDO_LABELS,
  STATUS_PAGAMENTO_LABELS,
  PIX_STATUS_META,
  gerarQrCodeDataUrl,
  formatarMoeda,
  formatarQuantidadeItens,
  formatarTipoEntrega,
  erroEntregaEhCobertura,
  normalizarCep,
  formatarCep,
  normalizarDocumentoFiscal,
  possuiDigitosRepetidos,
  validarCpf,
  validarCnpj,
  validarDocumentoFiscal3DS,
  formatarDocumentoFiscal,
  normalizarNumeroCartao,
  formatarNumeroCartao,
  formatarMesCartao,
  formatarAnoCartao,
  normalizarAnoCartaoParaComparacao,
  normalizarAnoCartaoParaTokenizacao,
  formatarCvvCartao,
  normalizarNomeCompletoPara3DS,
  normalizarTelefonePara3DS,
  normalizarNumeroEnderecoPara3DS,
  construirEndereco3DS,
  mascararValorHomologacao,
  mascararDocumentoHomologacao,
  mascararTraceHomologacao,
  sanitizarErrorMessages3DS,
  sanitizarRequestPagamentoCartaoHomologacao,
  extrairStatusThreeDSChargeHomologacao,
  montarResumoRespostaGatewayHomologacao,
  resolverModalEntregaUber,
  estimarPesoCarrinhoKg,
  resolverStatusPix,
  obterStatusPixVisual,
  formatarStatusPedido,
  formatarStatusPagamento
} from '../lib/checkoutUtils';
import {
  calcularSubtotalPeso,
  isItemPeso,
  isProdutoAlcoolico,
  isProdutoTabaco,
  isProdutoVisivelNoCatalogo
} from '../lib/produtoCatalogoRules';

// Sub-componentes do checkout.
import {
  CheckoutSecurityTrust,
  DeliveryOptionCard,
  PickupStoreCard,
  DeliveryAddressLookupCard,
  CartItemRow,
  CheckoutSummaryCard,
  CheckoutCrossSellRail,
  PaymentMethodCard,
  PaymentSelectionSummary,
  PaymentOrderSummary,
  TaxIdInput,
  PixStatusCard,
  PixQrCodeCard,
  PixCopyCodeCard,
  PixInstructionsCard
} from '../components/checkout';
import InternalTopBar from '../components/navigation/InternalTopBar';

const CHECKOUT_ENDERECO_CACHE_KEY = 'bf_checkout_endereco_preferido';
const CHECKOUT_CPF_NOTA_CACHE_KEY = 'bf_checkout_cpf_nota';
const STATUS_REVISAO_ATIVOS = new Set(['aguardando_revisao', 'pendente', 'pagamento_recusado']);
const LIMITE_SUGESTOES_CHECKOUT = 8;
const MINIMO_PRIORIDADE_IMPULSO = 6;
const TERMOS_PRIORIDADE_IMPULSO = [
  'biscoito',
  'biscoitos',
  'bolacha',
  'bolachas',
  'chocolate',
  'chocolates',
  'bombom',
  'bombons',
  'bala',
  'balas',
  'salgadinho',
  'salgadinhos',
  'refrigerante',
  'refri',
  'suco',
  'sucos',
  'sobremesa',
  'conveniencia'
];
const TERMOS_FALLBACK_GERAL = [
  'conveniencia',
  'snack',
  'sobremesa',
  'suco',
  'refrigerante'
];
const TOKENS_MEDICAMENTOS_BLOQUEADOS = [
  'medicamento',
  'medicamentos',
  'remedio',
  'remedios',
  'farmacia',
  'tarja',
  'analgesico',
  'antibiotico'
];
const TOKENS_ALCOOL_BLOQUEADOS = [
  'bebida alcoolica',
  'bebidas alcoolicas',
  'cerveja',
  'vinho',
  'whisky',
  'vodka',
  'gin',
  'rum',
  'tequila',
  'licor',
  'aperitivo',
  'cachaca'
];
const TOKENS_TABACO_BLOQUEADOS = [
  'tabaco',
  'cigarro',
  'cigarros',
  'fumo',
  'narguile',
  'vape'
];
const RELACOES_CATEGORIA_SUGESTAO = [
  {
    match: ['mercearia', 'biscoito', 'bolacha', 'doce', 'conveniencia', 'snack'],
    termos: ['biscoito', 'chocolate', 'salgadinho', 'bombom', 'sobremesa']
  },
  {
    match: ['bebida', 'refrigerante', 'refri', 'suco', 'agua'],
    termos: ['refrigerante', 'refri', 'suco', 'biscoito', 'salgadinho']
  },
  {
    match: ['laticinio', 'frios', 'padaria', 'cafe', 'pao'],
    termos: ['chocolate', 'biscoito', 'sobremesa', 'suco']
  }
];

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
  const { itens, resumo, addItem, updateItemQuantity, removeItem, clearCart } = useCart();
  const { tracker: reviewTrackerGlobal, trackOrder, clearTracking } = useReviewTracker();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [cancelandoRevisao, setCancelandoRevisao] = useState(false);
  const [erro, setErro] = useState('');
  const [feedbackCarrinho, setFeedbackCarrinho] = useState('');
  const [retomandoPedidoExistente, setRetomandoPedidoExistente] = useState(false);
  const [ultimaAtualizacaoRevisao, setUltimaAtualizacaoRevisao] = useState('');
  const [dadosUsuarioCheckout, setDadosUsuarioCheckout] = useState(null);
  const [resultadoPix, setResultadoPix] = useState(null);
  const [qrCodePixDataUrl, setQrCodePixDataUrl] = useState('');
  const [feedbackCopiaPix, setFeedbackCopiaPix] = useState('');
  const [sugestoesCheckout, setSugestoesCheckout] = useState([]);
  const [modoSugestoesCheckout, setModoSugestoesCheckout] = useState('impulso');
  const [carregandoSugestoesCheckout, setCarregandoSugestoesCheckout] = useState(false);
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
  const [buscandoEnderecoCepEntrega, setBuscandoEnderecoCepEntrega] = useState(false);
  const [erroEnderecoCepEntrega, setErroEnderecoCepEntrega] = useState('');
  const [cepEnderecoConsultado, setCepEnderecoConsultado] = useState('');
  const [documentoPagador, setDocumentoPagador] = useState('');
  const [documentoTocado, setDocumentoTocado] = useState(false);
  const [cpfNotaFiscal, setCpfNotaFiscal] = useState('');
  const [cpfNotaFiscalAtivo, setCpfNotaFiscalAtivo] = useState(false);
  const [cpfNotaFiscalTocado, setCpfNotaFiscalTocado] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [gatewayPublicKey, setGatewayPublicKey] = useState('');
  const [buscandoChavePublica, setBuscandoChavePublica] = useState(false);
  const [tokenCartao, setTokenCartao] = useState('');
  const [cartaoPaymentMethodId, setCartaoPaymentMethodId] = useState('');
  const [cartaoIssuerId, setCartaoIssuerId] = useState(null);
  const [criptografandoCartao, setCriptografandoCartao] = useState(false);
  const [nomeTitularCartao, setNomeTitularCartao] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [mesExpiracaoCartao, setMesExpiracaoCartao] = useState('');
  const [anoExpiracaoCartao, setAnoExpiracaoCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [parcelasCartao, setParcelasCartao] = useState('1');
  const [resultadoCartao, setResultadoCartao] = useState(null);
  const [sessao3DS, setSessao3DS] = useState('');
  const [sessao3DSEnv, setSessao3DSEnv] = useState('SANDBOX');
  const [sessao3DSGeradaEm, setSessao3DSGeradaEm] = useState(0);
  const [sessao3DSExpirando, setSessao3DSExpirando] = useState(false);
  const [status3DS, setStatus3DS] = useState('idle');
  const [resultado3DS, setResultado3DS] = useState(null);
  const [idAutenticacao3DS, setIdAutenticacao3DS] = useState('');
  const [eventosHomologacao3DS, setEventosHomologacao3DS] = useState([]);
  const [feedbackEvidencia3DS, setFeedbackEvidencia3DS] = useState('');
  const [growthVersion, setGrowthVersion] = useState(0);
  const [recaptchaCheckoutToken, setRecaptchaCheckoutToken] = useState('');
  const [recaptchaCheckoutErroCarregamento, setRecaptchaCheckoutErroCarregamento] = useState('');
  const recaptchaCheckoutRef = useRef(null);
  const cartaoPaymentMethodIdRef = useRef('');
  const cartaoIssuerIdRef = useRef(null);
  const pagandoCartaoRef = useRef(false);
  const buscaEnderecoRef = useRef(0);
  const startCheckoutTrackedRef = useRef(false);
  const purchaseTrackedOrdersRef = useRef(new Set());
  const cacheSugestoesRef = useRef(new Map());
  const ultimaSugestaoCheckoutValidaRef = useRef([]);
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

  const termosSugestaoImpulso = useMemo(
    () => TERMOS_PRIORIDADE_IMPULSO.map((termo) => normalizarTextoSugestao(termo)).filter(Boolean),
    [normalizarTextoSugestao]
  );

  const termosSugestaoCategoriaRelacionada = useMemo(() => {
    const termos = [];
    const vistos = new Set(termosSugestaoImpulso);

    const adicionarTermo = (valor) => {
      const termo = normalizarTextoSugestao(valor);
      if (!termo || vistos.has(termo) || termo.length < 3) {
        return;
      }
      vistos.add(termo);
      termos.push(termo);
    };

    itens.forEach((item) => {
      const textoFonte = [
        item?.categoria,
        item?.categoria_nome,
        item?.departamento,
        item?.secao,
        item?.nome_base,
        item?.nome
      ]
        .map((parte) => normalizarTextoSugestao(parte))
        .filter(Boolean)
        .join(' ');

      if (!textoFonte) {
        return;
      }

      textoFonte.split(/\s+/)
        .filter((token) => token.length >= 4)
        .slice(0, 6)
        .forEach(adicionarTermo);

      RELACOES_CATEGORIA_SUGESTAO.forEach((regra) => {
        if (!regra.match.some((token) => textoFonte.includes(token))) {
          return;
        }
        regra.termos.forEach(adicionarTermo);
      });
    });

    return termos.slice(0, 18);
  }, [itens, normalizarTextoSugestao, termosSugestaoImpulso]);

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

    if (mensagem) {
      setFeedbackCarrinho(mensagem);
    }

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

  const handleAtualizarQuantidadeCarrinho = useCallback((id, quantidade) => {
    const itemAtual = itens.find((item) => item.id === Number(id));
    const quantidadeAnterior = Math.max(1, Number(itemAtual?.quantidade || 1));
    const proximaQuantidade = Math.max(1, Number(quantidade || 1));

    updateItemQuantity(id, proximaQuantidade);

    if (!itemAtual || proximaQuantidade === quantidadeAnterior) {
      return;
    }

    const variacao = proximaQuantidade > quantidadeAnterior ? 'aumentada' : 'reduzida';
    setFeedbackCarrinho(`${itemAtual.nome}: quantidade ${variacao} para ${proximaQuantidade}.`);
  }, [itens, updateItemQuantity]);

  const handleRemoverItemCarrinho = useCallback((id) => {
    const itemAtual = itens.find((item) => item.id === Number(id));
    removeItem(id);

    if (itemAtual) {
      setFeedbackCarrinho(`${itemAtual.nome} foi removido do carrinho.`);
    }
  }, [itens, removeItem]);

  const retiradaSelecionada = tipoEntrega === 'retirada';
  const formaRecebimentoSelecionada = retiradaSelecionada
    ? 'retirada'
    : (veiculoEntrega === 'bike' ? 'bike' : 'uber');
  const selecionarFormaRecebimento = useCallback((forma) => {
    const modo = String(forma || '').trim().toLowerCase();

    if (modo === 'retirada') {
      setTipoEntrega('retirada');
      setErroEntrega('');
      return;
    }

    if (modo === 'uber' && !uberQuoteDisponivel) {
      setErroEntrega('Entrega Uber indisponível no momento. Escolha Bike ou Retirada na loja.');
      return;
    }

    setTipoEntrega('entrega');
    setVeiculoEntrega(modo === 'bike' ? 'bike' : 'uber');
    setErroEntrega('');
  }, [uberQuoteDisponivel]);
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
  const veiculoSelecionadoResumo = retiradaSelecionada
    ? null
    : (VEICULOS_ENTREGA[resultadoPedido?.veiculo_entrega] || VEICULOS_ENTREGA[simulacaoFrete?.veiculo] || VEICULOS_ENTREGA.moto);
  const atendimentoSelecionadoLabel = retiradaSelecionada
    ? formatarTipoEntrega('retirada')
    : 'Uber Direct';
  const cepDestinoSelecionado = String(resultadoPedido?.cep_destino_entrega || simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-');
  const cepOrigemSelecionado = String(resultadoPedido?.cep_origem_entrega || simulacaoFrete?.cep_origem || CEP_MERCADO);
  const numeroOrigemSelecionado = String(resultadoPedido?.numero_origem_entrega || simulacaoFrete?.numero_origem || NUMERO_MERCADO);
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
  const exibirRecaptchaCheckout = recaptchaCheckoutEnabled
    && autenticado === true
    && (etapaAtual === ETAPAS.PAGAMENTO || etapaAtual === ETAPAS.PIX);
  const tituloFormaPagamento = formaPagamento === 'pix'
    ? 'PIX'
    : formaPagamento === 'debito'
      ? 'Cartão de Débito'
      : 'Cartão de Crédito';
  const sessao3DSValida = Boolean(sessao3DS)
    && Number(sessao3DSGeradaEm) > 0
    && (Date.now() - Number(sessao3DSGeradaEm)) < SESSAO_3DS_TTL_MS;
  const status3DSLabel = STATUS_3DS_LABELS[status3DS] || STATUS_3DS_LABELS.idle;
  const status3DSTone = ['concluida', 'pagamento_aprovado'].includes(status3DS)
    ? 'is-success'
    : ['nao_suportado', 'trocar_metodo', 'erro'].includes(status3DS)
      ? 'is-warning'
      : ['iniciando', 'aguardando_validacao', 'desafio', 'processando_pagamento'].includes(status3DS)
        ? 'is-loading'
        : '';
  const cepEntregaNormalizado = normalizarCep(cepEntrega);
  const cepEntregaValido = cepEntregaNormalizado.length === 8;
  const cepEntregaIncompleto = cepEntregaNormalizado.length > 0 && cepEntregaNormalizado.length < 8;
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
  const simulacaoUber = simulacoesFretePorVeiculo.uber || null;
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

  const aplicarEnderecoSalvoNoCheckout = useCallback(() => {
    if (!temEnderecoContaSalvo) {
      return;
    }

    const cepNormalizado = normalizarCep(enderecoContaSalvo?.cep || '');
    const numeroNormalizado = String(enderecoContaSalvo?.numero || '').replace(/\D/g, '').slice(0, 10);
    if (cepNormalizado.length !== 8) {
      return;
    }

    const enderecoMapeado = {
      cep: formatarCep(cepNormalizado),
      logradouro: String(enderecoContaSalvo?.logradouro || '').trim(),
      bairro: String(enderecoContaSalvo?.bairro || '').trim(),
      cidade: String(enderecoContaSalvo?.cidade || '').trim(),
      estado: String(enderecoContaSalvo?.estado || '').trim().toUpperCase(),
      complemento: String(enderecoContaSalvo?.complemento || '').trim()
    };

    setCepEntrega(formatarCep(cepNormalizado));
    if (numeroNormalizado) {
      setNumeroEntrega(numeroNormalizado);
    }
    setEnderecoCepEntrega(enderecoMapeado);
    setCepEnderecoConsultado(cepNormalizado);
    setErroEnderecoCepEntrega('');
    setErroEntrega('');

    if (numeroNormalizado) {
      salvarEnderecoCheckoutNoCache({
        cep: formatarCep(cepNormalizado),
        numero: numeroNormalizado,
        logradouro: enderecoMapeado.logradouro,
        bairro: enderecoMapeado.bairro,
        cidade: enderecoMapeado.cidade,
        estado: enderecoMapeado.estado
      });
    }
  }, [enderecoContaSalvo, temEnderecoContaSalvo]);

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
      setBuscandoEnderecoCepEntrega(false);
      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');
      if (mostrarErro && cepNormalizado.length > 0) {
        setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
      } else {
        setErroEnderecoCepEntrega('');
      }
      return null;
    }

    if (cepEnderecoConsultado === cepNormalizado && enderecoCepEntrega) {
      return enderecoCepEntrega;
    }

    // Evita que uma resposta antiga sobrescreva o endereço de um CEP mais novo.
    const requestId = ++buscaEnderecoRef.current;
    setBuscandoEnderecoCepEntrega(true);
    setErroEnderecoCepEntrega('');

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
          setErroEnderecoCepEntrega('Não encontramos endereço para este CEP.');
        } else if (mensagem === 'CEP inválido') {
          setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
        } else {
          setErroEnderecoCepEntrega(mensagem || 'Não foi possível consultar o endereço deste CEP.');
        }
      }

      return null;
    } finally {
      if (requestId === buscaEnderecoRef.current) {
        setBuscandoEnderecoCepEntrega(false);
      }
    }
  }, [cepEnderecoConsultado, enderecoCepEntrega]);

  useEffect(() => {
    const cepNormalizado = cepEntregaNormalizado;

    if (!cepNormalizado) {
      setEnderecoCepEntrega(null);
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
      setCepEnderecoConsultado('');
      return;
    }

    if (cepNormalizado.length !== 8) {
      setEnderecoCepEntrega(null);
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
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
      setCpfNotaFiscalAtivo(true);
      setCpfNotaFiscalTocado(false);
    }
  }, []);

  useEffect(() => {
    if (!cpfNotaFiscalAtivo) {
      salvarCpfNotaNoCache('');
      return;
    }

    salvarCpfNotaNoCache(cpfNotaFiscal);
  }, [cpfNotaFiscal, cpfNotaFiscalAtivo]);

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

          const nomeUsuario = String(usuario?.nome || '').trim();
          if (nomeUsuario) {
            setNomeTitularCartao((atual) => {
              const atualNormalizado = String(atual || '').trim();
              return atualNormalizado || nomeUsuario;
            });
          }

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
    if (!resultadoPedido?.pedido_id || autenticado !== true) {
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
        const data = await getPedidos({}, {
          signal: statusAbortController?.signal
        });
        const pedido = (data.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
        if (ativo && pedido?.status) {
          const novoStatus = String(pedido.status || '').toLowerCase();
          setStatusPedidoAtual(novoStatus);
          setUltimaAtualizacaoRevisao(new Date().toISOString());
          trackOrder(resultadoPedido.pedido_id, pedido);

          if (!statusEhElegivelParaFluxoRevisao(novoStatus) && novoStatus !== 'pago') {
            sairDoFluxoRevisaoEncerrado('Seu pedido em revisão foi encerrado. Você pode montar um novo carrinho.');
            return;
          }

          // Evita travar na etapa de revisão quando o status já foi aprovado no admin.
          if (etapaAtual === ETAPAS.REVISAO && (novoStatus === 'pendente' || novoStatus === 'pago' || novoStatus === 'pagamento_recusado')) {
            setEtapaAtual(ETAPAS.PIX);
          }

          if (etapaAtual === ETAPAS.REVISAO && (novoStatus === 'cancelado' || novoStatus === 'expirado')) {
            sairDoFluxoRevisaoEncerrado('Seu pedido em revisão foi encerrado. Monte um novo pedido para continuar.');
            return;
          }

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

    atualizarStatus();
    const interval = setInterval(atualizarStatus, 15000);

    return () => {
      ativo = false;
      clearInterval(interval);
      if (statusAbortController) {
        statusAbortController.abort();
      }
      emAndamento = false;
    };
  }, [resultadoPedido?.pedido_id, autenticado, etapaAtual, sairDoFluxoRevisaoEncerrado, trackOrder]);

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
  }

  function limparTokenCartaoGerado() {
    setTokenCartao('');
    cartaoPaymentMethodIdRef.current = '';
    cartaoIssuerIdRef.current = null;
    setCartaoPaymentMethodId('');
    setCartaoIssuerId(null);
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
  }

  function resetRecaptchaCheckout() {
    setRecaptchaCheckoutToken('');
    setRecaptchaCheckoutErroCarregamento('');

    if (recaptchaCheckoutRef.current && typeof recaptchaCheckoutRef.current.reset === 'function') {
      recaptchaCheckoutRef.current.reset();
    }
  }

  const registrarEventoHomologacao3DS = useCallback((evento, detalhes = {}) => {
    const registro = {
      timestamp: new Date().toISOString(),
      evento: String(evento || '').trim() || 'evento_desconhecido',
      detalhes: (detalhes && typeof detalhes === 'object' && !Array.isArray(detalhes))
        ? detalhes
        : {}
    };

    setEventosHomologacao3DS((atual) => {
      const proximo = [...atual, registro];
      if (proximo.length <= HOMOLOGACAO_3DS_MAX_EVENTOS) {
        return proximo;
      }

      return proximo.slice(proximo.length - HOMOLOGACAO_3DS_MAX_EVENTOS);
    });

    if (IS_DEVELOPMENT) {
      console.info('[debit_3ds_auth.homologacao]', registro);
    }
  }, []);

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

  function obterRecaptchaCheckoutTokenObrigatorio() {
    if (!recaptchaCheckoutEnabled) {
      return '';
    }

    const token = String(recaptchaCheckoutToken || '').trim();
    if (token) {
      return token;
    }

    throw new Error(
      recaptchaCheckoutErroCarregamento
      || 'Confirme o reCAPTCHA de segurança antes de continuar.'
    );
  }

  function erroIndicaSessao3DSExpirada(error) {
    const detail = error?.detail || {};
    const statusCode = Number(detail?.httpStatus || error?.status || 0);
    const mensagem = String(detail?.message || error?.message || '').toLowerCase();

    if (statusCode === 401 || statusCode === 403) {
      return true;
    }

    return mensagem.includes('session')
      && (mensagem.includes('expir') || mensagem.includes('invalid') || mensagem.includes('unauthorized'));
  }

  async function obterSessao3DSComRenovacao({ forceRefresh = false, pedidoId } = {}) {
    if (!forceRefresh && sessao3DSValida) {
      registrarEventoHomologacao3DS('sessao_3ds_cache', {
        endpoint: '/api/checkout/3ds/session',
        reference_id: pedidoId ? `pedido_${pedidoId}` : null,
        env: sessao3DSEnv,
        session_masked: mascararValorHomologacao(sessao3DS, { prefixo: 8, sufixo: 4 }),
        reused: true
      });

      return {
        session: sessao3DS,
        env: sessao3DSEnv
      };
    }

    const referencia = pedidoId ? `pedido_${pedidoId}` : '';
    const data = await criarSessao3DSGateway({ referenceId: referencia });
    const session = String(data?.session || '').trim();
    const env = String(data?.env || 'SANDBOX').trim().toUpperCase() || 'SANDBOX';

    if (!session) {
      throw new Error('Nao foi possivel iniciar a sessao de autenticacao 3DS.');
    }

    setSessao3DS(session);
    setSessao3DSEnv(env);
    setSessao3DSGeradaEm(Date.now());

    registrarEventoHomologacao3DS('geracao_sessao_3ds', {
      endpoint: '/api/checkout/3ds/session',
      reference_id: referencia || null,
      force_refresh: Boolean(forceRefresh),
      env,
      session_masked: mascararValorHomologacao(session, { prefixo: 8, sufixo: 4 }),
      expires_in_seconds: Number.parseInt(String(data?.expires_in_seconds || ''), 10) || null,
      trace_id_masked: mascararTraceHomologacao(data?.trace_id || data?.traceId) || null
    });

    return {
      session,
      env
    };
  }

  function montarRequestAutenticacao3DS({ documentoDigits } = {}) {
    const numeroCartaoLimpo = normalizarNumeroCartao(numeroCartao);
    const mes = formatarMesCartao(mesExpiracaoCartao).padStart(2, '0');
    const ano = formatarAnoCartao(anoExpiracaoCartao);
    const documentoFiscal3DS = normalizarDocumentoFiscal(documentoDigits);
    const nomeHolder = normalizarNomeCompletoPara3DS(
      nomeTitularCartao || dadosUsuarioCheckout?.nome,
      'Cliente Teste'
    );
    const nomeCliente = normalizarNomeCompletoPara3DS(
      dadosUsuarioCheckout?.nome || nomeHolder,
      'Cliente Teste'
    );
    const emailCliente = String(dadosUsuarioCheckout?.email || 'cliente@example.com').trim() || 'cliente@example.com';
    const telefoneCliente = normalizarTelefonePara3DS(dadosUsuarioCheckout?.telefone) || {
      country: '55',
      area: '11',
      number: '999999999',
      type: 'MOBILE'
    };
    const valorCentavos = Math.max(1, Math.round(Number(resultadoPedido?.total || totalComEntregaPedido || 0) * 100));
    const endereco3DS = construirEndereco3DS({
      endereco: enderecoCepEntrega,
      cepFallback: cepEntrega
    });
    const customerPayload = {
      name: nomeCliente,
      email: emailCliente,
      phones: [telefoneCliente]
    };

    if (validarDocumentoFiscal3DS(documentoFiscal3DS)) {
      customerPayload.taxId = documentoFiscal3DS;
    }

    return {
      data: {
        customer: customerPayload,
        paymentMethod: {
          type: 'DEBIT_CARD',
          installments: 1,
          card: {
            number: numeroCartaoLimpo,
            expMonth: mes,
            expYear: ano,
            holder: {
              name: nomeHolder
            }
          }
        },
        amount: {
          value: valorCentavos,
          currency: 'BRL'
        },
        billingAddress: endereco3DS,
        shippingAddress: endereco3DS,
        dataOnly: false
      },
      beforeChallenge: ({ open, brand, issuer } = {}) => {
        setStatus3DS('desafio');

        if (IS_DEVELOPMENT) {
          console.info('[debit_3ds_auth.before_challenge]', {
            brand,
            issuer
          });
        }

        if (typeof open === 'function') {
          open();
        }
      }
    };
  }

  async function executarAutenticacao3DSDebito({ pedidoId, documentoDigits } = {}) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const forceRefresh = tentativa > 0;

      try {
        setStatus3DS('iniciando');
        const sessaoAtual = await obterSessao3DSComRenovacao({
          forceRefresh,
          pedidoId
        });

        await configure3DSSession({
          session: sessaoAtual.session,
          env: sessaoAtual.env
        });

        setStatus3DS('aguardando_validacao');
        const request3DS = montarRequestAutenticacao3DS({ documentoDigits });
        registrarEventoHomologacao3DS('request_authenticate3ds', {
          endpoint: 'https://sandbox.sdk.pagseguro.com/checkout-sdk/3ds/authentications',
          amount: {
            value: Number(request3DS?.data?.amount?.value) || null,
            currency: String(request3DS?.data?.amount?.currency || '').trim() || null
          },
          customer: {
            email_masked: mascararValorHomologacao(request3DS?.data?.customer?.email, { prefixo: 3, sufixo: 8 }) || null,
            tax_id_masked: mascararDocumentoHomologacao(request3DS?.data?.customer?.taxId) || null,
            phone_present: Array.isArray(request3DS?.data?.customer?.phones) && request3DS.data.customer.phones.length > 0
          },
          card: {
            number_masked: mascararValorHomologacao(request3DS?.data?.paymentMethod?.card?.number, { prefixo: 6, sufixo: 4 }) || null,
            exp_month: String(request3DS?.data?.paymentMethod?.card?.expMonth || '').trim() || null,
            exp_year: String(request3DS?.data?.paymentMethod?.card?.expYear || '').trim() || null,
            holder_present: Boolean(String(request3DS?.data?.paymentMethod?.card?.holder?.name || '').trim())
          },
          shipping_address_present: Boolean(request3DS?.data?.shippingAddress),
          billing_address_present: Boolean(request3DS?.data?.billingAddress)
        });
        const resultado = await authenticate3DS(request3DS);
        const status = String(resultado?.status || '').trim().toUpperCase();
        const authId = String(resultado?.id || '').trim();
        const traceId = String(
          resultado?.traceId
            || resultado?.trace_id
            || resultado?.detail?.traceId
            || resultado?.detail?.trace_id
            || ''
        ).trim() || null;

        if (IS_DEVELOPMENT) {
          console.info('[debit_3ds_auth.result]', {
            status,
            authId: authId || null,
            traceId
          });
        }

        setResultado3DS({
          status,
          id: authId || null,
          trace_id: traceId
        });

        registrarEventoHomologacao3DS('resultado_authenticate3ds', {
          status,
          authentication_id_masked: authId
            ? mascararValorHomologacao(authId, { prefixo: 6, sufixo: 4 })
            : null,
          trace_id_masked: traceId ? mascararTraceHomologacao(traceId) : null
        });

        if (status === 'AUTH_FLOW_COMPLETED') {
          if (!authId) {
            setStatus3DS('erro');
            throw new Error('A autenticacao 3DS foi concluida sem id valido. Tente novamente.');
          }

          setIdAutenticacao3DS(authId);
          setStatus3DS('concluida');

          return {
            status,
            authenticationMethod: {
              type: 'THREEDS',
              id: authId
            },
            traceId
          };
        }

        if (status === 'AUTH_NOT_SUPPORTED') {
          setStatus3DS('nao_suportado');
          throw new Error('Seu cartão de débito não é elegível para autenticação 3DS. Escolha outro meio de pagamento.');
        }

        if (status === 'CHANGE_PAYMENT_METHOD') {
          setStatus3DS('trocar_metodo');
          throw new Error('A autenticacao 3DS foi negada. Escolha outro meio de pagamento.');
        }

        if (status === 'REQUIRE_CHALLENGE') {
          setStatus3DS('desafio');
          throw new Error('Conclua o desafio 3DS para continuar o pagamento no debito.');
        }

        setStatus3DS('erro');
        throw new Error('Nao foi possivel concluir a autenticacao 3DS. Tente novamente.');
      } catch (error) {
        const detail = (error?.detail && typeof error.detail === 'object' && !Array.isArray(error.detail))
          ? error.detail
          : {};
        const erroDetalhado = String(detail?.message || detail?.error_description || detail?.error || '').trim();
        const erroCodigo = String(detail?.code || detail?.error_code || '').trim();
        const erroHttpStatus = Number(detail?.httpStatus || detail?.status || error?.status || 0) || null;
        const erroMensagens = sanitizarErrorMessages3DS(detail?.errorMessages);

        registrarEventoHomologacao3DS('erro_authenticate3ds', {
          message: String(error?.message || 'Falha ao autenticar 3DS').trim(),
          sdk_http_status: erroHttpStatus,
          sdk_code: erroCodigo || null,
          sdk_message: erroDetalhado || null,
          sdk_error_messages: erroMensagens.length ? erroMensagens : null,
          trace_id_masked: mascararTraceHomologacao(
            error?.traceId
              || error?.trace_id
              || error?.detail?.traceId
              || error?.detail?.trace_id
          ) || null
        });

        if (IS_DEVELOPMENT) {
          console.error('[debit_3ds_auth.error]', {
            message: error?.message,
            httpStatus: erroHttpStatus,
            code: erroCodigo || null,
            detailMessage: erroDetalhado || null,
            errorMessages: erroMensagens,
            detail: error?.detail || null
          });
        }

        if (tentativa === 0 && erroIndicaSessao3DSExpirada(error)) {
          setSessao3DS('');
          setSessao3DSGeradaEm(0);
          continue;
        }

        throw error;
      }
    }

    setStatus3DS('erro');
    throw new Error('Sessao 3DS expirada. Gere uma nova autenticacao e tente novamente.');
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

    const holder = String(nomeTitularCartao || '').trim();
    const number = normalizarNumeroCartao(numeroCartao);
    const expMonth = formatarMesCartao(mesExpiracaoCartao);
    const expYear = normalizarAnoCartaoParaTokenizacao(anoExpiracaoCartao);
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

    if (expYear.length !== 2) {
      throw new Error('Ano de expiração inválido.');
    }

    if (![3, 4].includes(securityCode.length)) {
      throw new Error('CVV inválido.');
    }

    setCriptografandoCartao(true);
    try {
      const publicKey = await carregarChavePublicaGateway();
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
      if (!token) {
        throw new Error('Não foi possível tokenizar o cartão no Mercado Pago.');
      }

      const paymentMethodId = String(tokenizacao?.paymentMethodId || '').trim();
      const issuerId = Number.isFinite(Number(tokenizacao?.issuerId)) ? Number(tokenizacao.issuerId) : null;

      setTokenCartao(token);
      cartaoPaymentMethodIdRef.current = paymentMethodId;
      cartaoIssuerIdRef.current = issuerId;
      setCartaoPaymentMethodId(paymentMethodId);
      setCartaoIssuerId(issuerId);
      return token;
    } finally {
      setCriptografandoCartao(false);
    }
  }

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
    setSessao3DS('');
    setSessao3DSEnv('SANDBOX');
    setSessao3DSGeradaEm(0);
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

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar.');
      return;
    }

    setCarregando(true);
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
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
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

  async function handleContinuarPagamento() {
    setDocumentoTocado(true);

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    if (!(documentoDigits.length === 11 || documentoDigits.length === 14)) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      return;
    }

    setErro('');
    await handleIrParaPagamento();
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
    if (recaptchaCheckoutEnabled && !String(recaptchaCheckoutToken || '').trim()) return;
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
    documentoPagador,
    recaptchaCheckoutEnabled,
    recaptchaCheckoutToken
  ]);

  // Gerar PIX via Mercado Pago.
  async function handleGerarPixMercadoPago(pedidoId) {
    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setDocumentoTocado(true);
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o PIX.');
      return;
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para gerar o PIX.');
      return;
    }

    setResultadoPix(null);
    setFeedbackCopiaPix('');
    setErro('');

    setCarregando(true);
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
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  // Pagar com cart?o via Mercado Pago.
  async function handlePagarCartaoMercadoPago(pedidoId) {
    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagar com cartão.');
      return;
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar no cartão.');
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
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  async function handleGerarPix(pedidoId) {
    setResultadoPix(null);
    setFeedbackCopiaPix('');
    setErro('');

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para gerar o PIX.');
      return;
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o PIX.');
      return;
    }

    setCarregando(true);
    try {
      const data = await gerarPix(pedidoId, documentoDigits, recaptchaTokenAcao);
      setResultadoPix({
        ...data,
        status: String(data?.status || 'WAITING').toUpperCase(),
        qr_data: String(data?.qr_data || data?.pix_codigo || '').trim(),
        pix_codigo: String(data?.pix_codigo || data?.qr_data || '').trim(),
        pix_qrcode: String(data?.pix_qrcode || '').trim()
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  async function handleVerificarPagamentoPix() {
    if (!resultadoPedido?.pedido_id) {
      return;
    }

    setErro('');
    setVerificandoStatusPix(true);

    try {
      const data = await getPedidos();
      const pedidoAtual = (data?.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
      if (!pedidoAtual) {
        throw new Error('Não foi possível localizar o pedido para verificar o pagamento.');
      }

      const statusInterno = String(pedidoAtual.status || '').toLowerCase();
      setStatusPedidoAtual(statusInterno);
      setUltimaAtualizacaoRevisao(new Date().toISOString());
      trackOrder(resultadoPedido.pedido_id, pedidoAtual);

      const aprovado = statusInterno === 'pago' || statusInterno === 'entregue';
      setPagamentoConfirmado(aprovado);

      setResultadoPix((atual) => {
        if (!atual) {
          return atual;
        }

        return {
          ...atual,
          status: aprovado
            ? 'PAID'
            : statusInterno === 'cancelado'
              ? 'CANCELED'
              : statusInterno === 'pagamento_recusado'
                ? 'DECLINED'
              : String(atual.status || 'WAITING').toUpperCase(),
          status_interno: statusInterno
        };
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message || 'Não foi possível atualizar o status do pagamento PIX.');
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

  async function handlePagarCartao(pedidoId) {
    if (pagandoCartaoRef.current || carregando || criptografandoCartao) {
      return;
    }

    setResultadoCartao(null);
    setErro('');

    if (debitoSelecionado) {
      setEventosHomologacao3DS([]);
      setFeedbackEvidencia3DS('');
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento com cartão.');
      return;
    }

    if (debitoSelecionado && !validarDocumentoFiscal3DS(documentoDigits)) {
      setErro('Para débito com autenticação 3DS, informe um CPF ou CNPJ válido.');
      return;
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar no cartão.');
      return;
    }

    pagandoCartaoRef.current = true;

    let tokenNormalizado = String(tokenCartao || '').trim();
    if (!tokenNormalizado) {
      try {
        tokenNormalizado = await handleCriptografarCartao();
      } catch (error) {
        setErro(error.message || 'Não foi possível validar os dados do cartão.');
        pagandoCartaoRef.current = false;
        return;
      }
    }

    setCarregando(true);
    try {
      let authenticationMethod = null;
      let threeDSResultPayload = null;

      if (debitoSelecionado) {
        const resultadoAutenticacao = await executarAutenticacao3DSDebito({
          pedidoId,
          documentoDigits
        });

        authenticationMethod = resultadoAutenticacao?.authenticationMethod || null;
        threeDSResultPayload = {
          flow: 'debit_3ds_auth',
          status: resultadoAutenticacao?.status || null,
          id: authenticationMethod?.id || null,
          trace_id: resultadoAutenticacao?.traceId || null
        };
        setStatus3DS('processando_pagamento');
      }

      const payloadPagamentoCartao = {
        pedido_id: pedidoId,
        tax_id: documentoDigits,
        token_cartao: tokenNormalizado,
        parcelas: parcelasCartaoEfetivas,
        tipo_cartao: formaPagamento,
        authentication_method: authenticationMethod,
        three_ds_result: threeDSResultPayload,
        recaptcha_token: recaptchaTokenAcao
      };

      if (debitoSelecionado) {
        registrarEventoHomologacao3DS(
          'request_final_pedido',
          sanitizarRequestPagamentoCartaoHomologacao({ payloadRequest: payloadPagamentoCartao })
        );
      }

      const data = await pagarCartao(pedidoId, {
        taxId: documentoDigits,
        tokenCartao: tokenNormalizado,
        parcelas: parcelasCartaoEfetivas,
        tipoCartao: formaPagamento,
        authenticationMethod,
        threeDSResult: threeDSResultPayload,
        recaptchaToken: recaptchaTokenAcao
      });

      setResultadoCartao(data);

      if (debitoSelecionado) {
        registrarEventoHomologacao3DS(
          'response_final_gateway',
          montarResumoRespostaGatewayHomologacao({
            responsePayload: data,
            pedidoId
          })
        );
      }

      const statusGateway = String(data?.status || '').toUpperCase();
      const statusInterno = String(data?.status_interno || '').toLowerCase();
      if (statusGateway === 'PAID' || statusInterno === 'pago' || statusInterno === 'entregue') {
        setStatusPedidoAtual(statusInterno || 'pago');
        setPagamentoConfirmado(true);

        if (debitoSelecionado) {
          setStatus3DS('pagamento_aprovado');
        }
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }

      if (debitoSelecionado) {
        registrarEventoHomologacao3DS('erro_pagamento_backend', {
          endpoint: '/api/pagamentos/cartao',
          message: String(error?.message || 'Falha no processamento do pagamento com cartão.').trim(),
          trace_id_masked: mascararTraceHomologacao(
            error?.traceId
              || error?.trace_id
              || error?.detail?.traceId
              || error?.detail?.trace_id
          ) || null
        });

        setStatus3DS((atual) => (
          ['nao_suportado', 'trocar_metodo', 'pagamento_aprovado'].includes(atual)
            ? atual
            : 'erro'
        ));
      }

      setErro(error.message);
    } finally {
      setCarregando(false);
      pagandoCartaoRef.current = false;
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.ENTREGA) return 1;
    if (etapa === ETAPAS.PAGAMENTO) return 2;
    if (etapa === ETAPAS.REVISAO) return 3;
    if (etapa === ETAPAS.PIX) return 3;
    return 4;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const tituloEtapaAtual = (() => {
    if (etapaAtual === ETAPAS.CARRINHO) return 'Carrinho';
    if (etapaAtual === ETAPAS.ENTREGA) return 'Entrega';
    if (etapaAtual === ETAPAS.PAGAMENTO) return 'Pagamento';
    if (etapaAtual === ETAPAS.REVISAO) return 'Revisão';
    if (etapaAtual === ETAPAS.PIX) return formaPagamento === 'pix' ? 'Pagamento' : `Pagamento com ${tituloFormaPagamento}`;
    return 'Confirmação';
  })();
  const subtituloEtapaAtual = `Etapa ${etapaIndex + 1} de 5`;
  const subtituloEtapaAtualTexto = etapaAtual === ETAPAS.PAGAMENTO
    ? 'Escolha como pagar e confirme seu pedido em segundos.'
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
  const documentoObrigatorioNaoPreenchido = documentoTocado && documentoDigits.length === 0;
  const documentoInvalidoPagamento = documentoTocado && documentoDigits.length > 0 && !documentoValidoPagamento;
  const documentoValidoFeedback = documentoTocado && documentoValidoPagamento;
  const cpfPagadorSugestao = documentoDigits.length === 11 && validarCpf(documentoDigits)
    ? formatarDocumentoFiscal(documentoDigits)
    : '';
  const cpfNotaDigits = normalizarDocumentoFiscal(cpfNotaFiscal).slice(0, 11);
  const cpfNotaValido = cpfNotaDigits.length === 11 && validarCpf(cpfNotaDigits);
  const cpfNotaInvalido = cpfNotaFiscalTocado && cpfNotaDigits.length > 0 && !cpfNotaValido;
  const cpfNotaFeedbackValido = cpfNotaFiscalTocado && cpfNotaValido;
  const recaptchaCheckoutPronto = !recaptchaCheckoutEnabled || Boolean(String(recaptchaCheckoutToken || '').trim());
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
  const cartaoProntoParaContinuar = !pagamentoCartaoSelecionado || Boolean(tokenCartao) || dadosCartaoCompletos;
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
    || !recaptchaCheckoutPronto
    || (pagamentoCartaoSelecionado && !cartaoProntoParaContinuar);
  const mensagemBloqueioPagamento = pagamentoSemItens
    ? 'Seu carrinho está vazio. Adicione produtos para seguir com o pagamento.'
    : pagamentoSemFreteCalculado
      ? 'Frete ainda não calculado. Volte para entrega e calcule o CEP para continuar.'
      : documentoDigits.length === 0
        ? 'Informe CPF/CNPJ para habilitar a continuação.'
        : !documentoValidoPagamento
          ? 'Documento inválido. Use CPF com 11 dígitos ou CNPJ com 14 dígitos.'
          : !recaptchaCheckoutPronto
            ? 'Confirme o reCAPTCHA de seguranca para habilitar a continuacao.'
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
    || !recaptchaCheckoutPronto
    || !documentoValidoPagamento;
  const bloqueioVerificacaoPix = verificandoStatusPix || carregando || !resultadoPedido?.pedido_id;
  const pixDisponivelParaPagar = Boolean(codigoPixAtual || qrCodePixSrc);
  const itensDistintosCarrinho = itens.length;
  const resumoItensCarrinho = formatarQuantidadeItens(resumo.itens);
  const mensagemProcessamentoCheckout = etapaAtual === ETAPAS.PIX
    ? (formaPagamento === 'pix'
      ? 'Processando informações do PIX. Aguarde para evitar pagamentos duplicados.'
      : `Processando ${tituloFormaPagamento.toLowerCase()}. Aguarde a confirmação do gateway.`)
    : 'Processando as informações do seu pedido com segurança.';
  const pagamentoAprovadoCheckout = pagamentoConfirmado || pixPagamentoAprovado || cartaoAprovado;
  const sugestoesPorImpulsoAtivas = modoSugestoesCheckout === 'impulso';
  const sugestoesPorCategoriaAtivas = modoSugestoesCheckout === 'categoria';
  const sugestoesPorFallbackAtivas = modoSugestoesCheckout === 'fallback';
  const tituloSugestoesCheckout = sugestoesPorImpulsoAtivas
    ? 'Aproveite tambem'
    : sugestoesPorCategoriaAtivas
      ? 'Leve junto'
      : 'Mais para o seu pedido';
  const subtituloSugestoesCheckout = sugestoesPorImpulsoAtivas
    ? 'Itens de impulso para aumentar praticidade sem sair do carrinho.'
    : sugestoesPorCategoriaAtivas
      ? 'Produtos da mesma categoria ou relacionados ao que voce escolheu.'
      : sugestoesPorFallbackAtivas
        ? 'Selecionamos opcoes atrativas em estoque para nao perder o ritmo da compra.'
        : 'Sugestoes para completar o pedido.';

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
    setFeedbackCarrinho('Carrinho limpo.');
    setSugestoesCheckout([]);
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
    if (!feedbackCarrinho) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFeedbackCarrinho('');
    }, 2200);

    return () => clearTimeout(timeout);
  }, [feedbackCarrinho]);

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

    if (etapaAtual !== ETAPAS.CARRINHO || !itens.length) {
      setSugestoesCheckout([]);
      setModoSugestoesCheckout('impulso');
      setCarregandoSugestoesCheckout(false);
      return () => {
        ativo = false;
      };
    }

    const idsCarrinho = new Set(itens.map((item) => Number(item.id)));
    const textosCarrinho = itens
      .map((item) =>
        normalizarTextoSugestao([
          item?.nome_base,
          item?.nome,
          item?.categoria,
          item?.categoria_nome
        ].join(' '))
      )
      .filter(Boolean);

    async function carregarSugestoes() {
      setCarregandoSugestoesCheckout(true);
      const vistos = new Set();
      const agregados = [];
      let modoSugestaoAtivo = 'impulso';

      const includesAny = (texto, termos = []) => termos.some((termo) => texto.includes(termo));

      const extrairTextoProduto = (produto) => normalizarTextoSugestao([
        produto?.nome_externo,
        produto?.nome,
        produto?.categoria,
        produto?.categoria_nome,
        produto?.departamento,
        produto?.descricao,
        produto?.marca,
        produto?.produto_controlado
      ].join(' '));

      const produtoEhProibido = (produto, textoProduto) => {
        if (!isProdutoVisivelNoCatalogo(produto)) {
          return true;
        }

        if (isProdutoTabaco(produto) || isProdutoAlcoolico(produto)) {
          return true;
        }

        if (includesAny(textoProduto, TOKENS_TABACO_BLOQUEADOS)) {
          return true;
        }

        if (includesAny(textoProduto, TOKENS_ALCOOL_BLOQUEADOS)) {
          return true;
        }

        if (includesAny(textoProduto, TOKENS_MEDICAMENTOS_BLOQUEADOS)) {
          return true;
        }

        if (textoProduto.includes('+18') || textoProduto.includes('18 anos')) {
          return true;
        }

        return false;
      };

      const pontuarProduto = ({ textoProduto, estoque, preco, origem }) => {
        let pontuacao = 0;
        const impulso = includesAny(textoProduto, termosSugestaoImpulso);
        const relacionado = includesAny(textoProduto, termosSugestaoCategoriaRelacionada)
          || textosCarrinho.some((textoCarrinho) => textoCarrinho && textoProduto.includes(textoCarrinho.slice(0, 10)));

        if (impulso) {
          pontuacao += 320;
        }

        if (relacionado) {
          pontuacao += 180;
        }

        if (origem === 'impulso') {
          pontuacao += 140;
        } else if (origem === 'categoria') {
          pontuacao += 90;
        } else {
          pontuacao += 40;
        }

        if (Number.isFinite(preco) && preco > 0 && preco <= 25) {
          pontuacao += 35;
        }

        if (Number.isFinite(estoque) && estoque > 0) {
          pontuacao += Math.min(30, Math.floor(estoque / 4));
        }

        return pontuacao;
      };

      const adicionarSugestao = (produto, origem = 'fallback') => {
        const id = Number(produto?.id || 0);
        const nome = String(produto?.nome_externo || produto?.nome || '').trim();
        const ativoProduto = !Object.prototype.hasOwnProperty.call(produto || {}, 'ativo') || Number(produto?.ativo) !== 0;
        const estoqueRaw = produto?.estoque ?? produto?.quantidade_estoque ?? produto?.stock;
        const estoqueNumerico = Number(estoqueRaw);
        const possuiEstoque = Number.isFinite(estoqueNumerico) && estoqueNumerico > 0;
        const textoProduto = extrairTextoProduto(produto);
        const preco = Number(produto?.preco_promocional ?? produto?.preco ?? produto?.preco_venda ?? 0);

        if (!id || !nome || vistos.has(id) || idsCarrinho.has(id) || !ativoProduto || !possuiEstoque) {
          return false;
        }

        if (!textoProduto || produtoEhProibido(produto, textoProduto)) {
          return false;
        }

        if (!Number.isFinite(preco) || preco <= 0) {
          return false;
        }

        vistos.add(id);
        agregados.push({
          id,
          nome,
          preco,
          imagem: String(produto?.imagem || produto?.imagem_url || '').trim(),
          categoria: String(
            produto?.categoria
            || produto?.categoria_nome
            || produto?.departamento
            || ''
          ).trim(),
          unidade: String(produto?.unidade || '').trim(),
          estoque: estoqueNumerico,
          score: pontuarProduto({
            textoProduto,
            estoque: estoqueNumerico,
            preco,
            origem
          })
        });

        return true;
      };

      const buscarProdutos = async ({
        busca = '',
        categoria = '',
        limit = 24,
        page = 1,
        sort = 'estoque'
      } = {}) => {
        const termoBusca = normalizarTextoSugestao(busca);
        const termoCategoria = normalizarTextoSugestao(categoria);
        const cacheKey = `checkout_sugestoes:${termoBusca || '-'}:${termoCategoria || '-'}:${limit}:${page}:${sort}`;
        if (cacheSugestoesRef.current.has(cacheKey)) {
          return cacheSugestoesRef.current.get(cacheKey);
        }

        try {
          const data = await getProdutos({
            busca: termoBusca || undefined,
            categoria: termoCategoria || undefined,
            page,
            limit,
            sort
          });
          const lista = Array.isArray(data?.produtos) ? data.produtos : [];
          cacheSugestoesRef.current.set(cacheKey, lista);
          return lista;
        } catch {
          cacheSugestoesRef.current.set(cacheKey, []);
          return [];
        }
      };

      const preencherPorTermos = async (termos, origem, maxTermos = 12) => {
        for (const termo of termos.slice(0, maxTermos)) {
          if (!ativo || agregados.length >= LIMITE_SUGESTOES_CHECKOUT) {
            return;
          }
          const lista = await buscarProdutos({ busca: termo, limit: 18, page: 1, sort: 'estoque' });
          if (!ativo) {
            return;
          }
          lista.forEach((produto) => {
            adicionarSugestao(produto, origem);
          });
        }
      };

      await preencherPorTermos(termosSugestaoImpulso, 'impulso', 14);
      if (!ativo) {
        return;
      }

      if (agregados.length < MINIMO_PRIORIDADE_IMPULSO && termosSugestaoCategoriaRelacionada.length) {
        modoSugestaoAtivo = 'categoria';
        await preencherPorTermos(termosSugestaoCategoriaRelacionada, 'categoria', 14);
      }

      if (!ativo) {
        return;
      }

      if (agregados.length < MINIMO_PRIORIDADE_IMPULSO) {
        modoSugestaoAtivo = 'fallback';
        await preencherPorTermos(TERMOS_FALLBACK_GERAL, 'fallback', TERMOS_FALLBACK_GERAL.length);
      }

      if (!ativo) {
        return;
      }

      if (agregados.length < MINIMO_PRIORIDADE_IMPULSO) {
        const fallbackGeral = await buscarProdutos({ limit: 120, page: 1, sort: 'estoque' });
        if (!ativo) {
          return;
        }
        fallbackGeral.forEach((produto) => {
          adicionarSugestao(produto, 'fallback');
        });
      }

      let sugestoesOrdenadas = agregados
        .sort((a, b) => {
          const scoreA = Number(a?.score || 0);
          const scoreB = Number(b?.score || 0);
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }
          const estoqueA = Number(a?.estoque || 0);
          const estoqueB = Number(b?.estoque || 0);
          if (estoqueA !== estoqueB) {
            return estoqueB - estoqueA;
          }
          return Number(a?.preco || 0) - Number(b?.preco || 0);
        })
        .slice(0, LIMITE_SUGESTOES_CHECKOUT)
        .map((produto) => ({
          id: produto.id,
          nome: produto.nome,
          preco: produto.preco,
          imagem: produto.imagem,
          categoria: produto.categoria,
          unidade: produto.unidade,
          estoque: produto.estoque
        }));

      if (!sugestoesOrdenadas.length && ultimaSugestaoCheckoutValidaRef.current.length) {
        sugestoesOrdenadas = ultimaSugestaoCheckoutValidaRef.current
          .filter((produto) => !idsCarrinho.has(Number(produto?.id || 0)))
          .slice(0, LIMITE_SUGESTOES_CHECKOUT);
      }

      if (sugestoesOrdenadas.length) {
        ultimaSugestaoCheckoutValidaRef.current = sugestoesOrdenadas;
      }

      setModoSugestoesCheckout(modoSugestaoAtivo);
      setSugestoesCheckout(sugestoesOrdenadas);
      setCarregandoSugestoesCheckout(false);
    }

    void carregarSugestoes();

    return () => {
      ativo = false;
    };
  }, [
    etapaAtual,
    itens,
    normalizarTextoSugestao,
    termosSugestaoImpulso,
    termosSugestaoCategoriaRelacionada
  ]);

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

  return (
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

      {exibirRecaptchaCheckout ? (
        <section className="checkout-recaptcha-banner" aria-label="Validacao antiabuso">
          <p className="checkout-recaptcha-title">Validacao de seguranca</p>
          <p className="checkout-recaptcha-description">
            Confirme o reCAPTCHA antes de concluir pedido, gerar PIX ou pagar com cartão.
          </p>

          <ReCAPTCHA
            ref={recaptchaCheckoutRef}
            sitekey={RECAPTCHA_SITE_KEY}
            hl="pt-BR"
            onChange={(token) => {
              setRecaptchaCheckoutToken(String(token || '').trim());
              if (token) {
                setRecaptchaCheckoutErroCarregamento('');
              }
            }}
            onExpired={() => setRecaptchaCheckoutToken('')}
            onErrored={() => {
              setRecaptchaCheckoutToken('');
              setRecaptchaCheckoutErroCarregamento(
                'Nao foi possivel validar o reCAPTCHA neste dominio. Confira os dominios permitidos na chave do Google.'
              );
            }}
          />

          {recaptchaCheckoutErroCarregamento ? (
            <p className="error-text">{recaptchaCheckoutErroCarregamento}</p>
          ) : (
            <p className="muted-text">A validacao pode expirar; refaca o reCAPTCHA se necessario.</p>
          )}
        </section>
      ) : null}

      {etapaAtual === ETAPAS.CARRINHO ? (
        <div className="checkout-cart-layout">
          <div className="card-box checkout-cart-main">
            <div className="checkout-cart-header">
              <p className="checkout-cart-live-feedback" role="status" aria-live="polite">
                {feedbackCarrinho || (carrinhoVazio
                  ? 'Nenhum item no carrinho por enquanto.'
                  : `${itensDistintosCarrinho} produtos diferentes · ${resumoItensCarrinho}.`)}
              </p>
            </div>

            {carrinhoVazio ? (
              <div className="checkout-cart-empty-state" role="status">
                <span className="checkout-cart-empty-icon" aria-hidden="true">
                  <ShoppingCart size={22} strokeWidth={2} />
                </span>
                <div>
                  <strong>Seu carrinho está vazio.</strong>
                  <p>Adicione produtos para continuar com a finalização do pedido.</p>
                  <Link className="btn-primary checkout-cart-empty-cta" to="/produtos">
                    Ir para produtos
                  </Link>
                </div>
              </div>
            ) : (
              <div className="checkout-cart-items-list">
                {itens.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    warningMessage={avisosRestricaoEntregaPorItem.get(Number(item.id)) || ''}
                    onUpdateQuantity={handleAtualizarQuantidadeCarrinho}
                    onRemove={handleRemoverItemCarrinho}
                  />
                ))}
              </div>
            )}

            <CheckoutCrossSellRail
              title={tituloSugestoesCheckout}
              subtitle={subtituloSugestoesCheckout}
              produtos={sugestoesCheckout}
              carregando={carregandoSugestoesCheckout}
              alwaysVisible={Boolean(itens.length)}
              onAdd={(produto) => addItem(produto, 1, { source: 'checkout_cross_sell' })}
            />
          </div>

          <aside className="checkout-cart-side">
            <CheckoutSummaryCard
              subtotal={resumo.total}
              taxaServico={taxaServicoAtual}
              tipoEntrega={tipoEntrega}
              economiaFrete={economiaFreteRetirada}
              onContinue={() => setEtapaAtual(ETAPAS.ENTREGA)}
              disabled={carrinhoVazio}
              showContinueButton={false}
            />
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.ENTREGA ? (
        <div className="checkout-delivery-layout">
          <div className="card-box checkout-delivery-main">
            <section className="checkout-delivery-section" aria-label="Forma de recebimento">
              <div className="checkout-delivery-section-head">
                <h3>Formas de recebimento</h3>
              </div>
              <div className="delivery-mode-toggle" role="radiogroup" aria-label="Forma de recebimento">
                <button
                  type="button"
                  role="radio"
                  aria-checked={formaRecebimentoSelecionada === 'retirada'}
                  className={`delivery-mode-toggle-btn ${formaRecebimentoSelecionada === 'retirada' ? 'is-active' : ''}`.trim()}
                  onClick={() => selecionarFormaRecebimento('retirada')}
                >
                  Retirada na loja
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={formaRecebimentoSelecionada === 'bike'}
                  className={`delivery-mode-toggle-btn ${formaRecebimentoSelecionada === 'bike' ? 'is-active' : ''}`.trim()}
                  onClick={() => selecionarFormaRecebimento('bike')}
                >
                  Bike
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={formaRecebimentoSelecionada === 'uber'}
                  className={`delivery-mode-toggle-btn ${formaRecebimentoSelecionada === 'uber' ? 'is-active' : ''}`.trim()}
                  onClick={() => selecionarFormaRecebimento('uber')}
                  disabled={!uberQuoteDisponivel}
                  title={!uberQuoteDisponivel ? 'Uber indisponível no momento' : ''}
                >
                  Uber
                </button>
              </div>
            </section>

            {formaRecebimentoSelecionada === 'uber' ? (
              <article className="delivery-uber-info" role="status" aria-live="polite" aria-label="Informações da entrega via Uber">
                <div className="delivery-uber-info-head">
                  <span className="delivery-uber-info-icon" aria-hidden="true">
                    <AlertTriangle size={16} strokeWidth={2} />
                  </span>
                  <p className="delivery-uber-info-title">Entrega realizada pela Uber</p>
                </div>
                <p className="delivery-uber-info-text">
                  Sua entrega será feita por um parceiro logístico da Uber. Você poderá acompanhar o andamento da entrega e terá mais segurança no processo. Quando disponível, a localização e as atualizações do entregador aparecerão para você durante a rota.
                </p>
              </article>
            ) : null}

            {!retiradaSelecionada ? (
              <div className="checkout-delivery-compact-head">
                <span aria-hidden="true">
                  <MapPin size={16} strokeWidth={2} />
                </span>
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
                  onClick={() => {
                    const campoCep = document.getElementById('cep-entrega');
                    if (campoCep) {
                      campoCep.focus();
                    }
                  }}
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
                  role={mensagemFrete.tone === 'error' || mensagemFrete.tone === 'warning' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {mensagemFrete.text}
                </p>
              </>
            ) : (
              <>
                <section className="checkout-delivery-section checkout-delivery-compact checkout-delivery-minimal" aria-label="Entrega">
                  {temEnderecoContaSalvo ? (
                    <div className="checkout-saved-address-option" role="status" aria-live="polite">
                      <p className="checkout-saved-address-label">Endereço salvo na conta</p>
                      <p className="checkout-saved-address-text">{enderecoContaSalvoResumo}</p>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={aplicarEnderecoSalvoNoCheckout}
                        disabled={enderecoSalvoJaSelecionado}
                      >
                        {enderecoSalvoJaSelecionado ? 'Endereço salvo em uso' : 'Usar endereço salvo'}
                      </button>
                    </div>
                  ) : null}

                  <div className="delivery-input-labels" aria-hidden="true">
                    <span>CEP</span>
                    <span>Número</span>
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
                        onChange={(event) => {
                          const cepFormatado = formatarCep(event.target.value);
                          const cepNormalizado = normalizarCep(cepFormatado);

                          setCepEntrega(cepFormatado);
                          setErroEntrega('');

                          if (cepNormalizado !== cepEnderecoConsultado) {
                            setEnderecoCepEntrega(null);
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
                      onChange={(event) => setNumeroEntrega(String(event.target.value || '').replace(/\D/g, '').slice(0, 10))}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-secondary entrega-calcular-btn"
                    onClick={() => {
                      void executarSimulacaoFrete({ mostrarErro: true });
                    }}
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
                    role={mensagemFrete.tone === 'error' || mensagemFrete.tone === 'warning' ? 'alert' : 'status'}
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
                      const veiculo = key === 'bike'
                        ? VEICULOS_ENTREGA.bike
                        : { ...VEICULOS_ENTREGA.moto, label: 'Entrega Uber' };
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
                          setTipoEntrega('entrega');
                          setVeiculoEntrega(key);
                          setSimulacaoFrete(sim || null);
                          setErroEntrega('');
                        }}
                      />
                    );})}
                  </div>
                </section>

                {semOpcaoEntregaDisponivel ? (
                  <div className="delivery-empty-state" role="alert">
                    <span aria-hidden="true">
                      <AlertTriangle size={18} strokeWidth={2} />
                    </span>
                    <div>
                      <strong>Sem opção de entrega disponível para este CEP.</strong>
                      <p>Verifique o CEP informado ou tente outro endereço para continuar.</p>
                    </div>
                  </div>
                ) : null}
              </>
            )}

          </div>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
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
                {/* Cards de método com destaque explícito para a opção ativa. */}
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
                          if (!['pix', 'credito', 'debito'].includes(formaSelecionada)) {
                            return;
                          }

                          setFormaPagamento(formaSelecionada);
                          if (formaSelecionada === 'debito') {
                            setParcelasCartao('1');
                          }
                          setErro('');
                          limparTokenCartaoGerado();
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
                    setDocumentoPagador(formatarDocumentoFiscal(event.target.value));
                    if (erro) {
                      setErro('');
                    }
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
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setCpfNotaFiscalAtivo(true);
                          setCpfNotaFiscalTocado(false);
                        }}
                      >
                        Adicionar CPF na nota
                      </button>

                      {cpfPagadorSugestao ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setCpfNotaFiscal(cpfPagadorSugestao);
                            setCpfNotaFiscalAtivo(true);
                            setCpfNotaFiscalTocado(true);
                          }}
                        >
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
                        onChange={(event) => {
                          const documentoFormatado = formatarDocumentoFiscal(event.target.value);
                          setCpfNotaFiscal(documentoFormatado);
                          if (erro) {
                            setErro('');
                          }
                        }}
                        onBlur={() => setCpfNotaFiscalTocado(true)}
                        requiredError={false}
                        invalidError={cpfNotaInvalido}
                        validFeedback={cpfNotaFeedbackValido}
                      />

                      <div className="payment-fiscal-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setCpfNotaFiscal('');
                            setCpfNotaFiscalAtivo(false);
                            setCpfNotaFiscalTocado(false);
                          }}
                        >
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
                      </div>

                      <div className="payment-card-field payment-card-field-span-2">
                        <label htmlFor="numero-cartao">Número do cartão</label>
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
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="mes-expiracao-cartao">Mês</label>
                        <input
                          id="mes-expiracao-cartao"
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
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="ano-expiracao-cartao">Ano</label>
                        <input
                          id="ano-expiracao-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp-year"
                          placeholder="AA ou AAAA"
                          maxLength={4}
                          value={anoExpiracaoCartao}
                          onChange={(event) => {
                            setAnoExpiracaoCartao(formatarAnoCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="cvv-cartao">CVV</label>
                        <input
                          id="cvv-cartao"
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
                        <div className="payment-card-field payment-card-field-span-2">
                          <label htmlFor="parcelas-cartao">Parcelas</label>
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
                          void handleCriptografarCartao().catch((error) => {
                            setErro(error.message || 'Não foi possível validar os dados do cartão.');
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
            {/* Resumo financeiro com maior visibilidade antes da confirmação. */}
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
      ) : null}

      {/* ETAPA REVIS?O: aguardando equipe confirmar disponibilidade */}
      {etapaAtual === ETAPAS.REVISAO ? (
        <div className="checkout-revisao-layout">
          <div className="card-box checkout-revisao-main">
            <div className="checkout-revisao-header">
              <p className="checkout-pix-kicker">Etapa 4</p>
              <h2>Pedido em revisão</h2>
              <p className="muted-text">
                Seu pedido #{resultadoPedido?.pedido_id} foi recebido e está sendo verificado pela nossa equipe.
                Vamos confirmar se todos os itens estão disponíveis.
              </p>
            </div>

            {statusRevisaoAtual === 'aguardando_revisao' ? (
              <div className="checkout-revisao-status">
                <div className="checkout-revisao-icon" aria-hidden="true">
                  <ClipboardList size={18} strokeWidth={2} />
                </div>
                <h3>Aguardando revisão da equipe</h3>
                <p className="muted-text">
                  A equipe do mercado está verificando a disponibilidade dos seus itens.
                  Esta p?gina atualiza automaticamente ? voc? ser? direcionado para o pagamento assim que o pedido for aprovado.
                </p>
                <div className="checkout-revisao-loading">
                  <div className="checkout-revisao-spinner"></div>
                  <span>Verificando a cada 10 segundos...</span>
                </div>
                <p className="muted-text" style={{ marginTop: '0.6rem' }}>{textoUltimaAtualizacaoRevisao}</p>
                {podeCancelarRevisaoPedido ? (
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => {
                      void handleCancelarPedidoEmRevisao();
                    }}
                    disabled={cancelandoRevisao}
                    style={{ marginTop: '0.8rem' }}
                  >
                    {cancelandoRevisao ? 'Cancelando pedido...' : 'Cancelar pedido'}
                  </button>
                ) : null}
              </div>
            ) : statusRevisaoAtual === 'pendente' || statusRevisaoAtual === 'pagamento_recusado' ? (
              <div className={`checkout-revisao-status ${statusRevisaoAtual === 'pagamento_recusado' ? 'is-rejected' : ''}`.trim()}>
                <div className="checkout-revisao-icon" aria-hidden="true">
                  {statusRevisaoAtual === 'pagamento_recusado' ? (
                    <AlertTriangle size={18} strokeWidth={2} />
                  ) : (
                    <CircleCheck size={18} strokeWidth={2} />
                  )}
                </div>
                <h3>{statusRevisaoAtual === 'pagamento_recusado' ? 'Pagamento recusado' : 'Pedido aprovado para pagamento'}</h3>
                <p className={statusRevisaoAtual === 'pagamento_recusado' ? 'error-text' : 'muted-text'}>
                  {statusRevisaoAtual === 'pagamento_recusado'
                    ? 'Seu pedido está aprovado, mas o pagamento foi recusado. Revise os dados e tente novamente.'
                    : 'A revisão terminou. Você já pode seguir para o pagamento.'}
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn-primary" type="button" onClick={() => setEtapaAtual(ETAPAS.PIX)}>
                    Ir para pagamento
                  </button>
                  {podeCancelarRevisaoPedido ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => {
                        void handleCancelarPedidoEmRevisao();
                      }}
                      disabled={cancelandoRevisao}
                    >
                      {cancelandoRevisao ? 'Cancelando pedido...' : 'Cancelar pedido'}
                    </button>
                  ) : null}
                  <Link to="/pedidos" className="btn-secondary">
                    Ir para meus pedidos
                  </Link>
                </div>
              </div>
            ) : statusRevisaoAtual === 'cancelado' || statusRevisaoAtual === 'expirado' ? (
              <div className="checkout-revisao-status is-rejected">
                <div className="checkout-revisao-icon" aria-hidden="true">
                  <BadgeX size={18} strokeWidth={2} />
                </div>
                <h3>Pedido encerrado</h3>
                <p className="error-text">
                  {erro || 'Esse pedido em revisão foi encerrado. Você pode iniciar um novo carrinho normalmente.'}
                </p>
                <Link to="/produtos" className="btn-primary" style={{ marginTop: '1rem' }}>
                  Voltar às compras
                </Link>
              </div>
            ) : null}

            {/* Resumo do pedido */}
            {resumoPedidoSnapshot ? (
              <div className="checkout-revisao-resumo">
                <h4>Resumo do pedido</h4>
                <ul className="checkout-revisao-itens">
                  {itensPedidoSnapshot.map((item) => (
                    <li key={item.produto_id}>
                      <span>{item.quantidade}x {item.nome}</span>
                      <span>{formatarMoeda(calcularSubtotalLinhaRevisao(item))}</span>
                    </li>
                  ))}
                </ul>
                <div className="checkout-revisao-total">
                  <strong>Total</strong>
                  <strong>{formatarMoeda(totalRevisaoSnapshot)}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
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
                {/* Estrutura principal do PIX com QR em destaque e código copia e cola. */}
                <section className="checkout-pix-payment-panel" aria-label="Pagamento PIX">
                  <div className="checkout-pix-payment-grid">
                    <PixQrCodeCard qrCodeSrc={qrCodePixSrc} carregando={carregando} />

                    <PixCopyCodeCard
                      codigoPix={codigoPixAtual}
                      onCopy={() => {
                        void handleCopiarCodigoPix();
                      }}
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
                  disabled={carregando || criptografandoCartao || !resultadoPedido?.pedido_id || !recaptchaCheckoutPronto || !documentoValidoPagamento}
                  onClick={() => handlePagarCartaoMercadoPago(resultadoPedido.pedido_id)}
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
                        onClick={() => {
                          void handleCopiarEvidenciaHomologacao3DS();
                        }}
                      >
                        Copiar log sanitizado
                      </button>

                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={handleBaixarEvidenciaHomologacao3DS}
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
                  onClick={() => handleGerarPixMercadoPago(resultadoPedido.pedido_id)}
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
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <div className="card-box">
          <p><strong>Etapa 4: Confirmação e acompanhamento</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido: #{resultadoPedido.pedido_id}</p>
              <p>Total com entrega estimado: {formatarMoeda(totalComEntregaPedido)}</p>
              <p>
                Situação atual: <span className="pedido-status-badge">{labelStatus}</span>
              </p>
              {pagamentoConfirmado ? (
                <div className="pagamento-ok" aria-label="Pagamento confirmado com sucesso">
                  <span className="pagamento-ok-icon"><CircleCheck size={16} aria-hidden="true" /></span>
                  <span>Pagamento confirmado com sucesso.</span>
                </div>
              ) : (
                <p className="checkout-status-pending" role="status">
                  Ainda estamos aguardando a confirmação final do pagamento. Mantenha esta tela aberta para acompanhar.
                </p>
              )}
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

          <Link className="btn-secondary" to="/pedidos" style={{ display: 'inline-flex', width: 'fit-content' }}>
            Ir para meus pedidos
          </Link>
        </div>
      ) : null}

    </section>
  );
}
