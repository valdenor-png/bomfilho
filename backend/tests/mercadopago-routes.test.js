'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../lib/config', () => ({
  MP_ACCESS_TOKEN: 'TEST_MP_TOKEN',
  MP_ENV: 'test',
  MP_NOTIFICATION_URL: 'https://example.test/notify',
  MP_WEBHOOK_SECRET: 'test_secret',
  IS_PRODUCTION: false,
  RECAPTCHA_PAYMENT_PROTECTION_ENABLED: true
}));

const createMercadoPagoRoutes = require('../routes/mercadopago');

describe('MercadoPago routes surface and error contract', () => {
  function criarApp(overrides = {}) {
    const pool = {
      query: jest.fn()
    };

    const mercadoPagoService = {
      criarPagamentoPix: jest.fn(),
      criarPagamentoCartao: jest.fn(),
      consultarPagamento: jest.fn(),
      mapearStatusPagamento: jest.fn((v) => v)
    };
    const paymentSyncService = {
      sincronizarPagamentoComPedido: jest.fn().mockResolvedValue({
        applied: true,
        reason: 'status_transition_applied',
        pedido: {
          id: 10,
          status_anterior: 'pendente',
          status_novo: 'pendente'
        }
      })
    };

    const validarRecaptcha = jest.fn().mockResolvedValue();

    const deps = {
      autenticarToken: (req, _res, next) => {
        req.usuario = { id: 1 };
        next();
      },
      mercadoPagoService,
      paymentSyncService,
      pool,
      validarRecaptcha,
      isProduction: false,
      recaptchaPaymentProtectionEnabled: true,
      ...overrides
    };

    const app = express();
    app.use(express.json());
    app.use(createMercadoPagoRoutes(deps));

    return {
      app,
      deps,
      pool,
      mercadoPagoService,
      paymentSyncService: deps.paymentSyncService,
      validarRecaptcha: deps.validarRecaptcha
    };
  }

  test('GET /api/mercadopago/status expõe superfície ativa', async () => {
    const { app } = criarApp();
    const res = await request(app).get('/api/mercadopago/status');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('active_runtime_gateway', 'mercadopago');
    expect(res.body).toHaveProperty('legados_presentes_no_repositorio');
  });

  test('POST /api/mercadopago/criar-pix inválido retorna contrato de erro dual', async () => {
    const { app } = criarApp();

    const res = await request(app)
      .post('/api/mercadopago/criar-pix')
      .send({ pedido_id: 'abc', tax_id: '123', recaptcha_token: 'token_ok' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/mercadopago/criar-pix com token válido processa pagamento', async () => {
    const { app, pool, mercadoPagoService, validarRecaptcha } = criarApp();

    pool.query
      .mockResolvedValueOnce([[{
        id: 10,
        usuario_id: 1,
        total: 49.9,
        status: 'pendente',
        gateway_pagamento: null,
        mp_payment_id_mp: null
      }]])
      .mockResolvedValueOnce([[{ nome: 'Cliente Teste', email: 'cliente@test.com' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    mercadoPagoService.criarPagamentoPix.mockResolvedValue({
      payment_id: 12345,
      status: 'pending',
      qr_code: '000201...',
      qr_code_base64: 'base64_qr'
    });

    const res = await request(app)
      .post('/api/mercadopago/criar-pix')
      .send({ pedido_id: 10, tax_id: '12345678909', recaptcha_token: 'token_valido' });

    expect(res.status).toBe(200);
    expect(validarRecaptcha).toHaveBeenCalledWith(expect.objectContaining({
      token: 'token_valido',
      action: 'payment_pix'
    }));
    expect(mercadoPagoService.criarPagamentoPix).toHaveBeenCalledTimes(1);
    expect(res.body).toHaveProperty('payment_id', 12345);
  });

  test('POST /api/mercadopago/criar-pix bloqueia pedido de outro usuario (ownership)', async () => {
    const { app, pool, mercadoPagoService } = criarApp();

    pool.query.mockResolvedValueOnce([[{
      id: 99,
      usuario_id: 999,
      total: 49.9,
      status: 'pendente',
      gateway_pagamento: null,
      mp_payment_id_mp: null
    }]]);

    const res = await request(app)
      .post('/api/mercadopago/criar-pix')
      .send({ pedido_id: 99, tax_id: '12345678909', recaptcha_token: 'token_valido' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('erro');
    expect(mercadoPagoService.criarPagamentoPix).not.toHaveBeenCalled();
  });

  test('POST /api/mercadopago/criar-cartao sem token reCAPTCHA é bloqueado', async () => {
    const { app, mercadoPagoService, validarRecaptcha } = criarApp();

    const res = await request(app)
      .post('/api/mercadopago/criar-cartao')
      .send({
        pedido_id: 11,
        token: 'card_token',
        parcelas: 1,
        tax_id: '12345678909'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code', 'RECAPTCHA_TOKEN_MISSING');
    expect(validarRecaptcha).not.toHaveBeenCalled();
    expect(mercadoPagoService.criarPagamentoCartao).not.toHaveBeenCalled();
  });

  test('POST /api/mercadopago/criar-cartao com token inválido é bloqueado', async () => {
    const erroRecaptcha = new Error('Falha na validação do reCAPTCHA. Tente novamente.');
    erroRecaptcha.status = 400;

    const { app, validarRecaptcha, mercadoPagoService } = criarApp({
      validarRecaptcha: jest.fn().mockRejectedValue(erroRecaptcha)
    });

    const res = await request(app)
      .post('/api/mercadopago/criar-cartao')
      .send({
        pedido_id: 11,
        token: 'card_token',
        parcelas: 1,
        tax_id: '12345678909',
        recaptcha_token: 'token_invalido'
      });

    expect(res.status).toBe(400);
    expect(validarRecaptcha).toHaveBeenCalled();
    expect(res.body).toHaveProperty('code', 'RECAPTCHA_TOKEN_INVALID');
    expect(mercadoPagoService.criarPagamentoCartao).not.toHaveBeenCalled();
  });

  test('POST /api/mercadopago/criar-pix em ambiente não-produção com proteção relaxada permite fluxo', async () => {
    const { app, mercadoPagoService, pool, validarRecaptcha } = criarApp({
      recaptchaPaymentProtectionEnabled: false,
      isProduction: false
    });

    pool.query
      .mockResolvedValueOnce([[{
        id: 12,
        usuario_id: 1,
        total: 39.9,
        status: 'pendente',
        gateway_pagamento: null,
        mp_payment_id_mp: null
      }]])
      .mockResolvedValueOnce([[{ nome: 'Cliente Teste', email: 'cliente@test.com' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    mercadoPagoService.criarPagamentoPix.mockResolvedValue({
      payment_id: 555,
      status: 'pending',
      qr_code: '000201...',
      qr_code_base64: 'base64_qr'
    });

    const res = await request(app)
      .post('/api/mercadopago/criar-pix')
      .send({ pedido_id: 12, tax_id: '12345678909' });

    expect(res.status).toBe(200);
    expect(validarRecaptcha).not.toHaveBeenCalled();
    expect(mercadoPagoService.criarPagamentoPix).toHaveBeenCalledTimes(1);
  });

  test('POST /api/mercadopago/criar-cartao em produção sem proteção configurada falha sem bypass silencioso', async () => {
    const { app, validarRecaptcha, mercadoPagoService } = criarApp({
      recaptchaPaymentProtectionEnabled: false,
      isProduction: true
    });

    const res = await request(app)
      .post('/api/mercadopago/criar-cartao')
      .send({
        pedido_id: 13,
        token: 'card_token',
        parcelas: 1,
        tax_id: '12345678909',
        recaptcha_token: 'qualquer'
      });

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('erro');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code', 'RECAPTCHA_PAYMENT_DISABLED_IN_PRODUCTION');
    expect(validarRecaptcha).not.toHaveBeenCalled();
    expect(mercadoPagoService.criarPagamentoCartao).not.toHaveBeenCalled();
  });
});
