const TOKENS_TABACO = [
  'tabaco',
  'cigarro',
  'cigarros',
  'cigarrete',
  'fumo',
  'charuto',
  'cigarilha'
];

const TOKENS_ALCOOL = [
  'cerveja',
  'chopp',
  'vinho',
  'espumante',
  'whisky',
  'whiskey',
  'vodka',
  'gin',
  'rum',
  'tequila',
  'licor',
  'conhaque',
  'cachaca',
  'aperitivo',
  'vermouth',
  'vermute',
  'campari',
  'sidra',
  'cooler',
  'ice'
];

const TOKENS_SEM_ALCOOL = ['sem alcool'];

const TOKENS_CATEGORIA_PESO = [
  'hortifruti',
  'feira',
  'verdura',
  'verduras',
  'legume',
  'legumes',
  'fruta',
  'frutas',
  'folha',
  'folhas',
  'raiz',
  'raizes',
  'temperos frescos'
];

const TOKENS_TEXTO_PESO_FORTE = [
  'a granel',
  'granel',
  'balanca',
  'peso variavel',
  'fracionado',
  'pesavel'
];

const TOKENS_TEXTO_PESO_GRANEL = [
  'a granel',
  'agranel',
  'granel'
];

const TOKENS_TEXTO_PESO_BALANCA = [
  'balanca'
];

const TOKENS_CONTEXTO_ALIMENTAR_PESO = [
  'horti',
  'hortifruti',
  'feira',
  'verdura',
  'legume',
  'fruta',
  'folha',
  'raiz',
  'tempero fresco',
  'acougue',
  'in natura'
];

const TOKENS_CONTEXTO_BLOQUEIO_PESO = [
  'balanca dig',
  'balanca digital',
  'balanca corporal',
  'aparelho',
  'equipamento',
  'utensilio',
  'ferramenta',
  'thinner',
  'solvente',
  'tinta',
  'argamass',
  'construcao',
  'material de construcao'
];

const TOKENS_ITEMS_FEIRA = [
  'tomate',
  'cebola',
  'batata',
  'cenoura',
  'pimentao',
  'cheiro verde',
  'cheiro-verde',
  'alface',
  'couve',
  'repolho',
  'rucula',
  'espinafre',
  'coentro',
  'cebolinha',
  'mandioca',
  'macaxeira',
  'inhame',
  'abobora',
  'pepino',
  'chuchu',
  'beterraba',
  'banana',
  'maca',
  'uva',
  'pera',
  'melao',
  'melancia'
];

const TOKENS_CATEGORIA_UNITARIA = [
  'mercearia',
  'frios',
  'laticinio',
  'limpeza',
  'descart',
  'utilidades',
  'higiene'
];

const TOKENS_EMBALAGEM = [
  'pacote',
  'pct',
  'pcte',
  'sache',
  'caixa',
  'lata',
  'garrafa',
  'pet',
  'pote',
  'frasco',
  'fardo',
  'pack',
  'embalado'
];

const REGEX_MEDIDA_EMBALAGEM = /\b\d+(?:[.,]\d+)?\s?(?:kg|g|gr|grama|gramas|ml|l)\b/;

export function normalizeProductText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toPositiveInt(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }

  return Math.max(0, Math.round(Number(fallback || 0)));
}

export function hasTruthyFlag(value, defaultValue = false) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return Boolean(defaultValue);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = normalizeProductText(value);
  if (!normalized) {
    return Boolean(defaultValue);
  }

  return ['1', 'true', 'sim', 'yes', 'ativo'].includes(normalized);
}

function includesAnyToken(text, tokens = []) {
  if (!text) {
    return false;
  }

  return tokens.some((token) => text.includes(token));
}

export function getProdutoTextoCompleto(produto = {}) {
  return [
    produto?.nome,
    produto?.nome_externo,
    produto?.descricao,
    produto?.marca,
    produto?.categoria,
    produto?.departamento,
    produto?.secao_exibicao
  ]
    .map((item) => normalizeProductText(item))
    .filter(Boolean)
    .join(' ');
}

function getCategoriaContexto(produto = {}) {
  return [
    produto?.categoria_operacional,
    produto?.categoriaOperacional,
    produto?.departamento,
    produto?.categoria,
    produto?.secao_exibicao
  ]
    .map((item) => normalizeProductText(item))
    .filter(Boolean)
    .join(' ');
}

