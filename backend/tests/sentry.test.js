'use strict';

const sentry = require('../lib/sentry');

describe('sentry (no DSN)', () => {
  test('exports expected functions', () => {
    expect(typeof sentry.captureException).toBe('function');
    expect(typeof sentry.captureMessage).toBe('function');
    expect(typeof sentry.sentryErrorHandler).toBe('function');
    expect(typeof sentry.sentryRequestHandler).toBe('function');
    expect(typeof sentry.isActive).toBe('function');
  });

  test('isActive returns false without DSN', () => {
    expect(sentry.isActive()).toBe(false);
  });

  test('captureException is no-op without DSN', () => {
    expect(() => sentry.captureException(new Error('test'))).not.toThrow();
  });

  test('captureMessage is no-op without DSN', () => {
    expect(() => sentry.captureMessage('test')).not.toThrow();
  });

  test('sentryErrorHandler returns passthrough middleware', () => {
    const handler = sentry.sentryErrorHandler();
    expect(typeof handler).toBe('function');
    const next = jest.fn();
    handler(new Error('test'), {}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('sentryRequestHandler returns passthrough middleware', () => {
    const handler = sentry.sentryRequestHandler();
    expect(typeof handler).toBe('function');
    const next = jest.fn();
    handler({}, {}, next);
    expect(next).toHaveBeenCalled();
  });
});
