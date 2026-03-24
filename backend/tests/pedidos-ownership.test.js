'use strict';

const express = require('express');
const request = require('supertest');

const mockPool = {
  query: jest.fn()
};

jest.mock('../lib/db', () => ({
  pool: mockPool
}));

jest.mock('../lib/config', () => ({
  DB_DIALECT: 'mysql'
}));

const createPedidosRoutes = require('../routes/pedidos');

describe('Pedidos - ownership authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function criarApp() {
    const app = express();
    app.use(express.json());
    app.use(createPedidosRoutes({
      autenticarToken: (req, _res, next) => {
        req.usuario = { id: 1 };
        next();
      },
      parsePositiveInt: (value, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      },
      montarPaginacao: (total, pagina, limite) => ({
        total,
        pagina,
        limite,
        total_paginas: 1,
        tem_mais: false
      })
    }));
    return app;
  }

  test('GET /api/pedidos/:id retorna 404 quando pedido nao pertence ao usuario autenticado', async () => {
    const app = criarApp();

    mockPool.query
      .mockResolvedValueOnce([[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'usuario_id' }, { COLUMN_NAME: 'status' }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/pedidos/999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('erro');
  });
});
