// ─── Subcategorias heurísticas por categoria ─────────────────────────
// Cada categoria principal tem subcategorias derivadas por matcher de texto
// no nome/descrição do produto. Isso permite filtrar mesmo sem campo de
// subcategoria no banco de dados.

import { normalizeText } from './produtosUtils';

/** Definição de subcategorias por categoria principal */
export const SUBCATEGORIAS_POR_CATEGORIA = {
  bebidas: [
    { id: 'agua', label: 'Águas', matchers: ['agua', 'mineral', 'sem gas', 'com gas', 'agua de coco'] },
    { id: 'refrigerante', label: 'Refrigerantes', matchers: ['refrigerante', 'coca', 'pepsi', 'guarana', 'guaraná', 'fanta', 'sprite', 'kuat', 'sukita', 'dolly', 'tubaina', 'h2o'] },
    { id: 'sucos', label: 'Sucos', matchers: ['suco', 'nectar', 'tang', 'clight', 'del valle', 'kapo', 'limonada', 'juice', 'laranjada'] },
    { id: 'energeticos', label: 'Energéticos', matchers: ['energetico', 'energético', 'isotonico', 'isotônico', 'gatorade', 'powerade', 'monster', 'red bull', 'tonica', 'tônica'] },
    { id: 'chas-cafes', label: 'Chás e Cafés', matchers: ['cha ', 'cafe', 'café', 'cappuccino', 'nescafe', 'nescafé', 'mate', 'kombucha'] },
    { id: 'achocolatados', label: 'Achocolatados', matchers: ['achocolatado', 'toddy', 'nescau', 'toddynho'] },
  ],
  'bebidas-alcoolicas': [
    { id: 'cervejas', label: 'Cervejas', matchers: ['cerveja', 'heineken', 'brahma', 'skol', 'antarctica', 'itaipava', 'chopp', 'pilsen', 'lager', 'ipa'] },
    { id: 'vinhos', label: 'Vinhos', matchers: ['vinho', 'tinto', 'branco', 'rose', 'rosé', 'sangria', 'espumante'] },
    { id: 'destilados', label: 'Destilados', matchers: ['vodka', 'whisky', 'rum', 'gin', 'cachaça', 'cachaca', 'tequila', 'conhaque', 'pitu', '51 ', 'smirnoff'] },
    { id: 'licores', label: 'Licores e Aperitivos', matchers: ['licor', 'campari', 'aperol', 'vermouth', 'vermute', 'martini'] },
    { id: 'drinks-prontos', label: 'Drinks Prontos', matchers: ['ice', 'beats', 'skyy', 'caipirinha pronta', 'drink pronto', 'cooler', 'sidra'] }
  ],
  mercearia: [
    {
      id: 'mercearia-seca',
      label: 'Mercearia Seca',
      matchers: [
        'arroz',
        'feijao',
        'feijão',
        'farinha',
        'acucar',
        'açúcar',
        'cafe',
        'café',
        'macarrao',
        'macarrão',
        'espaguete',
        'penne',
        'talharim',
        'biscoito',
        'farofa',
        'leite em po',
        'leite em pó',
        'po lacteo',
        'pó lácteo'
      ]
    },
    {
      id: 'mercearia-liquida',
      label: 'Mercearia Líquida',
      matchers: [
        'oleo',
        'óleo',
        'azeite',
        'vinagre',
        'suco',
        'nectar',
        'néctar',
        'agua',
        'água',
        'refrigerante'
      ]
    },
    {
      id: 'conservas-enlatados',
      label: 'Conservas e Enlatados',
      matchers: [
        'milho',
        'ervilha',
        'molho de tomate',
        'extrato de tomate',
        'atum',
        'sardinha',
        'conserva',
        'enlatado'
      ]
    },
    {
      id: 'condimentos-temperos',
      label: 'Condimentos e Temperos',
      matchers: [
        'sal ',
        'especiaria',
        'tempero',
        'ketchup',
        'mostarda',
        'maionese',
        'pimenta',
        'oregano',
        'orégano',
        'sazon',
        'knorr'
      ]
    }
  ],
  cervejas: [
    { id: 'lagers', label: 'Lagers', matchers: ['lager', 'puro malte', 'american lager'] },
    { id: 'pilsen', label: 'Pilsen', matchers: ['pilsen', 'pilsner'] },
    { id: 'premium', label: 'Premium', matchers: ['premium', 'especial', 'gold'] },
    { id: 'artesanais', label: 'Artesanais', matchers: ['artesanal', 'ipa', 'apa', 'weiss', 'witbier', 'session', 'stout'] },
    { id: 'long-neck', label: 'Long neck', matchers: ['long neck', 'longneck'] },
    { id: 'lata', label: 'Lata', matchers: ['lata', 'latão', 'latao'] },
    { id: 'packs-fardos', label: 'Packs e fardos', matchers: ['pack', 'fardo', 'caixa', 'combo'] }
  ],
  hortifruti: [
    { id: 'frutas', label: 'Frutas', matchers: ['banana', 'maca', 'maçã', 'laranja', 'limao', 'limão', 'manga', 'uva', 'morango', 'melancia', 'abacaxi', 'mamao', 'mamão', 'pera', 'kiwi', 'goiaba', 'maracuja', 'maracujá'] },
    { id: 'verduras', label: 'Verduras', matchers: ['alface', 'couve', 'espinafre', 'rucula', 'rúcula', 'agriao', 'agrião', 'acelga', 'chicoria', 'chicória', 'salsa', 'cheiro verde', 'cebolinha'] },
    { id: 'legumes', label: 'Legumes', matchers: ['tomate', 'cebola', 'batata', 'cenoura', 'beterraba', 'abobrinha', 'pepino', 'pimentao', 'pimentão', 'berinjela', 'chuchu', 'mandioca', 'inhame'] },
    { id: 'ervas', label: 'Ervas e Temperos', matchers: ['manjericao', 'manjericão', 'hortela', 'hortelã', 'alecrim', 'tomilho', 'oregano', 'orégano', 'gengibre'] },
  ],
  higiene: [
    { id: 'shampoo', label: 'Shampoo e Condicionador', matchers: ['shampoo', 'condicionador', 'creme para pentear', 'cabelo'] },
    { id: 'sabonete', label: 'Sabonete', matchers: ['sabonete', 'sabao', 'sabão'] },
    { id: 'creme-dental', label: 'Creme Dental', matchers: ['creme dental', 'pasta de dente', 'escova de dente', 'enxaguante', 'fio dental', 'colgate', 'oral-b'] },
    { id: 'papel-higienico', label: 'Papel Higiênico', matchers: ['papel higienico', 'papel higiênico', 'papel toalha', 'lenco', 'lenço'] },
    { id: 'desodorante', label: 'Desodorante', matchers: ['desodorante', 'antitranspirante', 'rexona', 'dove'] },
    { id: 'absorvente', label: 'Absorvente', matchers: ['absorvente', 'protetor diario', 'protetor diário'] },
  ],
  frios: [
    { id: 'leite', label: 'Leite', matchers: ['leite integral', 'leite desnatado', 'leite semi', 'leite uht', 'leite longa', 'leite fresco'] },
    { id: 'queijos', label: 'Queijos', matchers: ['queijo', 'mussarela', 'mozzarella', 'parmesao', 'provolone', 'cheddar', 'ricota', 'gorgonzola', 'prato'] },
    { id: 'iogurte', label: 'Iogurte', matchers: ['iogurte', 'danone', 'activia', 'yakult', 'chamyto', 'fermentado'] },
    { id: 'manteiga', label: 'Manteiga e Margarina', matchers: ['manteiga', 'margarina', 'qualy'] },
    { id: 'requeijao', label: 'Requeijão', matchers: ['requeijao', 'requeijão', 'cream cheese', 'catupiry'] },
    { id: 'frios-embutidos', label: 'Frios e Embutidos', matchers: ['presunt', 'presunto', 'mortadela', 'salame', 'salsicha', 'linguica', 'linguiça', 'bacon', 'peito peru', 'apresuntado'] },
    { id: 'empanados', label: 'Congelados', matchers: ['empan', 'nuggets', 'steak', 'congelado', 'lasanha congelada', 'pizza congelada'] },
  ],
  limpeza: [
    {
      id: 'higiene',
      label: 'Higiene',
      matchers: [
        'detergente',
        'desinfetante',
        'multiuso',
        'limpa vidro',
        'limpa pisos',
        'agua sanitaria',
        'água sanitária',
        'cloro',
        'esponja',
        'pano',
        'flanela',
        'luva'
      ]
    },
    {
      id: 'lavanderia',
      label: 'Lavanderia',
      matchers: [
        'sabao em po',
        'sabão em pó',
        'sabao liquido',
        'sabão líquido',
        'lava roupa',
        'lava-roupa',
        'amaciante',
        'tira manchas',
        'omo',
        'surf',
        'brilhante',
        'comfort',
        'downy'
      ]
    },
    {
      id: 'higiene-pessoal',
      label: 'Higiene Pessoal',
      matchers: [
        'shampoo',
        'condicionador',
        'sabonete',
        'creme dental',
        'pasta de dente',
        'escova de dente',
        'enxaguante',
        'fio dental',
        'desodorante',
        'absorvente',
        'papel higienico',
        'papel higiênico',
        'lenço',
        'lenco'
      ]
    },
  ],
  salgadinhos: [
    { id: 'chips', label: 'Batata e Chips', matchers: ['batata', 'chips', 'ruffles', 'lays', 'pringles', 'doritos', 'cheetos'] },
    { id: 'amendoim', label: 'Amendoim', matchers: ['amendoim', 'paçoca', 'pacoca', 'castanha'] },
    { id: 'pipoca', label: 'Pipoca', matchers: ['pipoca', 'popcorn'] },
    { id: 'snacks', label: 'Snacks e Petiscos', matchers: ['salgadinho', 'snack', 'petisco', 'palito', 'biscoito salgado'] },
  ],
  doces: [
    { id: 'chocolate', label: 'Chocolates', matchers: ['chocolate', 'cacau', 'bombom', 'bis', 'kit kat', 'lacta', 'garoto', 'nestle'] },
    { id: 'bala', label: 'Balas e Gomas', matchers: ['bala', 'goma', 'chiclete', 'jujuba', 'pastilha', 'tic tac', 'trident'] },
    { id: 'sobremesa', label: 'Sobremesas', matchers: ['pudim', 'gelatina', 'flan', 'mousse', 'doce de leite'] },
  ],
  biscoitos: [
    { id: 'recheados', label: 'Recheados', matchers: ['recheado', 'oreo', 'negresco', 'trakinas', 'bono'] },
    { id: 'cream-cracker', label: 'Cream Cracker', matchers: ['cream cracker', 'agua e sal', 'água e sal', 'integral'] },
    { id: 'wafer', label: 'Wafer', matchers: ['wafer', 'bauducco'] },
    { id: 'rosquinha', label: 'Rosquinha e Amanteigado', matchers: ['rosquinha', 'amanteigado', 'maisena', 'maizena'] },
  ],
};

