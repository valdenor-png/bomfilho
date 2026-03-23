import { getProdutos } from './api';

// ─── Constantes ──────────────────────────────────────────────────────
export const CATEGORIA_TODAS = 'todas';
export const CATEGORIA_PROMOCOES = 'promocoes';
export const CATEGORIA_BEBIDAS = 'bebidas';
export const CATEGORIA_FRIOS = 'frios';
export const TOKEN_BEBIDA = 'bebida';
export const TOKEN_FRIOS = 'frios';
export const PRODUTOS_POR_PAGINA = 60;

// Super-categorias: agrupam subcategorias do DB
export const SUPER_CATEGORIAS = {
  bebidas: ['bebidas', 'agua', 'refrigerantes'],
  frios: ['frios', 'derivados_lacteos', 'leites_fermentados']
};

// Mapa inverso: subcategoria DB -> super-categoria
export const SUBCATEGORIA_TO_SUPER = {
  agua: 'bebidas',
  refrigerantes: 'bebidas',
  derivados_lacteos: 'frios',
  leites_fermentados: 'frios'
};

export const DRINK_SECTIONS_BEBIDAS = [
  {
    id: 'agua',
    label: 'Água',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1400&q=60',
    matchers: ['agua', 'mineral', 'sem gas', 'com gas', 'agua de coco', 'coco']
  },
  {
    id: 'refrigerante',
    label: 'Refrigerante',
    image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?auto=format&fit=crop&w=1400&q=60',
    matchers: ['refrigerante', 'coca', 'pepsi', 'guarana', 'guaraná', 'fanta', 'sprite', 'kuat', 'sukita', 'dolly', 'tubaina', 'tubaína', 'h2o']
  },
  {
    id: 'cervejas',
    label: 'Cervejas',
    image: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=1400&q=60',
    matchers: ['cerveja', 'beer', 'heineken', 'brahma', 'skol', 'antarctica', 'itaipava', 'chopp', 'pilsen', 'lager', 'ipa', 'ale']
  },
  {
    id: 'sucos',
    label: 'Sucos e Néctares',
    image: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=1400&q=60',
    matchers: ['suco', 'nectar', 'tang', 'clight', 'del valle', 'kapo', 'ades', 'limonada', 'juice', 'natural one', 'laranjada']
  },
  {
    id: 'energeticos',
    label: 'Energéticos e Isotônicos',
    image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=1400&q=60',
    matchers: ['energetico', 'energético', 'isotonico', 'isotônico', 'gatorade', 'powerade', 'monster', 'red bull', 'redbull', 'tonica', 'tônica', 'burn', 'schweppes']
  },
  {
    id: 'destilados',
    label: 'Destilados e Licores',
    image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1400&q=60',
    matchers: ['vodka', 'whisky', 'whiskey', 'rum', 'gin', 'cachaça', 'cachaca', 'tequila', 'licor', 'conhaque', 'cognac', 'amarula', 'absinto', 'smirnoff', 'ice', 'pitú', 'pitu', '51 ', 'espumante', 'champagne', 'sidra', 'sake']
  },
  {
    id: 'vinho',
    label: 'Vinho',
    image: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1400&q=60',
    matchers: ['vinho', 'wine', 'tinto', 'branco', 'rose', 'rosé', 'sangria']
  },
  {
    id: 'chas-cafes',
    label: 'Chás e Cafés',
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1400&q=60',
    matchers: ['cha ', 'cha de', 'cafe', 'café', 'cappuccino', 'nescafe', 'nescafé', 'mate', 'kombucha', 'leao', 'leão']
  },
  {
    id: 'achocolatados',
    label: 'Achocolatados e Lácteos',
    image: 'https://images.unsplash.com/photo-1517578239113-b03992dcdd25?auto=format&fit=crop&w=1400&q=60',
    matchers: ['achocolatado', 'toddy', 'nescau', 'toddynho', 'leite', 'iogurte', 'bebida lactea', 'bebida láctea']
  }
];

