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
import { getCategoriasAtivas, getOfertasDia } from '../lib/api';
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
  getSubcategoriaId,
  getSubcategoriasComContagem,
  SUBCATEGORIAS_POR_CATEGORIA
} from '../lib/subcategoriaHelpers';
import {
  CATEGORIA_CERVEJAS,
  CATEGORIAS_PRINCIPAIS_NAVEGACAO,
  classifyCategoriaComercial,
  resolveCategoriaPrincipalVitrine
} from '../lib/categoryUtils';
import {
  CATEGORIA_TODAS,
  CATEGORIA_PROMOCOES,
  CATEGORIA_BEBIDAS,
  CATEGORIA_FRIOS,
  TOKEN_BEBIDA,
  PRODUTOS_POR_PAGINA,
  DRINK_SECTIONS_BEBIDAS,
  BRAND_GROUPS_BY_SUBCATEGORY,
  FRIOS_SECTIONS,
  SUBCATEGORIA_TO_SUPER,
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
  FRIOS_SECTIONS_INDEX,
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
  isFriosCategoria,
  getCategoriaAgrupada,
  getCategoriaVitrineDefensiva,
  getTextoProduto,
  textoContemMatcher,
  getBebidaSubcategoriaIdByTexto,
  getFriosSubcategoriaIdByTexto,
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
  RecorrenciaMiniCard,
  CategoryNav,
  SubcategoryNav,
  CategorySection
} from '../components/produtos';

const ProdutoDecisionDrawer = React.lazy(() => import('../components/ProdutoDecisionDrawer'));

