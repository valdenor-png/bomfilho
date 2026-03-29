/**
 * Normaliza nomes de produtos de CAIXA ALTA/abreviados para legível.
 */

const removeWords = [
  'entrega', 'levar', 'entregar', 'retornavel', 'top util',
  'zein', 'bomba', 'n ', 'faor',
];

const expansions = {
  'garr': 'Garrafão', 'garraf': 'Garrafão', 'garrafao': 'Garrafão', 'garrafaor': 'Garrafão',
  'refrig': 'Refrigerante', 'min': 'Mineral', 'antart': 'Antarctica',
  'abs': 'Absorvente', 'achoc': 'Achocolatado', 'liq': 'Líquido',
  'lt': 'Lata', 'pc': 'Pacote', 'cx': 'Caixa', 'pct': 'Pacote',
  'bco': 'Branco', 'tp1': 'Tipo 1', 'tp2': 'Tipo 2',
  'autom': 'Automática', 'recarg': 'Recarga', 'trasp': 'Transparente',
  'c/ab': 'Com Abas', 'und': 'Unidade', 'un': 'Unidade',
  'desc': 'Descartável', 'orig': 'Original', 'trad': 'Tradicional',
  'integ': 'Integral', 'desnat': 'Desnatado', 'semides': 'Semidesnatado',
  'inst': 'Instantâneo', 'conc': 'Concentrado',
  'plast': 'Plástico', 'ct': 'Cotton',
  'not': 'Noturno', 'c/ab': 'Com Abas',
};

export default function formatProductName(name) {
  if (!name) return '';

  let clean = name.toLowerCase();

  // Remove palavras inúteis
  removeWords.forEach(w => {
    clean = clean.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), '');
  });

  // Expansões
  Object.entries(expansions).forEach(([abbr, full]) => {
    clean = clean.replace(new RegExp('\\b' + abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), full);
  });

  // Title Case
  clean = clean.replace(/\b\w/g, c => c.toUpperCase());

  // Unidades em uppercase
  clean = clean.replace(
    /\b(Kg|Ml|Lt|Un|Und|20l|25l|500ml|350ml|200ml|1l|5kg|1kg|2kg|10kg|800g|900ml|16un|8un)\b/gi,
    m => m.toUpperCase()
  );

  // Limpar espaços
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Mapeia subcategorias do banco para categorias principais.
 */
export const categoryMap = {
  'agua': 'bebidas', 'agua 20l': 'bebidas', 'agua mineral': 'bebidas',
  'refrigerante': 'bebidas', 'refrigerantes': 'bebidas', 'suco': 'bebidas',
  'sucos': 'bebidas', 'cerveja': 'bebidas', 'cervejas': 'bebidas',
  'leite': 'bebidas', 'leites': 'bebidas', 'bebida': 'bebidas',
  'bebidas': 'bebidas', 'bebidas alcoolicas': 'bebidas',
  'arroz e feijao': 'mercearia', 'arroz': 'mercearia', 'feijao': 'mercearia',
  'massa': 'mercearia', 'massas': 'mercearia', 'oleo': 'mercearia',
  'cafe': 'mercearia', 'acucar': 'mercearia', 'mercearia': 'mercearia',
  'biscoito': 'mercearia', 'biscoitos': 'mercearia', 'doces': 'mercearia',
  'salgadinhos': 'mercearia', 'tempero': 'mercearia', 'molho': 'mercearia',
  'fruta': 'hortifruti', 'verdura': 'hortifruti', 'legume': 'hortifruti',
  'hortifruti': 'hortifruti', 'hortifrutigranjeiros': 'hortifruti',
  'bebe': 'higiene', 'fralda': 'higiene', 'absorvente': 'higiene',
  'sabonete': 'higiene', 'higiene': 'higiene', 'higiene pessoal': 'higiene',
  'detergente': 'limpeza', 'sabao': 'limpeza', 'desinfetante': 'limpeza',
  'limpeza': 'limpeza', 'produtos de limpeza': 'limpeza',
  'frios': 'frios', 'frios e laticinios': 'frios', 'laticínios': 'frios',
  'derivados lacteos': 'frios', 'leites fermentados': 'frios',
};

export function getMainCategory(subcat) {
  if (!subcat) return 'outros';
  return categoryMap[subcat.toLowerCase().trim()] || 'outros';
}