export const BRAND_GROUPS_BY_SUBCATEGORY = {
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

export const FRIOS_SECTIONS = [
  {
    id: 'empanados',
    label: 'Empanados e Congelados',
    matchers: ['empan', 'empanado', 'nuggets', 'steak', 'stek', 'tirinha', 'isca', 'chicken', 'chicren', 'tekito', 'auroggets']
  },
  {
    id: 'frios-embutidos',
    label: 'Frios e Embutidos',
    matchers: ['presunt', 'presunto', 'mortadela', 'salame', 'salsicha', 'linguica', 'linguiça', 'bacon', 'peito peru', 'apresuntado', 'copa', 'lombo', 'tender']
  },
  {
    id: 'queijos',
    label: 'Queijos',
    matchers: ['queijo', 'mussarela', 'mozzarella', 'parmesao', 'parmes', 'provolone', 'cheddar', 'ricota', 'gorgonzola', 'coalh', 'prato']
  },
  {
    id: 'requeijao-cremes',
    label: 'Requeijão e Cremes',
    matchers: ['requeij', 'requeijao', 'chantilly', 'creme de leite', 'nata']
  },
  {
    id: 'leite-derivados',
    label: 'Leite Condensado e em Pó',
    matchers: ['leite cond', 'leite po', 'leite coc', 'condensado', 'leite em po']
  },
  {
    id: 'leites-fermentados',
    label: 'Leites Fermentados',
    matchers: ['fermentado', 'yakult', 'chamyto']
  }
];

export const CATEGORY_IMAGES = {
  frios: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=900&q=60',
  refrigerantes: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=60',
  bebidas: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=60',
  cervejas: 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=900&q=60',
  agua: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=900&q=60',
  salgadinhos: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=900&q=60',
  doces: 'https://images.unsplash.com/photo-1582176604856-e824b4736522?auto=format&fit=crop&w=900&q=60',
  biscoitos: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=60',
  leites_fermentados: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=60',
  derivados_lacteos: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=60',
  mercearia: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=900&q=60',
  hortifruti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=60',
  limpeza: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=60',
  higiene: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=60'
};

export const CATEGORIAS_LEGADO = [
  { id: CATEGORIA_TODAS, label: 'Todas' },
  { id: CATEGORIA_PROMOCOES, label: 'Promoções', destaque: true },
  { id: CATEGORIA_BEBIDAS, label: 'Bebidas' },
  { id: 'bebidas-alcoolicas', label: 'Bebidas Alcoólicas' },
  { id: 'mercearia', label: 'Mercearia' },
  { id: 'hortifruti', label: 'Hortifruti' },
  { id: 'limpeza', label: 'Limpeza' },
  { id: CATEGORIA_FRIOS, label: 'Frios e Laticínios' },
  { id: 'acougue', label: 'Açougue' },
  { id: 'descartaveis', label: 'Descartáveis' },
  { id: 'salgadinhos', label: 'Salgadinhos' },
  { id: 'doces', label: 'Doces' },
  { id: 'biscoitos', label: 'Biscoitos' },
  { id: 'cervejas', label: 'Cervejas' },
  { id: 'higiene', label: 'Higiene' }
];

export const ORDENACOES_PRODUTOS = [
  { id: 'mais-vendidos', label: 'Mais comprados' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
  { id: 'az', label: 'A-Z' },
  { id: 'promocoes', label: 'Promoções' }
];

export const BUSCA_SUGESTOES_RAPIDAS = [
  { id: 'sug-arroz', label: 'Arroz', termo: 'arroz', categoria: CATEGORIA_TODAS },
  { id: 'sug-leite', label: 'Leite', termo: 'leite', categoria: CATEGORIA_TODAS },
  { id: 'sug-cafe', label: 'Cafe', termo: 'cafe', categoria: CATEGORIA_TODAS },
  { id: 'sug-bebidas', label: 'Bebidas', termo: 'bebida', categoria: CATEGORIA_BEBIDAS },
  { id: 'sug-limpeza', label: 'Limpeza', termo: 'limpeza', categoria: 'limpeza' },
  { id: 'sug-promocoes', label: 'Promocoes', termo: '', categoria: CATEGORIA_PROMOCOES }
];

export const FILTROS_RECORRENCIA = [
  { id: 'todos', label: 'Tudo' },
  { id: 'favoritos', label: 'Favoritos' },
  { id: 'recompra', label: 'Comprar novamente' }
];

export const FILTROS_COMERCIAIS_RAPIDOS = [
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

export const CATEGORIA_ICONE_FALLBACK = {
  frios: '🧊',
  refrigerantes: '🥤',
  bebidas: '🍹',
  'bebidas-alcoolicas': '🥃',
  cervejas: '🍺',
  acougue: '🥩',
  agua: '💧',
  salgadinhos: '🍿',
  doces: '🍫',
  biscoitos: '🍪',
  leites_fermentados: '🥛',
  derivados_lacteos: '🧀',
  mercearia: '🛒',
  hortifruti: '🥦',
  limpeza: '🧽',
  higiene: '🧴',
  descartaveis: '🧻'
};

export const TOKENS_MAIS_VENDIDOS = [
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
export const ESTOQUE_BAIXO_LIMIAR = 5;

export const BRL_CURRENCY = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
export const PT_BR_COLLATOR = new Intl.Collator('pt-BR');

// ─── Funções utilitárias ─────────────────────────────────────────────

export function getProdutoImagem(produto) {
  return String(produto?.imagem || '').trim();
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMatchers(matchers = []) {
  return matchers.map((matcher) => normalizeText(matcher)).filter(Boolean);
}

export const DRINK_SECTIONS_BEBIDAS_INDEX = DRINK_SECTIONS_BEBIDAS.map((section) => ({
  ...section,
  matchersNormalizados: normalizeMatchers(section.matchers)
}));

export const FRIOS_SECTIONS_INDEX = FRIOS_SECTIONS.map((section) => ({
  ...section,
  matchersNormalizados: normalizeMatchers(section.matchers)
}));

export const BRAND_GROUPS_BY_SUBCATEGORY_INDEX = Object.fromEntries(
  Object.entries(BRAND_GROUPS_BY_SUBCATEGORY).map(([subcategoryId, groups]) => [
    subcategoryId,
    groups.map((group) => ({
      ...group,
      matchersNormalizados: normalizeMatchers(group.matchers)
    }))
  ])
);

export function isBebidasCategoria(value) {
  return normalizeText(value).includes('bebida');
}

export function isFriosCategoria(value) {
  const v = normalizeText(value);
  return v === 'frios' || v === 'frios e laticinios';
}

export function getCategoriaAgrupada(categoriaOriginal) {
  return SUBCATEGORIA_TO_SUPER[categoriaOriginal] || categoriaOriginal;
}

const VITRINE_HORTIFRUTI_MATCHERS = normalizeMatchers([
  'fruta', 'banana', 'maca', 'manga', 'uva', 'pera', 'abacaxi', 'morango', 'melao', 'melancia',
  'verdura', 'alface', 'couve', 'repolho', 'rucula', 'espinafre', 'coentro', 'cebolinha',
  'legume', 'batata', 'cenoura', 'tomate', 'cebola', 'abobora', 'pepino', 'chuchu', 'beterraba',
  'hortifruti', 'in natura', 'hortali'
]);

const VITRINE_HORTIFRUTI_EXCLUDE_MATCHERS = normalizeMatchers([
  'palha', 'chips', 'salgadinho', 'snack', 'biscoito', 'wafer', 'chocolate', 'refrigerante',
  'detergente', 'sabonete', 'amaciante', 'condensado', 'creme de leite', 'leite em po', 'embalagem',
  'plastico', 'descartavel', 'papel aluminio'
]);

const VITRINE_BEBIDAS_EXCLUDE_MATCHERS = normalizeMatchers([
  'leite condensado', 'condensado', 'creme de leite', 'creme culinario', 'composto lacteo',
  'leite em po', 'po lacteo', 'margarina', 'manteiga', 'queijo', 'requeijao', 'coalhada'
]);

const VITRINE_BEBIDAS_INCLUDE_MATCHERS = normalizeMatchers([
  'agua', 'mineral', 'refrigerante', 'suco', 'nectar', 'energetico', 'isotonico',
  'cha', 'cafe', 'cerveja', 'vinho', 'whisky', 'vodka', 'gin', 'licor', 'achocolatado',
  'bebida lactea', 'iogurte liquido', 'leite uht', 'integral', 'desnatado', 'semidesnatado',
  'longa vida'
]);

const VITRINE_FRIOS_MATCHERS = normalizeMatchers([
  'leite', 'iogurte', 'queijo', 'manteiga', 'margarina', 'requeijao', 'fermentado', 'lacteo', 'laticinio'
]);

const VITRINE_MERCEARIA_MATCHERS = normalizeMatchers([
  'leite condensado', 'creme de leite', 'leite de coco', 'leite coco', 'leite coc', 'composto lacteo', 'po lacteo'
]);

export function getCategoriaVitrineDefensiva({ categoriaAgrupada, categoriaOriginal, textoBusca }) {
  const categoria = normalizeText(categoriaAgrupada || categoriaOriginal || '');
  const texto = normalizeText(textoBusca);

  if (!categoria) {
    return 'outros';
  }

  if (categoria === 'hortifruti') {
    const hasHortiToken = textoContemMatcher(texto, VITRINE_HORTIFRUTI_MATCHERS);
    const hasExcludeToken = textoContemMatcher(texto, VITRINE_HORTIFRUTI_EXCLUDE_MATCHERS);

    if (hasExcludeToken && !hasHortiToken) {
      return 'mercearia';
    }

    if (!hasHortiToken && texto) {
      return 'mercearia';
    }

    return 'hortifruti';
  }

  if (categoria === 'bebidas') {
    if (textoContemMatcher(texto, VITRINE_MERCEARIA_MATCHERS)) {
      return 'mercearia';
    }

    if (textoContemMatcher(texto, VITRINE_FRIOS_MATCHERS)) {
      return 'frios';
    }

    const hasExcludeToken = textoContemMatcher(texto, VITRINE_BEBIDAS_EXCLUDE_MATCHERS);
    const hasIncludeToken = textoContemMatcher(texto, VITRINE_BEBIDAS_INCLUDE_MATCHERS);

    if (hasExcludeToken && !hasIncludeToken) {
      return 'mercearia';
    }

    return 'bebidas';
  }

  return categoria;
}

export function getTextoProduto(produto) {
  return [
    normalizeText(produto?.nome),
    normalizeText(produto?.marca),
    normalizeText(produto?.categoria),
    normalizeText(produto?.descricao)
  ]
    .filter(Boolean)
    .join(' ');
}

export function textoContemMatcher(textoProduto, matchersNormalizados) {
  return matchersNormalizados.some((matcher) => textoProduto.includes(matcher));
}

export function getBebidaSubcategoriaIdByTexto(textoProduto) {
  const found = DRINK_SECTIONS_BEBIDAS_INDEX.find((section) =>
    textoContemMatcher(textoProduto, section.matchersNormalizados)
  );
  return found?.id || 'outras-bebidas';
}

export function getFriosSubcategoriaIdByTexto(textoProduto) {
  const found = FRIOS_SECTIONS_INDEX.find((section) =>
    textoContemMatcher(textoProduto, section.matchersNormalizados)
  );
  return found?.id || 'outros-frios';
}

export function isProdutoEmPromocao(produto) {
  return (
    Number(produto?.desconto || 0) > 0
    || Number(produto?.percentual_desconto || 0) > 0
    || Number(produto?.preco_promocional || 0) > 0
    || produto?.promocao === true
    || Number(produto?.promocao || 0) === 1
  );
}

export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalizado = String(value || '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value) {
  return BRL_CURRENCY.format(Number(value || 0));
}

export function formatConversionRate(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '0%';
  }

  return `${Math.round(normalized * 100)}%`;
}

export function getProdutoCarrinhoId(produto) {
  const id = Number(produto?.id);
  return Number.isFinite(id) ? id : null;
}

export function getProdutoIdNormalizado(produtoOuId) {
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

function toTitleCase(str) {
  const lower = str.toLowerCase();
  const small = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'em', 'e', 'p/', 'c/']);
  return lower.replace(/\S+/g, (word, idx) =>
    idx === 0 || !small.has(word)
      ? word.charAt(0).toUpperCase() + word.slice(1)
      : word
  );
}

export function getProdutoNome(produto) {
  const nomeExterno = String(produto?.nome_externo || '').trim();
  if (nomeExterno) return nomeExterno;
  const nome = String(produto?.nome || '').trim();
  if (!nome) return 'Produto sem nome';
  const isAllCaps = nome === nome.toUpperCase() && nome.length > 3;
  return isAllCaps ? toTitleCase(nome) : nome;
}

// Mapa de labels legíveis para as categorias do DB
const CATEGORIA_LABEL_MAP = Object.fromEntries(
  CATEGORIAS_LEGADO
    .filter(c => c.id !== CATEGORIA_TODAS && c.id !== CATEGORIA_PROMOCOES)
    .map(c => [c.id, c.label])
);
// Sub-categorias DB que foram agrupadas
CATEGORIA_LABEL_MAP.agua = 'Água';
CATEGORIA_LABEL_MAP.refrigerantes = 'Refrigerantes';
CATEGORIA_LABEL_MAP.derivados_lacteos = 'Derivados Lácteos';
CATEGORIA_LABEL_MAP.leites_fermentados = 'Leites Fermentados';

export function getProdutoCategoriaLabel(produto) {
  const raw = String(produto?.departamento || produto?.categoria || '').trim().toLowerCase();
  return CATEGORIA_LABEL_MAP[raw] || raw || 'Categoria não informada';
}

export function getProdutoMedida(produto) {
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

export function getProdutoDetalheComercial(produto) {
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

export function getProdutoPrecoInfo(produto) {
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

export function getProdutoEstoqueInfo(produto) {
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

export function getEstoqueBadge(estoqueInfo) {
  if (!estoqueInfo || !estoqueInfo.informado) {
    return { classe: 'estoque-sem-info', label: 'Estoque n/a', cor: 'gray' };
  }
  if (estoqueInfo.semEstoque) {
    return { classe: 'estoque-zerado', label: 'Sem estoque', cor: 'red' };
  }
  if (estoqueInfo.estoqueBaixo) {
    return { classe: 'estoque-baixo', label: `Restam ${estoqueInfo.quantidade}`, cor: 'yellow' };
  }
  return { classe: 'estoque-ok', label: 'Em estoque', cor: 'green' };
}

export function getScoreMaisVendido(produtoIndexado) {
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

export function compareProdutosPorNome(a, b) {
  return PT_BR_COLLATOR.compare(a.nomeProduto, b.nomeProduto);
}

export function getScoreComportamento(item, scoreComportamentoPorId) {
  const id = Number(item?.carrinhoId || 0);
  if (!id || !scoreComportamentoPorId) {
    return 0;
  }

  return Number(scoreComportamentoPorId.get(id) || 0);
}

function comparePrioridadeEstoque(
  a,
  b,
  {
    priorizarConversao = true,
    priorizarPersonalizacao = false,
    scoreComportamentoPorId = null
  } = {}
) {
  const estoqueA = Number(a?.estoqueInfo?.quantidade || 0);
  const estoqueB = Number(b?.estoqueInfo?.quantidade || 0);
  const estoqueDiff = estoqueB - estoqueA;
  if (estoqueDiff !== 0) {
    return estoqueDiff;
  }

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

  const scoreMaisVendidoDiff = Number(b.scoreMaisVendido || 0) - Number(a.scoreMaisVendido || 0);
  if (scoreMaisVendidoDiff !== 0) {
    return scoreMaisVendidoDiff;
  }

  return 0;
}

export function sortProdutosIndexados(
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
        const prioridadeEstoqueDiff = comparePrioridadeEstoque(a, b, {
          priorizarConversao,
          priorizarPersonalizacao,
          scoreComportamentoPorId
        });
        if (prioridadeEstoqueDiff !== 0) {
          return prioridadeEstoqueDiff;
        }

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
        const prioridadeEstoqueDiff = comparePrioridadeEstoque(a, b, {
          priorizarConversao,
          priorizarPersonalizacao,
          scoreComportamentoPorId
        });
        if (prioridadeEstoqueDiff !== 0) {
          return prioridadeEstoqueDiff;
        }

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
        const prioridadeEstoqueDiff = comparePrioridadeEstoque(a, b, {
          priorizarConversao,
          priorizarPersonalizacao,
          scoreComportamentoPorId
        });
        if (prioridadeEstoqueDiff !== 0) {
          return prioridadeEstoqueDiff;
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
    case 'promocoes':
      ordenados.sort((a, b) => {
        const prioridadeEstoqueDiff = comparePrioridadeEstoque(a, b, {
          priorizarConversao,
          priorizarPersonalizacao,
          scoreComportamentoPorId
        });
        if (prioridadeEstoqueDiff !== 0) {
          return prioridadeEstoqueDiff;
        }

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
        const prioridadeEstoqueDiff = comparePrioridadeEstoque(a, b, {
          priorizarConversao,
          priorizarPersonalizacao,
          scoreComportamentoPorId
        });
        if (prioridadeEstoqueDiff !== 0) {
          return prioridadeEstoqueDiff;
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

export function getProdutoBadges(
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
    badges.push({ tone: 'recomendado', label: 'Sugerido p/ voce' });
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

export function getPlaceholderIconePorCategoria(produto) {
  const categoriaNormalizada = normalizeText(produto?.categoria);
  const entrada = Object.entries(CATEGORIA_ICONE_FALLBACK).find(([categoria]) =>
    categoriaNormalizada.includes(categoria)
  );
  return entrada?.[1] || '🛍️';
}

export function getProdutoStableKey(produto) {
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

export function getCategoriaApi(categoria) {
  const valor = String(categoria || '').toLowerCase();
  if (!valor || valor === CATEGORIA_TODAS || valor === CATEGORIA_PROMOCOES) {
    return '';
  }

  if (valor.includes(TOKEN_BEBIDA)) {
    return CATEGORIA_BEBIDAS;
  }

  if (valor === CATEGORIA_FRIOS || valor === 'frios e laticinios') {
    return CATEGORIA_FRIOS;
  }

  return valor;
}

export function buildProdutosQueryKey({ categoria, busca, page, limit }) {
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
export async function fetchProdutosPage({ categoria, busca, page, limit }) {
  const categoriaOriginal = String(categoria || '').toLowerCase();
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

  let data = await getProdutos(params);
  let lista = Array.isArray(data?.produtos) ? data.produtos : [];
  let paginacao = data?.paginacao || {};

  // Fallback de compatibilidade: algumas bases antigas guardam cervejas dentro de bebidas.
  // Se a consulta por "cervejas" vier vazia sem termo de busca, tenta bebidas + busca "cerveja".
  if (
    categoriaOriginal === 'cervejas'
    && !buscaNormalizada
    && Number(paginacao?.total || lista.length || 0) === 0
  ) {
    data = await getProdutos({
      ...params,
      categoria: CATEGORIA_BEBIDAS,
      busca: 'cerveja'
    });
    lista = Array.isArray(data?.produtos) ? data.produtos : [];
    paginacao = data?.paginacao || {};
  }

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

export function buildProdutosPageCacheKey({ categoria, busca, page, limit }) {
  return JSON.stringify(
    buildProdutosQueryKey({ categoria, busca, page, limit })
  );
}

export function isUnsplashUrl(value) {
  return String(value || '').includes('images.unsplash.com');
}

export function buildUnsplashVariant(url, width, quality = 60) {
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

export function getProdutoImagemResponsiva(produto) {
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

export function getProdutoImagemBlurSrc(produto) {
  const srcBase = getProdutoImagem(produto);
  if (!isUnsplashUrl(srcBase)) {
    return '';
  }

  return buildUnsplashVariant(srcBase, 64, 24);
}

export function mergeProdutosById(listaAtual, novosProdutos) {
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

// ─── Virtualização ───────────────────────────────────────────────────

export const VIRTUALIZATION_THRESHOLD = 64;
export const VIRTUAL_GRID_GAP = 14;
export const VIRTUAL_CARD_MIN_WIDTH_DESKTOP = 232;
export const VIRTUAL_CARD_MIN_WIDTH_MOBILE = 158;
export const VIRTUAL_CARD_HEIGHT_DESKTOP = 470;
export const VIRTUAL_CARD_HEIGHT_MOBILE = 344;
export const VIRTUAL_GRID_MIN_HEIGHT = 300;
export const PREFETCHED_PRODUCT_IMAGE_LIMIT = 1200;
const prefetchedProductImageSrc = new Set();
const prefetchedProductImageQueue = [];

export function prefetchProductImage(src) {
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
