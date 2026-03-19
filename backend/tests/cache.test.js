'use strict';

const { BoundedCache } = require('../lib/cache');

describe('BoundedCache', () => {
  test('set/get basic', () => {
    const cache = new BoundedCache({ maxSize: 10, ttlMs: 60000, name: 'test' });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  test('respects maxSize with LRU eviction', () => {
    const cache = new BoundedCache({ maxSize: 3, ttlMs: 60000, name: 'test' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  test('respects TTL', () => {
    const cache = new BoundedCache({ maxSize: 10, ttlMs: 50, name: 'test' });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);

    // Manually expire the entry by setting ts far in the past
    const entry = cache._map.get('a');
    entry.ts = Date.now() - 60000;
    expect(cache.get('a')).toBeUndefined();
  });

  test('clearByPrefix removes matching keys', () => {
    const cache = new BoundedCache({ maxSize: 10, ttlMs: 60000, name: 'test' });
    cache.set('user:1', 'a');
    cache.set('user:2', 'b');
    cache.set('product:1', 'c');
    cache.clearByPrefix('user:');
    expect(cache.get('user:1')).toBeUndefined();
    expect(cache.get('user:2')).toBeUndefined();
    expect(cache.get('product:1')).toBe('c');
  });

  test('purgeExpired removes only expired entries', () => {
    const cache = new BoundedCache({ maxSize: 10, ttlMs: 60000, name: 'test' });
    cache.set('fresh', 1);
    cache.set('stale', 2);
    // Manually expire 'stale'
    cache._map.get('stale').ts = Date.now() - 70000;
    cache.purgeExpired();
    expect(cache.get('fresh')).toBe(1);
    expect(cache.get('stale')).toBeUndefined();
  });

  test('has checks TTL', () => {
    const cache = new BoundedCache({ maxSize: 10, ttlMs: 60000, name: 'test' });
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    cache._map.get('a').ts = Date.now() - 70000;
    expect(cache.has('a')).toBe(false);
  });

  test('clear removes all entries', () => {
    const cache = new BoundedCache({ maxSize: 10, ttlMs: 60000, name: 'test' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
