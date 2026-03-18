import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Grid } from 'react-window';
import { getProdutos } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useRecorrencia } from '../context/RecorrenciaContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import usePreloadImage from '../hooks/usePreloadImage';
import SmartImage from '../components/ui/SmartImage';
import {
  buildProductEventPayload,
  captureCommerceEvent
} from '../lib/commerceTracking';
import {
  GROWTH_BOTTLENECK_LABELS,
  GROWTH_UPDATE_EVENT_NAME,
  getGrowthInsights
} from '../lib/conversionGrowth';

const ProdutoDecisionDrawer = React.lazy(() => import('../components/ProdutoDecisionDrawer'));

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
  { id: 'mais-vendidos', label: 'Mais comprados' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
  { id: 'az', label: 'A-Z' },
  { id: 'promocoes', label: 'Promoções' }
];

const BUSCA_SUGESTOES_RAPIDAS = [
  { id: 'sug-arroz', label: 'Arroz', termo: 'arroz', categoria: CATEGORIA_TODAS },
  { id: 'sug-leite', label: 'Leite', termo: 'leite', categoria: CATEGORIA_TODAS },
  { id: 'sug-cafe', label: 'Cafe', termo: 'cafe', categoria: CATEGORIA_TODAS },
  { id: 'sug-bebidas', label: 'Bebidas', termo: 'bebida', categoria: CATEGORIA_BEBIDAS },
  { id: 'sug-limpeza', label: 'Limpeza', termo: 'limpeza', categoria: 'limpeza' },
  { id: 'sug-promocoes', label: 'Promocoes', termo: '', categoria: CATEGORIA_PROMOCOES }
];

const FILTROS_RECORRENCIA = [
  { id: 'todos', label: 'Tudo' },
  { id: 'favoritos', label: 'Favoritos' },
  { id: 'recompra', label: 'Comprar novamente' }
];

const FILTROS_COMERCIAIS_RAPIDOS = [
  {
    id: 'atalho-ofertas',
    label: 'Ofertas reais',
    descricao: 'Somente itens em promocao',
    onSelect: ({ setCategoria, setOrdenacao, setFiltroRecorrencia, setBusca, setBebidaSubcategoria }) => {
      setCategoria(CATEGORIA_PROMOCOES);
      setOrdenacao('promocoes');
      setFiltroRecorrencia('todos');
      setBusca('');
      setBebidaSubcategoria('todas');
    }
  },
  {
    id: 'atalho-mais-procurados',
    label: 'Mais procurados',
    descricao: 'Itens de maior interesse',
    onSelect: ({ setOrdenacao, setFiltroRecorrencia }) => {
      setOrdenacao('mais-vendidos');
      setFiltroRecorrencia('todos');
    }
  },
  {
    id: 'atalho-favoritos',
    label: 'Meus favoritos',
    descricao: 'Acesso rapido aos salvos',
    onSelect: ({ setFiltroRecorrencia }) => {
      setFiltroRecorrencia('favoritos');
    }
  },
  {
    id: 'atalho-recompra',
    label: 'Recompra inteligente',
    descricao: 'Compre de novo com menos esforco',
    onSelect: ({ setFiltroRecorrencia }) => {
      setFiltroRecorrencia('recompra');
    }
  }
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
const ESTOQUE_BAIXO_LIMIAR = 5;

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

function formatConversionRate(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '0%';
  }

  return `${Math.round(normalized * 100)}%`;
}

function getProdutoCarrinhoId(produto) {
  const id = Number(produto?.id);
  return Number.isFinite(id) ? id : null;
}

