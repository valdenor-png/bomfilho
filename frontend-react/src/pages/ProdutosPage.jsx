import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Grid } from 'react-window';
import { getProdutos } from '../lib/api';
import { useCart } from '../context/CartContext';

const CATEGORIA_TODAS = 'todas';
const CATEGORIA_PROMOCOES = 'promocoes';
const CATEGORIA_BEBIDAS = 'bebidas';
const TOKEN_BEBIDA = 'bebida';
const PRODUTOS_POR_PAGINA = 60;

const DRINK_SECTIONS_BEBIDAS = [
  {
    id: 'agua',
    label: 'Água',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1400&q=60',
    matchers: ['agua', 'mineral', 'sem gas', 'com gas']
  },
  {
    id: 'refrigerante',
    label: 'Refrigerante',
    image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?auto=format&fit=crop&w=1400&q=60',
    matchers: ['refrigerante', 'coca', 'pepsi', 'guarana', 'guaraná', 'fanta', 'sprite']
  },
  {
    id: 'cervejas',
    label: 'Cervejas',
    image: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=1400&q=60',
    matchers: ['cerveja', 'beer', 'heineken', 'brahma', 'skol', 'antarctica', 'itaipava']
  },
  {
    id: 'vinho',
    label: 'Vinho',
    image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1400&q=60',
    matchers: ['vinho', 'wine', 'tinto', 'branco', 'rose', 'rosé']
  }
];

const BRAND_GROUPS_BY_SUBCATEGORY = {
  refrigerante: [
    {
      id: 'coca-cola',
      label: 'Coca-Cola',
      image: 'https://images.unsplash.com/photo-1629203432180-71e9bfe03d94?auto=format&fit=crop&w=1400&q=60',
      matchers: ['coca-cola', 'coca cola', 'coca']
    },
    {
      id: 'pepsi',
      label: 'Pepsi',
      image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=1400&q=60',
      matchers: ['pepsi']
    },
    {
      id: 'guarana-e-outros',
      label: 'Guaraná e Outros',
      image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1400&q=60',
      matchers: ['guarana', 'guaraná', 'fanta', 'sprite', 'kuat', 'sukita', 'garoto']
    }
  ],
  cervejas: [
    {
      id: 'heineken',
      label: 'Heineken',
      image: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=1400&q=60',
      matchers: ['heineken']
    },
    {
      id: 'brahma-e-skol',
      label: 'Brahma e Skol',
      image: 'https://images.unsplash.com/photo-1618885472179-5e474019f2a9?auto=format&fit=crop&w=1400&q=60',
      matchers: ['brahma', 'skol', 'antarctica']
    }
  ],
  vinho: [
    {
      id: 'vinhos-tintos',
      label: 'Vinhos Tintos',
      image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1400&q=60',
      matchers: ['tinto']
    },
    {
      id: 'vinhos-brancos',
      label: 'Vinhos Brancos',
      image: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?auto=format&fit=crop&w=1400&q=60',
      matchers: ['branco', 'rose', 'rosé']
    }
  ],
  agua: [
    {
      id: 'agua-sem-gas',
      label: 'Água sem gás',
      image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1400&q=60',
      matchers: ['sem gas']
    },
    {
      id: 'agua-com-gas',
      label: 'Água com gás',
      image: 'https://images.unsplash.com/photo-1564417947365-8dbc9d0e718e?auto=format&fit=crop&w=1400&q=60',
      matchers: ['com gas']
    }
  ]
};

const CATEGORY_IMAGES = {
  hortifruti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=60',
  bebidas: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=60',
  mercearia: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60',
  acougue: 'https://images.unsplash.com/photo-1607623814143-16f56c7d0980?auto=format&fit=crop&w=900&q=60',
  limpeza: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=60'
};

const CATEGORIAS_LEGADO = [
  { id: CATEGORIA_TODAS, label: '🛒 Todas' },
  { id: CATEGORIA_PROMOCOES, label: '🔥 Promoções', destaque: true },
  { id: 'hortifruti', label: '🥦 Hortifruti' },
  { id: CATEGORIA_BEBIDAS, label: '🥤 Bebidas' },
  { id: 'limpeza', label: '🧴 Limpeza' }
];

