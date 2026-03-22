import { normalizeText } from './produtosUtils';

export const CATEGORIA_CERVEJAS = 'cervejas';
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