// Índice pré-processado para performance: normaliza matchers uma vez
const _subcategoriasIndex = {};
for (const [catKey, subs] of Object.entries(SUBCATEGORIAS_POR_CATEGORIA)) {
  _subcategoriasIndex[catKey] = subs.map((sub) => ({
    ...sub,
    matchersNormalizados: sub.matchers.map(normalizeText),
  }));
}

/**
 * Dado um produto indexado, retorna o ID da subcategoria heurística.
 * Usa o textoBusca (nome+marca+categoria+descrição normalizado) para matching.
 */
export function getSubcategoriaId(textoBusca, categoriaAgrupada) {
  const subs = _subcategoriasIndex[categoriaAgrupada];
  if (!subs) return null;

  for (const sub of subs) {
    for (const matcher of sub.matchersNormalizados) {
      if (textoBusca.includes(matcher)) {
        return sub.id;
      }
    }
  }
  return null;
}

/**
 * Retorna a lista de subcategorias disponíveis para uma categoria,
 * contando quantos produtos cada uma tem no array fornecido.
 * Só retorna subcategorias com pelo menos 1 produto.
 */
export function getSubcategoriasComContagem(produtosIndexados, categoriaAgrupada) {
  const defs = _subcategoriasIndex[categoriaAgrupada];
  if (!defs || defs.length === 0) return [];

  const contadores = new Map();
  defs.forEach((sub) => contadores.set(sub.id, 0));

  for (const item of produtosIndexados) {
    const subId = item._subcategoriaId || getSubcategoriaId(item.textoBusca, categoriaAgrupada);
    if (subId && contadores.has(subId)) {
      contadores.set(subId, contadores.get(subId) + 1);
    }
  }

  return defs
    .filter((sub) => contadores.get(sub.id) > 0)
    .map((sub) => ({
      id: sub.id,
      label: sub.label,
      count: contadores.get(sub.id),
    }));
}
