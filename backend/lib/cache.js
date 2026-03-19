'use strict';

/**
 * Cache simples com TTL e tamanho máximo (evict LRU).
 * Substitui Map() ilimitados do projeto original.
 */
class BoundedCache {
  constructor({ maxSize = 500, ttlMs = 60_000, name = 'cache' } = {}) {
    this._map = new Map();
    this._maxSize = Math.max(1, maxSize);
    this._ttlMs = Math.max(0, ttlMs);
    this._name = name;
  }

  get size() {
    return this._map.size;
  }

  has(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (this._ttlMs > 0 && Date.now() - entry.ts > this._ttlMs) {
      this._map.delete(key);
      return false;
    }
    return true;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (this._ttlMs > 0 && Date.now() - entry.ts > this._ttlMs) {
      this._map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    // Delete first so re-insert goes to end
    this._map.delete(key);
    // Evict oldest if at capacity
    if (this._map.size >= this._maxSize) {
      const oldestKey = this._map.keys().next().value;
      this._map.delete(oldestKey);
    }
    this._map.set(key, { value, ts: Date.now() });
  }

  delete(key) {
    return this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  /**
   * Remove entradas expiradas (garbage collection manual).
   * Retorna quantidade removida.
   */
  purgeExpired() {
    if (this._ttlMs <= 0) return 0;
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this._map) {
      if (now - entry.ts > this._ttlMs) {
        this._map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** Remove todas as entradas cujo key começa com prefix. */
  clearByPrefix(prefix) {
    for (const key of this._map.keys()) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        this._map.delete(key);
      }
    }
  }

  /** Retorna snapshot das keys (para debug/métricas). */
  keys() {
    return [...this._map.keys()];
  }
}

module.exports = { BoundedCache };
