import React from 'react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

const EMPTY_RECOMENDACOES = [];
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useRecorrencia } from '../context/RecorrenciaContext';
import useDocumentHead from '../hooks/useDocumentHead';
import useDebouncedValue from '../hooks/useDebouncedValue';
import usePreloadImage from '../hooks/usePreloadImage';
import SmartImage from '../components/ui/SmartImage';
import { getOfertasDia } from '../lib/api';
import {
  buildProductEventPayload,
  captureCommerceEvent
} from '../lib/commerceTracking';
import {
  GROWTH_BOTTLENECK_LABELS,
  GROWTH_UPDATE_EVENT_NAME,
  getGrowthInsights
} from '../lib/conversionGrowth';
import {
  CATEGORIA_TODAS,
  CATEGORIA_PROMOCOES,
  CATEGORIA_BEBIDAS,
  TOKEN_BEBIDA,
  PRODUTOS_POR_PAGINA,
  DRINK_SECTIONS_BEBIDAS,
  BRAND_GROUPS_BY_SUBCATEGORY,
  CATEGORY_IMAGES,
  CATEGORIAS_LEGADO,
  ORDENACOES_PRODUTOS,
  BUSCA_SUGESTOES_RAPIDAS,
  FILTROS_RECORRENCIA,
  FILTROS_COMERCIAIS_RAPIDOS,
  CATEGORIA_ICONE_FALLBACK,
  TOKENS_MAIS_VENDIDOS,
  ESTOQUE_BAIXO_LIMIAR,
  BRL_CURRENCY,
  PT_BR_COLLATOR,
  DRINK_SECTIONS_BEBIDAS_INDEX,
  BRAND_GROUPS_BY_SUBCATEGORY_INDEX,
  VIRTUALIZATION_THRESHOLD,
  VIRTUAL_GRID_GAP,
  VIRTUAL_CARD_MIN_WIDTH_DESKTOP,
  VIRTUAL_CARD_MIN_WIDTH_MOBILE,
  VIRTUAL_CARD_HEIGHT_DESKTOP,
  VIRTUAL_CARD_HEIGHT_MOBILE,
  VIRTUAL_GRID_MIN_HEIGHT,
  PREFETCHED_PRODUCT_IMAGE_LIMIT,
  getProdutoImagem,
  normalizeText,
  normalizeMatchers,
  isBebidasCategoria,
  getTextoProduto,
  textoContemMatcher,
  getBebidaSubcategoriaIdByTexto,
  isProdutoEmPromocao,
  toNumber,
  formatCurrency,
  formatConversionRate,
  getProdutoCarrinhoId,
  getProdutoIdNormalizado,
  getProdutoNome,
  getProdutoCategoriaLabel,
  getProdutoMedida,
  getProdutoDetalheComercial,
  getProdutoPrecoInfo,
  getProdutoEstoqueInfo,
  getScoreMaisVendido,
  compareProdutosPorNome,
  getScoreComportamento,
  sortProdutosIndexados,
  getProdutoBadges,
  getPlaceholderIconePorCategoria,
  getProdutoStableKey,
  getCategoriaApi,
  buildProdutosQueryKey,
  fetchProdutosPage,
  buildProdutosPageCacheKey,
  isUnsplashUrl,
  buildUnsplashVariant,
  getProdutoImagemResponsiva,
  getProdutoImagemBlurSrc,
  mergeProdutosById,
  prefetchProductImage
} from '../lib/produtosUtils';
import useViewportHeight from '../hooks/useViewportHeight';
import useElementWidth from '../hooks/useElementWidth';
import {
  ProdutoImageFallback,
  ProdutoBadge,
  ProdutosSkeletonGrid,
  ProdutoCard,
  VirtualizedProdutoGrid,
  RecorrenciaMiniCard
} from '../components/produtos';

const ProdutoDecisionDrawer = React.lazy(() => import('../components/ProdutoDecisionDrawer'));


