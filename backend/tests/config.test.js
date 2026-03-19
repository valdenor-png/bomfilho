'use strict';

// Set required env vars before importing config
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://test:test@localhost:3306/testdb';
process.env.NODE_ENV = 'test';

const config = require('../lib/config');

describe('config', () => {
  test('exports core variables', () => {
    expect(config.DATABASE_URL).toBeTruthy();
    expect(config.NODE_ENV).toBe('test');
    expect(typeof config.IS_PRODUCTION).toBe('boolean');
    expect(config.IS_PRODUCTION).toBe(false);
    expect(config.PORT).toBeDefined();
    expect(typeof config.SERVICE_NAME).toBe('string');
  });

  test('exports PagBank config', () => {
    expect(config.PAGBANK_CONFIG).toBeDefined();
    expect(typeof config.PAGBANK_ENV).toBe('string');
  });

  test('exports cookie config', () => {
    expect(config.USER_AUTH_COOKIE_NAME).toBe('bf_access_token');
    expect(config.ADMIN_AUTH_COOKIE_NAME).toBe('bf_admin_token');
    expect(config.CSRF_COOKIE_NAME).toBe('bf_csrf_token');
    expect(typeof config.COOKIE_SECURE).toBe('boolean');
  });

  test('exports CORS config', () => {
    expect(Array.isArray(config.CORS_ORIGINS)).toBe(true);
    expect(Array.isArray(config.CORS_ORIGIN_PATTERNS)).toBe(true);
  });

  test('exports helper functions', () => {
    expect(typeof config.parseBooleanEnv).toBe('function');
    expect(typeof config.escapeRegex).toBe('function');
    expect(typeof config.normalizarOrigin).toBe('function');
  });

  test('parseBooleanEnv works correctly', () => {
    process.env.__TEST_BOOL = 'true';
    expect(config.parseBooleanEnv('__TEST_BOOL', false)).toBe(true);
    process.env.__TEST_BOOL = 'false';
    expect(config.parseBooleanEnv('__TEST_BOOL', true)).toBe(false);
    delete process.env.__TEST_BOOL;
    expect(config.parseBooleanEnv('__TEST_BOOL', true)).toBe(true);
  });

  test('escapeRegex escapes special chars', () => {
    expect(config.escapeRegex('hello.world')).toBe('hello\\.world');
    expect(config.escapeRegex('a+b*c')).toBe('a\\+b\\*c');
  });

  test('normalizarOrigin trims and lowercases', () => {
    expect(config.normalizarOrigin('  HTTP://LOCALHOST:5173/  ')).toBe('http://localhost:5173');
    expect(config.normalizarOrigin('')).toBe('');
  });
});
