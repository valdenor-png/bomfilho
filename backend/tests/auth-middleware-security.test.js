'use strict';

const jwt = require('jsonwebtoken');

jest.mock('../lib/config', () => ({
  JWT_SECRET: 'test-jwt-secret-strong',
  USER_AUTH_COOKIE_NAME: 'bf_access_token',
  ADMIN_AUTH_COOKIE_NAME: 'bf_admin_token',
  ADMIN_LOCAL_ONLY: true
}));

const createAuthMiddleware = require('../middleware/auth');

function criarResMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('Auth middleware - security guards', () => {
  test('exigirAcessoLocalAdmin bloqueia IP remoto', () => {
    const middleware = createAuthMiddleware({
      normalizarIp: (ip) => String(ip || '').replace(/^::ffff:/, ''),
      extrairTokenUsuarioRequest: () => '',
      extrairTokenAdminRequest: () => '',
      limparCookie: jest.fn()
    });

    const req = { ip: '8.8.8.8', originalUrl: '/api/admin/pedidos' };
    const res = criarResMock();
    const next = jest.fn();

    middleware.exigirAcessoLocalAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('autenticarAdminToken rejeita token sem role admin', () => {
    const limparCookie = jest.fn();
    const middleware = createAuthMiddleware({
      normalizarIp: (ip) => String(ip || '').replace(/^::ffff:/, ''),
      extrairTokenUsuarioRequest: () => '',
      extrairTokenAdminRequest: (req) => req.headers.authorization.replace('Bearer ', ''),
      limparCookie
    });

    const tokenSemRoleAdmin = jwt.sign({ role: 'user', id: 1 }, 'test-jwt-secret-strong', { expiresIn: '10m' });
    const req = {
      ip: '127.0.0.1',
      headers: { authorization: `Bearer ${tokenSemRoleAdmin}` },
      originalUrl: '/api/admin/ofertas-dia'
    };
    const res = criarResMock();
    const next = jest.fn();

    middleware.autenticarAdminToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(limparCookie).toHaveBeenCalledTimes(1);
  });
});