const CategoriaHorizontalRail = React.memo(function CategoriaHorizontalRail({
  itensIndexados = [],
  onWheel,
  renderCard,
  exibirBarraMobile = false
}) {
  const trilhoRef = useRef(null);
  const snapTimeoutRef = useRef(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);

  const sincronizarMetricas = useCallback(() => {
    const elemento = trilhoRef.current;
    if (!elemento) {
      setMaxScroll(0);
      setScrollPos(0);
      return;
    }

    const maxAtual = Math.max(0, elemento.scrollWidth - elemento.clientWidth);
    const scrollAtual = Math.max(0, Math.min(maxAtual, elemento.scrollLeft));
    setMaxScroll(maxAtual);
    setScrollPos(scrollAtual);
  }, []);

  useEffect(() => {
    sincronizarMetricas();
    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('resize', sincronizarMetricas);
    return () => {
      window.removeEventListener('resize', sincronizarMetricas);
    };
  }, [itensIndexados, sincronizarMetricas]);

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  const snapParaCardMaisProximo = useCallback(() => {
    const elemento = trilhoRef.current;
    if (!elemento) {
      return;
    }

    const cards = elemento.querySelectorAll('.produto-card');
    if (!cards.length) {
      return;
    }

    const scrollAtual = Math.max(0, elemento.scrollLeft);
    let offsetMaisProximo = 0;
    let distanciaMaisProxima = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
      const offset = Number(card?.offsetLeft || 0);
      const distancia = Math.abs(offset - scrollAtual);
      if (distancia < distanciaMaisProxima) {
        distanciaMaisProxima = distancia;
        offsetMaisProximo = offset;
      }
    });

    elemento.scrollTo({
      left: offsetMaisProximo,
      behavior: 'smooth'
    });
  }, []);

  const agendarSnap = useCallback(() => {
    if (!exibirBarraMobile) {
      return;
    }

    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current);
    }

    snapTimeoutRef.current = setTimeout(() => {
      snapParaCardMaisProximo();
    }, 140);
  }, [exibirBarraMobile, snapParaCardMaisProximo]);

  const handleScroll = useCallback((event) => {
    const elemento = event.currentTarget;
    const maxAtual = Math.max(0, elemento.scrollWidth - elemento.clientWidth);
    setMaxScroll(maxAtual);
    setScrollPos(Math.max(0, Math.min(maxAtual, elemento.scrollLeft)));
    agendarSnap();
  }, [agendarSnap]);

  const handleRangeChange = useCallback((event) => {
    const elemento = trilhoRef.current;
    if (!elemento) {
      return;
    }

    const proximoValor = Number(event.target.value || 0);
    elemento.scrollLeft = proximoValor;
    setScrollPos(proximoValor);
  }, []);

  const handleRangeCommit = useCallback(() => {
    snapParaCardMaisProximo();
  }, [snapParaCardMaisProximo]);

  const mostrarBarraRange = exibirBarraMobile && maxScroll > 0;

  return (
    <div className="categoria-horizontal-rail">
      <div
        ref={trilhoRef}
        className="categoria-horizontal-scroll"
        onWheel={onWheel}
        onScroll={handleScroll}
      >
        {itensIndexados.map((produtoIndexado, index) => renderCard(produtoIndexado, index))}
      </div>

      {mostrarBarraRange ? (
        <input
          type="range"
          className="categoria-horizontal-range"
          min={0}
          max={maxScroll}
          step={1}
          value={scrollPos}
          onChange={handleRangeChange}
          onMouseUp={handleRangeCommit}
          onTouchEnd={handleRangeCommit}
          onKeyUp={handleRangeCommit}
          aria-label="Deslizar produtos da categoria"
        />
      ) : null}
    </div>
  );
});


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
  const [categoriaNavAtiva, setCategoriaNavAtiva] = useState(categoriaInicial || CATEGORIA_TODAS);
  const [ordenacao, setOrdenacao] = useState(ORDENACOES_PRODUTOS[0].id);
  const [bebidaSubcategoria, setBebidaSubcategoria] = useState('todas');
  const [friosSubcategoria, setFriosSubcategoria] = useState('todas');
  const [subcategoriaAtiva, setSubcategoriaAtiva] = useState('todas');
  const [subcategoriaNavAtiva, setSubcategoriaNavAtiva] = useState('todas');
  const [categoriaExpandida, setCategoriaExpandida] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMaisProdutos, setTemMaisProdutos] = useState(false);
  const [totalProdutosBackend, setTotalProdutosBackend] = useState(0);
  const [produtoAdicionadoRecenteId, setProdutoAdicionadoRecenteId] = useState(null);
  const [produtoDetalheAbertoChave, setProdutoDetalheAbertoChave] = useState('');
  const [filtroRecorrencia, setFiltroRecorrencia] = useState(
    FILTROS_RECORRENCIA.some((item) => item.id === filtroRecorrenciaInicial)
      ? filtroRecorrenciaInicial
      : 'todos'
  );
  const [feedbackRecorrencia, setFeedbackRecorrencia] = useState('');
  const [growthVersion, setGrowthVersion] = useState(0);
  const [ofertasDia, setOfertasDia] = useState([]);
  const [categoriasCatalogo, setCategoriasCatalogo] = useState([]);
  const [totaisCategoriasVitrine, setTotaisCategoriasVitrine] = useState({});
  const [secoesCategoriaExpandidas, setSecoesCategoriaExpandidas] = useState({});
  const requisicaoProdutosIdRef = useRef(0);
  const limparFeedbackAdicaoRef = useRef(null);
  const limparFeedbackRecorrenciaRef = useRef(null);
  const adicionandoIdsRef = useRef(new Set());
  const sectionRefsMap = useRef({});
  const sectionRefsSubcategoriaMap = useRef({});
  const sectionTopoSubcategoriasRef = useRef(null);
  const prefetchCategoriasVitrineRef = useRef(new Set());
  const limparAdicionandoTimersRef = useRef(new Map());
  const quantidadesCarrinhoRef = useRef(new Map());
  const prefetchProdutosCacheRef = useRef(new Map());
  const prefetchEmAndamentoRef = useRef(new Set());
  const produtosSnapshotRef = useRef([]);
  const falhasConsecutivasProdutosRef = useRef(0);
  const buscaDebounced = useDebouncedValue(busca, 280);
  const termoBuscaDigitado = String(busca || '').trim();
  const termoBuscaEfetivo = String(buscaDebounced || '').trim();
  const buscaEmAtualizacao = normalizeText(termoBuscaDigitado) !== normalizeText(termoBuscaEfetivo);
  const categoriaEhBebidas = useMemo(() => isBebidasCategoria(categoria), [categoria]);
  const categoriaEhFrios = useMemo(() => isFriosCategoria(categoria), [categoria]);
  const exibirVisaoCategoriaDetalhe = categoria !== CATEGORIA_TODAS
    && categoria !== CATEGORIA_PROMOCOES
    && !normalizeText(termoBuscaEfetivo);
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
      checkoutPayment: { enabled: false, ctaPrefix: 'Ver carrinho', badgeLabel: '', priceHighlight: 'none' }
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
    const categoriaParamRaw = String(searchParams.get('categoria') || CATEGORIA_TODAS).toLowerCase();
    const categoriaParam = categoriaParamRaw === CATEGORIA_TODAS || categoriaParamRaw === CATEGORIA_PROMOCOES
      ? categoriaParamRaw
      : resolveCategoriaPrincipalVitrine(categoriaParamRaw);
    setCategoria(categoriaParam);
    setCategoriaNavAtiva(categoriaParam || CATEGORIA_TODAS);
    setSubcategoriaNavAtiva('todas');

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
    let cancelado = false;

    getCategoriasAtivas()
      .then((data) => {
        if (cancelado) {
          return;
        }

        const categoriasBrutas = Array.isArray(data?.categorias) ? data.categorias : [];
        const categoriasNormalizadas = Array.from(new Set(
          categoriasBrutas
            .map((categoriaRaw) => {
              const categoriaAgrupada = getCategoriaAgrupada(String(categoriaRaw || '').trim().toLowerCase());
              return resolveCategoriaPrincipalVitrine(categoriaAgrupada);
            })
            .filter(Boolean)
            .filter((categoriaId) => categoriaId !== CATEGORIA_TODAS && categoriaId !== CATEGORIA_PROMOCOES)
        ));

        setCategoriasCatalogo(categoriasNormalizadas);
      })
      .catch(() => {
        if (!cancelado) {
          setCategoriasCatalogo([]);
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!categoriaEhBebidas) {
      setBebidaSubcategoria('todas');
    }
  }, [categoriaEhBebidas]);

  useEffect(() => {
    if (!categoriaEhFrios) {
      setFriosSubcategoria('todas');
    }
  }, [categoriaEhFrios]);

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
    produtosSnapshotRef.current = produtos;
  }, [produtos]);

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
      const detalheCategoriaAtivo = categoriaEfetiva !== CATEGORIA_TODAS
        && categoriaEfetiva !== CATEGORIA_PROMOCOES
        && categoriaEfetiva === categoriaNavAtiva;
      const categoriaPrecisaAmostraAmpla = !buscaEfetiva && (
        categoriaEfetiva === CATEGORIA_TODAS
        || categoriaEfetiva === CATEGORIA_CERVEJAS
        || detalheCategoriaAtivo
      );
      const limiteEfetivo = categoriaPrecisaAmostraAmpla ? 200 : PRODUTOS_POR_PAGINA;
      let respostaProdutos = null;
      let erroTentativa = null;

      // Retry silencioso para reduzir intermitência em falhas transitórias de rede/5xx.
      for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
        try {
          respostaProdutos = await fetchProdutosPage({
            categoria: categoriaEfetiva,
            busca: buscaEfetiva,
            page: pagina,
            limit: limiteEfetivo
          });
          erroTentativa = null;
          break;
        } catch (errorFetch) {
          erroTentativa = errorFetch;
          const statusErro = Number(errorFetch?.status || 0);
          const mensagemErro = String(errorFetch?.message || '').toLowerCase();
          const erroRecuperavel = statusErro === 0
            || statusErro >= 500
            || mensagemErro.includes('network')
            || mensagemErro.includes('failed to fetch');

          if (tentativa < 2 && erroRecuperavel) {
            await new Promise((resolve) => setTimeout(resolve, 180));
            continue;
          }

          throw errorFetch;
        }
      }

      if (!respostaProdutos && erroTentativa) {
        throw erroTentativa;
      }

      const { lista, paginacao } = respostaProdutos || { lista: [], paginacao: {} };

      if (requestId !== requisicaoProdutosIdRef.current) {
        return;
      }

      setProdutos((atual) => (append ? mergeProdutosById(atual, lista) : lista));
      setPaginaAtual(Number(paginacao.pagina || pagina));
      setTemMaisProdutos(Boolean(paginacao.tem_mais));
      setTotalProdutosBackend(Number(paginacao.total || lista.length));
      falhasConsecutivasProdutosRef.current = 0;

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

      const falhasConsecutivas = ++falhasConsecutivasProdutosRef.current;
      const status = Number(error?.status || 0);
      const erroFatal = status >= 500 || status === 0;
      const listaAnterior = Array.isArray(produtosSnapshotRef.current)
        ? produtosSnapshotRef.current
        : [];
      const tinhaConteudoAnterior = listaAnterior.length > 0;

      setErro(error.message);

      if (!append) {
        if (!tinhaConteudoAnterior) {
          setProdutos([]);
          setPaginaAtual(1);
          setTemMaisProdutos(false);
          setTotalProdutosBackend(0);
        } else if (erroFatal && falhasConsecutivas >= 3) {
          setProdutos([]);
          setPaginaAtual(1);
          setTemMaisProdutos(false);
          setTotalProdutosBackend(0);
          setErro('Nao foi possivel atualizar os produtos apos varias tentativas.');
        } else {
          setErro('Instabilidade na atualizacao. Exibindo os ultimos produtos carregados.');
        }
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
  }, [buscaDebounced, categoria, categoriaNavAtiva, prefetchProximaPagina]);

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
    const categoriaAlvoRaw = String(event.target.value || CATEGORIA_TODAS).toLowerCase();
    const categoriaAlvo = categoriaAlvoRaw === CATEGORIA_TODAS || categoriaAlvoRaw === CATEGORIA_PROMOCOES
      ? categoriaAlvoRaw
      : resolveCategoriaPrincipalVitrine(categoriaAlvoRaw);
    setCategoria(categoriaAlvo);
    setCategoriaNavAtiva(categoriaAlvo);
    setSubcategoriaAtiva('todas');
    setSubcategoriaNavAtiva('todas');
    setBebidaSubcategoria('todas');
    setFriosSubcategoria('todas');
  }, []);

  const handleOrdenacaoChange = useCallback((event) => {
    setOrdenacao(String(event.target.value));
  }, []);

  const handleCategoriaLegadoClick = useCallback((categoriaId) => {
    const categoriaAlvoRaw = String(categoriaId || CATEGORIA_TODAS).toLowerCase();
    const categoriaAlvo = categoriaAlvoRaw === CATEGORIA_TODAS || categoriaAlvoRaw === CATEGORIA_PROMOCOES
      ? categoriaAlvoRaw
      : resolveCategoriaPrincipalVitrine(categoriaAlvoRaw);
    setCategoriaNavAtiva(categoriaAlvo);
    setSubcategoriaNavAtiva('todas');
    setSubcategoriaAtiva('todas');
    setCategoriaExpandida(null);
    setBebidaSubcategoria('todas');
    setFriosSubcategoria('todas');
    setBusca('');

    if (categoriaAlvo === CATEGORIA_TODAS) {
      setCategoria(CATEGORIA_TODAS);
      return;
    }

    if (categoriaAlvo === CATEGORIA_PROMOCOES) {
      setCategoria(CATEGORIA_PROMOCOES);
      return;
    }

    setCategoria(categoriaAlvo);
  }, []);

  const handleLimparFiltros = useCallback(() => {
    setBusca('');
    setCategoria(CATEGORIA_TODAS);
    setCategoriaNavAtiva(CATEGORIA_TODAS);
    setOrdenacao(ORDENACOES_PRODUTOS[0].id);
    setBebidaSubcategoria('todas');
    setFriosSubcategoria('todas');
    setSubcategoriaAtiva('todas');
    setSubcategoriaNavAtiva('todas');
    setCategoriaExpandida(null);
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
    const categoriaAlvoRaw = String(categoriaSugestao || CATEGORIA_TODAS).toLowerCase();
    const categoriaAlvo = categoriaAlvoRaw === CATEGORIA_TODAS || categoriaAlvoRaw === CATEGORIA_PROMOCOES
      ? categoriaAlvoRaw
      : resolveCategoriaPrincipalVitrine(categoriaAlvoRaw);
    setCategoria(categoriaAlvo);
    setCategoriaNavAtiva(categoriaAlvo);
    setBusca(String(termo || ''));
    setSubcategoriaAtiva('todas');
    setSubcategoriaNavAtiva('todas');
    setCategoriaExpandida(null);
    if (categoriaSugestao !== CATEGORIA_BEBIDAS) {
      setBebidaSubcategoria('todas');
    }
    if (categoriaSugestao !== CATEGORIA_FRIOS) {
      setFriosSubcategoria('todas');
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

    limparFeedbackAdicaoRef.current = setTimeout(() => {
      setProdutoAdicionadoRecenteId(null);
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
      const categoriaOriginal = String(produto?.departamento || produto?.categoria || '').trim().toLowerCase();
      const categoriaNormalizada = normalizeText(categoriaOriginal);
      const precoInfo = getProdutoPrecoInfo(produto);
      const estoqueInfo = getProdutoEstoqueInfo(produto);
      const imagemResponsiva = getProdutoImagemResponsiva(produto);
      const carrinhoId = getProdutoCarrinhoId(produto);
      const conversaoProduto = carrinhoId !== null
        ? growthTopProductsById.get(carrinhoId) || null
        : null;

      const catAgrupada = getCategoriaAgrupada(categoriaOriginal);
      const categoriaComercial = classifyCategoriaComercial({
        categoriaAgrupada: catAgrupada,
        textoBusca
      });
      const categoriaVitrineBase = getCategoriaVitrineDefensiva({
        categoriaAgrupada: categoriaComercial,
        categoriaOriginal,
        textoBusca
      });
      const categoriaVitrine = resolveCategoriaPrincipalVitrine(categoriaVitrineBase, textoBusca);
      const subcategoriaVitrineId = getSubcategoriaId(textoBusca, categoriaVitrine);

      const indexadoBase = {
        chaveReact: getProdutoStableKey(produto),
        produto,
        nomeProduto,
        categoriaLabel,
        detalhesComerciais,
        medidaProduto,
        textoBusca,
        categoriaOriginal,
        categoriaAgrupada: categoriaComercial,
        categoriaVitrine,
        categoriaNormalizada,
        categoriaEhBebida: categoriaNormalizada.includes(TOKEN_BEBIDA),
        estoqueInfo,
        carrinhoId,
        precoInfo,
        emPromocao: precoInfo.emPromocao,
        bebidaSubcategoriaId: getBebidaSubcategoriaIdByTexto(textoBusca),
        friosSubcategoriaId: getFriosSubcategoriaIdByTexto(textoBusca),
        _subcategoriaId: subcategoriaVitrineId,
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
      const categoriaOriginal = String(produto?.departamento || produto?.categoria || '').trim().toLowerCase();
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
      const categoriaOriginal = String(p?.departamento || p?.categoria || '').trim().toLowerCase();
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
          if (item.categoriaVitrine !== CATEGORIA_BEBIDAS) {
            continue;
          }
        } else if (
          item.categoriaVitrine !== categoria
          && item.categoriaAgrupada !== categoria
          && item.categoriaOriginal !== categoria
        ) {
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

  const secoesFrios = useMemo(() => {
    if (!categoriaEhFrios) {
      return [];
    }

    const secoesMap = new Map(
      FRIOS_SECTIONS_INDEX.map((section) => [section.id, []])
    );

    produtosFiltradosIndexados.forEach((produtoIndexado) => {
      const bucket = secoesMap.get(produtoIndexado.friosSubcategoriaId);
      if (bucket) {
        bucket.push(produtoIndexado);
      }
    });

    return FRIOS_SECTIONS_INDEX.map((section) => ({
      id: section.id,
      label: section.label,
      itensIndexados: secoesMap.get(section.id) || []
    })).filter((secao) => secao.itensIndexados.length > 0);
  }, [categoriaEhFrios, produtosFiltradosIndexados]);

  const mostrarLayoutCategorias = categoria === CATEGORIA_TODAS
    && !normalizeText(termoBuscaDigitado)
    && !categoriaEhBebidas
    && !categoriaEhFrios;

  const ORDEM_CATEGORIAS_VITRINE = CATEGORIAS_PRINCIPAIS_NAVEGACAO.map((item) => item.id);
  const categoriasVitrineIds = ORDEM_CATEGORIAS_VITRINE;

  const categoriaLabelById = useMemo(() => {
    return new Map(
      CATEGORIAS_LEGADO
        .filter((cat) => cat.id !== CATEGORIA_TODAS && cat.id !== CATEGORIA_PROMOCOES)
        .map((cat) => [cat.id, cat.label])
    );
  }, []);

  const formatCategoriaLabel = useCallback((categoriaId) => {
    const fromMap = categoriaLabelById.get(categoriaId);
    if (fromMap) {
      return fromMap;
    }

    const texto = String(categoriaId || '').replace(/[_-]+/g, ' ').trim();
    if (!texto) {
      return 'Outros';
    }

    return texto
      .split(' ')
      .filter(Boolean)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
  }, [categoriaLabelById]);

  const getCategoriaIconeTopo = useCallback((categoriaId) => {
    if (categoriaId === CATEGORIA_TODAS) {
      return '🏠';
    }

    if (categoriaId === CATEGORIA_PROMOCOES) {
      return '🏷️';
    }

    return CATEGORIA_ICONE_FALLBACK[categoriaId] || '🛍️';
  }, []);

  const categoriasTopoVitrine = useMemo(() => {
    const lista = [
      { id: CATEGORIA_TODAS, label: 'Todos', icon: getCategoriaIconeTopo(CATEGORIA_TODAS) },
      { id: CATEGORIA_PROMOCOES, label: 'Ofertas', icon: getCategoriaIconeTopo(CATEGORIA_PROMOCOES) }
    ];

    const vistos = new Set([CATEGORIA_TODAS, CATEGORIA_PROMOCOES]);
    categoriasVitrineIds.forEach((categoriaId) => {
      if (vistos.has(categoriaId)) {
        return;
      }

      vistos.add(categoriaId);
      lista.push({
        id: categoriaId,
        label: formatCategoriaLabel(categoriaId),
        icon: getCategoriaIconeTopo(categoriaId)
      });
    });

    return lista;
  }, [categoriasVitrineIds, formatCategoriaLabel, getCategoriaIconeTopo]);

  const categoriaNavAtivaLabel = useMemo(() => {
    if (!categoriaNavAtiva || categoriaNavAtiva === CATEGORIA_TODAS || categoriaNavAtiva === CATEGORIA_PROMOCOES) {
      return '';
    }

    return formatCategoriaLabel(categoriaNavAtiva);
  }, [categoriaNavAtiva, formatCategoriaLabel]);

  const produtosCategoriaNavAtiva = useMemo(() => {
    if (!categoriaNavAtiva || categoriaNavAtiva === CATEGORIA_TODAS || categoriaNavAtiva === CATEGORIA_PROMOCOES) {
      return [];
    }

    return produtosIndexados.filter((item) => item.categoriaVitrine === categoriaNavAtiva);
  }, [categoriaNavAtiva, produtosIndexados]);

  const subcategoriasVitrineAtiva = useMemo(() => {
    if (!mostrarLayoutCategorias) {
      return [];
    }

    if (!categoriaNavAtiva || categoriaNavAtiva === CATEGORIA_TODAS || categoriaNavAtiva === CATEGORIA_PROMOCOES) {
      return [];
    }

    return getSubcategoriasComContagem(produtosCategoriaNavAtiva, categoriaNavAtiva);
  }, [categoriaNavAtiva, mostrarLayoutCategorias, produtosCategoriaNavAtiva]);

  const secoesCategorias = useMemo(() => {
    if (!mostrarLayoutCategorias) {
      return [];
    }

    const secoesMap = new Map(
      categoriasVitrineIds.map((categoriaId) => [
        categoriaId,
        {
          id: categoriaId,
          label: formatCategoriaLabel(categoriaId),
          itensIndexados: []
        }
      ])
    );

    produtosIndexados.forEach((item) => {
      const catKey = item.categoriaVitrine || item.categoriaAgrupada || 'outros';
      const catEntry = CATEGORIAS_LEGADO.find((c) => c.id === catKey);
      const catLabel = catEntry?.label || item.categoriaLabel || 'Outros';

      if (!secoesMap.has(catKey)) {
        secoesMap.set(catKey, {
          id: catKey,
          label: catLabel,
          itensIndexados: []
        });
      }

      secoesMap.get(catKey).itensIndexados.push(item);
    });

    const normalizarSecao = (secao) => {
      if (!secao) {
        return null;
      }

      const itensOrdenados = [...secao.itensIndexados].sort((a, b) => {
        const estoqueA = Number(a.produto?.estoque || 0);
        const estoqueB = Number(b.produto?.estoque || 0);
        if (estoqueA !== estoqueB) {
          return estoqueB - estoqueA;
        }

        const scoreMaisVendidoDiff = Number(b.scoreMaisVendido || 0) - Number(a.scoreMaisVendido || 0);
        if (scoreMaisVendidoDiff !== 0) {
          return scoreMaisVendidoDiff;
        }

        const scoreConversaoDiff = Number(b.scoreConversao || 0) - Number(a.scoreConversao || 0);
        if (scoreConversaoDiff !== 0) {
          return scoreConversaoDiff;
        }

        return compareProdutosPorNome(a, b);
      });

      const totalBackendCategoria = Number(totaisCategoriasVitrine[secao.id] || 0);
      const totalItensSecao = Math.max(
        itensOrdenados.length,
        Number.isFinite(totalBackendCategoria) ? totalBackendCategoria : 0
      );

      return {
        ...secao,
        totalItens: totalItensSecao,
        itensIndexados: itensOrdenados.slice(0, 20)
      };
    };

    const secoesOrdenadas = categoriasVitrineIds
      .map((categoriaId) => normalizarSecao(secoesMap.get(categoriaId)))
      .filter(Boolean);

    return secoesOrdenadas;
  }, [categoriasVitrineIds, formatCategoriaLabel, mostrarLayoutCategorias, produtosIndexados, totaisCategoriasVitrine]);

  useEffect(() => {
    if (!mostrarLayoutCategorias) {
      return;
    }

    categoriasVitrineIds.forEach((categoriaId) => {
      if (categoriaId === 'outros') {
        return;
      }

      if (prefetchCategoriasVitrineRef.current.has(categoriaId)) {
        return;
      }

      prefetchCategoriasVitrineRef.current.add(categoriaId);

      void fetchProdutosPage({
        categoria: categoriaId,
        busca: '',
        page: 1,
        limit: 21
      })
        .then(({ lista, paginacao }) => {
          const listaSegura = Array.isArray(lista) ? lista : [];
          const totalApi = Number(paginacao?.total || 0);
          const totalInferido = totalApi > 0
            ? totalApi
            : (Boolean(paginacao?.tem_mais) ? Math.max(21, listaSegura.length + 1) : listaSegura.length);

          if (totalInferido > 0) {
            setTotaisCategoriasVitrine((atual) => {
              const totalAtual = Number(atual[categoriaId] || 0);
              if (totalInferido <= totalAtual) {
                return atual;
              }

              return {
                ...atual,
                [categoriaId]: totalInferido
              };
            });
          }

          if (listaSegura.length > 0) {
            setProdutos((atual) => mergeProdutosById(atual, listaSegura));
          }
        })
        .catch(() => {
          // Permite nova tentativa em erro sem quebrar a página.
          prefetchCategoriasVitrineRef.current.delete(categoriaId);
        });
    });
  }, [categoriasVitrineIds, mostrarLayoutCategorias]);

  const secoesCategoriaDetalhe = useMemo(() => {
    if (!exibirVisaoCategoriaDetalhe) {
      return [];
    }

    if (categoriaEhBebidas) {
      return secoesBebidas
        .map((secao) => ({
          id: secao.id,
          label: secao.label,
          totalItens: secao.itensIndexados.length,
          itensCompletos: secao.itensIndexados
        }))
        .filter((secao) => secao.itensCompletos.length > 0);
    }

    if (categoriaEhFrios) {
      return secoesFrios
        .map((secao) => ({
          id: secao.id,
          label: secao.label,
          totalItens: secao.itensIndexados.length,
          itensCompletos: secao.itensIndexados
        }))
        .filter((secao) => secao.itensCompletos.length > 0);
    }

    if (!produtosFiltradosIndexados.length) {
      return [];
    }

    const itensPorSubcategoria = new Map();
    const itensSemSubcategoria = [];

    produtosFiltradosIndexados.forEach((item) => {
      const subcategoriaId = String(item?._subcategoriaId || '').trim();
      if (!subcategoriaId) {
        itensSemSubcategoria.push(item);
        return;
      }

      if (!itensPorSubcategoria.has(subcategoriaId)) {
        itensPorSubcategoria.set(subcategoriaId, []);
      }

      itensPorSubcategoria.get(subcategoriaId).push(item);
    });

    const defsSubcategorias = getSubcategoriasComContagem(produtosFiltradosIndexados, categoria);
    const secoes = defsSubcategorias
      .map((subcategoria) => {
        const itens = itensPorSubcategoria.get(subcategoria.id) || [];
        return {
          id: subcategoria.id,
          label: subcategoria.label,
          totalItens: Math.max(itens.length, Number(subcategoria.count || 0)),
          itensCompletos: itens
        };
      })
      .filter((secao) => secao.itensCompletos.length > 0);

    if (itensSemSubcategoria.length > 0) {
      secoes.push({
        id: 'outras-opcoes',
        label: 'Outras opcoes',
        totalItens: itensSemSubcategoria.length,
        itensCompletos: itensSemSubcategoria
      });
    }

    if (!secoes.length) {
      return [{
        id: 'todos-produtos',
        label: 'Todos os produtos',
        totalItens: produtosFiltradosIndexados.length,
        itensCompletos: produtosFiltradosIndexados
      }];
    }

    return secoes;
  }, [
    categoria,
    categoriaEhBebidas,
    categoriaEhFrios,
    exibirVisaoCategoriaDetalhe,
    produtosFiltradosIndexados,
    secoesBebidas,
    secoesFrios
  ]);

  const subcategoriasCategoriaDetalhe = useMemo(() => {
    return secoesCategoriaDetalhe.map((secao) => ({
      id: secao.id,
      label: secao.label,
      count: secao.totalItens
    }));
  }, [secoesCategoriaDetalhe]);

  useEffect(() => {
    setSecoesCategoriaExpandidas({});
    sectionRefsSubcategoriaMap.current = {};
    setSubcategoriaNavAtiva('todas');
  }, [categoria]);

  const handleAlternarSecaoCategoria = useCallback((secaoId) => {
    const id = String(secaoId || '').trim();
    if (!id) {
      return;
    }

    setSecoesCategoriaExpandidas((atual) => ({
      ...atual,
      [id]: !Boolean(atual[id])
    }));
  }, []);

  const handleSelecionarSubcategoriaDetalhe = useCallback((subcategoriaId) => {
    const alvo = String(subcategoriaId || 'todas').trim() || 'todas';
    setSubcategoriaNavAtiva(alvo);

    if (alvo === 'todas') {
      sectionTopoSubcategoriasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const ref = sectionRefsSubcategoriaMap.current[alvo];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (!exibirVisaoCategoriaDetalhe || subcategoriasCategoriaDetalhe.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entradasVisiveis = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));

        if (!entradasVisiveis.length) {
          return;
        }

        const subcategoriaMaisProxima = String(
          entradasVisiveis[0].target?.getAttribute('data-subcategoria-id') || ''
        ).trim();

        if (!subcategoriaMaisProxima) {
          return;
        }

        setSubcategoriaNavAtiva((atual) => (
          atual === subcategoriaMaisProxima ? atual : subcategoriaMaisProxima
        ));
      },
      {
        root: null,
        rootMargin: '-180px 0px -55% 0px',
        threshold: [0.05, 0.25, 0.5]
      }
    );

    if (sectionTopoSubcategoriasRef.current) {
      observer.observe(sectionTopoSubcategoriasRef.current);
    }

    subcategoriasCategoriaDetalhe.forEach((subcategoria) => {
      const ref = sectionRefsSubcategoriaMap.current[subcategoria.id];
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [exibirVisaoCategoriaDetalhe, subcategoriasCategoriaDetalhe]);

  useEffect(() => {
    if (!exibirVisaoCategoriaDetalhe) {
      return;
    }

    if (subcategoriaNavAtiva === 'todas') {
      return;
    }

    const existeNaLista = subcategoriasCategoriaDetalhe.some((item) => item.id === subcategoriaNavAtiva);
    if (!existeNaLista) {
      setSubcategoriaNavAtiva('todas');
    }
  }, [exibirVisaoCategoriaDetalhe, subcategoriaNavAtiva, subcategoriasCategoriaDetalhe]);

  // Subcategorias disponíveis para a categoria ativa (exclui bebidas/frios que têm sistema próprio)
  const subcategoriasDisponiveis = useMemo(() => {
    if (categoriaEhBebidas || categoriaEhFrios || categoria === CATEGORIA_TODAS || categoria === CATEGORIA_PROMOCOES) {
      return [];
    }
    return getSubcategoriasComContagem(produtosFiltradosIndexados, categoria);
  }, [categoria, categoriaEhBebidas, categoriaEhFrios, produtosFiltradosIndexados]);

  // Filtrar por subcategoria genérica quando ativa
  const produtosFiltradosPorSubcategoria = useMemo(() => {
    if (subcategoriaAtiva === 'todas' || categoriaEhBebidas || categoriaEhFrios) {
      return produtosFiltradosIndexados;
    }
    return produtosFiltradosIndexados.filter((item) => item._subcategoriaId === subcategoriaAtiva);
  }, [subcategoriaAtiva, categoriaEhBebidas, categoriaEhFrios, produtosFiltradosIndexados]);

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

  const handleHorizontalWheel = useCallback((event) => {
    const container = event.currentTarget;
    if (!container || container.scrollWidth <= container.clientWidth) {
      return;
    }

    const deltaX = Number(event.deltaX || 0);
    const deltaY = Number(event.deltaY || 0);
    const delta = Math.abs(deltaX) > Math.abs(deltaY)
      ? deltaX
      : (deltaY * 1.15);

    if (!delta) {
      return;
    }

    const scrollLeftAtual = container.scrollLeft;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const proximoScrollLeft = Math.max(0, Math.min(maxScroll, scrollLeftAtual + delta));
    const conseguiuRolar = Math.abs(proximoScrollLeft - scrollLeftAtual) > 0.5;

    container.scrollLeft = proximoScrollLeft;

    if (conseguiuRolar && Math.abs(deltaY) >= Math.abs(deltaX) && event.cancelable) {
      event.preventDefault();
    }
  }, []);

  const renderCategoriaHorizontalRow = useCallback((itensIndexados) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 700;

    const renderCard = (produtoIndexado, index) => (
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
    );

    return (
      <CategoriaHorizontalRail
        itensIndexados={itensIndexados}
        onWheel={handleHorizontalWheel}
        renderCard={renderCard}
        exibirBarraMobile={isMobile}
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
    idsNovidades,
    isProdutoAdicionando,
    produtoAdicionadoRecenteId,
    recompraIdsSet,
    categoriasRecompraSet,
    handleHorizontalWheel
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

  const friosSubcategoriaLabel = useMemo(() => {
    if (friosSubcategoria === 'todas') {
      return 'Todas';
    }

    const label = secoesFrios.find((item) => item.id === friosSubcategoria)?.label;
    if (label) {
      return label;
    }

    return String(friosSubcategoria || '').replace(/-/g, ' ');
  }, [friosSubcategoria, secoesFrios]);

  const filtrosAplicados = Boolean(normalizeText(termoBuscaDigitado))
    || (categoria !== CATEGORIA_TODAS && !exibirVisaoCategoriaDetalhe)
    || bebidaSubcategoria !== 'todas'
    || friosSubcategoria !== 'todas';

  const podeFinalizarPedido = resumo.itens > 0;
  const itensResumoTexto = resumo.itens === 1 ? '1 item' : `${resumo.itens} itens`;
  const subtotalTexto = formatCurrency(resumo.total);

  const mostrarSkeletonInicial = carregando && produtos.length === 0;
  const mostrarErro = Boolean(erro) && !carregando && produtos.length === 0;
  const mostrarAvisoAtualizacao = Boolean(erro) && !carregando && produtos.length > 0;
  const mensagemAtualizacao = useMemo(() => {
    if (!((carregando && produtos.length > 0) || buscaEmAtualizacao)) {
      return '';
    }

    const categoriaLabel = String(categoriaAtualLabel || 'produtos').trim();
    const termo = String(termoBuscaEfetivo || '').trim();

    if (termo) {
      return `Atualizando ${categoriaLabel.toLowerCase()} para "${termo}"...`;
    }

    return `Atualizando ${categoriaLabel.toLowerCase()}...`;
  }, [buscaEmAtualizacao, carregando, categoriaAtualLabel, produtos.length, termoBuscaEfetivo]);

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
  } else if (exibirVisaoCategoriaDetalhe && secoesCategoriaDetalhe.length > 0) {
    return (
      <div className="products-category-detail" id="produtos-lista">
        <div
          ref={sectionTopoSubcategoriasRef}
          className="products-category-detail-top-sentinel"
          data-subcategoria-id="todas"
          aria-hidden="true"
        />

        {secoesCategoriaDetalhe.map((secao) => {
          const secaoId = String(secao.id || '').trim();
          const secaoExpandida = Boolean(secoesCategoriaExpandidas[secaoId]);
          const itensExibidos = secaoExpandida
            ? secao.itensCompletos
            : secao.itensCompletos.slice(0, 20);
          const podeExpandir = secao.itensCompletos.length > 20;
          const secaoAtiva = subcategoriaNavAtiva === secaoId;

          return (
            <section
              key={secaoId}
              className={`products-subcategory-section${secaoAtiva ? ' is-active' : ''}`}
              aria-label={`Subcategoria ${secao.label}`}
              ref={(node) => { sectionRefsSubcategoriaMap.current[secaoId] = node; }}
              data-subcategoria-id={secaoId}
              id={`subcategoria-${secaoId}`}
            >
              <header className="products-subcategory-section-head">
                <div>
                  <h2 className="products-subcategory-section-title">{secao.label}</h2>
                  <p className="products-subcategory-section-meta">
                    {secao.totalItens} {secao.totalItens === 1 ? 'produto' : 'produtos'}
                  </p>
                </div>

                {podeExpandir ? (
                  <button
                    type="button"
                    className="vitrine-ver-mais products-subcategory-toggle"
                    onClick={() => handleAlternarSecaoCategoria(secaoId)}
                  >
                    {secaoExpandida ? 'Ver menos' : `Ver todos (${secao.totalItens})`}
                  </button>
                ) : null}
              </header>

              {renderProdutosGrid(itensExibidos, {
                listId: `subcategoria-${secaoId}-lista`,
                gridClassName: 'produto-grid category-detail-grid'
              })}
            </section>
          );
        })}
      </div>
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
  } else if (categoriaEhFrios) {
    return secoesFrios.length > 0
      ? (
        <div className="brand-sections-list" id="produtos-lista">
          {secoesFrios.map((secao) => (
            <section className="brand-section" key={secao.id} aria-label={`Produtos da categoria ${secao.label}`}>
              <div className="brand-section-banner frios-section-banner">
                <h2>{secao.label}</h2>
                <p>{secao.itensIndexados.length} {secao.itensIndexados.length === 1 ? 'item' : 'itens'}</p>
              </div>
              {renderProdutosGrid(secao.itensIndexados, {
                gridClassName: 'produto-grid brand-produto-grid'
              })}
            </section>
          ))}
        </div>
      )
      : renderSemResultados(
        'Nenhum produto encontrado',
        'Não encontramos produtos de frios e laticínios para os filtros atuais.'
      );
  } else if (mostrarLayoutCategorias && secoesCategorias.length > 0) {
    return (
      <div className="vitrine-categorias" id="produtos-lista">
        {favoritosIndexados.length > 0 && (
          <section className="vitrine-secao" aria-label="Seus Favoritos">
            <div className="vitrine-secao-header">
              <h2 className="vitrine-secao-titulo">❤️ Favoritos</h2>
            </div>
            {renderCategoriaHorizontalRow(favoritosIndexados)}
          </section>
        )}
        {ofertasDiaIndexados.length > 0 && (
          <section
            className="vitrine-secao"
            aria-label="Ofertas do Dia"
            ref={(node) => { sectionRefsMap.current[CATEGORIA_PROMOCOES] = node; }}
            id="vitrine-promocoes"
          >
            <div className="vitrine-secao-header">
              <h2 className="vitrine-secao-titulo">🔥 Ofertas do Dia</h2>
            </div>
            {renderCategoriaHorizontalRow(ofertasDiaIndexados)}
          </section>
        )}
        {secoesCategorias.map((secao) => {
          const secaoEhAtiva = categoriaNavAtiva === secao.id;
          const itensSecao = secaoEhAtiva && subcategoriaNavAtiva !== 'todas'
            ? secao.itensIndexados.filter((item) => item._subcategoriaId === subcategoriaNavAtiva)
            : secao.itensIndexados;
          const mensagemVazia = secaoEhAtiva && subcategoriaNavAtiva !== 'todas'
            ? 'Nenhum produto encontrado nesta subcategoria. Toque em "Todos" para ver a categoria completa.'
            : 'Carregando produtos desta categoria...';

          return (
            <CategorySection
              key={secao.id}
              section={secao}
              isActive={secaoEhAtiva}
              sectionRef={(node) => { sectionRefsMap.current[secao.id] = node; }}
              items={itensSecao}
              emptyMessage={mensagemVazia}
              renderRow={renderCategoriaHorizontalRow}
              onViewAll={() => handleAplicarSugestaoBusca({ termo: '', categoria: secao.id })}
            />
          );
        })}
      </div>
    );
  } else {
    return renderProdutosGrid(produtosFiltradosPorSubcategoria, { listId: 'produtos-lista' });
  }
  return null;
  }, [
    bebidaSubcategoria,
    categoriaNavAtiva,
    categoriaEhBebidas,
    categoriaEhFrios,
    chavesMaisVendidos,
    erro,
    exibirVisaoCategoriaDetalhe,
    favoritosIndexados,
    favoritosIdsSet,
    getQuantidadeProduto,
    growthExperimento,
    gruposMarcaBebidas,
    handleAddItem,
    handleAplicarSugestaoBusca,
    handleAtualizarProdutos,
    handleDecreaseItem,
    handleIncreaseItem,
    handleToggleFavorito,
    abrirDetalheProduto,
    idsAltaConversaoSet,
    idsNovidades,
    isProdutoAdicionando,
    handleAlternarSecaoCategoria,
    mostrarErro,
    mostrarLayoutCategorias,
    mostrarSkeletonInicial,
    ofertasDiaIndexados,
    produtoAdicionadoRecenteId,
    produtosFiltradosIndexados,
    produtosFiltradosPorSubcategoria,
    recompraIdsSet,
    renderCategoriaHorizontalRow,
    renderProdutosGrid,
    renderSemResultados,
    secoesCategoriaDetalhe,
    secoesCategoriaExpandidas,
    secoesCategorias,
    secoesBebidas,
    secoesFrios,
    subcategoriaNavAtiva,
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

        <CategoryNav
          categories={categoriasTopoVitrine}
          activeCategoryId={categoriaNavAtiva}
          onSelect={handleCategoriaLegadoClick}
          onWheel={handleHorizontalWheel}
        />

        {buscaEmAtualizacao ? (
          <div className="products-search-meta" aria-live="polite">
            <span className="products-results-pill">Atualizando busca...</span>
          </div>
        ) : termoBuscaEfetivo ? (
          <div className="products-search-meta" aria-live="polite">
            <p>Resultados para <strong>"{termoBuscaEfetivo}"</strong></p>
          </div>
        ) : null}

        {exibirVisaoCategoriaDetalhe && subcategoriasCategoriaDetalhe.length > 0 ? (
          <div className="products-subcategory-sticky-shell">
            <SubcategoryNav
              title={`Subcategorias de ${categoriaAtualLabel}`}
              subcategories={subcategoriasCategoriaDetalhe}
              activeSubcategoryId={subcategoriaNavAtiva}
              onSelect={handleSelecionarSubcategoriaDetalhe}
              onWheel={handleHorizontalWheel}
            />
          </div>
        ) : null}

        {mostrarLayoutCategorias && categoriaNavAtivaLabel ? (
          <SubcategoryNav
            title={`Subcategorias de ${categoriaNavAtivaLabel}`}
            subcategories={subcategoriasVitrineAtiva}
            activeSubcategoryId={subcategoriaNavAtiva}
            onSelect={setSubcategoriaNavAtiva}
            onWheel={handleHorizontalWheel}
          />
        ) : null}

        {!exibirVisaoCategoriaDetalhe && categoriaEhBebidas ? (
          <SubcategoryNav
            title="Subcategorias de bebidas"
            subcategories={secoesBebidas.map((secao) => ({
              id: secao.id,
              label: secao.label,
              count: secao.itensIndexados.length
            }))}
            activeSubcategoryId={bebidaSubcategoria}
            onSelect={setBebidaSubcategoria}
            onWheel={handleHorizontalWheel}
          />
        ) : null}

        {!exibirVisaoCategoriaDetalhe && categoriaEhFrios ? (
          <SubcategoryNav
            title="Subcategorias de Frios e Laticínios"
            subcategories={secoesFrios.map((secao) => ({
              id: secao.id,
              label: secao.label,
              count: secao.itensIndexados.length
            }))}
            activeSubcategoryId={friosSubcategoria}
            onSelect={setFriosSubcategoria}
            onWheel={handleHorizontalWheel}
          />
        ) : null}

        {!exibirVisaoCategoriaDetalhe && subcategoriasDisponiveis.length > 0 && !categoriaEhBebidas && !categoriaEhFrios ? (
          <SubcategoryNav
            title={`Subcategorias de ${categoriaAtualLabel}`}
            subcategories={subcategoriasDisponiveis}
            activeSubcategoryId={subcategoriaAtiva}
            onSelect={setSubcategoriaAtiva}
            onWheel={handleHorizontalWheel}
          />
        ) : null}

        {filtrosAplicados ? (
          <div className="products-active-filters" aria-label="Filtros ativos">
            {termoBuscaDigitado ? (
              <button type="button" className="products-active-filter-chip" onClick={handleLimparBusca}>
                Busca: "{termoBuscaDigitado}" <span aria-hidden="true">×</span>
              </button>
            ) : null}

            {categoria !== CATEGORIA_TODAS && !exibirVisaoCategoriaDetalhe ? (
              <button
                type="button"
                className="products-active-filter-chip"
                onClick={() => {
                  setCategoria(CATEGORIA_TODAS);
                  setCategoriaNavAtiva(CATEGORIA_TODAS);
                  setSubcategoriaAtiva('todas');
                  setSubcategoriaNavAtiva('todas');
                }}
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

            {friosSubcategoria !== 'todas' ? (
              <button
                type="button"
                className="products-active-filter-chip"
                onClick={() => setFriosSubcategoria('todas')}
              >
                Subcategoria: {friosSubcategoriaLabel} <span aria-hidden="true">×</span>
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
          {mensagemAtualizacao ? (
            <span className="products-results-pill">{mensagemAtualizacao}</span>
          ) : null}
          {mostrarAvisoAtualizacao ? (
            <span className="products-results-pill is-warning" role="status">{erro}</span>
          ) : null}
        </div>
      </section>

      {conteudoProdutos}

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
          </div>

          {podeFinalizarPedido ? (
            <Link to="/pagamento" className="btn-primary pedido-resumo-fixo-botao">
              Ver carrinho
            </Link>
          ) : (
            <button type="button" className="btn-primary pedido-resumo-fixo-botao" disabled>
              Ver carrinho
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

