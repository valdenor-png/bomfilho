'use strict';

const express = require('express');
const request = require('supertest');

const mockPool = {
  query: jest.fn(),
  getConnection: jest.fn()
};

const mockQueryWithRetry = jest.fn();

jest.mock('../lib/db', () => ({
  pool: mockPool,
  queryWithRetry: mockQueryWithRetry
}));

const createOfertasDiaRoutes = require('../routes/ofertas-dia');

describe('Ofertas do dia - autorizacao admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function criarApp({ exigirAcessoLocalAdmin, autenticarAdminToken }) {
    const app = express();
    app.use(express.json());
    app.use(createOfertasDiaRoutes({ exigirAcessoLocalAdmin, autenticarAdminToken }));
    return app;
  }

  test('bloqueia rota admin quando acesso local e negado', async () => {
    const app = criarApp({
      exigirAcessoLocalAdmin: (_req, res, _next) => res.status(403).json({ erro: 'bloqueado_local' }),
      autenticarAdminToken: (_req, _res, next) => next()
    });

    const res = await request(app).get('/api/admin/ofertas-dia');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ erro: 'bloqueado_local' });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  test('bloqueia reordenacao com ids invalidos', async () => {
    const app = criarApp({
      exigirAcessoLocalAdmin: (_req, _res, next) => next(),
      autenticarAdminToken: (_req, _res, next) => next()
    });

    const res = await request(app)
      .put('/api/admin/ofertas-dia/ordenar')
      .send({ ids: [1, 'abc', 2] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(mockPool.getConnection).not.toHaveBeenCalled();
  });
});