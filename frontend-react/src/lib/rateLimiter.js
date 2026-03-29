const attempts = new Map();

/**
 * Rate limiter simples no frontend.
 * Limita acoes por chave (ex: 'create_order', 'login').
 *
 * @param {string} key - Identificador da acao
 * @param {number} maxAttempts - Maximo de tentativas
 * @param {number} windowMs - Janela de tempo em ms
 * @returns {boolean} true se permitido, false se limitado
 */
export function rateLimitCheck(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const record = attempts.get(key) || { count: 0, firstAttempt: now };

  if (now - record.firstAttempt > windowMs) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return true;
  }

  record.count++;
  attempts.set(key, record);

  return record.count <= maxAttempts;
}
