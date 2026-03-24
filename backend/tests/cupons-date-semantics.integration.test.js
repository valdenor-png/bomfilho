'use strict';

const express = require('express');
const request = require('supertest');

const { pool } = require('../lib/db');
const createCuponsRoutes = require('../routes/cupons');
const { toMoney } = require('../lib/helpers');

const describeIfIntegration = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIfIntegration('Integração PostgreSQL - semântica de data de cupom', () => {
  let app;

  beforeAll(async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS cupons (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(80) UNIQUE NOT NULL,
      descricao TEXT,
      tipo VARCHAR(20) NOT NULL,
      valor NUMERIC(10,2) NOT NULL,
      valor_minimo NUMERIC(10,2) DEFAULT 0,
      uso_atual INTEGER DEFAULT 0,
      uso_maximo INTEGER,
      ativo BOOLEAN DEFAULT TRUE,
      validade DATE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS cupons_usados (
      id SERIAL PRIMARY KEY,
      cupom_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      pedido_id INTEGER,
      criado_em TIMESTAMP DEFAULT NOW()
    )`);

    app = express();
    app.use(express.json());
    app.use(createCuponsRoutes({
      autenticarToken: (req, _res, next) => {
        req.usuario = { id: 42 };
        next();
      },
      toMoney
    }));
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE cupons_usados RESTART IDENTITY');
    await pool.query('TRUNCATE TABLE cupons RESTART IDENTITY');
  });

  test('cupom com validade em CURRENT_DATE é aceito (regra por data civil)', async () => {
    await pool.query(
      `INSERT INTO cupons (codigo, descricao, tipo, valor, valor_minimo, uso_atual, uso_maximo, ativo, validade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)`,
      ['DATAHOJE', 'Cupom válido hoje', 'fixo', 5, 10, 0, 100, true]
    );

    const res = await request(app)
      .post('/api/cupons/validar')
      .send({ codigo: 'DATAHOJE', valorPedido: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('valido', true);
  });

  test('cupom com validade em CURRENT_DATE - 1 dia é expirado', async () => {
    await pool.query(
      `INSERT INTO cupons (codigo, descricao, tipo, valor, valor_minimo, uso_atual, uso_maximo, ativo, validade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, (CURRENT_DATE - INTERVAL '1 day'))`,
      ['ONTEM', 'Cupom expirado', 'fixo', 5, 10, 0, 100, true]
    );

    const res = await request(app)
      .post('/api/cupons/validar')
      .send({ codigo: 'ONTEM', valorPedido: 50 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('erro');
  });
});
