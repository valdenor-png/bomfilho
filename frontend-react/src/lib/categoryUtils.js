import { normalizeText } from './produtosUtils';

export const CATEGORIA_CERVEJAS = 'cervejas';

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
  'pilsen',
  'lager',
  'ipa',
  'apa',
  'weiss',
  'witbier',
  'long neck',
  'longneck',
  'fardo',
  'pack',
  'latao',
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

  // Regra de negocio: cervejas nunca ficam em mercearia/bebidas genericas.
  if (isProdutoCerveja(textoBusca)) {
    return CATEGORIA_CERVEJAS;
  }

  return categoriaBase || 'outros';
}
