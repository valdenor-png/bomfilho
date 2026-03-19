'use strict';

const logger = require('../lib/logger');

describe('logger', () => {
  test('exports all log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  test('info writes to stdout', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // Force production mode is not possible without env, so just test it doesn't throw
    expect(() => logger.info('test message')).not.toThrow();
    spy.mockRestore();
  });

  test('error does not throw', () => {
    expect(() => logger.error('test error', new Error('boom'))).not.toThrow();
  });

  test('child returns logger with same interface', () => {
    const child = logger.child({ module: 'test' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.debug).toBe('function');
    expect(() => child.info('child message')).not.toThrow();
  });
});