function resolveUnidadeVendaExplicita(produto = {}) {
  const unidadeVendaExpl = normalizeProductText(produto?.unidade_venda);
  if (unidadeVendaExpl === 'peso' || unidadeVendaExpl === 'unidade') {
    return unidadeVendaExpl;
  }

  const tipoVenda = normalizeProductText(produto?.tipo_venda || produto?.tipoVenda);
  if ([
    'peso',
    'kg',
    'granel',
    'a granel',
    'balanca',
    'fracionado',
    'variavel'
  ].includes(tipoVenda)) {
    return 'peso';
  }

  if ([
    'unidade',
    'unitario',
    'embalado',
    'fechado'
  ].includes(tipoVenda)) {
    return 'unidade';
  }

  const vendidoPorPesoRaw = (
    produto?.vendido_por_peso
    ?? produto?.vendidoPorPeso
    ?? produto?.por_peso
    ?? produto?.porPeso
  );

  if (vendidoPorPesoRaw !== null && vendidoPorPesoRaw !== undefined && String(vendidoPorPesoRaw).trim() !== '') {
    return hasTruthyFlag(vendidoPorPesoRaw, false) ? 'peso' : 'unidade';
  }

  const categoriaOperacional = normalizeProductText(produto?.categoria_operacional || produto?.categoriaOperacional);
  if (categoriaOperacional.includes('balanca') || categoriaOperacional.includes('granel')) {
    return 'peso';
  }

  if (categoriaOperacional.includes('embalad') || categoriaOperacional.includes('unitar')) {
    return 'unidade';
  }

  return null;
}

export function isProdutoTabaco(produto = {}) {
  const controlado = normalizeProductText(produto?.produto_controlado);
  if (controlado === 'tabaco' || controlado === 'cigarro') {
    return true;
  }

  const texto = getProdutoTextoCompleto(produto);
  return TOKENS_TABACO.some((token) => texto.includes(token));
}

export function isProdutoAlcoolico(produto = {}) {
  if (hasTruthyFlag(produto?.requer_maioridade)) {
    return true;
  }

  const controlado = normalizeProductText(produto?.produto_controlado);
  if (controlado === 'alcool' || controlado === 'bebida_alcoolica' || controlado === 'bebida-alcoolica') {
    return true;
  }

  if (isProdutoTabaco(produto)) {
    return false;
  }

  const categoria = normalizeProductText(produto?.categoria || produto?.departamento);
  if (categoria.includes('bebidas-alcoolicas')) {
    return true;
  }

  const texto = getProdutoTextoCompleto(produto);
  if (TOKENS_SEM_ALCOOL.some((token) => texto.includes(token))) {
    return false;
  }

  return TOKENS_ALCOOL.some((token) => texto.includes(token));
}

export function resolveUnidadeVenda(produto = {}) {
  const unidadeExplicita = resolveUnidadeVendaExplicita(produto);
  if (unidadeExplicita) {
    return unidadeExplicita;
  }

  const texto = getProdutoTextoCompleto(produto);
  const contextoCategoria = getCategoriaContexto(produto);
  const contextoCompleto = `${contextoCategoria} ${texto}`.trim();
  const categoriaPeso = TOKENS_CATEGORIA_PESO.some((token) => contextoCategoria.includes(token));
  const textoPesoForte = TOKENS_TEXTO_PESO_FORTE.some((token) => texto.includes(token));
  const textoComAgranel = includesAnyToken(texto, TOKENS_TEXTO_PESO_GRANEL);
  const textoComBalanca = includesAnyToken(texto, TOKENS_TEXTO_PESO_BALANCA);
  const itemFeira = TOKENS_ITEMS_FEIRA.some((token) => texto.includes(token));
  const categoriaUnitaria = TOKENS_CATEGORIA_UNITARIA.some((token) => contextoCategoria.includes(token));
  const contextoAlimentarPeso = includesAnyToken(contextoCompleto, TOKENS_CONTEXTO_ALIMENTAR_PESO);
  const contextoBloqueadoPeso = includesAnyToken(contextoCompleto, TOKENS_CONTEXTO_BLOQUEIO_PESO);
  const temMedidaEmbalagem = REGEX_MEDIDA_EMBALAGEM.test(texto);
  const temTokenEmbalagem = TOKENS_EMBALAGEM.some((token) => texto.includes(token));
  const aparentaEmbalado = temMedidaEmbalagem || temTokenEmbalagem;
  const categoriaOperacional = normalizeProductText(produto?.categoria_operacional || produto?.categoriaOperacional);
  const metadataFavoravelPeso = (
    categoriaOperacional.includes('balanca')
    || categoriaOperacional.includes('granel')
    || categoriaOperacional.includes('horti')
    || categoriaOperacional.includes('feira')
  );
  const contextoFavoravelPeso = categoriaPeso || itemFeira || contextoAlimentarPeso || metadataFavoravelPeso;

  if (contextoBloqueadoPeso) {
    return 'unidade';
  }

  if (textoPesoForte) {
    // "a granel"/"balanca" sozinhos nao devem ativar peso fora de contexto alimentar.
    if (!contextoFavoravelPeso) {
      return 'unidade';
    }

    if (aparentaEmbalado && (textoComAgranel || textoComBalanca)) {
      return 'unidade';
    }

    return 'peso';
  }

  if ((categoriaPeso || itemFeira || metadataFavoravelPeso) && !categoriaUnitaria && !aparentaEmbalado) {
    return 'peso';
  }

  return 'unidade';
}

