import { normalizeMatchers, normalizeText, textoContemMatcher } from './produtosUtils';

export const CATEGORIA_CERVEJAS = 'cervejas';
export const CATEGORIAS_PRINCIPAIS_NAVEGACAO = [
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'bebidas-alcoolicas', label: 'Bebidas Alcoólicas' },
  { id: 'mercearia', label: 'Mercearia' },
  { id: 'hortifruti', label: 'Hortifruti' },
  { id: 'limpeza', label: 'Limpeza' },
  { id: 'frios', label: 'Frios e Laticínios' },
  { id: 'acougue', label: 'Açougue' },
  { id: 'descartaveis', label: 'Descartáveis' },
  { id: 'salgadinhos', label: 'Salgadinhos' },
  { id: 'doces', label: 'Doces' },
  { id: 'biscoitos', label: 'Biscoitos' }
];

const CATEGORIAS_PRINCIPAIS_IDS = new Set(CATEGORIAS_PRINCIPAIS_NAVEGACAO.map((item) => item.id));
const CATEGORIA_PRINCIPAL_ALIAS = {
  agua: 'bebidas',
  refrigerantes: 'bebidas',
  cervejas: 'bebidas-alcoolicas',
  cerveja: 'bebidas-alcoolicas',
  vinho: 'bebidas-alcoolicas',
  vinhos: 'bebidas-alcoolicas',
  destilados: 'bebidas-alcoolicas',
  destilado: 'bebidas-alcoolicas',
  frios_e_laticinios: 'frios',
  frios_laticinios: 'frios',
  derivados_lacteos: 'frios',
  leites_fermentados: 'frios',
  higiene: 'limpeza',
  higiene_pessoal: 'limpeza',
  lavanderia: 'limpeza',
  descartavel: 'descartaveis',
  descartaveis: 'descartaveis',
  carnes: 'acougue',
  acougue: 'acougue',
  açougue: 'acougue'
};
const BEBIDAS_ALCOOLICAS_MATCHERS = normalizeMatchers([
  'cerveja',
  'chopp',
  'pilsen',
  'lager',
  'ipa',
  'stout',
  'heineken',
  'brahma',
  'skol',
  'budweiser',
  'vinho',
  'espumante',
  'whisky',
  'vodka',
  'gin',
  'rum',
  'tequila',
  'licor',
  'conhaque',
  'cachaca',
  'cachaça',
  'aperitivo',
  'vermouth',
  'vermute'
]);

const BEBIDAS_NAO_ALCOOLICAS_MATCHERS = normalizeMatchers([
  'agua',
  'mineral',
  'refrigerante',
  'coca',
  'pepsi',
  'guarana',
  'fanta',
  'sprite',
  'h2o',
  'suco',
  'nectar',
  'energetico',
  'isotonico',
  'cha',
  'cafe',
  'achocolatado',
  'bebida lactea',
  'iogurte liquido',
  'leite uht',
  'sem alcool',
  'sem álcool'
]);
const CATEGORIAS_BASE_ELEGIVEIS_CERVEJA = new Set([
  'mercearia',
  'bebidas',
  'agua',
  'refrigerantes',
  CATEGORIA_CERVEJAS
]);

const CERVEJA_MATCHERS = [
  'cerveja',
  'heineken',
  'brahma',
  'skol',
  'itaipava',
  'budweiser',
  'stella',
  'corona',
  'spaten',
  'amstel',
  'chopp',
  'pilsen',
  'lager',
  'weiss',
  'witbier',
  'long neck',
  'longneck',
  'puro malte'
].map(normalizeText);

export function isProdutoCerveja(textoBusca) {
  const texto = normalizeText(textoBusca);
  if (!texto) {
    return false;
  }

  return CERVEJA_MATCHERS.some((matcher) => texto.includes(matcher));
}

export function classifyCategoriaComercial({ categoriaAgrupada, textoBusca }) {
  const categoriaBase = normalizeText(categoriaAgrupada);
  const categoriaBaseValida = categoriaBase || 'outros';

  if (!CATEGORIAS_BASE_ELEGIVEIS_CERVEJA.has(categoriaBaseValida)) {
    return categoriaBaseValida;
  }

  // Regra de negocio: cervejas nunca ficam em mercearia/bebidas genericas.
  if (isProdutoCerveja(textoBusca)) {
    return CATEGORIA_CERVEJAS;
  }

  return categoriaBaseValida;
}

export function resolveCategoriaPrincipalVitrine(categoriaId, textoBusca = '') {
  const normalizada = normalizeText(String(categoriaId || '').trim());
  if (!normalizada) {
    return 'outros';
  }

  const categoriaPrincipalBase = CATEGORIA_PRINCIPAL_ALIAS[normalizada] || normalizada;
  if (categoriaPrincipalBase === 'bebidas') {
    const textoNormalizado = normalizeText(textoBusca);
    if (textoContemMatcher(textoNormalizado, BEBIDAS_NAO_ALCOOLICAS_MATCHERS)) {
      return 'bebidas';
    }

    const ehBebidaAlcoolica = textoContemMatcher(textoNormalizado, BEBIDAS_ALCOOLICAS_MATCHERS);
    if (ehBebidaAlcoolica) {
      return 'bebidas-alcoolicas';
    }
  }

  const categoriaPrincipal = categoriaPrincipalBase;

  if (CATEGORIAS_PRINCIPAIS_IDS.has(categoriaPrincipal)) {
    return categoriaPrincipal;
  }

  return categoriaPrincipal;
}