function getProdutoImagem(produto) {
  const imagem = String(produto?.imagem || '').trim();
  if (imagem) {
    return imagem;
  }

  const categoria = String(produto?.categoria || '').toLowerCase();
  return CATEGORY_IMAGES[categoria] || 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=60';
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMatchers(matchers = []) {
  return matchers.map((matcher) => normalizeText(matcher)).filter(Boolean);
}

const DRINK_SECTIONS_BEBIDAS_INDEX = DRINK_SECTIONS_BEBIDAS.map((section) => ({
  ...section,
  matchersNormalizados: normalizeMatchers(section.matchers)
}));

const BRAND_GROUPS_BY_SUBCATEGORY_INDEX = Object.fromEntries(
  Object.entries(BRAND_GROUPS_BY_SUBCATEGORY).map(([subcategoryId, groups]) => [
    subcategoryId,
    groups.map((group) => ({
      ...group,
      matchersNormalizados: normalizeMatchers(group.matchers)
    }))
  ])
);

function isBebidasCategoria(value) {
  return normalizeText(value).includes('bebida');
}

function getTextoProduto(produto) {
  return [
    normalizeText(produto?.nome),
    normalizeText(produto?.marca),
    normalizeText(produto?.categoria),
    normalizeText(produto?.descricao)
  ]
    .filter(Boolean)
    .join(' ');
}

function textoContemMatcher(textoProduto, matchersNormalizados) {
  return matchersNormalizados.some((matcher) => textoProduto.includes(matcher));
}

function getBebidaSubcategoriaIdByTexto(textoProduto) {
  const found = DRINK_SECTIONS_BEBIDAS_INDEX.find((section) =>
    textoContemMatcher(textoProduto, section.matchersNormalizados)
  );
  return found?.id || 'outras-bebidas';
}

function isProdutoEmPromocao(produto) {
  return (
    Number(produto?.desconto || 0) > 0
    || Number(produto?.percentual_desconto || 0) > 0
    || Number(produto?.preco_promocional || 0) > 0
    || produto?.promocao === true
    || Number(produto?.promocao || 0) === 1
  );
}

function getProdutoStableKey(produto) {
  const idRaw = produto?.id;
  if (idRaw !== undefined && idRaw !== null && String(idRaw).trim()) {
    return `id:${String(idRaw).trim()}`;
  }

  const codigoBarras = String(
    produto?.codigo_barras || produto?.codigoBarras || produto?.codigo || ''
  ).trim();
  if (codigoBarras) {
    return `codigo:${codigoBarras}`;
  }

  const nome = normalizeText(produto?.nome);
  const marca = normalizeText(produto?.marca);
  const categoria = normalizeText(produto?.categoria);
  const descricao = normalizeText(produto?.descricao);
  const imagem = String(produto?.imagem || '').trim();
  const unidade = normalizeText(produto?.unidade);
  const preco = Number(produto?.preco || 0).toFixed(2);
  return `sem-id:${nome}|${marca}|${categoria}|${descricao}|${unidade}|${preco}|${imagem}`;
}

function getCategoriaApi(categoria) {
  const valor = String(categoria || '').toLowerCase();
  if (!valor || valor === CATEGORIA_TODAS || valor === CATEGORIA_PROMOCOES) {
    return '';
  }

  if (valor.includes(TOKEN_BEBIDA)) {
    return CATEGORIA_BEBIDAS;
  }

  return valor;
}

function buildProdutosQueryKey({ categoria, busca, page, limit }) {
  return [
    'produtos',
    {
      categoria: getCategoriaApi(categoria) || CATEGORIA_TODAS,
      busca: normalizeText(busca),
      page: Number(page || 1),
      limit: Number(limit || PRODUTOS_POR_PAGINA)
    }
  ];
}

// Mantem a assinatura de busca isolada para facilitar migracao para React Query.
async function fetchProdutosPage({ categoria, busca, page, limit }) {
  const params = {
    page: Number(page || 1),
    limit: Number(limit || PRODUTOS_POR_PAGINA)
  };

  const categoriaApi = getCategoriaApi(categoria);
  if (categoriaApi) {
    params.categoria = categoriaApi;
  }

  const buscaNormalizada = String(busca || '').trim();
  if (buscaNormalizada) {
    params.busca = buscaNormalizada;
  }

  const data = await getProdutos(params);
  const lista = Array.isArray(data?.produtos) ? data.produtos : [];
  const paginacao = data?.paginacao || {};

  return {
    queryKey: buildProdutosQueryKey({
      categoria,
      busca,
      page: params.page,
      limit: params.limit
    }),
    lista,
    paginacao
  };
}

function buildProdutosPageCacheKey({ categoria, busca, page, limit }) {
  return JSON.stringify(
    buildProdutosQueryKey({ categoria, busca, page, limit })
  );
}

function isUnsplashUrl(value) {
  return String(value || '').includes('images.unsplash.com');
}

function buildUnsplashVariant(url, width) {
  if (!isUnsplashUrl(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('auto', 'format');
    parsed.searchParams.set('fit', 'crop');
    parsed.searchParams.set('q', '60');
    parsed.searchParams.set('w', String(width));
    return parsed.toString();
  } catch {
    return url;
  }
}

function getProdutoImagemResponsiva(produto) {
  const srcBase = getProdutoImagem(produto);

  if (!isUnsplashUrl(srcBase)) {
    return {
      src: srcBase,
      srcSet: undefined,
      sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 220px'
    };
  }

  const widths = [220, 320, 420, 640, 900];
  return {
    src: buildUnsplashVariant(srcBase, 420),
    srcSet: widths.map((width) => `${buildUnsplashVariant(srcBase, width)} ${width}w`).join(', '),
    sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 220px'
  };
}

function mergeProdutosById(listaAtual, novosProdutos) {
  const mapa = new Map();

  listaAtual.forEach((produto) => {
    const chave = getProdutoStableKey(produto);
    mapa.set(chave, produto);
  });

  novosProdutos.forEach((produto) => {
    const chave = getProdutoStableKey(produto);
    mapa.set(chave, produto);
  });

  return Array.from(mapa.values());
}

const VIRTUALIZATION_THRESHOLD = 72;
const VIRTUAL_GRID_GAP = 12;
const VIRTUAL_CARD_MIN_WIDTH_DESKTOP = 220;
const VIRTUAL_CARD_MIN_WIDTH_MOBILE = 164;
const VIRTUAL_CARD_HEIGHT_DESKTOP = 330;
const VIRTUAL_CARD_HEIGHT_MOBILE = 304;
const VIRTUAL_GRID_MIN_HEIGHT = 280;

function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === 'undefined') {
      return 900;
    }
    return window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewportHeight;
}

