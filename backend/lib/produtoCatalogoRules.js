'use strict';

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

const TOKENS_SEM_ALCOOL = [
  'sem alcool'
];

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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPositiveInt(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }

  return Math.max(0, Math.round(Number(fallback || 0)));
}

function hasTruthyFlag(value, defaultValue = false) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return Boolean(defaultValue);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = normalizeText(value);
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

function getProdutoTexto(produto = {}) {
  return [
    produto?.nome,
    produto?.nome_externo,
    produto?.descricao,
    produto?.marca,
    produto?.categoria,
    produto?.departamento,
    produto?.secao_exibicao
  ]
    .map((item) => normalizeText(item))
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
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join(' ');
}

function resolveUnidadeVendaExplicita(produto = {}) {
  const unidadeVendaExpl = normalizeText(produto?.unidade_venda);
  if (unidadeVendaExpl === 'peso' || unidadeVendaExpl === 'unidade') {
    return unidadeVendaExpl;
  }

  const tipoVenda = normalizeText(produto?.tipo_venda || produto?.tipoVenda);
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

  const categoriaOperacional = normalizeText(produto?.categoria_operacional || produto?.categoriaOperacional);
  if (categoriaOperacional.includes('balanca') || categoriaOperacional.includes('granel')) {
    return 'peso';
  }

  if (categoriaOperacional.includes('embalad') || categoriaOperacional.includes('unitar')) {
    return 'unidade';
  }

  return null;
}

function isProdutoTabaco(produto = {}) {
  const controlado = normalizeText(produto?.produto_controlado);
  if (controlado === 'tabaco' || controlado === 'cigarro') {
    return true;
  }

  const texto = getProdutoTexto(produto);
  return TOKENS_TABACO.some((token) => texto.includes(token));
}

function isProdutoAlcoolico(produto = {}) {
  if (hasTruthyFlag(produto?.requer_maioridade)) {
    return true;
  }

  const controlado = normalizeText(produto?.produto_controlado);
  if (controlado === 'alcool' || controlado === 'bebida_alcoolica' || controlado === 'bebida-alcoolica') {
    return true;
  }

  if (isProdutoTabaco(produto)) {
    return false;
  }

  const categoria = normalizeText(produto?.categoria || produto?.departamento);
  if (categoria.includes('bebidas-alcoolicas')) {
    return true;
  }

  const texto = getProdutoTexto(produto);
  if (TOKENS_SEM_ALCOOL.some((token) => texto.includes(token))) {
    return false;
  }

  return TOKENS_ALCOOL.some((token) => texto.includes(token));
}

function isProdutoFarinha(produto = {}) {
  const texto = getProdutoTexto(produto);
  return texto.includes('farinha');
}

function resolveUnidadeVenda(produto = {}) {
  const unidadeExplicita = resolveUnidadeVendaExplicita(produto);
  if (unidadeExplicita) {
    return unidadeExplicita;
  }

  const texto = getProdutoTexto(produto);
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
  const categoriaOperacional = normalizeText(produto?.categoria_operacional || produto?.categoriaOperacional);
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

function resolveConfiguracaoPeso(produto = {}, unidadeVenda = resolveUnidadeVenda(produto)) {
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

function resolveVisibilidadePublica(produto = {}) {
  const tabaco = isProdutoTabaco(produto);
  const visivelNoSite = hasTruthyFlag(produto?.visivel_no_site, true);
  const ocultoCatalogo = hasTruthyFlag(produto?.oculto_catalogo, false);

  return {
    visivel_no_site: visivelNoSite,
    oculto_catalogo: ocultoCatalogo,
    is_tabaco: tabaco,
    visivel_publico: visivelNoSite && !ocultoCatalogo && !tabaco
  };
}

function formatarPesoSelecionado(pesoGramas) {
  const peso = Math.max(1, toPositiveInt(pesoGramas, 0));
  if (peso >= 1000) {
    const kg = peso / 1000;
    const kgFormatado = Number.isInteger(kg)
      ? String(kg)
      : kg.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',');
    return `${kgFormatado}kg`;
  }

  return `${peso}g`;
}

function normalizarPesoSelecionadoParaPedido(inputPeso, configuracaoPeso = {}) {
  const pesoInformado = toPositiveInt(inputPeso, 0);
  const pesoMin = Math.max(1, toPositiveInt(configuracaoPeso?.peso_min_gramas, 1));
  const pesoStep = Math.max(1, toPositiveInt(configuracaoPeso?.peso_step_gramas, 1));
  const pesoPadrao = Math.max(pesoMin, toPositiveInt(configuracaoPeso?.peso_padrao_gramas, pesoMin));

  const pesoFinal = pesoInformado > 0 ? pesoInformado : pesoPadrao;
  if (pesoFinal < pesoMin) {
    return {
      ok: false,
      motivo: 'peso_minimo',
      peso_gramas: pesoFinal,
      peso_min_gramas: pesoMin,
      peso_step_gramas: pesoStep
    };
  }

  const restoStep = (pesoFinal - pesoMin) % pesoStep;
  if (restoStep !== 0) {
    return {
      ok: false,
      motivo: 'peso_step',
      peso_gramas: pesoFinal,
      peso_min_gramas: pesoMin,
      peso_step_gramas: pesoStep
    };
  }

  return {
    ok: true,
    peso_gramas: pesoFinal,
    peso_min_gramas: pesoMin,
    peso_step_gramas: pesoStep
  };
}

function enriquecerProdutoParaCatalogo(produto = {}) {
  const unidadeVenda = resolveUnidadeVenda(produto);
  const configuracaoPeso = resolveConfiguracaoPeso(produto, unidadeVenda);
  const visibilidade = resolveVisibilidadePublica(produto);
  const alcoolico = isProdutoAlcoolico(produto);

  return {
    ...produto,
    unidade_venda: unidadeVenda,
    peso_min_gramas: configuracaoPeso.peso_min_gramas,
    peso_step_gramas: configuracaoPeso.peso_step_gramas,
    peso_padrao_gramas: configuracaoPeso.peso_padrao_gramas,
    permite_fracionado: configuracaoPeso.permite_fracionado,
    requer_maioridade: Boolean(alcoolico || hasTruthyFlag(produto?.requer_maioridade)),
    visivel_no_site: visibilidade.visivel_no_site,
    oculto_catalogo: visibilidade.oculto_catalogo,
    produto_controlado: produto?.produto_controlado || (visibilidade.is_tabaco ? 'tabaco' : (alcoolico ? 'alcool' : null))
  };
}

module.exports = {
  normalizeText,
  hasTruthyFlag,
  getProdutoTexto,
  isProdutoTabaco,
  isProdutoAlcoolico,
  resolveUnidadeVenda,
  resolveConfiguracaoPeso,
  resolveVisibilidadePublica,
  formatarPesoSelecionado,
  normalizarPesoSelecionadoParaPedido,
  enriquecerProdutoParaCatalogo
};
