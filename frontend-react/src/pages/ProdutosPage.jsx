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
  { id: CATEGORIA_TODAS, label: 'Todas' },
  { id: CATEGORIA_PROMOCOES, label: 'Promoções', destaque: true },
  { id: 'hortifruti', label: 'Hortifruti' },
  { id: CATEGORIA_BEBIDAS, label: 'Bebidas' },
  { id: 'limpeza', label: 'Limpeza' }
];

const ORDENACOES_PRODUTOS = [
  { id: 'mais-vendidos', label: 'Mais vendidos' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
  { id: 'az', label: 'A-Z' },
  { id: 'promocoes', label: 'Promoções' }
];

const CATEGORIA_ICONE_FALLBACK = {
  hortifruti: '🥦',
  bebidas: '🥤',
  limpeza: '🧽',
  mercearia: '🛒',
  acougue: '🥩',
  padaria: '🥖',
  frios: '🧀'
};

const TOKENS_MAIS_VENDIDOS = [
  'arroz',
  'feijao',
  'feijão',
  'leite',
  'cafe',
  'café',
  'acucar',
  'açúcar',
  'oleo',
  'óleo',
  'detergente',
  'cerveja',
  'refrigerante',
  'frango'
];

const BRL_CURRENCY = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const PT_BR_COLLATOR = new Intl.Collator('pt-BR');

function getProdutoImagem(produto) {
  return String(produto?.imagem || '').trim();
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

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalizado = String(value || '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return BRL_CURRENCY.format(Number(value || 0));
}

function getProdutoCarrinhoId(produto) {
  const id = Number(produto?.id);
  return Number.isFinite(id) ? id : null;
}

function getProdutoNome(produto) {
  const nome = String(produto?.nome || '').trim();
  return nome || 'Produto sem nome';
}

function getProdutoCategoriaLabel(produto) {
  const categoria = String(produto?.categoria || '').trim();
  return categoria || 'Categoria não informada';
}

function getProdutoMedida(produto) {
  const unidade = String(produto?.unidade || '').trim();
  const medidaExtra = [
    produto?.peso,
    produto?.volume,
    produto?.conteudo,
    produto?.tamanho
  ]
    .map((item) => String(item || '').trim())
    .find(Boolean);

  if (medidaExtra && unidade) {
    return `${medidaExtra} ${unidade}`.trim();
  }

  if (medidaExtra) {
    return medidaExtra;
  }

  if (!unidade) {
    return '';
  }

  return unidade.toLowerCase() === 'un' ? 'Unidade' : unidade;
}

function getProdutoDetalheComercial(produto) {
  const marca = String(produto?.marca || '').trim();
  const medida = getProdutoMedida(produto);

  if (marca && medida) {
    return `${marca} • ${medida}`;
  }
  if (marca) {
    return marca;
  }
  if (medida) {
    return medida;
  }
  return 'Seleção especial Bomfilho';
}

function getProdutoPrecoInfo(produto) {
  const precoBase = Math.max(0, toNumber(produto?.preco));
  const precoPromocional = Math.max(0, toNumber(produto?.preco_promocional));
  const descontoValor = Math.max(0, toNumber(produto?.desconto));
  const descontoPercentual = Math.max(0, toNumber(produto?.percentual_desconto));
  const precoPix = Math.max(0, toNumber(produto?.preco_pix));

  let precoAtual = precoBase;
  let precoAnterior = null;

  if (precoPromocional > 0 && precoPromocional < precoBase) {
    precoAtual = precoPromocional;
    precoAnterior = precoBase;
  } else if (descontoValor > 0 && descontoValor < precoBase) {
    precoAtual = precoBase - descontoValor;
    precoAnterior = precoBase;
  } else if (descontoPercentual > 0 && descontoPercentual < 100 && precoBase > 0) {
    precoAtual = precoBase * (1 - (descontoPercentual / 100));
    precoAnterior = precoBase;
  }

  const precoAtualNormalizado = Number(precoAtual.toFixed(2));
  const precoAnteriorNormalizado =
    precoAnterior && precoAnterior > precoAtualNormalizado
      ? Number(precoAnterior.toFixed(2))
      : null;

  const economia = precoAnteriorNormalizado
    ? Number((precoAnteriorNormalizado - precoAtualNormalizado).toFixed(2))
    : 0;
  const percentualEconomia = precoAnteriorNormalizado
    ? Math.round((economia / precoAnteriorNormalizado) * 100)
    : 0;

  return {
    precoAtual: precoAtualNormalizado,
    precoAnterior: precoAnteriorNormalizado,
    economia,
    percentualEconomia,
    precoPix: precoPix > 0 ? Number(precoPix.toFixed(2)) : null,
    emPromocao: Boolean(precoAnteriorNormalizado) || isProdutoEmPromocao(produto)
  };
}

function getScoreMaisVendido(produtoIndexado) {
  let score = 0;

  if (produtoIndexado.emPromocao) {
    score += 3;
  }
  if (produtoIndexado.precoInfo.percentualEconomia >= 10) {
    score += 2;
  }
  if (TOKENS_MAIS_VENDIDOS.some((token) => produtoIndexado.textoBusca.includes(token))) {
    score += 5;
  }
  if (produtoIndexado.categoriaNormalizada.includes('mercearia')) {
    score += 2;
  }
  if (produtoIndexado.categoriaNormalizada.includes('bebida')) {
    score += 1;
  }

  return score;
}

function compareProdutosPorNome(a, b) {
  return PT_BR_COLLATOR.compare(a.nomeProduto, b.nomeProduto);
}

function sortProdutosIndexados(lista, ordenacao) {
  const ordenados = [...lista];

  switch (ordenacao) {
    case 'menor-preco':
      ordenados.sort((a, b) => {
        const diff = a.precoInfo.precoAtual - b.precoInfo.precoAtual;
        return diff === 0 ? compareProdutosPorNome(a, b) : diff;
      });
      break;
    case 'maior-preco':
      ordenados.sort((a, b) => {
        const diff = b.precoInfo.precoAtual - a.precoInfo.precoAtual;
        return diff === 0 ? compareProdutosPorNome(a, b) : diff;
      });
      break;
    case 'az':
      ordenados.sort(compareProdutosPorNome);
      break;
    case 'promocoes':
      ordenados.sort((a, b) => {
        const promoDiff = Number(b.emPromocao) - Number(a.emPromocao);
        if (promoDiff !== 0) {
          return promoDiff;
        }

        const descontoDiff = b.precoInfo.percentualEconomia - a.precoInfo.percentualEconomia;
        if (descontoDiff !== 0) {
          return descontoDiff;
        }

        return compareProdutosPorNome(a, b);
      });
      break;
    case 'mais-vendidos':
    default:
      ordenados.sort((a, b) => {
        const scoreDiff = b.scoreMaisVendido - a.scoreMaisVendido;
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        const promoDiff = Number(b.emPromocao) - Number(a.emPromocao);
        if (promoDiff !== 0) {
          return promoDiff;
        }

        return compareProdutosPorNome(a, b);
      });
      break;
  }

  return ordenados;
}

function getProdutoBadges(
  produtoIndexado,
  {
    destaqueMaisVendido = false,
    destaqueNovo = false
  } = {}
) {
  const badges = [];
  const { precoInfo } = produtoIndexado;

  if (produtoIndexado.emPromocao || precoInfo.precoAnterior) {
    badges.push({
      tone: 'oferta',
      label: precoInfo.percentualEconomia >= 5
        ? `${precoInfo.percentualEconomia}% OFF`
        : 'Oferta'
    });
  }

  if (destaqueMaisVendido) {
    badges.push({ tone: 'mais-vendido', label: 'Mais vendido' });
  }

  if (destaqueNovo) {
    badges.push({ tone: 'novo', label: 'Novo' });
  }

  if (
    (produtoIndexado.textoBusca.includes('leve 2') || produtoIndexado.textoBusca.includes('2x'))
    && badges.length < 2
  ) {
    badges.push({ tone: 'combo', label: 'Leve 2' });
  }

  if (precoInfo.economia >= 2 && badges.length < 2) {
    badges.push({ tone: 'desconto', label: 'Desconto' });
  }

  return badges.slice(0, 2);
}

function getPlaceholderIconePorCategoria(produto) {
  const categoriaNormalizada = normalizeText(produto?.categoria);
  const entrada = Object.entries(CATEGORIA_ICONE_FALLBACK).find(([categoria]) =>
    categoriaNormalizada.includes(categoria)
  );
  return entrada?.[1] || '🛍️';
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

  if (!srcBase) {
    return {
      src: '',
      srcSet: undefined,
      sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px'
    };
  }

  if (!isUnsplashUrl(srcBase)) {
    return {
      src: srcBase,
      srcSet: undefined,
      sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px'
    };
  }

  const widths = [240, 340, 460, 680, 920];
  return {
    src: buildUnsplashVariant(srcBase, 460),
    srcSet: widths.map((width) => `${buildUnsplashVariant(srcBase, width)} ${width}w`).join(', '),
    sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px'
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

const VIRTUALIZATION_THRESHOLD = 64;
const VIRTUAL_GRID_GAP = 14;
const VIRTUAL_CARD_MIN_WIDTH_DESKTOP = 236;
const VIRTUAL_CARD_MIN_WIDTH_MOBILE = 174;
const VIRTUAL_CARD_HEIGHT_DESKTOP = 436;
const VIRTUAL_CARD_HEIGHT_MOBILE = 412;
const VIRTUAL_GRID_MIN_HEIGHT = 300;

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

const ProdutoImageFallback = React.memo(function ProdutoImageFallback({ produto }) {
  return (
    <div className="produto-image-fallback" role="img" aria-label="Imagem em atualização">
      <span className="produto-image-fallback-icon" aria-hidden="true">
        {getPlaceholderIconePorCategoria(produto)}
      </span>
      <span className="produto-image-fallback-text">Imagem em atualização</span>
    </div>
  );
});

ProdutoImageFallback.displayName = 'ProdutoImageFallback';

function ProdutoBadge({ tone, label }) {
  return <span className={`produto-badge produto-badge-${tone}`}>{label}</span>;
}

function ProdutosSkeletonGrid({ quantidade = 10 }) {
  return (
    <div className="produto-grid produtos-skeleton-grid" aria-hidden="true">
      {Array.from({ length: quantidade }).map((_, index) => (
        <article className="produto-card produto-card-skeleton" key={`produto-skeleton-${index}`}>
          <div className="produto-skeleton-media" />
          <div className="produto-skeleton-line produto-skeleton-line-title" />
          <div className="produto-skeleton-line" />
          <div className="produto-skeleton-line produto-skeleton-line-price" />
          <div className="produto-skeleton-button" />
        </article>
      ))}
    </div>
  );
}

const ProdutoCard = React.memo(function ProdutoCard({
  produtoIndexado,
  quantidadeNoCarrinho,
  destaqueMaisVendido,
  destaqueNovo,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem
}) {
  const produto = produtoIndexado.produto;
  const imagem = produtoIndexado.imagemResponsiva;
  const [imagemIndisponivel, setImagemIndisponivel] = useState(() => !imagem.src);

  useEffect(() => {
    setImagemIndisponivel(!imagem.src);
  }, [imagem.src]);

  const nomeProduto = produtoIndexado.nomeProduto;
  const categoriaLabel = produtoIndexado.categoriaLabel;
  const detalhesProduto = produtoIndexado.detalhesComerciais;
  const precoInfo = produtoIndexado.precoInfo;
  const badges = useMemo(() => getProdutoBadges(produtoIndexado, {
    destaqueMaisVendido,
    destaqueNovo
  }), [destaqueMaisVendido, destaqueNovo, produtoIndexado]);
  const podeComprar = produtoIndexado.carrinhoId !== null;

  return (
    <article className="produto-card">
      <div className="produto-card-media">
        {badges.length > 0 ? (
          <div className="produto-badges" aria-label="Selos do produto">
            {badges.map((badge) => (
              <ProdutoBadge key={`${badge.tone}:${badge.label}`} tone={badge.tone} label={badge.label} />
            ))}
          </div>
        ) : null}

        {imagemIndisponivel ? (
          <ProdutoImageFallback produto={produto} />
        ) : (
          <img
            className="produto-image"
            src={imagem.src}
            srcSet={imagem.srcSet}
            sizes={imagem.sizes}
            alt={nomeProduto}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            onError={() => {
              setImagemIndisponivel(true);
            }}
          />
        )}
      </div>

      <div className="produto-card-body">
        <p className="produto-category">
          <span aria-hidden="true">{produto.emoji || '🛒'}</span>
          {categoriaLabel}
        </p>
        <h3 className="produto-title" title={nomeProduto}>{nomeProduto}</h3>
        <p className="produto-details">{detalhesProduto}</p>

        <div className="produto-price-area">
          <p className="produto-price">{formatCurrency(precoInfo.precoAtual)}</p>
          {precoInfo.precoAnterior ? (
            <p className="produto-price-old">de {formatCurrency(precoInfo.precoAnterior)}</p>
          ) : null}
          {precoInfo.economia > 0 ? (
            <p className="produto-price-saving">Economize {formatCurrency(precoInfo.economia)}</p>
          ) : null}
          {precoInfo.precoPix ? (
            <p className="produto-price-pix">{formatCurrency(precoInfo.precoPix)} no Pix</p>
          ) : null}
        </div>
      </div>

      <div className="produto-card-actions">
        {quantidadeNoCarrinho > 0 ? (
          <div className="produto-qty-control" aria-label={`Quantidade de ${nomeProduto} no carrinho`}>
            <button
              type="button"
              className="produto-qty-btn"
              onClick={() => onDecreaseItem(produto, quantidadeNoCarrinho)}
              aria-label={`Diminuir quantidade de ${nomeProduto}`}
            >
              -
            </button>
            <span className="produto-qty-value">{quantidadeNoCarrinho} no carrinho</span>
            <button
              type="button"
              className="produto-qty-btn"
              onClick={() => onIncreaseItem(produto)}
              aria-label={`Aumentar quantidade de ${nomeProduto}`}
            >
              +
            </button>
          </div>
        ) : null}

        <button
          className="btn-primary produto-add-btn"
          type="button"
          onClick={() => onAddItem(produto)}
          disabled={!podeComprar}
        >
          {podeComprar ? (quantidadeNoCarrinho > 0 ? 'Adicionar mais' : 'Adicionar') : 'Indisponível'}
        </button>
      </div>
    </article>
  );
});

ProdutoCard.displayName = 'ProdutoCard';

const VirtualizedProdutoGrid = React.memo(function VirtualizedProdutoGrid({
  itensIndexados,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem,
  getQuantidadeProduto,
  chavesMaisVendidos,
  idsNovidades,
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
    onIncreaseItem,
    onDecreaseItem,
    getQuantidadeProduto,
    chavesMaisVendidos,
    idsNovidades,
    columnCount
  }), [
    chavesMaisVendidos,
    columnCount,
    getQuantidadeProduto,
    idsNovidades,
    itensIndexados,
    onAddItem,
    onDecreaseItem,
    onIncreaseItem
  ]);
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
    onIncreaseItem: onIncrease,
    onDecreaseItem: onDecrease,
    getQuantidadeProduto: getQtd,
    chavesMaisVendidos: maisVendidos,
    idsNovidades: novidades,
    columnCount: columns
  }) => {
    const index = rowIndex * columns + columnIndex;
    const produtoIndexado = itens[index];

    if (!produtoIndexado) {
      return null;
    }

    const destaqueMaisVendido = maisVendidos.has(produtoIndexado.chaveReact);
    const destaqueNovo = produtoIndexado.carrinhoId !== null && novidades.has(produtoIndexado.carrinhoId);

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
          quantidadeNoCarrinho={getQtd(produtoIndexado.produto)}
          destaqueMaisVendido={destaqueMaisVendido}
          destaqueNovo={destaqueNovo}
          onAddItem={onAdd}
          onIncreaseItem={onIncrease}
          onDecreaseItem={onDecrease}
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
            quantidadeNoCarrinho={getQuantidadeProduto(produtoIndexado.produto)}
            destaqueMaisVendido={chavesMaisVendidos.has(produtoIndexado.chaveReact)}
            destaqueNovo={
              produtoIndexado.carrinhoId !== null
              && idsNovidades.has(produtoIndexado.carrinhoId)
            }
            onAddItem={onAddItem}
            onIncreaseItem={onIncreaseItem}
            onDecreaseItem={onDecreaseItem}
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
              quantidadeNoCarrinho={getQuantidadeProduto(produtoIndexado.produto)}
              destaqueMaisVendido={chavesMaisVendidos.has(produtoIndexado.chaveReact)}
              destaqueNovo={
                produtoIndexado.carrinhoId !== null
                && idsNovidades.has(produtoIndexado.carrinhoId)
              }
              onAddItem={onAddItem}
              onIncreaseItem={onIncreaseItem}
              onDecreaseItem={onDecreaseItem}
            />
          ))}
        </div>
      )}
    </div>
  );
});