function useElementWidth() {
  const [element, setElement] = useState(null);
  const [width, setWidth] = useState(0);

  const ref = useCallback((node) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) {
      setWidth(0);
      return undefined;
    }

    const updateWidth = () => {
      setWidth(element.clientWidth || 0);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, [element]);

  return [ref, width];
}

const ProdutoCard = React.memo(function ProdutoCard({ produtoIndexado, onAddItem }) {
  const produto = produtoIndexado.produto;
  const imagem = useMemo(() => getProdutoImagemResponsiva(produto), [produto]);

  return (
    <article className="produto-card">
      <img
        className="produto-image"
        src={imagem.src}
        srcSet={imagem.srcSet}
        sizes={imagem.sizes}
        alt={produto.nome}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onError={(event) => {
          event.currentTarget.src = '/img/logo-oficial.png';
        }}
      />
      <p className="produto-title">
        <span>{produto.emoji || '📦'}</span> {produto.nome}
      </p>
      <p className="muted-text">{produto.categoria || 'Sem categoria'}</p>
      <p className="produto-price">R$ {Number(produto.preco || 0).toFixed(2)}</p>
      <button className="btn-primary" type="button" onClick={() => onAddItem(produto)}>
        Adicionar ao carrinho
      </button>
    </article>
  );
});

ProdutoCard.displayName = 'ProdutoCard';