function isProdutoFarinha(produto = {}) {
  return getProdutoTextoCompleto(produto).includes('farinha');
}

export function resolvePesoConfig(produto = {}, unidadeVenda = resolveUnidadeVenda(produto)) {
  if (unidadeVenda !== 'peso') {
    return {
      peso_min_gramas: null,
      peso_step_gramas: null,
      peso_padrao_gramas: null,
      permite_fracionado: false
    };
  }

  const farinha = isProdutoFarinha(produto);
  const pesoMin = toPositiveInt(produto?.peso_min_gramas, farinha ? 500 : 100);
  const pesoStep = toPositiveInt(produto?.peso_step_gramas, farinha ? 500 : 50);

  let pesoPadrao = toPositiveInt(produto?.peso_padrao_gramas, farinha ? 500 : Math.max(500, pesoMin));
  if (pesoPadrao < pesoMin) {
    pesoPadrao = pesoMin;
  }

  const base = pesoMin;
  const passo = Math.max(1, pesoStep);
  const resto = (pesoPadrao - base) % passo;
  if (resto !== 0) {
    pesoPadrao += (passo - resto);
  }

  const permiteFracionadoInformado = produto?.permite_fracionado;
  const permiteFracionado = (permiteFracionadoInformado === null || permiteFracionadoInformado === undefined || String(permiteFracionadoInformado).trim() === '')
    ? true
    : hasTruthyFlag(permiteFracionadoInformado, true);

  return {
    peso_min_gramas: pesoMin,
    peso_step_gramas: passo,
    peso_padrao_gramas: pesoPadrao,
    permite_fracionado: permiteFracionado
  };
}

export function sanitizePesoGramas(inputPeso, config = {}) {
  const pesoMin = Math.max(1, toPositiveInt(config?.peso_min_gramas, 1));
  const pesoStep = Math.max(1, toPositiveInt(config?.peso_step_gramas, 1));
  const pesoPadrao = Math.max(pesoMin, toPositiveInt(config?.peso_padrao_gramas, pesoMin));
  const informado = toPositiveInt(inputPeso, 0);

  let pesoFinal = informado > 0 ? informado : pesoPadrao;
  if (pesoFinal < pesoMin) {
    pesoFinal = pesoMin;
  }

  const base = pesoMin;
  const resto = (pesoFinal - base) % pesoStep;
  if (resto !== 0) {
    pesoFinal += (pesoStep - resto);
  }

  return pesoFinal;
}

export function formatPesoSelecionado(pesoGramas) {
  const peso = Math.max(1, toPositiveInt(pesoGramas, 0));
  if (peso >= 1000) {
    const kg = peso / 1000;
    const texto = Number.isInteger(kg)
      ? String(kg)
      : kg.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',');
    return `${texto}kg`;
  }

  return `${peso}g`;
}

export function formatPesoInputValue(pesoGramas) {
  return String(Math.max(1, toPositiveInt(pesoGramas, 0)));
}

export function calcularSubtotalPeso(precoPorKg, pesoGramas, quantidade = 1) {
  const preco = Number(precoPorKg || 0);
  const peso = Math.max(1, toPositiveInt(pesoGramas, 0));
  const qtd = Math.max(1, Math.floor(Number(quantidade || 1)));
  return Number((preco * (peso / 1000) * qtd).toFixed(2));
}

export function buildCartItemKey({ id, unidadeVenda = 'unidade', pesoGramas = null } = {}) {
  const idNormalizado = Number(id || 0);
  const unidadeNormalizada = unidadeVenda === 'peso' ? 'peso' : 'unidade';
  const pesoNormalizado = unidadeNormalizada === 'peso' ? toPositiveInt(pesoGramas, 0) : 0;
  return `${idNormalizado}:${unidadeNormalizada}:${pesoNormalizado}`;
}

export function buildNomeCarrinho(produto = {}, unidadeVenda = resolveUnidadeVenda(produto), pesoGramas = null) {
  const nomeBase = String(produto?.nome || '').trim() || 'Produto';
  if (unidadeVenda !== 'peso') {
    return nomeBase;
  }

  return `${nomeBase} - ${formatPesoSelecionado(pesoGramas)}`;
}

export function isItemPeso(item = {}) {
  return resolveUnidadeVenda(item) === 'peso';
}

export function isProdutoVisivelNoCatalogo(produto = {}) {
  if (isProdutoTabaco(produto)) {
    return false;
  }

  if (!hasTruthyFlag(produto?.visivel_no_site, true)) {
    return false;
  }

  if (hasTruthyFlag(produto?.oculto_catalogo, false)) {
    return false;
  }

  return true;
}