VirtualizedProdutoGrid.displayName = 'VirtualizedProdutoGrid';

export default function ProdutosPage() {
  const { itens, addItem, updateItemQuantity, removeItem, resumo } = useCart();
  const [searchParams] = useSearchParams();
  const categoriaInicial = String(searchParams.get('categoria') || CATEGORIA_TODAS).toLowerCase();
  const buscaInicial = String(searchParams.get('busca') || '');

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
  }, []);

  // Índice local com campos normalizados para evitar recomputações em cada filtro/render.
  const produtosIndexados = useMemo(() => {
    return produtos.map((produto) => {
      const nomeProduto = getProdutoNome(produto);
      const categoriaLabel = getProdutoCategoriaLabel(produto);
      const detalhesComerciais = getProdutoDetalheComercial(produto);
      const textoBusca = getTextoProduto(produto);
      const categoriaOriginal = String(produto?.categoria || '').toLowerCase();
      const categoriaNormalizada = normalizeText(categoriaOriginal);
      const precoInfo = getProdutoPrecoInfo(produto);
      const imagemResponsiva = getProdutoImagemResponsiva(produto);

      const indexadoBase = {
        chaveReact: getProdutoStableKey(produto),
        produto,
        nomeProduto,
        categoriaLabel,
        detalhesComerciais,
        textoBusca,
        categoriaOriginal,
        categoriaNormalizada,
        categoriaEhBebida: categoriaNormalizada.includes(TOKEN_BEBIDA),
        carrinhoId: getProdutoCarrinhoId(produto),
        precoInfo,
        emPromocao: precoInfo.emPromocao,
        bebidaSubcategoriaId: getBebidaSubcategoriaIdByTexto(textoBusca),
        imagemResponsiva
      };

      return {
        ...indexadoBase,
        scoreMaisVendido: getScoreMaisVendido(indexadoBase)
      };
    });
  }, [produtos]);

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
  }, [categoria, filtroCategoriaAtivo, filtroPromocaoAtivo, produtosIndexados, termoBusca]);

  const produtosOrdenadosIndexados = useMemo(() => {
    return sortProdutosIndexados(produtosFiltradosBase, ordenacao);
  }, [ordenacao, produtosFiltradosBase]);

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

  const getQuantidadeProduto = useCallback((produto) => {
    const id = getProdutoCarrinhoId(produto);
    if (id === null) {
      return 0;
    }
    return quantidadesCarrinhoPorId.get(id) || 0;
  }, [quantidadesCarrinhoPorId]);

  const handleAddItem = useCallback((produto) => {
    addItem(produto, 1);
  }, [addItem]);

  const handleIncreaseItem = useCallback((produto) => {
    addItem(produto, 1);
  }, [addItem]);

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
        getQuantidadeProduto={getQuantidadeProduto}
        chavesMaisVendidos={chavesMaisVendidos}
        idsNovidades={idsNovidades}
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
    idsNovidades
  ]);

  const totalItensVitrine = totalProdutosBackend || produtos.length;
  const totalOfertasDisponiveis = useMemo(() => {
    return produtosIndexados.filter((item) => item.emPromocao).length;
  }, [produtosIndexados]);

  const totalMaisVendidosVitrine = chavesMaisVendidos.size;

  const filtrosAplicados = Boolean(normalizeText(busca))
    || categoria !== CATEGORIA_TODAS
    || bebidaSubcategoria !== 'todas'
    || ordenacao !== ORDENACOES_PRODUTOS[0].id;

  const podeFinalizarPedido = resumo.itens > 0;
  const itensResumoTexto = resumo.itens === 1 ? '1 item' : `${resumo.itens} itens`;
  const subtotalTexto = formatCurrency(resumo.total);

  const mostrarSkeletonInicial = carregando && produtos.length === 0;
  const mostrarErro = Boolean(erro) && !carregando;

  const renderSemResultados = useCallback((titulo, descricao) => {
    return (
      <div className="products-empty-state" role="status" aria-live="polite">
        <span className="products-empty-icon" aria-hidden="true">🔎</span>
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

  let conteudoProdutos = null;

  if (mostrarSkeletonInicial) {
    conteudoProdutos = <ProdutosSkeletonGrid quantidade={10} />;
  } else if (mostrarErro) {
    conteudoProdutos = (
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
    conteudoProdutos = renderSemResultados(
      'Nenhum produto encontrado',
      'Tente buscar outro termo ou ajuste os filtros para ver mais opções.'
    );
  } else if (categoriaEhBebidas) {
    if (bebidaSubcategoria === 'todas') {
      conteudoProdutos = secoesBebidas.length > 0
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
      conteudoProdutos = gruposMarcaBebidas.length > 0
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
  } else {
    conteudoProdutos = renderProdutosGrid(produtosFiltradosIndexados, { listId: 'produtos-lista' });
  }

  return (
    <section className="page page-produtos">
      <section className="products-hero" id="produtos" aria-label="Página de produtos">
        <div className="products-hero-header">
          <div className="products-hero-copy">
            <p className="products-hero-kicker">Vitrine Bomfilho</p>
            <h1>Produtos</h1>
            <p className="products-hero-subtitle">
              Compare preços rapidamente, encontre ofertas do dia e adicione ao carrinho em poucos cliques.
            </p>
          </div>

          <div className="products-hero-metrics" aria-label="Indicadores da vitrine">
            <article className="products-metric-card">
              <strong>{totalItensVitrine}</strong>
              <span>itens na vitrine</span>
            </article>
            <article className="products-metric-card products-metric-card-highlight">
              <strong>{totalOfertasDisponiveis}</strong>
              <span>promoções do dia</span>
            </article>
            <article className="products-metric-card">
              <strong>{totalMaisVendidosVitrine}</strong>
              <span>mais vendidos</span>
            </article>
          </div>
        </div>

        <div className="products-search-wrap">
          <label className="field-label" htmlFor="busca-produtos">Buscar produtos</label>
          <div className="products-search-input-wrap">
            <span className="products-search-icon" aria-hidden="true">🔎</span>
            <input
              id="busca-produtos"
              className="field-input products-search-input"
              type="search"
              value={busca}
              onChange={handleBuscaChange}
              placeholder="Busque por arroz, leite, café, detergente..."
            />
          </div>
        </div>

        <div className="products-toolbar-grid">
          <div className="products-toolbar-field">
            <label className="field-label" htmlFor="produtos-categoria-select">Categoria</label>
            <select
              id="produtos-categoria-select"
              className="field-input"
              value={categoria}
              onChange={handleCategoriaSelectChange}
            >
              {categorias.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="products-toolbar-field">
            <label className="field-label" htmlFor="produtos-ordenacao-select">Ordenar por</label>
            <select
              id="produtos-ordenacao-select"
              className="field-input"
              value={ordenacao}
              onChange={handleOrdenacaoChange}
            >
              {ORDENACOES_PRODUTOS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="products-toolbar-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={handleLimparFiltros}
              disabled={!filtrosAplicados}
            >
              Limpar filtros
            </button>

            <button
              className="btn-secondary"
              type="button"
              onClick={handleAtualizarProdutos}
              disabled={carregando}
            >
              {carregando ? 'Atualizando vitrine...' : 'Atualizar vitrine'}
            </button>
          </div>
        </div>

        <div className="legacy-categories products-quick-filters" aria-label="Filtros rápidos de categoria">
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

        <div className="products-results-bar" aria-live="polite">
          <p>
            <strong>{produtosFiltradosIndexados.length}</strong> produtos exibidos
            {totalProdutosBackend > 0 ? ` de ${totalProdutosBackend}` : ''}
          </p>
          <div className="products-results-meta">
            <span>{totalOfertasDisponiveis} em oferta</span>
            {carregando && produtos.length > 0 ? (
              <span className="products-results-pill">Atualizando vitrine...</span>
            ) : null}
          </div>
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

      <div className="pedido-resumo pedido-resumo-fixo" role="region" aria-label="Resumo do pedido e avanço para pagamento">
        <div className="pedido-resumo-fixo-conteudo">
          <span className="pedido-resumo-fixo-icone" aria-hidden="true">🛒</span>

          <div className="pedido-resumo-fixo-info" title={`Itens: ${resumo.itens} | Total: ${subtotalTexto}`}>
            <p className="pedido-resumo-fixo-linha">
              <strong>{itensResumoTexto}</strong>
              <span className="pedido-resumo-fixo-separador" aria-hidden="true">•</span>
              <span>Total {subtotalTexto}</span>
            </p>
            <p className="pedido-resumo-fixo-meta">
              {podeFinalizarPedido
                ? 'Frete estimado será calculado no checkout'
                : 'Adicione itens para seguir para o checkout'}
            </p>
          </div>

          {podeFinalizarPedido ? (
            <Link to="/pagamento" className="btn-primary pedido-resumo-fixo-botao">
              <span className="pedido-resumo-fixo-botao-icon" aria-hidden="true">🧾</span>
              Ir para checkout
            </Link>
          ) : (
            <button type="button" className="btn-primary pedido-resumo-fixo-botao" disabled>
              <span className="pedido-resumo-fixo-botao-icon" aria-hidden="true">🧾</span>
              Ir para checkout
            </button>
          )}
        </div>
      </div>
    </section>
  );
}