function getProdutoIdNormalizado(produtoOuId) {
  if (produtoOuId === null || produtoOuId === undefined) {
    return null;
  }

  if (typeof produtoOuId === 'number' || typeof produtoOuId === 'string') {
    const idDireto = Number(produtoOuId);
    return Number.isFinite(idDireto) && idDireto > 0 ? idDireto : null;
  }

  const id = Number(produtoOuId?.id || produtoOuId?.produto_id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
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

function getProdutoEstoqueInfo(produto) {
  const candidatos = [
    produto?.estoque,
    produto?.estoque_atual,
    produto?.quantidade_estoque,
    produto?.saldo_estoque,
    produto?.saldo
  ];

  for (const candidato of candidatos) {
    const texto = String(candidato ?? '').trim();
    if (!texto || !/\d/.test(texto)) {
      continue;
    }

    const quantidade = Math.max(0, Math.trunc(toNumber(texto)));
    return {
      informado: true,
      quantidade,
      estoqueBaixo: quantidade > 0 && quantidade <= ESTOQUE_BAIXO_LIMIAR,
      semEstoque: quantidade === 0
    };
  }

  return {
    informado: false,
    quantidade: null,
    estoqueBaixo: false,
    semEstoque: false
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

function getScoreComportamento(item, scoreComportamentoPorId) {
  const id = Number(item?.carrinhoId || 0);
  if (!id || !scoreComportamentoPorId) {
    return 0;
  }

  return Number(scoreComportamentoPorId.get(id) || 0);
}

function sortProdutosIndexados(
  lista,
  ordenacao,
  {
    priorizarConversao = true,
    priorizarPersonalizacao = false,
    scoreComportamentoPorId = null
  } = {}
) {
  const ordenados = [...lista];

  switch (ordenacao) {
    case 'menor-preco':
      ordenados.sort((a, b) => {
        const diff = a.precoInfo.precoAtual - b.precoInfo.precoAtual;
        if (diff !== 0) {
          return diff;
        }

        if (priorizarPersonalizacao) {
          const scoreComportamentoDiff = getScoreComportamento(b, scoreComportamentoPorId)
            - getScoreComportamento(a, scoreComportamentoPorId);
          if (scoreComportamentoDiff !== 0) {
            return scoreComportamentoDiff;
          }
        }

        return compareProdutosPorNome(a, b);
      });
      break;
    case 'maior-preco':
      ordenados.sort((a, b) => {
        const diff = b.precoInfo.precoAtual - a.precoInfo.precoAtual;
        if (diff !== 0) {
          return diff;
        }

        if (priorizarPersonalizacao) {
          const scoreComportamentoDiff = getScoreComportamento(b, scoreComportamentoPorId)
            - getScoreComportamento(a, scoreComportamentoPorId);
          if (scoreComportamentoDiff !== 0) {
            return scoreComportamentoDiff;
          }
        }

        return compareProdutosPorNome(a, b);
      });
      break;
    case 'az':
      ordenados.sort((a, b) => {
        if (priorizarPersonalizacao) {
          const scoreComportamentoDiff = getScoreComportamento(b, scoreComportamentoPorId)
            - getScoreComportamento(a, scoreComportamentoPorId);
          if (scoreComportamentoDiff !== 0) {
            return scoreComportamentoDiff;
          }
        }

        return compareProdutosPorNome(a, b);
      });
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

        if (priorizarPersonalizacao) {
          const scoreComportamentoDiff = getScoreComportamento(b, scoreComportamentoPorId)
            - getScoreComportamento(a, scoreComportamentoPorId);
          if (scoreComportamentoDiff !== 0) {
            return scoreComportamentoDiff;
          }
        }

        return compareProdutosPorNome(a, b);
      });
      break;
    case 'mais-vendidos':
    default:
      ordenados.sort((a, b) => {
        if (priorizarConversao) {
          const conversaoDiff = Number(b.scoreConversao || 0) - Number(a.scoreConversao || 0);
          if (conversaoDiff !== 0) {
            return conversaoDiff;
          }
        }

        if (priorizarPersonalizacao) {
          const scoreComportamentoDiff = getScoreComportamento(b, scoreComportamentoPorId)
            - getScoreComportamento(a, scoreComportamentoPorId);
          if (scoreComportamentoDiff !== 0) {
            return scoreComportamentoDiff;
          }
        }

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
    destaqueNovo = false,
    destaqueConversao = false,
    favorito = false,
    recorrente = false,
    recomendado = false,
    growthBadgeLabel = ''
  } = {}
) {
  const badges = [];
  const { precoInfo } = produtoIndexado;

  if (growthBadgeLabel) {
    badges.push({ tone: 'growth', label: growthBadgeLabel });
  }

  if (destaqueConversao) {
    badges.push({ tone: 'conversao', label: 'Alta conversao' });
  }

  if (produtoIndexado.emPromocao || precoInfo.precoAnterior) {
    badges.push({
      tone: 'oferta',
      label: precoInfo.percentualEconomia >= 5
        ? `${precoInfo.percentualEconomia}% OFF`
        : 'OFERTA'
    });
  }

  if (destaqueMaisVendido) {
    badges.push({ tone: 'mais-vendido', label: 'Mais comprado' });
  }

  if (favorito) {
    badges.push({ tone: 'favorito', label: 'Favorito' });
  }

  if (recorrente) {
    badges.push({ tone: 'recorrente', label: 'Compra frequente' });
  }

  if (recomendado) {
    badges.push({ tone: 'recomendado', label: 'Recomendado' });
  }

  if (destaqueNovo) {
    badges.push({ tone: 'novo', label: 'Novo' });
  }

  if (
    (produtoIndexado.textoBusca.includes('leve 2') || produtoIndexado.textoBusca.includes('2x'))
    && badges.length < 3
  ) {
    badges.push({ tone: 'combo', label: 'Leve 2' });
  }

  if (precoInfo.economia >= 2 && badges.length < 3) {
    badges.push({ tone: 'desconto', label: 'Desconto' });
  }

  const badgesUnicos = [];
  const labels = new Set();

  badges.forEach((badge) => {
    if (labels.has(badge.label)) {
      return;
    }
    labels.add(badge.label);
    badgesUnicos.push(badge);
  });

  return badgesUnicos.slice(0, 3);
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

function buildUnsplashVariant(url, width, quality = 60) {
  if (!isUnsplashUrl(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('auto', 'format');
    parsed.searchParams.set('fit', 'crop');
    parsed.searchParams.set('q', String(quality));
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
      blurSrc: '',
      srcSet: undefined,
      sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px'
    };
  }

  if (!isUnsplashUrl(srcBase)) {
    return {
      src: srcBase,
      blurSrc: '',
      srcSet: undefined,
      sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px'
    };
  }

  const widths = [240, 340, 460, 680, 920];
  return {
    src: buildUnsplashVariant(srcBase, 460),
    blurSrc: buildUnsplashVariant(srcBase, 64, 24),
    srcSet: widths.map((width) => `${buildUnsplashVariant(srcBase, width)} ${width}w`).join(', '),
    sizes: '(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 240px'
  };
}

function getProdutoImagemBlurSrc(produto) {
  const srcBase = getProdutoImagem(produto);
  if (!isUnsplashUrl(srcBase)) {
    return '';
  }

  return buildUnsplashVariant(srcBase, 64, 24);
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
const VIRTUAL_CARD_HEIGHT_DESKTOP = 448;
const VIRTUAL_CARD_HEIGHT_MOBILE = 324;
const VIRTUAL_GRID_MIN_HEIGHT = 300;
const PREFETCHED_PRODUCT_IMAGE_LIMIT = 1200;
const prefetchedProductImageSrc = new Set();
const prefetchedProductImageQueue = [];

function prefetchProductImage(src) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedSrc = String(src || '').trim();
  if (!normalizedSrc || prefetchedProductImageSrc.has(normalizedSrc)) {
    return;
  }

  prefetchedProductImageSrc.add(normalizedSrc);
  prefetchedProductImageQueue.push(normalizedSrc);

  while (prefetchedProductImageQueue.length > PREFETCHED_PRODUCT_IMAGE_LIMIT) {
    const oldest = prefetchedProductImageQueue.shift();
    if (oldest) {
      prefetchedProductImageSrc.delete(oldest);
    }
  }

  const prefetchImageElement = new window.Image();
  prefetchImageElement.decoding = 'async';
  prefetchImageElement.src = normalizedSrc;
}

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
  index = 0,
  isMobileViewport = false,
  nextImageSrc = '',
  estaAdicionando = false,
  quantidadeNoCarrinho,
  destaqueMaisVendido,
  destaqueNovo,
  destaqueConversao = false,
  favorito = false,
  sinalRecorrente = false,
  sinalRecomendado = false,
  growthExperimento = null,
  foiAdicionadoRecente = false,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem,
  onToggleFavorito,
  onOpenDetail
}) {
  const produto = produtoIndexado.produto;
  const imagem = produtoIndexado.imagemResponsiva;
  const [imagemIndisponivel, setImagemIndisponivel] = useState(() => !imagem.src);

  useEffect(() => {
    setImagemIndisponivel(!imagem.src);
  }, [imagem.src]);

  useEffect(() => {
    prefetchProductImage(nextImageSrc);
  }, [nextImageSrc]);

  const nomeProduto = produtoIndexado.nomeProduto;
  const categoriaLabel = produtoIndexado.categoriaLabel;
  const detalhesProduto = produtoIndexado.detalhesComerciais;
  const medidaProduto = produtoIndexado.medidaProduto;
  const precoInfo = produtoIndexado.precoInfo;
  const estoqueInfo = produtoIndexado.estoqueInfo;
  const growthCatalogConfig = growthExperimento?.catalog || null;
  const growthCatalogEnabled = Boolean(growthCatalogConfig?.enabled);
  const growthCatalogBadge = growthCatalogEnabled
    ? String(growthCatalogConfig?.badgeLabel || '').trim()
    : '';
  const growthCatalogPriceHighlight = growthCatalogEnabled
    ? String(growthCatalogConfig?.priceHighlight || 'none').trim() || 'none'
    : 'none';
  const growthCatalogHelper = growthCatalogEnabled
    ? String(growthCatalogConfig?.helperText || '').trim()
    : '';
  const badges = useMemo(() => getProdutoBadges(produtoIndexado, {
    destaqueMaisVendido,
    destaqueNovo,
    destaqueConversao,
    favorito,
    recorrente: sinalRecorrente,
    recomendado: sinalRecomendado,
    growthBadgeLabel: growthCatalogBadge
  }), [
    destaqueMaisVendido,
    destaqueNovo,
    destaqueConversao,
    favorito,
    growthCatalogBadge,
    sinalRecorrente,
    sinalRecomendado,
    produtoIndexado
  ]);
  const podeComprar = produtoIndexado.carrinhoId !== null;
  const shouldPrioritizeImage = isMobileViewport ? index < 1 : index < 2;
  const urgenciaEstoqueAtiva = Boolean(podeComprar && estoqueInfo?.estoqueBaixo);
  const copyDisponibilidade = !podeComprar
    ? 'Indisponivel no momento'
    : (urgenciaEstoqueAtiva ? 'Restam poucas unidades' : '');
  const microcopyConversao = !podeComprar
    ? ''
    : (sinalRecorrente
      ? 'Baseado nas suas compras anteriores'
      : (growthCatalogHelper
        ? growthCatalogHelper
        : (urgenciaEstoqueAtiva
          ? 'Vale a pena levar agora'
          : (precoInfo.economia >= 1
            ? 'Economize hoje'
            : (destaqueMaisVendido ? 'Preco baixo de verdade' : 'Decisao rapida no carrinho')))));
  const precoCta = formatCurrency(precoInfo.precoAtual);
  const temPrecoNoCta = Number(precoInfo.precoAtual || 0) > 0;
  const ctaExperimentoCatalogo = !temPrecoNoCta || !growthCatalogEnabled
    ? ''
    : (growthCatalogConfig?.ctaMode === 'valor'
      ? `Levar agora • ${precoCta}`
      : (growthCatalogConfig?.ctaMode === 'urgencia' ? `Garantir hoje • ${precoCta}` : ''));
  const indicadorUrgencia = !podeComprar
    ? ''
    : (urgenciaEstoqueAtiva
      ? '⏳ Acabando'
      : (precoInfo.economia >= 1
        ? `💸 Economize ${formatCurrency(precoInfo.economia)}`
        : ((produtoIndexado.emPromocao || precoInfo.precoAnterior) ? '🔥 Oferta hoje' : '')));
  const ctaPrimaria = !podeComprar
    ? 'Indisponivel'
    : (estaAdicionando
      ? 'Adicionando...'
      : (temPrecoNoCta
        ? (quantidadeNoCarrinho > 0
          ? `Adicionar +1 • ${precoCta}`
          : (ctaExperimentoCatalogo
            || (precoInfo.precoAnterior ? `Levar por ${precoCta}` : `Adicionar agora • ${precoCta}`)))
        : 'Adicionar ao carrinho'));
  const priceAreaClassName = [
    'produto-price-area',
    growthCatalogEnabled ? `is-growth-${growthCatalogPriceHighlight}` : ''
  ].filter(Boolean).join(' ');
  const priceClassName = [
    'produto-price',
    (growthCatalogEnabled && growthCatalogPriceHighlight !== 'none') ? 'is-growth-emphasis' : ''
  ].filter(Boolean).join(' ');
  const cardClassName = [
    'produto-card',
    foiAdicionadoRecente ? 'is-added' : '',
    index === 0 ? 'is-prime' : '',
    indicadorUrgencia ? 'is-urgent' : '',
    (produtoIndexado.emPromocao || precoInfo.precoAnterior) ? 'is-offer' : '',
    (destaqueMaisVendido || sinalRecorrente) ? 'is-popular' : '',
    destaqueConversao ? 'is-conversion-winner' : ''
  ].filter(Boolean).join(' ');

  return (
    <article className={cardClassName}>
      <div className="produto-card-media">
        <button
          type="button"
          className={`produto-favorite-btn ${favorito ? 'is-active' : ''}`}
          onClick={() => onToggleFavorito(produto)}
          aria-label={favorito ? `Remover ${nomeProduto} dos favoritos` : `Salvar ${nomeProduto} nos favoritos`}
        >
          {favorito ? '♥' : '♡'}
        </button>

        {badges.length > 0 ? (
          <div className="produto-badges" aria-label="Selos do produto">
            {badges.map((badge) => (
              <ProdutoBadge key={`${badge.tone}:${badge.label}`} tone={badge.tone} label={badge.label} />
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="produto-media-button"
          onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
          aria-label={`Ver detalhes de ${nomeProduto}`}
        >
          {imagemIndisponivel ? (
            <ProdutoImageFallback produto={produto} />
          ) : (
            <SmartImage
              className="produto-image"
              src={imagem.src}
              blurSrc={imagem.blurSrc}
              srcSet={imagem.srcSet}
              sizes={imagem.sizes}
              alt={nomeProduto}
              priority={shouldPrioritizeImage}
              loading="lazy"
              decoding="async"
              onError={() => {
                setImagemIndisponivel(true);
              }}
            />
          )}
        </button>
      </div>

      <div className="produto-card-body">
        <p className="produto-category">
          <span aria-hidden="true">{produto.emoji || '🛒'}</span>
          {categoriaLabel}
        </p>
        <h3 className="produto-title" title={nomeProduto}>{nomeProduto}</h3>
        <p className="produto-details">{detalhesProduto}</p>
        {copyDisponibilidade ? (
          <p className={`produto-availability ${podeComprar ? 'is-available' : 'is-unavailable'} ${urgenciaEstoqueAtiva ? 'is-urgency' : ''}`.trim()}>
            {copyDisponibilidade}
          </p>
        ) : null}

        <div className={priceAreaClassName}>
          {precoInfo.precoAnterior ? (
            <p className="produto-price-old">de {formatCurrency(precoInfo.precoAnterior)}</p>
          ) : null}
          <p className={priceClassName}>{formatCurrency(precoInfo.precoAtual)}</p>

          {medidaProduto ? (
            <p className="produto-price-unit">Unidade: {medidaProduto}</p>
          ) : null}

          {precoInfo.economia > 0 ? (
            <p className="produto-price-saving">Economize {formatCurrency(precoInfo.economia)}</p>
          ) : null}
          {precoInfo.precoPix ? (
            <p className="produto-price-pix">{formatCurrency(precoInfo.precoPix)} no Pix</p>
          ) : null}
        </div>

        {indicadorUrgencia ? <p className="produto-urgency">{indicadorUrgencia}</p> : null}
      </div>

      <div className="produto-card-actions">
        {quantidadeNoCarrinho > 0 ? (
          <div className="produto-qty-control" aria-label={`Quantidade de ${nomeProduto} no carrinho`}>
            <button
              type="button"
              className="produto-qty-btn"
              onClick={() => onDecreaseItem(produto, quantidadeNoCarrinho)}
              aria-label={`Diminuir quantidade de ${nomeProduto}`}
              disabled={estaAdicionando}
            >
              -
            </button>
            <span className="produto-qty-value">{quantidadeNoCarrinho} no carrinho</span>
            <button
              type="button"
              className="produto-qty-btn"
              onClick={() => onIncreaseItem(produto)}
              aria-label={`Aumentar quantidade de ${nomeProduto}`}
              disabled={estaAdicionando}
            >
              +
            </button>
          </div>
        ) : null}

        {microcopyConversao ? <p className="produto-microcopy">{microcopyConversao}</p> : null}

        <div className="produto-card-actions-row">
          <button
            className={`btn-primary produto-add-btn ${estaAdicionando ? 'is-loading' : ''}`.trim()}
            type="button"
            onClick={() => onAddItem(produto)}
            disabled={!podeComprar || estaAdicionando}
          >
            {ctaPrimaria}
          </button>

          <button
            className="btn-secondary produto-detail-btn"
            type="button"
            onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
          >
            Ver detalhes
          </button>
        </div>

        {foiAdicionadoRecente ? (
          <p className="produto-card-feedback" role="status" aria-live="polite">
            Adicionado ao carrinho ✅
          </p>
        ) : null}
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
  onToggleFavorito,
  onOpenDetail,
  getQuantidadeProduto,
  chavesMaisVendidos,
  idsNovidades,
  favoritosIdsSet,
  recompraIdsSet,
  idsAltaConversaoSet,
  growthExperimento,
  produtoAdicionadoRecenteId,
  isProdutoAdicionando = () => false,
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
    onToggleFavorito,
    onOpenDetail,
    getQuantidadeProduto,
    chavesMaisVendidos,
    idsNovidades,
    favoritosIdsSet,
    recompraIdsSet,
    idsAltaConversaoSet,
    growthExperimento,
    produtoAdicionadoRecenteId,
    isProdutoAdicionando,
    columnCount,
    isMobileViewport
  }), [
    chavesMaisVendidos,
    columnCount,
    getQuantidadeProduto,
    idsNovidades,
    itensIndexados,
    onAddItem,
    onDecreaseItem,
    onIncreaseItem,
    onToggleFavorito,
    onOpenDetail,
    favoritosIdsSet,
    growthExperimento,
    idsAltaConversaoSet,
    isMobileViewport,
    isProdutoAdicionando,
    recompraIdsSet,
    produtoAdicionadoRecenteId
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
    onToggleFavorito: onToggleFav,
    onOpenDetail: onDetail,
    getQuantidadeProduto: getQtd,
    chavesMaisVendidos: maisVendidos,
    idsNovidades: novidades,
    favoritosIdsSet: favoritosSet,
    recompraIdsSet: recompraSet,
    idsAltaConversaoSet: altaConversaoSet,
    growthExperimento: growth,
    produtoAdicionadoRecenteId: adicionadoRecenteId,
    isProdutoAdicionando: isAddingProduto,
    columnCount: columns,
    isMobileViewport: isMobile
  }) => {
    const index = rowIndex * columns + columnIndex;
    const produtoIndexado = itens[index];
    const proximoProdutoIndexado = itens[index + 1] || null;

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
          index={index}
          isMobileViewport={isMobile}
          nextImageSrc={proximoProdutoIndexado?.imagemResponsiva?.src || ''}
          produtoIndexado={produtoIndexado}
          estaAdicionando={isAddingProduto(produtoIndexado.produto)}
          quantidadeNoCarrinho={getQtd(produtoIndexado.produto)}
          destaqueMaisVendido={destaqueMaisVendido}
          destaqueNovo={destaqueNovo}
          favorito={
            produtoIndexado.carrinhoId !== null
            && favoritosSet.has(produtoIndexado.carrinhoId)
          }
          sinalRecorrente={
            produtoIndexado.carrinhoId !== null
            && recompraSet.has(produtoIndexado.carrinhoId)
          }
          sinalRecomendado={produtoIndexado.scoreMaisVendido >= 6}
          destaqueConversao={
            produtoIndexado.carrinhoId !== null
            && altaConversaoSet.has(produtoIndexado.carrinhoId)
          }
          growthExperimento={growth}
          foiAdicionadoRecente={
            produtoIndexado.carrinhoId !== null
            && produtoIndexado.carrinhoId === adicionadoRecenteId
          }
          onAddItem={onAdd}
          onIncreaseItem={onIncrease}
          onDecreaseItem={onDecrease}
          onToggleFavorito={onToggleFav}
          onOpenDetail={onDetail}
        />
      </div>
    );
  }, []);

  if (!usarVirtualizacao) {
    const isMobileCardPriority = isMobileViewport
      || (containerWidth === 0 && typeof window !== 'undefined' && window.innerWidth < 700);

    return (
      <div className={gridClassName} id={listId}>
        {itensIndexados.map((produtoIndexado, index) => (
          <ProdutoCard
            key={produtoIndexado.chaveReact}
            index={index}
            isMobileViewport={isMobileCardPriority}
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
            sinalRecomendado={produtoIndexado.scoreMaisVendido >= 6}
            destaqueConversao={
              produtoIndexado.carrinhoId !== null
              && idsAltaConversaoSet.has(produtoIndexado.carrinhoId)
            }
            growthExperimento={growthExperimento}
            foiAdicionadoRecente={
              produtoIndexado.carrinhoId !== null
              && produtoIndexado.carrinhoId === produtoAdicionadoRecenteId
            }
            onAddItem={onAddItem}
            onIncreaseItem={onIncreaseItem}
            onDecreaseItem={onDecreaseItem}
            onToggleFavorito={onToggleFavorito}
            onOpenDetail={onOpenDetail}
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
          {itensIndexados.slice(0, 12).map((produtoIndexado, index) => (
            <ProdutoCard
              key={produtoIndexado.chaveReact}
              index={index}
              isMobileViewport={typeof window !== 'undefined' && window.innerWidth < 700}
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
              sinalRecomendado={produtoIndexado.scoreMaisVendido >= 6}
              destaqueConversao={
                produtoIndexado.carrinhoId !== null
                && idsAltaConversaoSet.has(produtoIndexado.carrinhoId)
              }
              growthExperimento={growthExperimento}
              foiAdicionadoRecente={
                produtoIndexado.carrinhoId !== null
                && produtoIndexado.carrinhoId === produtoAdicionadoRecenteId
              }
              onAddItem={onAddItem}
              onIncreaseItem={onIncreaseItem}
              onDecreaseItem={onDecreaseItem}
              onToggleFavorito={onToggleFavorito}
              onOpenDetail={onOpenDetail}
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
  const [adicionandoPorId, setAdicionandoPorId] = useState({});
  const [produtoDetalheAbertoChave, setProdutoDetalheAbertoChave] = useState('');
  const [filtroRecorrencia, setFiltroRecorrencia] = useState(
    FILTROS_RECORRENCIA.some((item) => item.id === filtroRecorrenciaInicial)
      ? filtroRecorrenciaInicial
      : 'todos'
  );
  const [feedbackRecorrencia, setFeedbackRecorrencia] = useState('');
  const [growthVersion, setGrowthVersion] = useState(0);
  const requisicaoProdutosIdRef = useRef(0);
  const limparFeedbackAdicaoRef = useRef(null);
  const limparFeedbackRecorrenciaRef = useRef(null);
  const adicionandoIdsRef = useRef(new Set());
  const limparAdicionandoTimersRef = useRef(new Map());
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
    setAdicionandoPorId((atual) => {
      if (!atual[carrinhoId]) {
        return atual;
      }

      const proximo = { ...atual };
      delete proximo[carrinhoId];
      return proximo;
    });
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

  const favoritosRecorrencia = useMemo(() => {
    return favoritosProdutos.slice(0, 12);
  }, [favoritosProdutos]);

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
  }, [
    categoria,
    fecharDetalheProduto,
    filtroRecorrencia,
    ordenacao,
    produtoDetalheSelecionado,
    registrarVisualizacao,
    termoBuscaEfetivo
  ]);

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

  const produtosRelacionadosDetalhe = useMemo(() => {
    if (!produtoDetalheSelecionado) {
      return [];
    }

    const base = produtoDetalheSelecionado;
    const baseMarca = normalizeText(base.produto?.marca);
    const baseCategoria = String(base.categoriaOriginal || '');
    const baseTokens = normalizeText(base.nomeProduto)
      .split(' ')
      .filter((token) => token.length >= 4);
    const poolRelacionados = produtosIndexados.length > 0 ? produtosIndexados : produtosOrdenadosIndexados;

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
  }, [produtoDetalheSelecionado, produtosIndexados, produtosOrdenadosIndexados]);

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

  const crossSellAposAdicao = useMemo(() => {
    if (produtoAdicionadoRecenteId === null) {
      return [];
    }

    const base = produtosIndexadosPorId.get(produtoAdicionadoRecenteId);
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

    for (const item of produtosIndexados) {
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
    produtoAdicionadoRecenteId,
    produtosIndexados,
    produtosIndexadosPorId,
    quantidadesCarrinhoPorId,
    recompraIdsSet,
    scoreComportamentoPorId
  ]);

  const getQuantidadeProduto = useCallback((produto) => {
    const id = getProdutoCarrinhoId(produto);
    if (id === null) {
      return 0;
    }
    return quantidadesCarrinhoPorId.get(id) || 0;
  }, [quantidadesCarrinhoPorId]);

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
    return carrinhoId !== null && Boolean(adicionandoPorId[carrinhoId]);
  }, [adicionandoPorId]);

  const handleAddItem = useCallback((produto) => {
    const carrinhoId = getProdutoCarrinhoId(produto);
    if (carrinhoId === null || adicionandoIdsRef.current.has(carrinhoId)) {
      return;
    }

    adicionandoIdsRef.current.add(carrinhoId);
    setAdicionandoPorId((atual) => ({
      ...atual,
      [carrinhoId]: true
    }));

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
    recompraIdsSet,
    isProdutoAdicionando,
    idsNovidades,
    produtoAdicionadoRecenteId
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
    || bebidaSubcategoria !== 'todas'
    || ordenacao !== ORDENACOES_PRODUTOS[0].id
    || filtroRecorrencia !== 'todos';

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
      termoBuscaDigitado
        ? `Nao encontramos resultados para "${termoBuscaDigitado}". Tente outro termo ou limpe os filtros para ampliar a vitrine.`
        : 'Tente buscar outro termo ou ajuste os filtros para ver mais opcoes.'
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
      <section className="products-hero products-hero-clean" id="produtos" aria-label="Página de produtos">
        <div className="products-hero-header products-hero-header-clean">
          <h1>Produtos</h1>
          <p className="products-hero-subtitle">
            Encontre o que precisa, compare precos e monte seu carrinho.
          </p>
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

          <div className="products-search-meta" aria-live="polite">
            {buscaEmAtualizacao ? (
              <span className="products-results-pill">Atualizando busca...</span>
            ) : termoBuscaEfetivo ? (
              <p>
                Exibindo resultados para <strong>"{termoBuscaEfetivo}"</strong>
              </p>
            ) : (
              <p>Use os atalhos abaixo para encontrar produtos mais rapido.</p>
            )}
          </div>

          <div className="products-search-suggestions" aria-label="Atalhos de busca">
            {BUSCA_SUGESTOES_RAPIDAS.map((atalho) => (
              <button
                key={atalho.id}
                type="button"
                className="products-search-suggestion-btn"
                onClick={() => handleAplicarSugestaoBusca({
                  termo: atalho.termo,
                  categoria: atalho.categoria
                })}
              >
                {atalho.label}
              </button>
            ))}
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

        <section className="products-recorrencia products-recorrencia-clean" aria-label="Atalhos de recorrencia e recompra">
          <div className="products-recorrencia-head">
            <h2>Sua rotina</h2>

            <div className="products-recorrencia-filters" role="tablist" aria-label="Filtrar recorrencia">
              {FILTROS_RECORRENCIA.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`products-recorrencia-filter-btn ${filtroRecorrencia === item.id ? 'active' : ''}`}
                  aria-pressed={filtroRecorrencia === item.id}
                  onClick={() => handleSelecionarFiltroRecorrencia(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {feedbackRecorrencia ? (
            <p className="products-recorrencia-feedback" role="status" aria-live="polite">
              {feedbackRecorrencia}
            </p>
          ) : null}

          {!temDadosRecorrencia ? (
            <div className="products-recorrencia-empty" role="status" aria-live="polite">
              <p>Favorite produtos e compre para montar seu painel personalizado.</p>
            </div>
          ) : null}

          {temDadosRecorrencia && filtroRecorrencia === 'todos' ? (
            <div className="products-recorrencia-groups">
              {favoritosRecorrencia.length > 0 ? (
                <section className="products-recorrencia-group" aria-label="Seus favoritos">
                  <div className="products-recorrencia-group-head">
                    <h3>❤️ Favoritos</h3>
                    <button type="button" className="btn-secondary" onClick={() => handleSelecionarFiltroRecorrencia('favoritos')}>
                      Ver todos
                    </button>
                  </div>
                  <div className="products-recorrencia-grid">
                    {favoritosRecorrencia.slice(0, 4).map((produto) => (
                      <RecorrenciaMiniCard
                        key={`rec-fav-${produto.id}`}
                        produto={produto}
                        favorito={isFavorito(produto.id)}
                        onAbrir={abrirProdutoRecorrente}
                        onAdicionar={adicionarRecorrenteAoCarrinho}
                        onAlternarFavorito={handleToggleFavorito}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {recompraRecorrencia.length > 0 ? (
                <section className="products-recorrencia-group products-recorrencia-group-recompra" aria-label="Comprar novamente">
                  <div className="products-recorrencia-group-head">
                    <h3>🔁 Comprar de novo</h3>
                    <button type="button" className="btn-secondary" onClick={() => handleSelecionarFiltroRecorrencia('recompra')}>
                      Ver todos
                    </button>
                  </div>
                  <div className="products-recorrencia-grid">
                    {recompraRecorrencia.slice(0, 4).map((produto) => (
                      <RecorrenciaMiniCard
                        key={`rec-recompra-${produto.id}`}
                        produto={produto}
                        favorito={isFavorito(produto.id)}
                        onAbrir={abrirProdutoRecorrente}
                        onAdicionar={adicionarRecorrenteAoCarrinho}
                        onAlternarFavorito={handleToggleFavorito}
                        destaqueRecompra
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {temDadosRecorrencia && filtroRecorrencia !== 'todos' ? (
            <section className="products-recorrencia-group" aria-label={`Filtro ativo: ${filtroRecorrenciaAtivoLabel}`}>
              <div className="products-recorrencia-group-head">
                <h3>{filtroRecorrenciaAtivoLabel}</h3>
                <button type="button" className="btn-secondary" onClick={() => handleSelecionarFiltroRecorrencia('todos')}>
                  Mostrar tudo
                </button>
              </div>

              {listaRecorrenciaAtiva.length > 0 ? (
                <div className="products-recorrencia-grid">
                  {listaRecorrenciaAtiva.slice(0, 12).map((produto) => (
                    <RecorrenciaMiniCard
                      key={`rec-ativo-${filtroRecorrencia}-${produto.id}`}
                      produto={produto}
                      favorito={isFavorito(produto.id)}
                      onAbrir={abrirProdutoRecorrente}
                      onAdicionar={adicionarRecorrenteAoCarrinho}
                      onAlternarFavorito={handleToggleFavorito}
                      destaqueRecompra={filtroRecorrencia === 'recompra'}
                    />
                  ))}
                </div>
              ) : (
                <div className="products-recorrencia-empty" role="status" aria-live="polite">
                  <p>Nenhum item neste atalho ainda. Continue navegando.</p>
                </div>
              )}
            </section>
          ) : null}
        </section>

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

            {ordenacao !== ORDENACOES_PRODUTOS[0].id ? (
              <button
                type="button"
                className="products-active-filter-chip"
                onClick={() => setOrdenacao(ORDENACOES_PRODUTOS[0].id)}
              >
                Ordenacao: {ordenacaoAtualLabel} <span aria-hidden="true">×</span>
              </button>
            ) : null}

            {filtroRecorrencia !== 'todos' ? (
              <button
                type="button"
                className="products-active-filter-chip"
                onClick={() => setFiltroRecorrencia('todos')}
              >
                Recorrencia: {filtroRecorrenciaAtivoLabel} <span aria-hidden="true">×</span>
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

const RecorrenciaMiniCard = React.memo(function RecorrenciaMiniCard({
  produto,
  favorito,
  onAbrir,
  onAdicionar,
  onAlternarFavorito,
  destaqueRecompra = false
}) {
  const nome = getProdutoNome(produto);
  const imagem = getProdutoImagem(produto) || CATEGORY_IMAGES[normalizeText(produto?.categoria)] || '/img/logo-oficial.png';
  const blurSrc = getProdutoImagemBlurSrc(produto);
  const preco = formatCurrency(Number(produto?.preco || 0));

  return (
    <article className={`recorrencia-mini-card ${destaqueRecompra ? 'is-recompra' : ''}`.trim()}>
      <button
        type="button"
        className={`recorrencia-favorite-btn ${favorito ? 'is-active' : ''}`}
        onClick={() => onAlternarFavorito(produto)}
        aria-label={favorito ? `Remover ${nome} dos favoritos` : `Salvar ${nome} nos favoritos`}
      >
        {favorito ? '♥' : '♡'}
      </button>

      <button
        type="button"
        className="recorrencia-mini-media"
        onClick={() => onAbrir(produto)}
        aria-label={`Abrir ${nome}`}
      >
        <SmartImage
          src={imagem}
          blurSrc={blurSrc}
          alt={nome}
          loading="lazy"
          fallbackSrc="/img/logo-oficial.png"
        />
      </button>

      <div className="recorrencia-mini-body">
        <p className="recorrencia-mini-name" title={nome}>{nome}</p>
        <p className="recorrencia-mini-price">{preco}</p>
      </div>

      <button
        type="button"
        className={`btn-secondary recorrencia-mini-add ${destaqueRecompra ? 'is-recompra' : ''}`.trim()}
        onClick={() => onAdicionar(produto)}
      >
        Comprar novamente • {preco}
      </button>
    </article>
  );
});

RecorrenciaMiniCard.displayName = 'RecorrenciaMiniCard';