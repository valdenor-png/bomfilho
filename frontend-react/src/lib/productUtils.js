export function getSaleType(product) {
  const nome = (product.nome || product.name || '').toLowerCase();
  const unidade = (product.unidade_venda || product.unidade || '').toLowerCase();
  const cat = (product.categoria || product.category || '').toLowerCase();

  if (
    unidade.includes('kg') || unidade.includes('balanca') || unidade.includes('balança') ||
    nome.includes('kg balanca') || nome.includes('kg balança') || nome.includes('por kg') ||
    nome.includes('a granel') || cat === 'hortifruti'
  ) return 'peso';

  return 'unidade';
}

export function formatDisplayName(name) {
  if (!name) return '';
  const units = ['kg', 'g', 'ml', 'lt', 'l', 'un', 'und', 'cx', 'pct', 'pc'];
  return name.toLowerCase().split(/\s+/).map(w => {
    if (units.includes(w) || w.length <= 2) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

export function formatPriceUnit(product) {
  const type = getSaleType(product);
  const price = (product.preco || product.price || 0).toFixed(2).replace('.', ',');
  return type === 'peso' ? `R$ ${price}/kg` : `R$ ${price}`;
}