const VirtualizedProdutoGrid = React.memo(function VirtualizedProdutoGrid({
  itensIndexados,
  onAddItem,
  gridClassName = 'produto-grid',
  listId
}) {
  const [containerRef, containerWidth] = useElementWidth();
  const viewportHeight = useViewportHeight();

  const usarVirtualizacao = itensIndexados.length >= VIRTUALIZATION_THRESHOLD;

  const isMobileViewport = containerWidth > 0 && containerWidth < 700;
  const minCardWidth = isMobileViewport ? VIRTUAL_CARD_MIN_WIDTH_MOBILE : VIRTUAL_CARD_MIN_WIDTH_DESKTOP;
  const cardHeight = isMobileViewport ? VIRTUAL_CARD_HEIGHT_MOBILE : VIRTUAL_CARD_HEIGHT_DESKTOP;

  const columnCount = Math.max(
    1,
    Math.floor((containerWidth + VIRTUAL_GRID_GAP) / (minCardWidth + VIRTUAL_GRID_GAP)) || 1
  );

  const totalHorizontalGap = Math.max(0, columnCount - 1) * VIRTUAL_GRID_GAP;
  const cardWidth = Math.max(
    140,
    Math.floor((Math.max(containerWidth, minCardWidth) - totalHorizontalGap) / columnCount)
  );

  const gridColumnWidth = cardWidth + VIRTUAL_GRID_GAP;
  const gridRowHeight = cardHeight + VIRTUAL_GRID_GAP;
  const rowCount = Math.max(1, Math.ceil(itensIndexados.length / columnCount));

  const maxViewportHeight = Math.max(
    VIRTUAL_GRID_MIN_HEIGHT,
    Math.floor(viewportHeight * (isMobileViewport ? 0.58 : 0.68))
  );
  const gridHeight = Math.max(
    VIRTUAL_GRID_MIN_HEIGHT,
    Math.min(maxViewportHeight, rowCount * gridRowHeight)
  );

  const itemData = useMemo(() => ({
    itensIndexados,
    onAddItem,
    columnCount
  }), [columnCount, itensIndexados, onAddItem]);
  const shellClassName = gridClassName.includes('brand-produto-grid')
    ? 'produto-grid-virtualized-shell brand-produto-grid-virtualized'
    : 'produto-grid-virtualized-shell';

  const renderCell = useCallback(({
    ariaAttributes,
    columnIndex,
    rowIndex,
    style,
    itensIndexados: itens,
    onAddItem: onAdd,
    columnCount: columns
  }) => {
    const index = rowIndex * columns + columnIndex;
    const produtoIndexado = itens[index];

    if (!produtoIndexado) {
      return null;
    }

    const width = typeof style.width === 'number' ? style.width : Number.parseFloat(style.width || '0');
    const height = typeof style.height === 'number' ? style.height : Number.parseFloat(style.height || '0');

    return (
      <div
        className="produto-grid-virtualized-cell"
        {...ariaAttributes}
        style={{
          ...style,
          width: Math.max(0, width - VIRTUAL_GRID_GAP),
          height: Math.max(0, height - VIRTUAL_GRID_GAP)
        }}
      >
        <ProdutoCard
          produtoIndexado={produtoIndexado}
          onAddItem={onAdd}
        />
      </div>
    );
  }, []);

  if (!usarVirtualizacao) {
    return (
      <div className={gridClassName} id={listId}>
        {itensIndexados.map((produtoIndexado) => (
          <ProdutoCard
            key={produtoIndexado.chaveReact}
            produtoIndexado={produtoIndexado}
            onAddItem={onAddItem}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={shellClassName} id={listId} ref={containerRef}>
      {containerWidth > 0 ? (
        <Grid
          className="produto-grid-virtualized"
          style={{
            width: containerWidth,
            height: gridHeight
          }}
          defaultWidth={containerWidth}
          defaultHeight={gridHeight}
          cellComponent={renderCell}
          cellProps={itemData}
          columnCount={columnCount}
          columnWidth={gridColumnWidth}
          rowCount={rowCount}
          rowHeight={gridRowHeight}
          overscanCount={isMobileViewport ? 3 : 4}
        />
      ) : (
        <div className={gridClassName}>
          {itensIndexados.slice(0, 12).map((produtoIndexado) => (
            <ProdutoCard
              key={produtoIndexado.chaveReact}
              produtoIndexado={produtoIndexado}
              onAddItem={onAddItem}
            />
          ))}
        </div>
      )}
    </div>
  );
});

VirtualizedProdutoGrid.displayName = 'VirtualizedProdutoGrid';

export default function ProdutosPage() {
  const { addItem, resumo } = useCart();
  const [searchParams] = useSearchParams();
  const categoriaInicial = String(searchParams.get('categoria') || CATEGORIA_TODAS).toLowerCase();
  const buscaInicial = String(searchParams.get('busca') || '');

  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState(buscaInicial);
  const [categoria, setCategoria] = useState(categoriaInicial || CATEGORIA_TODAS);
  const [bebidaSubcategoria, setBebidaSubcategoria] = useState('todas');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMaisProdutos, setTemMaisProdutos] = useState(false);
  const [totalProdutosBackend, setTotalProdutosBackend] = useState(0);
  const requisicaoProdutosIdRef = useRef(0);
  const prefetchProdutosCacheRef = useRef(new Map());
  const prefetchEmAndamentoRef = useRef(new Set());
  const categoriaEhBebidas = useMemo(() => isBebidasCategoria(categoria), [categoria]);
  const assinaturaConsultaAtual = useMemo(
    () => JSON.stringify(buildProdutosQueryKey({
      categoria,
      busca,
      page: 1,
      limit: PRODUTOS_POR_PAGINA
    })),
    [busca, categoria]
  );

  useEffect(() => {
    setBusca(String(searchParams.get('busca') || ''));
    setCategoria(String(searchParams.get('categoria') || CATEGORIA_TODAS).toLowerCase());
  }, [searchParams]);

  useEffect(() => {
    if (!categoriaEhBebidas) {
      setBebidaSubcategoria('todas');
    }
  }, [categoriaEhBebidas]);

  useEffect(() => {
    prefetchProdutosCacheRef.current.clear();
    prefetchEmAndamentoRef.current.clear();
  }, [assinaturaConsultaAtual]);

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
      const buscaEfetiva = String(buscaAlvo ?? busca);
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
  }, [busca, categoria, prefetchProximaPagina]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void carregarProdutos({
        append: false,
        pagina: 1,
        categoriaAlvo: categoria,
        buscaAlvo: busca
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [busca, carregarProdutos, categoria]);

  const handleCarregarMais = useCallback(async () => {
    if (carregando || carregandoMais || !temMaisProdutos) {
      return;
    }

    const proximaPagina = paginaAtual + 1;
    const chaveCache = buildProdutosPageCacheKey({
      categoria,
      busca,
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
          buscaAlvo: busca,
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
      buscaAlvo: busca
    });
  }, [
    busca,
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
      buscaAlvo: busca
    });
  }, [busca, carregarProdutos, categoria]);

  const handleBuscaChange = useCallback((event) => {
    setBusca(event.target.value);
  }, []);

  const handleCategoriaSelectChange = useCallback((event) => {
    setCategoria(String(event.target.value).toLowerCase());
  }, []);

  const handleCategoriaLegadoClick = useCallback((categoriaId) => {
    setCategoria(categoriaId);
    if (categoriaId !== CATEGORIA_BEBIDAS) {
      setBebidaSubcategoria('todas');
    }
  }, []);

  // Índice local com campos normalizados para evitar recomputações em cada filtro/render.
  const produtosIndexados = useMemo(() => {
    return produtos.map((produto) => {
      const textoBusca = getTextoProduto(produto);
      const categoriaOriginal = String(produto?.categoria || '').toLowerCase();
      const categoriaNormalizada = normalizeText(categoriaOriginal);

      return {
        chaveReact: getProdutoStableKey(produto),
        produto,
        textoBusca,
        categoriaOriginal,
        categoriaNormalizada,
        categoriaEhBebida: categoriaNormalizada.includes(TOKEN_BEBIDA),
        emPromocao: isProdutoEmPromocao(produto),
        bebidaSubcategoriaId: getBebidaSubcategoriaIdByTexto(textoBusca)
      };
    });
  }, [produtos]);

  const categorias = useMemo(() => {
    const values = new Set();
    produtos.forEach((produto) => {
      if (produto.categoria) {
        values.add(String(produto.categoria));
      }
    });
    return [CATEGORIA_TODAS, ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [produtos]);

  const termoBusca = useMemo(() => {
    const termoNormalizado = normalizeText(busca);
    if (categoriaEhBebidas && (termoNormalizado === TOKEN_BEBIDA || termoNormalizado === `${TOKEN_BEBIDA}s`)) {
      return '';
    }
    return termoNormalizado;
  }, [busca, categoriaEhBebidas]);

  // Etapa 1 do pipeline: busca textual.
  const produtosFiltradosPorBusca = useMemo(() => {
    if (!termoBusca) {
      return produtosIndexados;
    }
    return produtosIndexados.filter((item) => item.textoBusca.includes(termoBusca));
  }, [produtosIndexados, termoBusca]);

  const filtroPromocaoAtivo = categoria === CATEGORIA_PROMOCOES;
  const filtroCategoriaAtivo = categoria !== CATEGORIA_TODAS && !filtroPromocaoAtivo;

  // Etapa 2 do pipeline: categoria.
  const produtosFiltradosPorCategoria = useMemo(() => {
    if (!filtroCategoriaAtivo) {
      return produtosFiltradosPorBusca;
    }

    if (categoria === CATEGORIA_BEBIDAS) {
      return produtosFiltradosPorBusca.filter((item) => item.categoriaEhBebida);
    }

    return produtosFiltradosPorBusca.filter((item) => item.categoriaOriginal === categoria);
  }, [categoria, filtroCategoriaAtivo, produtosFiltradosPorBusca]);

  // Etapa 3 do pipeline: promoção.
  const produtosFiltradosPorPromocao = useMemo(() => {
    if (!filtroPromocaoAtivo) {
      return produtosFiltradosPorCategoria;
    }
    return produtosFiltradosPorBusca.filter((item) => item.emPromocao);
  }, [filtroPromocaoAtivo, produtosFiltradosPorBusca, produtosFiltradosPorCategoria]);

  // Lista linear consumida tanto pelo grid tradicional quanto pelo virtualizado.
  const produtosFiltradosIndexados = useMemo(() => {
    return produtosFiltradosPorPromocao;
  }, [produtosFiltradosPorPromocao]);

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

    if (outrasBebidas.length) {
      secoes.push({
        id: 'outras-bebidas',
        label: 'Outras bebidas',
        image: CATEGORY_IMAGES.bebidas,
        itensIndexados: outrasBebidas
      });
    }

    return secoes;
  }, [categoriaEhBebidas, produtosFiltradosIndexados]);

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

  const handleAddItem = useCallback((produto) => {
    addItem(produto, 1);
  }, [addItem]);

  const renderProdutosGrid = useCallback((itensIndexados, { listId, gridClassName = 'produto-grid' } = {}) => {
    return (
      <VirtualizedProdutoGrid
        itensIndexados={itensIndexados}
        onAddItem={handleAddItem}
        listId={listId}
        gridClassName={gridClassName}
      />
    );
  }, [handleAddItem]);

  return (
    <section className="page">
      <section className="product-highlight-section" id="produtos" aria-label="Página de produtos">
        <h1>Produtos</h1>
        <p className="product-highlight-subtitle">Use a busca para encontrar rápido e filtre por categoria.</p>

        <div className="search-bar-highlight">
          <label className="field-label" htmlFor="busca-produtos">Buscar produtos</label>
          <div className="search-bar-react">
            <input
              id="busca-produtos"
              className="field-input"
              type="search"
              value={busca}
              onChange={handleBuscaChange}
              placeholder="🔍 Ex: arroz, café, detergente..."
            />
          </div>
        </div>

        <div className="toolbar-box">
          <select
            className="field-input"
            value={categoria}
            onChange={handleCategoriaSelectChange}
          >
            {categorias.map((item) => (
              <option key={item} value={item}>
                {item === CATEGORIA_TODAS ? 'Todas as categorias' : item}
              </option>
            ))}
          </select>

          <button
            className="btn-primary"
            type="button"
            onClick={handleAtualizarProdutos}
            disabled={carregando}
          >
            {carregando ? 'Atualizando...' : 'Atualizar produtos'}
          </button>
        </div>

        <div className="legacy-categories" aria-label="Filtros de categoria">
          {CATEGORIAS_LEGADO.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`category-btn-react ${item.destaque ? 'category-promocoes-react' : ''} ${categoria === item.id ? 'active' : ''}`}
              onClick={() => handleCategoriaLegadoClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {categoriaEhBebidas ? (
          <div className="bebidas-subcats" aria-label="Subcategorias de bebidas">
            <p className="bebidas-subcats-title">Subcategorias de bebidas</p>
            <div className="bebidas-subcats-actions">
              <button
                type="button"
                className={`category-btn-react ${bebidaSubcategoria === 'todas' ? 'active' : ''}`}
                onClick={() => setBebidaSubcategoria('todas')}
              >
                Todas
              </button>
              {secoesBebidas.map((secao) => (
                <button
                  key={secao.id}
                  type="button"
                  className={`category-btn-react ${bebidaSubcategoria === secao.id ? 'active' : ''}`}
                  onClick={() => setBebidaSubcategoria(secao.id)}
                >
                  {secao.label} ({secao.itensIndexados.length})
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="pedido-resumo" style={{ marginTop: '0.9rem' }}>
        <p><strong>Carrinho:</strong> {resumo.itens} item(ns)</p>
        <p><strong>Total parcial:</strong> R$ {resumo.total.toFixed(2)}</p>
        {totalProdutosBackend > 0 ? (
          <p className="muted-text" style={{ marginTop: '0.35rem' }}>
            Mostrando {produtos.length} de {totalProdutosBackend} produto(s) carregados.
          </p>
        ) : null}
        {resumo.itens > 0 ? (
          <Link to="/pagamento" className="btn-primary" style={{ display: 'inline-block', marginTop: '0.6rem' }}>
            Finalizar pedido
          </Link>
        ) : (
          <p className="muted-text" style={{ marginTop: '0.4rem' }}>Adicione itens para liberar o pagamento.</p>
        )}
      </div>

      {erro ? <p className="error-text">{erro}</p> : null}
      {carregando ? <p className="muted-text">Carregando produtos...</p> : null}

      {produtosFiltradosIndexados.length === 0 ? (
        <p className="muted-text">Nenhum produto encontrado com os filtros atuais.</p>
      ) : categoriaEhBebidas ? (
        bebidaSubcategoria === 'todas' ? (
          <div className="brand-sections-list" id="produtos-lista">
            {secoesBebidas.map((secao) => (
              <section className="brand-section" key={secao.id} aria-label={`Produtos da categoria ${secao.label}`}>
                <div className="brand-section-banner" style={{ '--brand-bg': `url('${secao.image}')` }}>
                  <h2>{secao.label}</h2>
                  <p>{secao.itensIndexados.length} item(ns) nesta categoria</p>
                </div>
                {renderProdutosGrid(secao.itensIndexados, {
                  gridClassName: 'produto-grid brand-produto-grid'
                })}
              </section>
            ))}
          </div>
        ) : gruposMarcaBebidas.length === 0 ? (
          <p className="muted-text">Nenhum item encontrado para essa subcategoria.</p>
        ) : (
          <div className="brand-sections-list" id="produtos-lista">
            {gruposMarcaBebidas.map((grupo) => (
              <section className="brand-section" key={grupo.id} aria-label={`Produtos da marca ${grupo.label}`}>
                <div className="brand-section-banner" style={{ '--brand-bg': `url('${grupo.image}')` }}>
                  <h2>{grupo.label}</h2>
                  <p>{grupo.itensIndexados.length} item(ns) nesta marca</p>
                </div>
                {renderProdutosGrid(grupo.itensIndexados, {
                  gridClassName: 'produto-grid brand-produto-grid'
                })}
              </section>
            ))}
          </div>
        )
      ) : (
        <>{renderProdutosGrid(produtosFiltradosIndexados, { listId: 'produtos-lista' })}</>
      )}

      {temMaisProdutos ? (
        <div className="card-box" style={{ marginTop: '0.9rem' }}>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              void handleCarregarMais();
            }}
            disabled={carregandoMais || carregando}
          >
            {carregandoMais ? 'Carregando mais produtos...' : 'Carregar mais produtos'}
          </button>
        </div>
      ) : null}
    </section>
  );
}