export default function ProdutosPage() {
  useDocumentHead({ title: 'Produtos', description: 'Explore o catálogo completo do BomFilho — hortifruti, bebidas, mercearia, limpeza e muito mais.' });
  const { itens, addItem, updateItemQuantity, removeItem, resumo } = useCart();
  const {
    favoritosIds,
    favoritosProdutos,
    recomprasProdutos,
    stats: recorrenciaStats,
    isFavorito,
    alternarFavorito,
    registrarVisualizacao,
    registrarAcaoCarrinho
  } = useRecorrencia();
  const [searchParams] = useSearchParams();
  const categoriaInicial = String(searchParams.get('categoria') || CATEGORIA_TODAS).toLowerCase();
  const buscaInicial = String(searchParams.get('busca') || '');
  const filtroRecorrenciaInicial = String(
    searchParams.get('recorrencia')
    || (searchParams.get('favoritos') === '1' ? 'favoritos' : '')
    || (searchParams.get('recompra') === '1' ? 'recompra' : '')
    || 'todos'
  ).toLowerCase();

  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState(buscaInicial);
  const [categoria, setCategoria] = useState(categoriaInicial || CATEGORIA_TODAS);
  const [ordenacao, setOrdenacao] = useState(ORDENACOES_PRODUTOS[0].id);
  const [bebidaSubcategoria, setBebidaSubcategoria] = useState('todas');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMaisProdutos, setTemMaisProdutos] = useState(false);
  const [totalProdutosBackend, setTotalProdutosBackend] = useState(0);
  const [produtoAdicionadoRecenteId, setProdutoAdicionadoRecenteId] = useState(null);
  const [produtoAdicionadoRecenteNome, setProdutoAdicionadoRecenteNome] = useState('');
  const [produtoDetalheAbertoChave, setProdutoDetalheAbertoChave] = useState('');
  const [filtroRecorrencia, setFiltroRecorrencia] = useState(
    FILTROS_RECORRENCIA.some((item) => item.id === filtroRecorrenciaInicial)
      ? filtroRecorrenciaInicial
      : 'todos'
  );
  const [feedbackRecorrencia, setFeedbackRecorrencia] = useState('');
  const [growthVersion, setGrowthVersion] = useState(0);
  const [ofertasDia, setOfertasDia] = useState([]);
  const requisicaoProdutosIdRef = useRef(0);
  const limparFeedbackAdicaoRef = useRef(null);
  const limparFeedbackRecorrenciaRef = useRef(null);
  const adicionandoIdsRef = useRef(new Set());
  const limparAdicionandoTimersRef = useRef(new Map());
  const quantidadesCarrinhoRef = useRef(new Map());
  const prefetchProdutosCacheRef = useRef(new Map());
  const prefetchEmAndamentoRef = useRef(new Set());
  const buscaDebounced = useDebouncedValue(busca, 280);
  const termoBuscaDigitado = String(busca || '').trim();
  const termoBuscaEfetivo = String(buscaDebounced || '').trim();
  const buscaEmAtualizacao = normalizeText(termoBuscaDigitado) !== normalizeText(termoBuscaEfetivo);
  const categoriaEhBebidas = useMemo(() => isBebidasCategoria(categoria), [categoria]);
  const growthInsights = useMemo(() => getGrowthInsights({ windowDays: 7 }), [growthVersion]);
  const growthFunnel = Array.isArray(growthInsights?.funnel) ? growthInsights.funnel : [];
  const growthBottleneckLabel = GROWTH_BOTTLENECK_LABELS[growthInsights?.bottleneck] || GROWTH_BOTTLENECK_LABELS.view_to_cart;
  const growthExperimento = growthInsights?.experiment || {
    enabled: false,
    mode: 'collecting_data',
    variantKey: 'control',
    winnerVariantKey: null,
    variants: [],
    ui: {
      catalog: { enabled: false, ctaMode: 'default', badgeLabel: '', priceHighlight: 'none', helperText: '' },
      checkoutEntry: { enabled: false, ctaText: 'Ir para checkout', badgeLabel: '', priceHighlight: 'none' },
      checkoutPayment: { enabled: false, ctaPrefix: 'Finalizar pedido', badgeLabel: '', priceHighlight: 'none' }
    }
  };
  const growthDataVolume = growthInsights?.dataVolume || {
    readyForAction: false,
    windowEventCount: 0,
    bottleneckFromCount: 0,
    bottleneckToCount: 0,
    missingWindowEvents: 0,
    missingBottleneckBase: 0,
    missingBottleneckTarget: 0,
    thresholds: {
      windowEvents: 90,
      bottleneckBase: 28,
      bottleneckTarget: 8,
      samplePerVariant: 12
    }
  };
  const growthColetaAtiva = Boolean(growthExperimento?.mode === 'collecting_data' || !growthExperimento?.enabled);
  const growthTopProductsById = useMemo(() => {
    const mapa = new Map();

    (growthInsights?.topProducts || []).forEach((item) => {
      const id = Number(item?.productId || 0);
      if (Number.isFinite(id) && id > 0) {
        mapa.set(id, item);
      }
    });

    return mapa;
  }, [growthInsights?.topProducts]);
  const idsAltaConversaoSet = useMemo(() => {
    return new Set(Array.from(growthTopProductsById.keys()));
  }, [growthTopProductsById]);
  const assinaturaConsultaAtual = useMemo(
    () => JSON.stringify(buildProdutosQueryKey({
      categoria,
      busca: buscaDebounced,
      page: 1,
      limit: PRODUTOS_POR_PAGINA
    })),
    [buscaDebounced, categoria]
  );

  useEffect(() => {
    setBusca(String(searchParams.get('busca') || ''));
    setCategoria(String(searchParams.get('categoria') || CATEGORIA_TODAS).toLowerCase());

    const proximoFiltroRecorrencia = String(
      searchParams.get('recorrencia')
      || (searchParams.get('favoritos') === '1' ? 'favoritos' : '')
      || (searchParams.get('recompra') === '1' ? 'recompra' : '')
      || 'todos'
    ).toLowerCase();

    if (FILTROS_RECORRENCIA.some((item) => item.id === proximoFiltroRecorrencia)) {
      setFiltroRecorrencia(proximoFiltroRecorrencia);
    } else {
      setFiltroRecorrencia('todos');
    }
  }, [searchParams]);

  // Buscar ofertas do dia (atualização semanal pelo admin)
  useEffect(() => {
    let cancelado = false;
    getOfertasDia()
      .then((data) => {
        if (!cancelado && Array.isArray(data?.ofertas)) {
          setOfertasDia(data.ofertas);
        }
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!categoriaEhBebidas) {
      setBebidaSubcategoria('todas');
    }
  }, [categoriaEhBebidas]);

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

  useEffect(() => {
    prefetchProdutosCacheRef.current.clear();
    prefetchEmAndamentoRef.current.clear();
  }, [assinaturaConsultaAtual]);

  useEffect(() => {
    return () => {
      if (limparFeedbackAdicaoRef.current) {
        clearTimeout(limparFeedbackAdicaoRef.current);
      }

      if (limparFeedbackRecorrenciaRef.current) {
        clearTimeout(limparFeedbackRecorrenciaRef.current);
      }

      limparAdicionandoTimersRef.current.forEach((timerId) => {
        clearTimeout(timerId);
      });
      limparAdicionandoTimersRef.current.clear();
      adicionandoIdsRef.current.clear();
    };
  }, []);

  const fecharDetalheProduto = useCallback(() => {
    setProdutoDetalheAbertoChave('');
  }, []);

  const abrirDetalheProduto = useCallback((chaveReact) => {
    const chave = String(chaveReact || '').trim();
    if (!chave) {
      return;
    }
    setProdutoDetalheAbertoChave(chave);
  }, []);

  const prefetchProximaPagina = useCallback(async ({
    categoriaAlvo,
    buscaAlvo,
    paginaAtualAlvo,
    paginacao
  }) => {
    if (!paginacao?.tem_mais) {
      return;
    }

    const proximaPagina = Number(paginacao.pagina || paginaAtualAlvo || 1) + 1;
    const chaveCache = buildProdutosPageCacheKey({
      categoria: categoriaAlvo,
      busca: buscaAlvo,
      page: proximaPagina,
      limit: PRODUTOS_POR_PAGINA
    });

    if (
      prefetchProdutosCacheRef.current.has(chaveCache)
      || prefetchEmAndamentoRef.current.has(chaveCache)
    ) {
      return;
    }

    prefetchEmAndamentoRef.current.add(chaveCache);

    try {
      const paginaPrefetch = await fetchProdutosPage({
        categoria: categoriaAlvo,
        busca: buscaAlvo,
        page: proximaPagina,
        limit: PRODUTOS_POR_PAGINA
      });

      prefetchProdutosCacheRef.current.set(chaveCache, paginaPrefetch);
    } catch {
      // Prefetch e silencioso para nao interferir na navegacao principal.
    } finally {
      prefetchEmAndamentoRef.current.delete(chaveCache);
    }
  }, []);

  const carregarProdutos = useCallback(async ({
    append = false,
    pagina = 1,
    categoriaAlvo,
    buscaAlvo
  } = {}) => {
    // Evita sobrescrever estado com resposta antiga quando o usuário muda filtros rapidamente.
    const requestId = ++requisicaoProdutosIdRef.current;

    if (append) {
      setCarregandoMais(true);
    } else {
      setCarregando(true);
    }

    setErro('');

    try {
      const categoriaEfetiva = String(categoriaAlvo ?? categoria);
      const buscaEfetiva = String(buscaAlvo ?? buscaDebounced);
      const { lista, paginacao } = await fetchProdutosPage({
        categoria: categoriaEfetiva,
        busca: buscaEfetiva,
        page: pagina,
        limit: PRODUTOS_POR_PAGINA
      });

      if (requestId !== requisicaoProdutosIdRef.current) {
        return;
      }

      setProdutos((atual) => (append ? mergeProdutosById(atual, lista) : lista));
      setPaginaAtual(Number(paginacao.pagina || pagina));
      setTemMaisProdutos(Boolean(paginacao.tem_mais));
      setTotalProdutosBackend(Number(paginacao.total || lista.length));

      void prefetchProximaPagina({
        categoriaAlvo: categoriaEfetiva,
        buscaAlvo: buscaEfetiva,
        paginaAtualAlvo: pagina,
        paginacao
      });
    } catch (error) {
      if (requestId !== requisicaoProdutosIdRef.current) {
        return;
      }

      setErro(error.message);

      if (!append) {
        setProdutos([]);
        setPaginaAtual(1);
        setTemMaisProdutos(false);
        setTotalProdutosBackend(0);
      }
    } finally {
      if (requestId !== requisicaoProdutosIdRef.current) {
        return;
      }

      if (append) {
        setCarregandoMais(false);
      } else {
        setCarregando(false);
      }
    }
  }, [buscaDebounced, categoria, prefetchProximaPagina]);

  useEffect(() => {
    void carregarProdutos({
      append: false,
      pagina: 1,
      categoriaAlvo: categoria,
      buscaAlvo: buscaDebounced
    });
  }, [buscaDebounced, carregarProdutos, categoria]);

  const handleCarregarMais = useCallback(async () => {
    if (carregando || carregandoMais || !temMaisProdutos) {
      return;
    }

    const proximaPagina = paginaAtual + 1;
    const chaveCache = buildProdutosPageCacheKey({
      categoria,
      busca: buscaDebounced,
      page: proximaPagina,
      limit: PRODUTOS_POR_PAGINA
    });

    const paginaPrefetch = prefetchProdutosCacheRef.current.get(chaveCache);

    if (paginaPrefetch) {
      setCarregandoMais(true);
      setErro('');

      try {
        prefetchProdutosCacheRef.current.delete(chaveCache);

        const lista = Array.isArray(paginaPrefetch.lista) ? paginaPrefetch.lista : [];
        const paginacao = paginaPrefetch.paginacao || {};

        setProdutos((atual) => mergeProdutosById(atual, lista));
        setPaginaAtual(Number(paginacao.pagina || proximaPagina));
        setTemMaisProdutos(Boolean(paginacao.tem_mais));
        setTotalProdutosBackend((totalAtual) => Number(paginacao.total || totalAtual || lista.length));

        void prefetchProximaPagina({
          categoriaAlvo: categoria,
          buscaAlvo: buscaDebounced,
          paginaAtualAlvo: proximaPagina,
          paginacao
        });
      } finally {
        setCarregandoMais(false);
      }

      return;
    }

    await carregarProdutos({
      append: true,
      pagina: proximaPagina,
      categoriaAlvo: categoria,
      buscaAlvo: buscaDebounced
    });
  }, [
    buscaDebounced,
    carregarProdutos,
    carregando,
    carregandoMais,
    categoria,
    paginaAtual,
    prefetchProximaPagina,
    temMaisProdutos
  ]);

  const handleAtualizarProdutos = useCallback(() => {
    void carregarProdutos({
      append: false,
      pagina: 1,
      categoriaAlvo: categoria,
      buscaAlvo: buscaDebounced
    });
  }, [buscaDebounced, carregarProdutos, categoria]);

  const handleBuscaChange = useCallback((event) => {
    setBusca(event.target.value);
  }, []);

  const handleLimparBusca = useCallback(() => {
    setBusca('');
  }, []);

  const handleCategoriaSelectChange = useCallback((event) => {
    setCategoria(String(event.target.value).toLowerCase());
  }, []);

  const handleOrdenacaoChange = useCallback((event) => {
    setOrdenacao(String(event.target.value));
  }, []);

  const handleCategoriaLegadoClick = useCallback((categoriaId) => {
    setCategoria(categoriaId);
    if (categoriaId !== CATEGORIA_BEBIDAS) {
      setBebidaSubcategoria('todas');
    }
  }, []);

  const handleLimparFiltros = useCallback(() => {
    setBusca('');
    setCategoria(CATEGORIA_TODAS);
    setOrdenacao(ORDENACOES_PRODUTOS[0].id);
    setBebidaSubcategoria('todas');
    setFiltroRecorrencia('todos');
  }, []);

  const handleAtalhoComercial = useCallback((atalhoId) => {
    const atalho = FILTROS_COMERCIAIS_RAPIDOS.find((item) => item.id === atalhoId);
    if (!atalho || typeof atalho.onSelect !== 'function') {
      return;
    }

    atalho.onSelect({
      setCategoria,
      setOrdenacao,
      setFiltroRecorrencia,
      setBusca,
      setBebidaSubcategoria
    });
  }, []);

  const handleAplicarSugestaoBusca = useCallback(({ termo = '', categoria: categoriaSugestao = CATEGORIA_TODAS } = {}) => {
    setCategoria(String(categoriaSugestao || CATEGORIA_TODAS).toLowerCase());
    setBusca(String(termo || ''));
    if (categoriaSugestao !== CATEGORIA_BEBIDAS) {
      setBebidaSubcategoria('todas');
    }
  }, []);

  const aplicarFeedbackRecorrencia = useCallback((mensagem) => {
    const texto = String(mensagem || '').trim();
    if (!texto) {
      return;
    }

    if (limparFeedbackRecorrenciaRef.current) {
      clearTimeout(limparFeedbackRecorrenciaRef.current);
    }

    setFeedbackRecorrencia(texto);
    limparFeedbackRecorrenciaRef.current = setTimeout(() => {
      setFeedbackRecorrencia('');
      limparFeedbackRecorrenciaRef.current = null;
    }, 2400);
  }, []);

  const handleToggleFavorito = useCallback((produto) => {
    const id = getProdutoCarrinhoId(produto);
    const nome = getProdutoNome(produto);
    const favoritadoAntes = id !== null ? isFavorito(id) : false;

    alternarFavorito(produto);
    aplicarFeedbackRecorrencia(
      favoritadoAntes
        ? `${nome} removido dos favoritos.`
        : `${nome} salvo nos favoritos.`
    );
  }, [alternarFavorito, aplicarFeedbackRecorrencia, isFavorito]);

  const handleSelecionarFiltroRecorrencia = useCallback((filtroId) => {
    if (!FILTROS_RECORRENCIA.some((item) => item.id === filtroId)) {
      return;
    }

    setFiltroRecorrencia(filtroId);

    if (filtroId === 'todos') {
      aplicarFeedbackRecorrencia('Exibindo todos os produtos da vitrine novamente.');
      return;
    }

    const label = FILTROS_RECORRENCIA.find((item) => item.id === filtroId)?.label || 'recorrencia';
    aplicarFeedbackRecorrencia(`Vitrine focada em ${label.toLowerCase()}.`);
  }, [aplicarFeedbackRecorrencia]);

  const registrarFeedbackAdicao = useCallback((produto) => {
    const carrinhoId = getProdutoCarrinhoId(produto);
    if (carrinhoId === null) {
      return;
    }

    if (limparFeedbackAdicaoRef.current) {
      clearTimeout(limparFeedbackAdicaoRef.current);
    }

    setProdutoAdicionadoRecenteId(carrinhoId);
    setProdutoAdicionadoRecenteNome(getProdutoNome(produto));

    limparFeedbackAdicaoRef.current = setTimeout(() => {
      setProdutoAdicionadoRecenteId(null);
      setProdutoAdicionadoRecenteNome('');
      limparFeedbackAdicaoRef.current = null;
    }, 2600);
  }, []);

  const limparEstadoAdicionando = useCallback((carrinhoId) => {
    if (!Number.isFinite(carrinhoId)) {
      return;
    }

    const timerId = limparAdicionandoTimersRef.current.get(carrinhoId);
    if (timerId) {
      clearTimeout(timerId);
      limparAdicionandoTimersRef.current.delete(carrinhoId);
    }

    adicionandoIdsRef.current.delete(carrinhoId);
  }, []);

  const agendarLimpezaEstadoAdicionando = useCallback((carrinhoId, delayMs = 520) => {
    if (!Number.isFinite(carrinhoId)) {
      return;
    }

    const timerAnterior = limparAdicionandoTimersRef.current.get(carrinhoId);
    if (timerAnterior) {
      clearTimeout(timerAnterior);
    }

    const timerId = setTimeout(() => {
      limparEstadoAdicionando(carrinhoId);
    }, delayMs);

    limparAdicionandoTimersRef.current.set(carrinhoId, timerId);
  }, [limparEstadoAdicionando]);

  // Índice local com campos normalizados para evitar recomputações em cada filtro/render.
  const produtosIndexados = useMemo(() => {
    return produtos.map((produto) => {
      const nomeProduto = getProdutoNome(produto);
      const categoriaLabel = getProdutoCategoriaLabel(produto);
      const detalhesComerciais = getProdutoDetalheComercial(produto);
      const medidaProduto = getProdutoMedida(produto);
      const textoBusca = getTextoProduto(produto);
      const categoriaOriginal = String(produto?.categoria || '').toLowerCase();
      const categoriaNormalizada = normalizeText(categoriaOriginal);
      const precoInfo = getProdutoPrecoInfo(produto);
      const estoqueInfo = getProdutoEstoqueInfo(produto);
      const imagemResponsiva = getProdutoImagemResponsiva(produto);
      const carrinhoId = getProdutoCarrinhoId(produto);
      const conversaoProduto = carrinhoId !== null
        ? growthTopProductsById.get(carrinhoId) || null
        : null;

      const indexadoBase = {
        chaveReact: getProdutoStableKey(produto),
        produto,
        nomeProduto,
        categoriaLabel,
        detalhesComerciais,
        medidaProduto,
        textoBusca,
        categoriaOriginal,
        categoriaNormalizada,
        categoriaEhBebida: categoriaNormalizada.includes(TOKEN_BEBIDA),
        estoqueInfo,
        carrinhoId,
        precoInfo,
        emPromocao: precoInfo.emPromocao,
        bebidaSubcategoriaId: getBebidaSubcategoriaIdByTexto(textoBusca),
        imagemResponsiva,
        conversaoProduto
      };

      return {
        ...indexadoBase,
        scoreMaisVendido: getScoreMaisVendido(indexadoBase),
        scoreConversao: Number(conversaoProduto?.score || 0)
      };
    });
  }, [growthTopProductsById, produtos]);

  const produtosIndexadosPorId = useMemo(() => {
    const mapa = new Map();

    produtosIndexados.forEach((item) => {
      if (item.carrinhoId !== null) {
        mapa.set(item.carrinhoId, item);
      }
    });

    return mapa;
  }, [produtosIndexados]);

  // Indexar produtos das ofertas do dia (podem não estar na lista paginada)
  const ofertasDiaIndexados = useMemo(() => {
    if (!ofertasDia.length) return [];
    return ofertasDia.map((oferta) => {
      // Normalizar campo imagem → imagem_url para compatibilidade com utilitários
      const produto = { ...oferta, imagem_url: oferta.imagem || oferta.imagem_url };
      const nomeProduto = getProdutoNome(produto);
      const categoriaLabel = getProdutoCategoriaLabel(produto);
      const detalhesComerciais = getProdutoDetalheComercial(produto);
      const medidaProduto = getProdutoMedida(produto);
      const textoBusca = getTextoProduto(produto);
      const categoriaOriginal = String(produto?.categoria || '').toLowerCase();
      const categoriaNormalizada = normalizeText(categoriaOriginal);
      const precoInfo = getProdutoPrecoInfo(produto);
      const estoqueInfo = getProdutoEstoqueInfo(produto);
      const imagemResponsiva = getProdutoImagemResponsiva(produto);
      const carrinhoId = getProdutoCarrinhoId(produto);

      const indexadoBase = {
        chaveReact: getProdutoStableKey(produto),
        produto,
        nomeProduto,
        categoriaLabel,
        detalhesComerciais,
        medidaProduto,
        textoBusca,
        categoriaOriginal,
        categoriaNormalizada,
        categoriaEhBebida: categoriaNormalizada.includes(TOKEN_BEBIDA),
        estoqueInfo,
        carrinhoId,
        precoInfo,
        emPromocao: precoInfo.emPromocao,
        bebidaSubcategoriaId: getBebidaSubcategoriaIdByTexto(textoBusca),
        imagemResponsiva,
        conversaoProduto: null
      };

      return {
        ...indexadoBase,
        scoreMaisVendido: getScoreMaisVendido(indexadoBase),
        scoreConversao: 0
      };
    });
  }, [ofertasDia]);

  const favoritosRecorrencia = useMemo(() => {
    return favoritosProdutos.slice(0, 12);
  }, [favoritosProdutos]);

  // Indexar favoritos para exibir como seção horizontal
  const favoritosIndexados = useMemo(() => {
    if (!favoritosRecorrencia.length) return [];
    return favoritosRecorrencia.map((produto) => {
      const p = { ...produto, imagem_url: produto.imagem_url || produto.imagem };
      const nomeProduto = getProdutoNome(p);
      const categoriaLabel = getProdutoCategoriaLabel(p);
      const detalhesComerciais = getProdutoDetalheComercial(p);
      const medidaProduto = getProdutoMedida(p);
      const textoBusca = getTextoProduto(p);
      const categoriaOriginal = String(p?.categoria || '').toLowerCase();
      const categoriaNormalizada = normalizeText(categoriaOriginal);
      const precoInfo = getProdutoPrecoInfo(p);
      const estoqueInfo = getProdutoEstoqueInfo(p);
      const imagemResponsiva = getProdutoImagemResponsiva(p);
      const carrinhoId = getProdutoCarrinhoId(p);

      const indexadoBase = {
        chaveReact: getProdutoStableKey(p),
        produto: p,
        nomeProduto,
        categoriaLabel,
        detalhesComerciais,
        medidaProduto,
        textoBusca,
        categoriaOriginal,
        categoriaNormalizada,
        categoriaEhBebida: categoriaNormalizada.includes(TOKEN_BEBIDA),
        estoqueInfo,
        carrinhoId,
        precoInfo,
        emPromocao: precoInfo.emPromocao,
        bebidaSubcategoriaId: getBebidaSubcategoriaIdByTexto(textoBusca),
        imagemResponsiva,
        conversaoProduto: null
      };

      return {
        ...indexadoBase,
        scoreMaisVendido: getScoreMaisVendido(indexadoBase),
        scoreConversao: 0
      };
    });
  }, [favoritosRecorrencia]);

  const recompraRecorrencia = useMemo(() => {
    return recomprasProdutos.slice(0, 12);
  }, [recomprasProdutos]);

  const listaRecorrenciaAtiva = useMemo(() => {
    switch (filtroRecorrencia) {
      case 'favoritos':
        return favoritosRecorrencia;
      case 'recompra':
        return recompraRecorrencia;
      default:
        return [];
    }
  }, [filtroRecorrencia, favoritosRecorrencia, recompraRecorrencia]);

  const idsFiltroRecorrenciaAtivos = useMemo(() => {
    return new Set(
      listaRecorrenciaAtiva
        .map((item) => getProdutoIdNormalizado(item?.id || item))
        .filter((id) => id !== null)
    );
  }, [listaRecorrenciaAtiva]);

  const abrirProdutoRecorrente = useCallback((produtoRecorrente) => {
    const id = getProdutoIdNormalizado(produtoRecorrente);
    if (id !== null) {
      const produtoIndexado = produtosIndexadosPorId.get(id);
      if (produtoIndexado) {
        abrirDetalheProduto(produtoIndexado.chaveReact);
        return;
      }
    }

    const nome = getProdutoNome(produtoRecorrente);
    setBusca(nome);
    setFiltroRecorrencia('todos');
    aplicarFeedbackRecorrencia(`Mostrando resultados para "${nome}" na vitrine.`);
  }, [aplicarFeedbackRecorrencia, abrirDetalheProduto, produtosIndexadosPorId]);

  const adicionarRecorrenteAoCarrinho = useCallback((produtoRecorrente) => {
    const nome = getProdutoNome(produtoRecorrente);
    addItem(produtoRecorrente, 1);
    registrarFeedbackAdicao(produtoRecorrente);
    registrarAcaoCarrinho(produtoRecorrente, { quantidade: 1 });
    aplicarFeedbackRecorrencia(`${nome} adicionado para recompra rapida.`);
  }, [addItem, aplicarFeedbackRecorrencia, registrarAcaoCarrinho, registrarFeedbackAdicao]);

  const produtoDetalheSelecionado = useMemo(() => {
    if (!produtoDetalheAbertoChave) {
      return null;
    }

    return produtosIndexados.find((item) => item.chaveReact === produtoDetalheAbertoChave) || null;
  }, [produtoDetalheAbertoChave, produtosIndexados]);

  useEffect(() => {
    if (!produtoDetalheAbertoChave) {
      return;
    }

    if (!produtoDetalheSelecionado) {
      setProdutoDetalheAbertoChave('');
    }
  }, [produtoDetalheAbertoChave, produtoDetalheSelecionado]);

  const drawerAberto = Boolean(produtoDetalheSelecionado);

  useEffect(() => {
    if (!produtoDetalheSelecionado) {
      return undefined;
    }

    captureCommerceEvent(
      'product_view',
      buildProductEventPayload(produtoDetalheSelecionado.produto, {
        view_context: 'produto_detalhe_drawer',
        categoria_ativa: categoria,
        filtro_recorrencia: filtroRecorrencia,
        termo_busca: termoBuscaEfetivo || null,
        ordenacao_ativa: ordenacao
      })
    );

    registrarVisualizacao(produtoDetalheSelecionado.produto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoDetalheSelecionado]);

  // Body scroll lock e Escape — depende apenas de drawer aberto/fechado
  useEffect(() => {
    if (!drawerAberto) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        fecharDetalheProduto();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerAberto, fecharDetalheProduto]);

  const categorias = useMemo(() => {
    const values = new Map();

    produtos.forEach((produto) => {
      const label = String(produto.categoria || '').trim();
      if (label) {
        const id = label.toLowerCase();
        if (!values.has(id)) {
          values.set(id, label);
        }
      }
    });

    return [
      { id: CATEGORIA_TODAS, label: 'Todas as categorias' },
      ...Array.from(values.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
        .map(([id, label]) => ({ id, label }))
    ];
  }, [produtos]);

  const termoBusca = useMemo(() => {
    const termoNormalizado = normalizeText(busca);
    if (categoriaEhBebidas && (termoNormalizado === TOKEN_BEBIDA || termoNormalizado === `${TOKEN_BEBIDA}s`)) {
      return '';
    }
    return termoNormalizado;
  }, [busca, categoriaEhBebidas]);

  const filtroPromocaoAtivo = categoria === CATEGORIA_PROMOCOES;
  const filtroCategoriaAtivo = categoria !== CATEGORIA_TODAS && !filtroPromocaoAtivo;

  // Executa busca + categoria + promocao em uma unica passagem para reduzir trabalho por interacao.
  const produtosFiltradosBase = useMemo(() => {
    const filtrados = [];

    for (const item of produtosIndexados) {
      if (filtroRecorrencia !== 'todos') {
        const idProduto = item.carrinhoId;
        if (idProduto === null || !idsFiltroRecorrenciaAtivos.has(idProduto)) {
          continue;
        }
      }

      if (termoBusca && !item.textoBusca.includes(termoBusca)) {
        continue;
      }

      if (filtroPromocaoAtivo) {
        if (!item.emPromocao) {
          continue;
        }
      } else if (filtroCategoriaAtivo) {
        if (categoria === CATEGORIA_BEBIDAS) {
          if (!item.categoriaEhBebida) {
            continue;
          }
        } else if (item.categoriaOriginal !== categoria) {
          continue;
        }
      }

      filtrados.push(item);
    }

    return filtrados;
  }, [
    categoria,
    filtroCategoriaAtivo,
    filtroPromocaoAtivo,
    filtroRecorrencia,
    idsFiltroRecorrenciaAtivos,
    produtosIndexados,
    termoBusca
  ]);

  const scoreComportamentoPorId = useMemo(() => {
    const mapa = new Map();

    const somarScore = (id, valor) => {
      const normalizedId = Number(id || 0);
      const score = Number(valor || 0);

      if (!normalizedId || !Number.isFinite(score) || score <= 0) {
        return;
      }

      mapa.set(normalizedId, Number((Number(mapa.get(normalizedId) || 0) + score).toFixed(4)));
    };

    favoritosProdutos.slice(0, 24).forEach((item, index) => {
      const id = getProdutoIdNormalizado(item);
      somarScore(id, Math.max(0.6, 6 - (index * 0.18)));
    });

    recomprasProdutos.slice(0, 28).forEach((item, index) => {
      const id = getProdutoIdNormalizado(item);
      const scoreRecorrencia = Number(item?.scoreRecorrencia || 0);
      somarScore(id, Math.max(1.1, 9 - (index * 0.24)) + Math.min(12, scoreRecorrencia * 0.35));
    });

    return mapa;
  }, [favoritosProdutos, recomprasProdutos]);

  const personalizacaoComportamentalAtiva = scoreComportamentoPorId.size > 0;

  const produtosOrdenadosIndexados = useMemo(() => {
    return sortProdutosIndexados(produtosFiltradosBase, ordenacao, {
      priorizarConversao: growthTopProductsById.size > 0,
      priorizarPersonalizacao: personalizacaoComportamentalAtiva,
      scoreComportamentoPorId
    });
  }, [
    growthTopProductsById,
    ordenacao,
    personalizacaoComportamentalAtiva,
    produtosFiltradosBase,
    scoreComportamentoPorId
  ]);

  const chavesMaisVendidos = useMemo(() => {
    const candidatosBase = produtosOrdenadosIndexados.filter((item) => item.scoreMaisVendido > 0);
    const candidatos = ordenacao === 'mais-vendidos'
      ? candidatosBase
      : [...candidatosBase].sort((a, b) => b.scoreMaisVendido - a.scoreMaisVendido);

    if (candidatos.length === 0) {
      return new Set();
    }

    const limite = Math.max(2, Math.min(12, Math.ceil(produtosOrdenadosIndexados.length * 0.18)));
    return new Set(candidatos.slice(0, limite).map((item) => item.chaveReact));
  }, [ordenacao, produtosOrdenadosIndexados]);

  const idsNovidades = useMemo(() => {
    const ids = produtosOrdenadosIndexados
      .map((item) => item.carrinhoId)
      .filter((id) => id !== null)
      .sort((a, b) => b - a);

    if (ids.length === 0) {
      return new Set();
    }

    const limite = Math.max(2, Math.min(8, Math.ceil(ids.length * 0.14)));
    return new Set(ids.slice(0, limite));
  }, [produtosOrdenadosIndexados]);

  // Lista linear consumida tanto pelo grid tradicional quanto pelo virtualizado.
  const produtosFiltradosIndexados = produtosOrdenadosIndexados;

  const primeiraImagemCatalogo = useMemo(() => {
    return String(produtosFiltradosIndexados[0]?.imagemResponsiva?.src || '').trim();
  }, [produtosFiltradosIndexados]);

  usePreloadImage(primeiraImagemCatalogo);

  // Pre-carrega o chunk do drawer apos 2s para eliminar delay no primeiro clique
  useEffect(() => {
    const timer = setTimeout(() => {
      import('../components/ProdutoDecisionDrawer').catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const deferredProdutoDetalhe = useDeferredValue(produtoDetalheSelecionado);

  const produtosRelacionadosDetalhe = useMemo(() => {
    if (!deferredProdutoDetalhe) {
      return EMPTY_RECOMENDACOES;
    }

    const base = deferredProdutoDetalhe;
    const baseMarca = normalizeText(base.produto?.marca);
    const baseCategoria = String(base.categoriaOriginal || '');
    const baseTokens = normalizeText(base.nomeProduto)
      .split(' ')
      .filter((token) => token.length >= 4);
    const pool = produtosIndexados.length > 0 ? produtosIndexados : produtosOrdenadosIndexados;
    // Limita busca aos primeiros 200 itens do pool para evitar O(n) em 21k
    const poolRelacionados = pool.length > 200 ? pool.slice(0, 200) : pool;

    const candidatos = [];

    for (const item of poolRelacionados) {
      if (item.chaveReact === base.chaveReact) {
        continue;
      }

      let score = 0;

      if (baseCategoria && item.categoriaOriginal === baseCategoria) {
        score += 6;
      }

      const marcaCandidata = normalizeText(item.produto?.marca);
      if (baseMarca && marcaCandidata && marcaCandidata === baseMarca) {
        score += 4;
      }

      if (base.categoriaEhBebida && item.bebidaSubcategoriaId === base.bebidaSubcategoriaId) {
        score += 3;
      }

      if (baseTokens.length > 0 && baseTokens.some((token) => item.textoBusca.includes(token))) {
        score += 2;
      }

      if (item.emPromocao) {
        score += 1;
      }

      if (score <= 0) {
        continue;
      }

      candidatos.push({
        item,
        score
      });
    }

    candidatos.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const promoDiff = Number(b.item.emPromocao) - Number(a.item.emPromocao);
      if (promoDiff !== 0) {
        return promoDiff;
      }

      const precoDiff = a.item.precoInfo.precoAtual - b.item.precoInfo.precoAtual;
      if (precoDiff !== 0) {
        return precoDiff;
      }

      return compareProdutosPorNome(a.item, b.item);
    });

    const selecionados = candidatos.slice(0, 6).map((entry) => entry.item);
    if (selecionados.length >= 4) {
      return selecionados;
    }

    const complemento = poolRelacionados
      .filter((item) => {
        if (item.chaveReact === base.chaveReact) {
          return false;
        }

        return !selecionados.some((selecionado) => selecionado.chaveReact === item.chaveReact);
      })
      .slice(0, Math.max(0, 6 - selecionados.length));

    return [...selecionados, ...complemento].slice(0, 6);
  }, [deferredProdutoDetalhe, produtosIndexados, produtosOrdenadosIndexados]);

  const secoesBebidas = useMemo(() => {
    if (!categoriaEhBebidas) {
      return [];
    }

    const secoesMap = new Map(
      DRINK_SECTIONS_BEBIDAS_INDEX.map((section) => [section.id, []])
    );
    const outrasBebidas = [];

    produtosFiltradosIndexados.forEach((produtoIndexado) => {
      const bucket = secoesMap.get(produtoIndexado.bebidaSubcategoriaId);
      if (bucket) {
        bucket.push(produtoIndexado);
      } else {
        outrasBebidas.push(produtoIndexado);
      }
    });

    const secoes = DRINK_SECTIONS_BEBIDAS_INDEX.map((section) => ({
      id: section.id,
      label: section.label,
      image: section.image,
      itensIndexados: secoesMap.get(section.id) || []
    })).filter((secao) => secao.itensIndexados.length > 0);

    // Não mostra seção "Outras bebidas" pois inclui produtos mal classificados pelo ERP
    // (absorventes, adaptadores, etc. que o ERP colocou em categoria='bebidas')

    return secoes;
  }, [categoriaEhBebidas, produtosFiltradosIndexados]);

  const mostrarLayoutCategorias = categoria === CATEGORIA_TODAS
    && !normalizeText(termoBuscaDigitado)
    && !categoriaEhBebidas;

  const secoesCategorias = useMemo(() => {
    if (!mostrarLayoutCategorias) {
      return [];
    }

    const secoesMap = new Map();

    produtosFiltradosIndexados.forEach((item) => {
      const catKey = item.categoriaOriginal || 'outros';
      const catLabel = item.categoriaLabel || 'Outros';

      if (!secoesMap.has(catKey)) {
        secoesMap.set(catKey, { id: catKey, label: catLabel, itensIndexados: [] });
      }

      secoesMap.get(catKey).itensIndexados.push(item);
    });

    return Array.from(secoesMap.values())
      .filter((secao) => secao.itensIndexados.length > 0)
      .map((secao) => {
        // Ordenar produtos dentro de cada categoria por estoque DESC
        secao.itensIndexados.sort((a, b) => {
          const estoqueA = Number(a.produto?.estoque || 0);
          const estoqueB = Number(b.produto?.estoque || 0);
          return estoqueB - estoqueA;
        });
        return secao;
      })
      // Ordenar categorias por estoque total (proxy de popularidade)
      .sort((a, b) => {
        const totalA = a.itensIndexados.reduce((s, i) => s + Number(i.produto?.estoque || 0), 0);
        const totalB = b.itensIndexados.reduce((s, i) => s + Number(i.produto?.estoque || 0), 0);
        return totalB - totalA;
      });
  }, [mostrarLayoutCategorias, produtosFiltradosIndexados]);

  const produtosBebidasSubcategoriaIndexados = useMemo(() => {
    if (!categoriaEhBebidas || bebidaSubcategoria === 'todas') {
      return [];
    }
    return produtosFiltradosIndexados.filter(
      (produtoIndexado) => produtoIndexado.bebidaSubcategoriaId === bebidaSubcategoria
    );
  }, [bebidaSubcategoria, categoriaEhBebidas, produtosFiltradosIndexados]);

  const gruposMarcaBebidas = useMemo(() => {
    if (!categoriaEhBebidas || bebidaSubcategoria === 'todas') {
      return [];
    }

    const defs = BRAND_GROUPS_BY_SUBCATEGORY_INDEX[bebidaSubcategoria] || [];
    const gruposComItens = defs.map((def) => ({
      id: def.id,
      label: def.label,
      image: def.image,
      matchersNormalizados: def.matchersNormalizados,
      itensIndexados: []
    }));

    const outros = [];

    produtosBebidasSubcategoriaIndexados.forEach((produtoIndexado) => {
      let pertenceAAlgumGrupo = false;

      gruposComItens.forEach((grupo) => {
        if (textoContemMatcher(produtoIndexado.textoBusca, grupo.matchersNormalizados)) {
          grupo.itensIndexados.push(produtoIndexado);
          pertenceAAlgumGrupo = true;
        }
      });

      if (!pertenceAAlgumGrupo) {
        outros.push(produtoIndexado);
      }
    });

    const grupos = gruposComItens.filter((grupo) => grupo.itensIndexados.length > 0);

    if (outros.length > 0) {
      grupos.push({
        id: 'outras-marcas',
        label: 'Outras marcas',
        image: CATEGORY_IMAGES.bebidas,
        itensIndexados: outros
      });
    }

    return grupos;
  }, [bebidaSubcategoria, categoriaEhBebidas, produtosBebidasSubcategoriaIndexados]);

  const quantidadesCarrinhoPorId = useMemo(() => {
    const mapa = new Map();

    itens.forEach((item) => {
      const id = Number(item?.id);
      if (Number.isFinite(id)) {
        mapa.set(id, Math.max(0, Number(item?.quantidade || 0)));
      }
    });

    return mapa;
  }, [itens]);

  const favoritosIdsSet = useMemo(() => {
    return new Set(favoritosIds);
  }, [favoritosIds]);

  const recompraIdsSet = useMemo(() => {
    return new Set(
      recompraRecorrencia
        .map((item) => getProdutoIdNormalizado(item?.id || item))
        .filter((id) => id !== null)
    );
  }, [recompraRecorrencia]);

  const categoriasRecompraSet = useMemo(() => {
    const cats = new Set();
    recomprasProdutos.forEach((p) => {
      const cat = normalizeText(String(p?.categoria || ''));
      if (cat) cats.add(cat);
    });
    return cats;
  }, [recomprasProdutos]);

  const deferredProdutoAdicionadoRecenteId = useDeferredValue(produtoAdicionadoRecenteId);

  const crossSellAposAdicao = useMemo(() => {
    if (deferredProdutoAdicionadoRecenteId === null) {
      return [];
    }

    const base = produtosIndexadosPorId.get(deferredProdutoAdicionadoRecenteId);
    if (!base) {
      return [];
    }

    const itensNoCarrinhoSet = new Set(
      Array.from(quantidadesCarrinhoPorId.entries())
        .filter(([, quantidade]) => Number(quantidade || 0) > 0)
        .map(([id]) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const baseMarca = normalizeText(base.produto?.marca);
    const basePreco = Number(base.precoInfo?.precoAtual || 0);

    const candidatos = [];
    // Limita busca aos primeiros 200 itens para evitar O(n) no pool inteiro
    const crossPool = produtosIndexados.length > 200 ? produtosIndexados.slice(0, 200) : produtosIndexados;

    for (const item of crossPool) {
      if (item.carrinhoId === null || item.carrinhoId === base.carrinhoId) {
        continue;
      }

      if (itensNoCarrinhoSet.has(item.carrinhoId)) {
        continue;
      }

      let score = 0;

      if (base.categoriaOriginal && item.categoriaOriginal === base.categoriaOriginal) {
        score += 8;
      }

      const marcaCandidata = normalizeText(item.produto?.marca);
      if (baseMarca && marcaCandidata && baseMarca === marcaCandidata) {
        score += 4;
      }

      if (base.categoriaEhBebida && item.bebidaSubcategoriaId === base.bebidaSubcategoriaId) {
        score += 3;
      }

      if (item.emPromocao) {
        score += 2;
      }

      if (item.scoreMaisVendido > 0) {
        score += Math.min(3, item.scoreMaisVendido);
      }

      if (item.carrinhoId !== null && idsAltaConversaoSet.has(item.carrinhoId)) {
        score += 5;
      }

      if (item.carrinhoId !== null && recompraIdsSet.has(item.carrinhoId)) {
        score += 4;
      }

      const scoreComportamento = item.carrinhoId !== null
        ? Number(scoreComportamentoPorId.get(item.carrinhoId) || 0)
        : 0;

      if (scoreComportamento > 0) {
        score += Math.min(9, scoreComportamento * 0.62);
      }

      const precoCandidato = Number(item.precoInfo?.precoAtual || 0);
      if (basePreco > 0 && precoCandidato >= basePreco * 0.35 && precoCandidato <= basePreco * 1.5) {
        score += 2;
      }

      if (score <= 0) {
        continue;
      }

      candidatos.push({ item, score, scoreComportamento });
    }

    candidatos.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const conversaoDiff = Number(b.item.scoreConversao || 0) - Number(a.item.scoreConversao || 0);
      if (conversaoDiff !== 0) {
        return conversaoDiff;
      }

      const comportamentoDiff = Number(b.scoreComportamento || 0) - Number(a.scoreComportamento || 0);
      if (comportamentoDiff !== 0) {
        return comportamentoDiff;
      }

      return compareProdutosPorNome(a.item, b.item);
    });

    return candidatos.slice(0, 4).map((entry) => entry.item);
  }, [
    idsAltaConversaoSet,
    deferredProdutoAdicionadoRecenteId,
    produtosIndexados,
    produtosIndexadosPorId,
    quantidadesCarrinhoPorId,
    recompraIdsSet,
    scoreComportamentoPorId
  ]);

  // Manter ref sincronizada com o mapa reativo para callbacks estaveis
  quantidadesCarrinhoRef.current = quantidadesCarrinhoPorId;

  const getQuantidadeProduto = useCallback((produto) => {
    const id = getProdutoCarrinhoId(produto);
    if (id === null) {
      return 0;
    }
    return quantidadesCarrinhoRef.current.get(id) || 0;
  }, []);

  const quantidadeProdutoDetalheNoCarrinho = useMemo(() => {
    if (!produtoDetalheSelecionado) {
      return 0;
    }

    return getQuantidadeProduto(produtoDetalheSelecionado.produto);
  }, [getQuantidadeProduto, produtoDetalheSelecionado]);

  const produtoDetalheFavorito = useMemo(() => {
    const id = produtoDetalheSelecionado?.carrinhoId;
    return id !== null && id !== undefined ? favoritosIdsSet.has(id) : false;
  }, [favoritosIdsSet, produtoDetalheSelecionado]);

  const isProdutoAdicionando = useCallback((produto) => {
    const carrinhoId = getProdutoCarrinhoId(produto);
    return carrinhoId !== null && adicionandoIdsRef.current.has(carrinhoId);
  }, []);

  const handleAddItem = useCallback((produto) => {
    const carrinhoId = getProdutoCarrinhoId(produto);
    if (carrinhoId === null || adicionandoIdsRef.current.has(carrinhoId)) {
      return;
    }

    adicionandoIdsRef.current.add(carrinhoId);

    addItem(produto, 1);
    registrarFeedbackAdicao(produto);
    registrarAcaoCarrinho(produto, { quantidade: 1 });
    agendarLimpezaEstadoAdicionando(carrinhoId);
  }, [addItem, agendarLimpezaEstadoAdicionando, registrarAcaoCarrinho, registrarFeedbackAdicao]);

  const handleIncreaseItem = useCallback((produto) => {
    handleAddItem(produto);
  }, [handleAddItem]);

  const handleDecreaseItem = useCallback((produto, quantidadeAtual) => {
    const id = getProdutoCarrinhoId(produto);

    if (id === null) {
      return;
    }

    if (quantidadeAtual <= 1) {
      removeItem(id);
      return;
    }

    updateItemQuantity(id, quantidadeAtual - 1);
  }, [removeItem, updateItemQuantity]);

  const renderProdutosGrid = useCallback((itensIndexados, { listId, gridClassName = 'produto-grid' } = {}) => {
    return (
      <VirtualizedProdutoGrid
        itensIndexados={itensIndexados}
        onAddItem={handleAddItem}
        onIncreaseItem={handleIncreaseItem}
        onDecreaseItem={handleDecreaseItem}
        onToggleFavorito={handleToggleFavorito}
        onOpenDetail={abrirDetalheProduto}
        getQuantidadeProduto={getQuantidadeProduto}
        chavesMaisVendidos={chavesMaisVendidos}
        idsNovidades={idsNovidades}
        favoritosIdsSet={favoritosIdsSet}
        recompraIdsSet={recompraIdsSet}
        idsAltaConversaoSet={idsAltaConversaoSet}
        categoriasRecompraSet={categoriasRecompraSet}
        growthExperimento={growthExperimento}
        produtoAdicionadoRecenteId={produtoAdicionadoRecenteId}
        isProdutoAdicionando={isProdutoAdicionando}
        listId={listId}
        gridClassName={gridClassName}
      />
    );
  }, [
    chavesMaisVendidos,
    getQuantidadeProduto,
    handleAddItem,
    handleDecreaseItem,
    handleIncreaseItem,
    handleToggleFavorito,
    abrirDetalheProduto,
    favoritosIdsSet,
    growthExperimento,
    idsAltaConversaoSet,
    categoriasRecompraSet,
    recompraIdsSet,
    idsNovidades
  ]);

  const renderCategoriaHorizontalRow = useCallback((itensIndexados) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 700;

    return (
      <div className="categoria-horizontal-scroll">
        {itensIndexados.map((produtoIndexado, index) => (
          <ProdutoCard
            key={produtoIndexado.chaveReact}
            index={index}
            isMobileViewport={isMobile}
            nextImageSrc={itensIndexados[index + 1]?.imagemResponsiva?.src || ''}
            produtoIndexado={produtoIndexado}
            estaAdicionando={isProdutoAdicionando(produtoIndexado.produto)}
            quantidadeNoCarrinho={getQuantidadeProduto(produtoIndexado.produto)}
            destaqueMaisVendido={chavesMaisVendidos.has(produtoIndexado.chaveReact)}
            destaqueNovo={
              produtoIndexado.carrinhoId !== null
              && idsNovidades.has(produtoIndexado.carrinhoId)
            }
            favorito={
              produtoIndexado.carrinhoId !== null
              && favoritosIdsSet.has(produtoIndexado.carrinhoId)
            }
            sinalRecorrente={
              produtoIndexado.carrinhoId !== null
              && recompraIdsSet.has(produtoIndexado.carrinhoId)
            }
            sinalRecomendado={
              categoriasRecompraSet.size > 0
              && produtoIndexado.carrinhoId !== null
              && !recompraIdsSet.has(produtoIndexado.carrinhoId)
              && !favoritosIdsSet.has(produtoIndexado.carrinhoId)
              && categoriasRecompraSet.has(produtoIndexado.categoriaNormalizada)
              && produtoIndexado.estoqueInfo?.semEstoque !== true
            }
            destaqueConversao={
              produtoIndexado.carrinhoId !== null
              && idsAltaConversaoSet.has(produtoIndexado.carrinhoId)
            }
            growthExperimento={growthExperimento}
            foiAdicionadoRecente={
              produtoIndexado.carrinhoId !== null
              && produtoIndexado.carrinhoId === produtoAdicionadoRecenteId
            }
            onAddItem={handleAddItem}
            onIncreaseItem={handleIncreaseItem}
            onDecreaseItem={handleDecreaseItem}
            onToggleFavorito={handleToggleFavorito}
            onOpenDetail={abrirDetalheProduto}
          />
        ))}
      </div>
    );
  }, [
    chavesMaisVendidos,
    getQuantidadeProduto,
    handleAddItem,
    handleDecreaseItem,
    handleIncreaseItem,
    handleToggleFavorito,
    abrirDetalheProduto,
    favoritosIdsSet,
    growthExperimento,
    idsAltaConversaoSet,
    idsNovidades,
    isProdutoAdicionando,
    produtoAdicionadoRecenteId,
    recompraIdsSet,
    categoriasRecompraSet
  ]);

  const totalItensVitrine = totalProdutosBackend || produtos.length;
  const totalOfertasDisponiveis = useMemo(() => {
    return produtosIndexados.filter((item) => item.emPromocao).length;
  }, [produtosIndexados]);

  const totalMaisVendidosVitrine = chavesMaisVendidos.size;
  const growthFunnelMap = useMemo(() => {
    const mapa = new Map();

    growthFunnel.forEach((stage) => {
      mapa.set(stage.id, stage);
    });

    return mapa;
  }, [growthFunnel]);
  const growthStageViewCart = growthFunnelMap.get('view_to_cart');
  const growthStageCartCheckout = growthFunnelMap.get('cart_to_checkout');
  const growthStageCheckoutPurchase = growthFunnelMap.get('checkout_to_purchase');
  const growthCheckoutEntryConfig = growthExperimento?.ui?.checkoutEntry || {
    enabled: false,
    ctaText: 'Ir para checkout',
    badgeLabel: '',
    priceHighlight: 'none'
  };
  const growthCheckoutEntryEnabled = Boolean(growthCheckoutEntryConfig.enabled);
  const growthCheckoutEntryClass = growthCheckoutEntryEnabled
    ? `is-growth-${String(growthCheckoutEntryConfig.priceHighlight || 'none').trim() || 'none'}`
    : '';
  const checkoutResumoCtaLabel = (growthCheckoutEntryEnabled && growthCheckoutEntryConfig.ctaText)
    ? growthCheckoutEntryConfig.ctaText
    : 'Ir para checkout';
  const checkoutResumoGrowthBadge = growthCheckoutEntryEnabled
    ? String(growthCheckoutEntryConfig.badgeLabel || '').trim()
    : '';
  const produtosCampeoesConversao = useMemo(() => {
    return produtosIndexados
      .filter((item) => item.carrinhoId !== null && idsAltaConversaoSet.has(item.carrinhoId))
      .sort((a, b) => Number(b.scoreConversao || 0) - Number(a.scoreConversao || 0))
      .slice(0, 6);
  }, [idsAltaConversaoSet, produtosIndexados]);
  const growthVolumeFaltanteLabel = useMemo(() => {
    const faltantes = [];

    if (Number(growthDataVolume?.missingWindowEvents || 0) > 0) {
      faltantes.push(`${growthDataVolume.missingWindowEvents} eventos na janela`);
    }

    if (Number(growthDataVolume?.missingBottleneckBase || 0) > 0) {
      faltantes.push(`${growthDataVolume.missingBottleneckBase} eventos de base no gargalo`);
    }

    if (Number(growthDataVolume?.missingBottleneckTarget || 0) > 0) {
      faltantes.push(`${growthDataVolume.missingBottleneckTarget} conversoes no gargalo`);
    }

    if (!faltantes.length) {
      return 'Amostra minima atingida para ativar mudancas.';
    }

    return `Coletando volume minimo: faltam ${faltantes.join(' • ')}.`;
  }, [growthDataVolume]);
  const growthModoLabel = growthColetaAtiva
    ? 'Coletando amostra minima'
    : (growthExperimento?.mode === 'scaled_winner'
      ? 'Escalando vencedor'
      : 'Teste semanal ativo');
  const crossSellTitulo = personalizacaoComportamentalAtiva
    ? 'Sugestoes para aumentar seu pedido'
    : 'Leve tambem';
  const temDadosRecorrencia = recorrenciaStats.favoritos > 0 || recorrenciaStats.recompra > 0;
  const filtroRecorrenciaAtivoLabel = FILTROS_RECORRENCIA.find((item) => item.id === filtroRecorrencia)?.label || 'Tudo';

  const categoriaAtualLabel = useMemo(() => {
    if (categoria === CATEGORIA_TODAS) {
      return 'Todas as categorias';
    }
    if (categoria === CATEGORIA_PROMOCOES) {
      return 'Promocoes';
    }
    return categorias.find((item) => item.id === categoria)?.label || categoria;
  }, [categoria, categorias]);

  const ordenacaoAtualLabel = useMemo(() => {
    return ORDENACOES_PRODUTOS.find((item) => item.id === ordenacao)?.label || ordenacao;
  }, [ordenacao]);

  const bebidaSubcategoriaLabel = useMemo(() => {
    if (bebidaSubcategoria === 'todas') {
      return 'Todas';
    }

    const label = secoesBebidas.find((item) => item.id === bebidaSubcategoria)?.label;
    if (label) {
      return label;
    }

    return String(bebidaSubcategoria || '').replace(/-/g, ' ');
  }, [bebidaSubcategoria, secoesBebidas]);

  const filtrosAplicados = Boolean(normalizeText(termoBuscaDigitado))
    || categoria !== CATEGORIA_TODAS
    || bebidaSubcategoria !== 'todas';

  const podeFinalizarPedido = resumo.itens > 0;
  const itensResumoTexto = resumo.itens === 1 ? '1 item' : `${resumo.itens} itens`;
  const subtotalTexto = formatCurrency(resumo.total);

  const mostrarSkeletonInicial = carregando && produtos.length === 0;
  const mostrarErro = Boolean(erro) && !carregando;

  const renderSemResultados = useCallback((titulo, descricao) => {
    return (
      <div className="products-empty-state" role="status" aria-live="polite">
        <span className="products-empty-icon" aria-hidden="true">🔍</span>
        <h2>{titulo}</h2>
        <p>{descricao}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleLimparFiltros}
          disabled={!filtrosAplicados}
        >
          Limpar filtros
        </button>
      </div>
    );
  }, [filtrosAplicados, handleLimparFiltros]);

  const conteudoProdutos = useMemo(() => {
  if (mostrarSkeletonInicial) {
    return <ProdutosSkeletonGrid quantidade={10} />;
  } else if (mostrarErro) {
    return (
      <div className="products-error-state" role="alert">
        <span className="products-error-icon" aria-hidden="true">⚠️</span>
        <div>
          <h2>Não foi possível carregar os produtos</h2>
          <p>{erro || 'Tente novamente em alguns instantes.'}</p>
        </div>
        <button className="btn-secondary" type="button" onClick={handleAtualizarProdutos}>
          Tentar novamente
        </button>
      </div>
    );
  } else if (produtosFiltradosIndexados.length === 0) {
    return renderSemResultados(
      'Nenhum produto encontrado',
      termoBuscaDigitado
        ? `Nao encontramos resultados para "${termoBuscaDigitado}". Tente outro termo ou limpe os filtros para ampliar a vitrine.`
        : 'Tente buscar outro termo ou ajuste os filtros para ver mais opcoes.'
    );
  } else if (categoriaEhBebidas) {
    if (bebidaSubcategoria === 'todas') {
      return secoesBebidas.length > 0
        ? (
          <div className="brand-sections-list" id="produtos-lista">
            {secoesBebidas.map((secao) => (
              <section className="brand-section" key={secao.id} aria-label={`Produtos da categoria ${secao.label}`}>
                <div className="brand-section-banner" style={{ '--brand-bg': `url('${secao.image}')` }}>
                  <h2>{secao.label}</h2>
                  <p>{secao.itensIndexados.length} itens nesta categoria</p>
                </div>
                {renderProdutosGrid(secao.itensIndexados, {
                  gridClassName: 'produto-grid brand-produto-grid'
                })}
              </section>
            ))}
          </div>
        )
        : renderSemResultados(
          'Nenhuma bebida encontrada',
          'Não encontramos bebidas para os filtros atuais.'
        );
    } else {
      return gruposMarcaBebidas.length > 0
        ? (
          <div className="brand-sections-list" id="produtos-lista">
            {gruposMarcaBebidas.map((grupo) => (
              <section className="brand-section" key={grupo.id} aria-label={`Produtos da marca ${grupo.label}`}>
                <div className="brand-section-banner" style={{ '--brand-bg': `url('${grupo.image}')` }}>
                  <h2>{grupo.label}</h2>
                  <p>{grupo.itensIndexados.length} itens nesta seleção</p>
                </div>
                {renderProdutosGrid(grupo.itensIndexados, {
                  gridClassName: 'produto-grid brand-produto-grid'
                })}
              </section>
            ))}
          </div>
        )
        : renderSemResultados(
          'Nenhum item nesta subcategoria',
          'Escolha outra subcategoria de bebidas para continuar navegando.'
        );
    }
  } else if (mostrarLayoutCategorias && secoesCategorias.length > 0) {
    return (
      <div className="categorias-horizontal-list" id="produtos-lista">
        {favoritosIndexados.length > 0 && (
          <section className="categoria-horizontal-section" aria-label="Seus Favoritos">
            <div className="categoria-horizontal-header">
              <h2 className="categoria-horizontal-titulo">❤️ Favoritos</h2>
              <span className="categoria-horizontal-count">{favoritosIndexados.length} {favoritosIndexados.length === 1 ? 'produto' : 'produtos'}</span>
            </div>
            {renderCategoriaHorizontalRow(favoritosIndexados)}
          </section>
        )}
        {ofertasDiaIndexados.length > 0 && (
          <section className="categoria-horizontal-section" aria-label="Ofertas do Dia">
            <div className="categoria-horizontal-header">
              <h2 className="categoria-horizontal-titulo">🔥 Ofertas do Dia</h2>
              <span className="categoria-horizontal-count">{ofertasDiaIndexados.length} {ofertasDiaIndexados.length === 1 ? 'oferta' : 'ofertas'}</span>
            </div>
            {renderCategoriaHorizontalRow(ofertasDiaIndexados)}
          </section>
        )}
        {secoesCategorias.map((secao) => (
          <section className="categoria-horizontal-section" key={secao.id} aria-label={`Categoria ${secao.label}`}>
            <div className="categoria-horizontal-header">
              <h2 className="categoria-horizontal-titulo">{secao.label}</h2>
              <span className="categoria-horizontal-count">{secao.itensIndexados.length} {secao.itensIndexados.length === 1 ? 'produto' : 'produtos'}</span>
            </div>
            {renderCategoriaHorizontalRow(secao.itensIndexados)}
          </section>
        ))}
      </div>
    );
  } else {
    return renderProdutosGrid(produtosFiltradosIndexados, { listId: 'produtos-lista' });
  }
  return null;
  }, [
    bebidaSubcategoria,
    categoriaEhBebidas,
    erro,
    favoritosIndexados,
    gruposMarcaBebidas,
    handleAtualizarProdutos,
    mostrarErro,
    mostrarLayoutCategorias,
    mostrarSkeletonInicial,
    ofertasDiaIndexados,
    produtosFiltradosIndexados,
    renderCategoriaHorizontalRow,
    renderProdutosGrid,
    renderSemResultados,
    secoesCategorias,
    secoesBebidas,
    termoBuscaDigitado
  ]);

  return (
    <section className="page page-produtos">
      <section className="products-hero products-hero-clean" id="produtos" aria-label="Pagina de produtos">

        <div className="products-search-wrap">
          <div className="products-search-input-wrap">
            <svg className="products-search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="busca-produtos"
              className="field-input products-search-input"
              type="search"
              value={busca}
              onChange={handleBuscaChange}
              placeholder="Buscar produtos..."
              aria-label="Buscar produtos"
            />

            {termoBuscaDigitado ? (
              <button
                type="button"
                className="products-search-clear"
                onClick={handleLimparBusca}
                aria-label="Limpar busca"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>

        <nav className="products-quick-categories" aria-label="Categorias rapidas">
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: '', categoria: CATEGORIA_PROMOCOES })}>
            <span className="products-quick-cat-icon">🏷️</span>
            <span className="products-quick-cat-label">Ofertas</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'arroz', categoria: CATEGORIA_TODAS })}>
            <span className="products-quick-cat-icon">🍚</span>
            <span className="products-quick-cat-label">Arroz</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'leite', categoria: CATEGORIA_TODAS })}>
            <span className="products-quick-cat-icon">🥛</span>
            <span className="products-quick-cat-label">Leite</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'cafe', categoria: CATEGORIA_TODAS })}>
            <span className="products-quick-cat-icon">☕</span>
            <span className="products-quick-cat-label">Cafe</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'bebida', categoria: CATEGORIA_BEBIDAS })}>
            <span className="products-quick-cat-icon">🥤</span>
            <span className="products-quick-cat-label">Bebidas</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'limpeza', categoria: 'limpeza' })}>
            <span className="products-quick-cat-icon">🧹</span>
            <span className="products-quick-cat-label">Limpeza</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'higiene', categoria: CATEGORIA_TODAS })}>
            <span className="products-quick-cat-icon">🧴</span>
            <span className="products-quick-cat-label">Higiene</span>
          </button>
          <button type="button" className="products-quick-cat-item" onClick={() => handleAplicarSugestaoBusca({ termo: 'feira', categoria: CATEGORIA_TODAS })}>
            <span className="products-quick-cat-icon">🥬</span>
            <span className="products-quick-cat-label">Feira</span>
          </button>
        </nav>

        {buscaEmAtualizacao ? (
          <div className="products-search-meta" aria-live="polite">
            <span className="products-results-pill">Atualizando busca...</span>
          </div>
        ) : termoBuscaEfetivo ? (
          <div className="products-search-meta" aria-live="polite">
            <p>Resultados para <strong>"{termoBuscaEfetivo}"</strong></p>
          </div>
        ) : null}

        {categoriaEhBebidas ? (
          <div className="bebidas-subcats" aria-label="Subcategorias de bebidas">
            <p className="bebidas-subcats-title">Subcategorias de bebidas</p>
            <div className="bebidas-subcats-actions">
              <button
                type="button"
                className={`category-btn-react ${bebidaSubcategoria === 'todas' ? 'active' : ''}`}
                onClick={() => setBebidaSubcategoria('todas')}
                aria-pressed={bebidaSubcategoria === 'todas'}
              >
                Todas
              </button>
              {secoesBebidas.map((secao) => (
                <button
                  key={secao.id}
                  type="button"
                  className={`category-btn-react ${bebidaSubcategoria === secao.id ? 'active' : ''}`}
                  onClick={() => setBebidaSubcategoria(secao.id)}
                  aria-pressed={bebidaSubcategoria === secao.id}
                >
                  {secao.label} ({secao.itensIndexados.length})
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {filtrosAplicados ? (
          <div className="products-active-filters" aria-label="Filtros ativos">
            {termoBuscaDigitado ? (
              <button type="button" className="products-active-filter-chip" onClick={handleLimparBusca}>
                Busca: "{termoBuscaDigitado}" <span aria-hidden="true">×</span>
              </button>
            ) : null}

            {categoria !== CATEGORIA_TODAS ? (
              <button
                type="button"
                className="products-active-filter-chip"
                onClick={() => setCategoria(CATEGORIA_TODAS)}
              >
                Categoria: {categoriaAtualLabel} <span aria-hidden="true">×</span>
              </button>
            ) : null}

            {bebidaSubcategoria !== 'todas' ? (
              <button
                type="button"
                className="products-active-filter-chip"
                onClick={() => setBebidaSubcategoria('todas')}
              >
                Subcategoria: {bebidaSubcategoriaLabel} <span aria-hidden="true">×</span>
              </button>
            ) : null}

            <button type="button" className="products-active-filter-chip is-clear-all" onClick={handleLimparFiltros}>
              Limpar tudo
            </button>
          </div>
        ) : null}

        <div className="products-results-bar products-results-bar-clean" aria-live="polite">
          <p>
            <strong>{produtosFiltradosIndexados.length}</strong> produtos
            {totalProdutosBackend > 0 ? ` de ${totalProdutosBackend}` : ''}
            {totalOfertasDisponiveis > 0 ? ` · ${totalOfertasDisponiveis} em oferta` : ''}
          </p>
          {(carregando && produtos.length > 0) || buscaEmAtualizacao ? (
            <span className="products-results-pill">Atualizando...</span>
          ) : null}
        </div>
      </section>

      {conteudoProdutos}

      {temMaisProdutos ? (
        <div className="card-box products-load-more">
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              void handleCarregarMais();
            }}
            disabled={carregandoMais || carregando}
          >
            {carregandoMais ? 'Carregando mais produtos...' : 'Ver mais produtos'}
          </button>
        </div>
      ) : null}

      {produtoDetalheSelecionado ? (
        <React.Suspense
          fallback={(
            <div className="product-detail-overlay" role="presentation" onClick={fecharDetalheProduto}>
              <aside
                className="product-detail-drawer"
                role="status"
                aria-live="polite"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="product-detail-header">
                  <div>
                    <p className="product-detail-kicker">Carregando detalhes</p>
                    <h2>Aguarde um instante...</h2>
                  </div>
                </header>
              </aside>
            </div>
          )}
        >
          <ProdutoDecisionDrawer
            produtoIndexado={produtoDetalheSelecionado}
            quantidadeNoCarrinho={quantidadeProdutoDetalheNoCarrinho}
            favorito={produtoDetalheFavorito}
            recomendacoes={produtosRelacionadosDetalhe}
            onClose={fecharDetalheProduto}
            onAddItem={handleAddItem}
            onIncreaseItem={handleIncreaseItem}
            onDecreaseItem={handleDecreaseItem}
            onToggleFavorito={handleToggleFavorito}
            isAddingItem={isProdutoAdicionando}
            getQuantidadeProduto={getQuantidadeProduto}
            onOpenDetail={abrirDetalheProduto}
            formatCurrency={formatCurrency}
            getProdutoMedida={getProdutoMedida}
            getProdutoBadges={getProdutoBadges}
            ProdutoBadgeComponent={ProdutoBadge}
            ProdutoImageFallbackComponent={ProdutoImageFallback}
            getPlaceholderIconePorCategoria={getPlaceholderIconePorCategoria}
          />
        </React.Suspense>
      ) : null}

      <div className="pedido-resumo pedido-resumo-fixo pedido-resumo-fixo-clean" role="region" aria-label="Resumo do pedido">
        <div className="pedido-resumo-fixo-conteudo">
          <div className="pedido-resumo-fixo-info" title={`Itens: ${resumo.itens} | Total: ${subtotalTexto}`}>
            <p className="pedido-resumo-fixo-linha">
              <strong>{itensResumoTexto}</strong>
              <span className="pedido-resumo-fixo-separador" aria-hidden="true">·</span>
              <span>{subtotalTexto}</span>
            </p>
            {produtoAdicionadoRecenteNome ? (
              <p className="pedido-resumo-fixo-feedback" role="status" aria-live="polite">
                + {produtoAdicionadoRecenteNome}
              </p>
            ) : null}
          </div>

          {podeFinalizarPedido ? (
            <Link to="/pagamento" className="btn-primary pedido-resumo-fixo-botao">
              Finalizar pedido
            </Link>
          ) : (
            <button type="button" className="btn-primary pedido-resumo-fixo-botao" disabled>
              Adicione itens
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

