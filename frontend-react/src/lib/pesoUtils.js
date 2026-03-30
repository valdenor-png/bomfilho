/**
 * Detecta se um produto é vendido por peso (kg) baseado no nome e categoria.
 */
export function isProdutoPeso(product) {
  const nome = String(product?.name || product?.nome || '').toUpperCase();
  const cat = String(product?.category || product?.categoria || '').toLowerCase();

  // Detectar por nome
  if (/\bKG\b/.test(nome)) return true;
  if (/\bAGRANEL\b/.test(nome)) return true;
  if (/\bGRANEL\b/.test(nome)) return true;
  if (/\bBALANCA\b/.test(nome)) return true;

  // Detectar por categoria
  if (cat.includes('hortifruti') || cat.includes('horti')) return true;

  return false;
}

/**
 * Formata peso para exibição (g ou kg)
 */
export function formatPeso(pesoKg) {
  if (pesoKg >= 1) return `${pesoKg.toFixed(1)}kg`;
  return `${(pesoKg * 1000).toFixed(0)}g`;
}

/**
 * Calcula subtotal de item por peso
 */
export function calcSubtotalPeso(precoKg, pesoKg) {
  return pesoKg * precoKg;
}
