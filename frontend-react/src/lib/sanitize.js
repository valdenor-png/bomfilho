/**
 * Sanitiza string removendo tags HTML e caracteres perigosos.
 * Usar em inputs de texto: busca, nome, endereco, etc.
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .substring(0, 500);
}

/**
 * Sanitizacao leve — so remove tags HTML mas mantem caracteres.
 * Usar em campos que precisam de acentos e caracteres especiais.
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').substring(0, 1000);
}

/**
 * Sanitiza objeto inteiro (ex: dados de formulario antes de enviar pra API)
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
