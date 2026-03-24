'use strict';

/**
 * Smoke tests para os fluxos de pedido e pagamento.
 *
 * Estes testes validam a camada de rota com mocks das dependências,
 * criando um Express app mínimo que espelha a injeção real do server.js.
 * Não dependem de banco de dados nem de serviços externos.
 */

// Mock de config ANTES de qualquer require de rotas
jest.mock('../lib/config', () => ({
  PAGBANK_TOKEN: 'FAKE_TOKEN_TEST',
  PAGBANK_ENV: 'sandbox',
  PAGBANK_API_URL: 'https://sandbox.api.pagseguro.com/orders',
  PAGBANK_SDK_API_URL: 'https://sdk.sandbox.pagseguro.com',
  PAGBANK_3DS_SDK_ENV: 'SANDBOX',
  PAGBANK_TIMEOUT_MS: 30000,
  PAGBANK_WEBHOOK_TOKEN: 'webhook_test',
  PAGBANK_DEBUG_LOGS: false,
  IS_PRODUCTION: false,
  ALLOW_PIX_MOCK: true,
  ALLOW_DEBIT_3DS_MOCK: true,
  BASE_URL_ENV: 'http://localhost:3000',
  RECAPTCHA_CHECKOUT_PROTECTION_ENABLED: false,
  RECAPTCHA_PAYMENT_PROTECTION_ENABLED: false,
  PAGBANK_PUBLIC_KEY: 'pk_test',
  PAGBANK_CONFIG: {}
}));

const express = require('express');
const request = require('supertest');

// ── helpers compartilhados ──────────────────────────────────────────
const { toMoney } = require('../lib/helpers');

// ── Factories de mocks ──────────────────────────────────────────────

/** Cria um pool mock que responde queries conforme mapas pré-configurados */
function criarPoolMock(overrides = {}) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue([[], null])
  };

  return {
    getConnection: jest.fn().mockResolvedValue(connection),
    query: jest.fn().mockResolvedValue([[], null]),
    _connection: connection,
    ...overrides
  };
}

/** Middleware de auth fake que popula req.usuario */
function autenticarTokenFake(req, _res, next) {
  req.usuario = { id: 1, nome: 'Teste', email: 'teste@example.com' };
  next();
}

/** validarRecaptcha que nunca bloqueia */
async function validarRecaptchaFake() { return true; }

// ── Dados de fixture ────────────────────────────────────────────────
const PRODUTO_ATIVO = {
  id: 10, nome: 'Produto Teste', preco: 25.50, ativo: 1, estoque: 100, categoria: 'bebidas'
};

const USUARIO_DB = {
  nome: 'Teste', email: 'teste@example.com', telefone: '91999999999', whatsapp_opt_in: 0
};

const PEDIDOS_COLUMNS_ROWS = [
  { column_name: 'usuario_id' },
  { column_name: 'total' },
  { column_name: 'status' },
  { column_name: 'forma_pagamento' },
  { column_name: 'tipo_entrega' },
  { column_name: 'revisao_em' },
  { column_name: 'taxa_servico' },
  { column_name: 'frete_cobrado_cliente' }
];

const USUARIOS_COLUMNS_ROWS = [
  { column_name: 'nome' },
  { column_name: 'email' },
  { column_name: 'telefone' },
  { column_name: 'whatsapp_opt_in' }
];

// ============================================================
// SUITE 1 — POST /api/pedidos (routes/pedidos-criar.js)
// ============================================================
describe('POST /api/pedidos', () => {
  let app, pool, criarPagamentoPixMock, enviarWhatsappPedidoMock;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../lib/config', () => ({
      PAGBANK_TOKEN: 'FAKE_TOKEN_TEST',
      PAGBANK_ENV: 'sandbox',
      PAGBANK_API_URL: 'https://sandbox.api.pagseguro.com/orders',
      PAGBANK_SDK_API_URL: 'https://sdk.sandbox.pagseguro.com',
      PAGBANK_3DS_SDK_ENV: 'SANDBOX',
      PAGBANK_TIMEOUT_MS: 30000,
      PAGBANK_WEBHOOK_TOKEN: 'webhook_test',
      PAGBANK_DEBUG_LOGS: false,
      IS_PRODUCTION: false,
      ALLOW_PIX_MOCK: true,
      ALLOW_DEBIT_3DS_MOCK: true,
      BASE_URL_ENV: 'http://localhost:3000',
      RECAPTCHA_CHECKOUT_PROTECTION_ENABLED: false,
      RECAPTCHA_PAYMENT_PROTECTION_ENABLED: false,
      PAGBANK_PUBLIC_KEY: 'pk_test',
      PAGBANK_CONFIG: {}
    }));

    pool = criarPoolMock();
    criarPagamentoPixMock = jest.fn().mockResolvedValue({
      id: 'ORDER_PIX_123', status: 'WAITING',
      qr_codes: [{ text: '00020126...', links: [{ href: 'https://pix.qr/img.png', media: 'image/png' }] }]
    });
    enviarWhatsappPedidoMock = jest.fn().mockResolvedValue(true);

    const conn = pool._connection;

    // Query sequence for a successful order:
    // 1. metadados de colunas de pedidos
    // 2. metadados de colunas de usuarios
    // 3. SELECT usuario (nome, email, telefone, whatsapp_opt_in)
    conn.query
      .mockResolvedValueOnce([PEDIDOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([USUARIOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([[USUARIO_DB]])
      // 4. SELECT produtos FOR UPDATE
      .mockResolvedValueOnce([[PRODUTO_ATIVO]])
      // 5. INSERT pedido
      .mockResolvedValueOnce([{ insertId: 42 }])
      // 6. INSERT pedido_itens (batch)
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // 7. UPDATE estoque
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const createRoute = require('../routes/pedidos-criar');
    const router = createRoute({
      autenticarToken: autenticarTokenFake,
      validarRecaptcha: validarRecaptchaFake,
      calcularEntregaPorCep: jest.fn().mockResolvedValue({ valor: 8.00, distancia_km: 3.2, veiculo: 'moto', tempo_estimado_min: 25 }),
      criarPagamentoPix: criarPagamentoPixMock,
      enviarWhatsappPedido: enviarWhatsappPedidoMock,
      normalizarCep: (cep) => String(cep || '').replace(/\D/g, '').slice(0, 8),
      pool
    });

    app = express();
    app.use(express.json());
    app.use(router);
  });

  test('cria pedido retirada com PIX — 201', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 2 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        tax_id: '12345678909'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('pedido_id', 42);
    expect(res.body).toHaveProperty('total');
    expect(pool._connection.beginTransaction).toHaveBeenCalled();
    expect(pool._connection.commit).toHaveBeenCalled();
  });

  test('rejeita pedido sem itens — 400', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });

  test('rejeita forma_pagamento inválida — 400', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 1 }],
        forma_pagamento: 'bitcoin',
        tipo_entrega: 'retirada'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });

  test('rejeita pedido com total zero (produto a R$ 0)', async () => {
    const conn = pool._connection;
    conn.query.mockReset();
    conn.query
      .mockResolvedValueOnce([PEDIDOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([USUARIOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([[USUARIO_DB]])
      .mockResolvedValueOnce([[{ ...PRODUTO_ATIVO, preco: 0 }]])
      .mockResolvedValueOnce([{ insertId: 44 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 1 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        tax_id: '12345678909'
      });

    // Total 0 deve ser rejeitado pela validação de total > 0
    expect(res.status).toBe(400);
  });

  test('falha PIX não impede criação do pedido', async () => {
    criarPagamentoPixMock.mockRejectedValueOnce(new Error('PagBank timeout'));

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 2 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        tax_id: '12345678909'
      });

    // O pedido deve ser criado mesmo com falha de PIX (after commit)
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('pedido_id', 42);
  });

  test('cria pedido com cupom válido — 201', async () => {
    const conn = pool._connection;
    conn.query.mockReset();
    conn.query
      .mockResolvedValueOnce([PEDIDOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([USUARIOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([[USUARIO_DB]])
      .mockResolvedValueOnce([[PRODUTO_ATIVO]])
      .mockResolvedValueOnce([[{ id: 7, tipo: 'percentual', valor: 10, valor_minimo: 20, uso_atual: 0, uso_maximo: 100 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 52 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 2 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        cupom_id: 7,
        tax_id: '12345678909'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('pedido_id', 52);
    expect(res.body).toHaveProperty('desconto_aplicado');
  });

  test('rejeita cupom expirado/inexistente no pedido — 400', async () => {
    const conn = pool._connection;
    conn.query.mockReset();
    conn.query
      .mockResolvedValueOnce([PEDIDOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([USUARIOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([[USUARIO_DB]])
      .mockResolvedValueOnce([[PRODUTO_ATIVO]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 1 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        cupom_id: 9999,
        tax_id: '12345678909'
      });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/cupom/i);
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('rejeita cupom inativo no pedido — 400', async () => {
    const conn = pool._connection;
    conn.query.mockReset();
    conn.query
      .mockResolvedValueOnce([PEDIDOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([USUARIOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([[USUARIO_DB]])
      .mockResolvedValueOnce([[PRODUTO_ATIVO]])
      // Cupom inativo não retorna linha pela própria query de elegibilidade
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 1 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        cupom_id: 13,
        tax_id: '12345678909'
      });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/inválido|expirado/i);
  });

  test('query de cupom no checkout não usa CURDATE (compatibilidade PostgreSQL)', async () => {
    const conn = pool._connection;
    conn.query.mockReset();
    conn.query.mockImplementation(async (sql, params = []) => {
      const texto = String(sql || '');
      if (/CURDATE\s*\(/i.test(texto)) {
        throw new Error('function curdate() does not exist');
      }

      if (/information_schema\.columns/i.test(texto)) {
        const tableName = String(params[0] || '').toLowerCase();
        return [tableName === 'pedidos' ? PEDIDOS_COLUMNS_ROWS : USUARIOS_COLUMNS_ROWS];
      }

      if (/SELECT nome, email, telefone/i.test(texto)) return [[USUARIO_DB]];
      if (/FROM produtos[\s\S]*FOR UPDATE/i.test(texto)) return [[PRODUTO_ATIVO]];
      if (/FROM cupons_usados/i.test(texto)) return [[]];
      if (/FROM cupons\s/i.test(texto)) return [[{ id: 99, tipo: 'fixo', valor: 5, valor_minimo: 0, uso_atual: 0, uso_maximo: 10 }]];
      if (/INSERT INTO pedidos/i.test(texto)) return [{ insertId: 61 }];
      if (/INSERT INTO pedido_itens/i.test(texto)) return [{ affectedRows: 1 }];
      if (/UPDATE produtos SET estoque/i.test(texto)) return [{ affectedRows: 1 }];
      if (/UPDATE cupons SET uso_atual/i.test(texto)) return [{ affectedRows: 1 }];
      if (/INSERT INTO cupons_usados/i.test(texto)) return [{ affectedRows: 1 }];
      return [[], null];
    });

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 1 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        cupom_id: 99,
        tax_id: '12345678909'
      });

    expect(res.status).toBe(201);
    const queryCupom = conn.query.mock.calls.find((call) => /FROM cupons/i.test(String(call[0] || '')));
    expect(queryCupom).toBeTruthy();
    expect(String(queryCupom[0])).toContain('CURRENT_DATE');
    expect(String(queryCupom[0])).not.toMatch(/CURDATE\s*\(/i);
  });

  test('falha de reserva de estoque retorna 409 e rollback', async () => {
    const conn = pool._connection;
    conn.query.mockReset();
    conn.query
      .mockResolvedValueOnce([PEDIDOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([USUARIOS_COLUMNS_ROWS])
      .mockResolvedValueOnce([[USUARIO_DB]])
      .mockResolvedValueOnce([[PRODUTO_ATIVO]])
      .mockResolvedValueOnce([{ insertId: 70 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // UPDATE estoque sem affectedRows simula corrida/estoque insuficiente no commit de reserva
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(app)
      .post('/api/pedidos')
      .send({
        itens: [{ produto_id: 10, quantidade: 2 }],
        forma_pagamento: 'pix',
        tipo_entrega: 'retirada',
        tax_id: '12345678909'
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('erro');
    expect(res.body).toHaveProperty('error');
    expect(conn.rollback).toHaveBeenCalled();
  });
});

// ============================================================
// SUITE 2 — POST /api/pagamentos/pix (routes/pagbank.js)
// ============================================================
describe.skip('POST /api/pagamentos/pix (legado PagBank)', () => {
  let app, criarPagamentoPixMock, poolMock;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../lib/config', () => ({
      PAGBANK_TOKEN: 'FAKE_TOKEN_TEST',
      PAGBANK_ENV: 'sandbox',
      PAGBANK_API_URL: 'https://sandbox.api.pagseguro.com/orders',
      PAGBANK_SDK_API_URL: 'https://sdk.sandbox.pagseguro.com',
      PAGBANK_3DS_SDK_ENV: 'SANDBOX',
      PAGBANK_TIMEOUT_MS: 30000,
      PAGBANK_WEBHOOK_TOKEN: 'webhook_test',
      PAGBANK_DEBUG_LOGS: false,
      IS_PRODUCTION: false,
      ALLOW_PIX_MOCK: true,
      ALLOW_DEBIT_3DS_MOCK: true,
      BASE_URL_ENV: 'http://localhost:3000',
      RECAPTCHA_CHECKOUT_PROTECTION_ENABLED: false,
      RECAPTCHA_PAYMENT_PROTECTION_ENABLED: false,
      PAGBANK_PUBLIC_KEY: 'pk_test',
      PAGBANK_CONFIG: {}
    }));

    criarPagamentoPixMock = jest.fn().mockResolvedValue({
      id: 'ORDER_PIX_456', status: 'WAITING',
      qr_codes: [{
        text: '00020126580014br.gov.bcb.pix',
        links: [{ href: 'https://pix.qr/img.png', media: 'image/png' }]
      }]
    });

    poolMock = {
      query: jest.fn()
        // buscarPedidoDoUsuarioPorId
        .mockResolvedValueOnce([[{
          id: 50, total: 100.00, status: 'pendente', forma_pagamento: 'pix',
          email: 'teste@example.com', nome: 'Teste'
        }]])
        // UPDATE pix dados
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
      getConnection: jest.fn()
    };

    const createPagbankRoutes = require('../routes/pagbank');
    const router = createPagbankRoutes({
      autenticarToken: autenticarTokenFake,
      protegerDiagnostico: (_req, _res, next) => next(),
      validarRecaptcha: validarRecaptchaFake,
      registrarLogPagBank: jest.fn(),
      registrarFalhaOperacaoPagBank: jest.fn(),
      registrarLogEndpointDiagnostico: jest.fn(),
      analisarChavePublicaPagBank: () => ({ valid: true, reason: 'ok', publicKey: 'pk_test' }),
      traduzirMotivoChavePublicaPagBank: (r) => r,
      montarWebhookPagBankUrl: () => 'https://example.com/api/webhooks/pagbank',
      verificarCredencialPagBank: jest.fn().mockResolvedValue({ ok: true, status: 'ok' }),
      criarPagamentoPix: criarPagamentoPixMock,
      criarPagamentoCartao: jest.fn(),
      criarSessaoAutenticacao3DSPagBank: jest.fn(),
      enviarPostPagBankOrders: jest.fn(),
      obterPedidoPagBank: jest.fn(),
      pagbankLastAuthCheck: null,
      pool: poolMock
    });

    app = express();
    app.use(express.json());
    app.use(router);
  });

  test('gera PIX para pedido pendente — 200', async () => {
    const res = await request(app)
      .post('/api/pagamentos/pix')
      .send({ pedido_id: 50, tax_id: '12345678909' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('payment_id', 'ORDER_PIX_456');
    expect(res.body).toHaveProperty('qr_code');
    expect(res.body).toHaveProperty('pix_qrcode');
    expect(criarPagamentoPixMock).toHaveBeenCalledWith(
      expect.objectContaining({ pedidoId: 50 })
    );
  });

  test('rejeita pedido_id inválido — 400', async () => {
    const res = await request(app)
      .post('/api/pagamentos/pix')
      .send({ pedido_id: 'abc', tax_id: '12345678909' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });

  test('rejeita CPF com tamanho errado — 400', async () => {
    const res = await request(app)
      .post('/api/pagamentos/pix')
      .send({ pedido_id: 50, tax_id: '1234' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CPF|CNPJ/i);
  });

  test('rejeita pedido já pago — 409', async () => {
    poolMock.query.mockReset();
    poolMock.query.mockResolvedValueOnce([[{
      id: 50, total: 100, status: 'pago', forma_pagamento: 'pix',
      email: 'teste@example.com', nome: 'Teste'
    }]]);

    const res = await request(app)
      .post('/api/pagamentos/pix')
      .send({ pedido_id: 50, tax_id: '12345678909' });

    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/pago/i);
  });

  test('erro PagBank retorna 500', async () => {
    criarPagamentoPixMock.mockRejectedValueOnce(new Error('PagBank indisponível'));

    const res = await request(app)
      .post('/api/pagamentos/pix')
      .send({ pedido_id: 50, tax_id: '12345678909' });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('erro');
  });
});

// ============================================================
// SUITE 3 — POST /api/pagamentos/cartao (routes/pagbank.js)
// ============================================================
describe.skip('POST /api/pagamentos/cartao (legado PagBank)', () => {
  let app, criarPagamentoCartaoMock, poolMock, registrarLogMock;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../lib/config', () => ({
      PAGBANK_TOKEN: 'FAKE_TOKEN_TEST',
      PAGBANK_ENV: 'sandbox',
      PAGBANK_API_URL: 'https://sandbox.api.pagseguro.com/orders',
      PAGBANK_SDK_API_URL: 'https://sdk.sandbox.pagseguro.com',
      PAGBANK_3DS_SDK_ENV: 'SANDBOX',
      PAGBANK_TIMEOUT_MS: 30000,
      PAGBANK_WEBHOOK_TOKEN: 'webhook_test',
      PAGBANK_DEBUG_LOGS: false,
      IS_PRODUCTION: false,
      ALLOW_PIX_MOCK: true,
      ALLOW_DEBIT_3DS_MOCK: true,
      BASE_URL_ENV: 'http://localhost:3000',
      RECAPTCHA_CHECKOUT_PROTECTION_ENABLED: false,
      RECAPTCHA_PAYMENT_PROTECTION_ENABLED: false,
      PAGBANK_PUBLIC_KEY: 'pk_test',
      PAGBANK_CONFIG: {}
    }));

    criarPagamentoCartaoMock = jest.fn().mockResolvedValue({
      id: 'ORDER_CARD_789', status: 'PAID',
      charges: [{
        id: 'CHG_001', status: 'PAID',
        payment_response: { code: '20000', message: 'SUCESSO' },
        payment_method: { type: 'CREDIT_CARD' }
      }]
    });

    registrarLogMock = jest.fn();

    poolMock = {
      query: jest.fn()
        .mockResolvedValueOnce([[{
          id: 60, total: 150.00, status: 'pendente', forma_pagamento: 'credito',
          email: 'teste@example.com', nome: 'Teste'
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
      getConnection: jest.fn()
    };

    const createPagbankRoutes = require('../routes/pagbank');
    const router = createPagbankRoutes({
      autenticarToken: autenticarTokenFake,
      protegerDiagnostico: (_req, _res, next) => next(),
      validarRecaptcha: validarRecaptchaFake,
      registrarLogPagBank: registrarLogMock,
      registrarFalhaOperacaoPagBank: jest.fn(),
      registrarLogEndpointDiagnostico: jest.fn(),
      analisarChavePublicaPagBank: () => ({ valid: true, reason: 'ok', publicKey: 'pk_test' }),
      traduzirMotivoChavePublicaPagBank: (r) => r,
      montarWebhookPagBankUrl: () => 'https://example.com/api/webhooks/pagbank',
      verificarCredencialPagBank: jest.fn().mockResolvedValue({ ok: true }),
      criarPagamentoPix: jest.fn(),
      criarPagamentoCartao: criarPagamentoCartaoMock,
      criarSessaoAutenticacao3DSPagBank: jest.fn(),
      enviarPostPagBankOrders: jest.fn(),
      obterPedidoPagBank: jest.fn(),
      pagbankLastAuthCheck: null,
      pool: poolMock
    });

    app = express();
    app.use(express.json());
    app.use(router);
  });

  test('pagamento crédito com token encriptado — 200', async () => {
    const res = await request(app)
      .post('/api/pagamentos/cartao')
      .send({
        pedido_id: 60,
        tax_id: '12345678909',
        token_cartao: 'ENCRYPTED_TOKEN_ABC',
        tipo_cartao: 'credito',
        parcelas: 1
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('payment_id');
    expect(res.body).toHaveProperty('status');
    expect(criarPagamentoCartaoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pedidoId: 60,
        tokenCartao: 'ENCRYPTED_TOKEN_ABC'
      })
    );
  });

  test('rejeita sem token_cartao — 400', async () => {
    const res = await request(app)
      .post('/api/pagamentos/cartao')
      .send({
        pedido_id: 60,
        tax_id: '12345678909',
        tipo_cartao: 'credito'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });

  test('rejeita CPF inválido — 400', async () => {
    const res = await request(app)
      .post('/api/pagamentos/cartao')
      .send({
        pedido_id: 60,
        tax_id: '123',
        token_cartao: 'TOKEN',
        tipo_cartao: 'credito'
      });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CPF|CNPJ/i);
  });

  test('rejeita pedido já cancelado — 409', async () => {
    poolMock.query.mockReset();
    poolMock.query.mockResolvedValueOnce([[{
      id: 60, total: 150, status: 'cancelado', forma_pagamento: 'credito',
      email: 'teste@example.com', nome: 'Teste'
    }]]);

    const res = await request(app)
      .post('/api/pagamentos/cartao')
      .send({
        pedido_id: 60,
        tax_id: '12345678909',
        token_cartao: 'TOKEN',
        tipo_cartao: 'credito'
      });

    expect(res.status).toBe(409);
  });

  test('débito com 3DS mock em sandbox — processa', async () => {
    poolMock.query.mockReset();
    poolMock.query
      .mockResolvedValueOnce([[{
        id: 61, total: 50, status: 'pendente', forma_pagamento: 'debito',
        email: 'teste@example.com', nome: 'Teste'
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    criarPagamentoCartaoMock.mockResolvedValueOnce({
      id: 'ORDER_DEBIT_001', status: 'PAID',
      charges: [{
        id: 'CHG_D01', status: 'PAID',
        payment_response: { code: '20000', message: 'SUCESSO' },
        payment_method: { type: 'DEBIT_CARD' }
      }]
    });

    const res = await request(app)
      .post('/api/pagamentos/cartao')
      .send({
        pedido_id: 61,
        tax_id: '12345678909',
        token_cartao: 'TOKEN_DEBITO',
        tipo_cartao: 'debito'
      });

    // Com ALLOW_DEBIT_3DS_MOCK=true em sandbox, deve processar sem 3DS real
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  test('erro PagBank no cartão retorna status de erro', async () => {
    criarPagamentoCartaoMock.mockRejectedValueOnce(
      Object.assign(new Error('PagBank: 422'), { httpStatus: 422 })
    );

    const res = await request(app)
      .post('/api/pagamentos/cartao')
      .send({
        pedido_id: 60,
        tax_id: '12345678909',
        token_cartao: 'TOKEN',
        tipo_cartao: 'credito'
      });

    expect(res.status).toBe(422);
  });
});

// ============================================================
// SUITE 4 — services/pedidoPagamentoHelpers
// ============================================================
describe('pedidoPagamentoHelpers', () => {
  const helpers = require('../services/pedidoPagamentoHelpers');

  test('extrairTaxIdDigits extrai apenas dígitos', () => {
    expect(helpers.extrairTaxIdDigits({ tax_id: '123.456.789-09' })).toBe('12345678909');
    expect(helpers.extrairTaxIdDigits({ cpf: '123.456.789-09' })).toBe('12345678909');
    expect(helpers.extrairTaxIdDigits({})).toBe('');
  });

  test('normalizarFormaPagamentoPedido normaliza', () => {
    expect(helpers.normalizarFormaPagamentoPedido('PIX')).toBe('pix');
    expect(helpers.normalizarFormaPagamentoPedido(' Credito ')).toBe('credito');
    expect(helpers.normalizarFormaPagamentoPedido(undefined)).toBe('pix');
  });

  test('normalizarItensPedidoInput valida estrutura', () => {
    const itens = helpers.normalizarItensPedidoInput([
      { produto_id: '10', quantidade: '3' },
      { produto_id: 20 }
    ]);
    expect(itens).toEqual([
      { produto_id: 10, quantidade: 3 },
      { produto_id: 20, quantidade: 1 }
    ]);
    expect(helpers.normalizarItensPedidoInput(null)).toEqual([]);
  });

  test('itensPedidoSaoValidos rejeita itens inválidos', () => {
    expect(helpers.itensPedidoSaoValidos([])).toBe(false);
    expect(helpers.itensPedidoSaoValidos([{ produto_id: -1, quantidade: 1 }])).toBe(false);
    expect(helpers.itensPedidoSaoValidos([{ produto_id: 10, quantidade: 0 }])).toBe(false);
    expect(helpers.itensPedidoSaoValidos([{ produto_id: 10, quantidade: 101 }])).toBe(false);
    expect(helpers.itensPedidoSaoValidos([{ produto_id: 10, quantidade: 2 }])).toBe(true);
  });

  test('normalizarTipoEntregaPedidoInput normaliza', () => {
    expect(helpers.normalizarTipoEntregaPedidoInput('RETIRADA')).toBe('retirada');
    expect(helpers.normalizarTipoEntregaPedidoInput('invalido')).toBe('entrega');
    expect(helpers.normalizarTipoEntregaPedidoInput(undefined)).toBe('entrega');
  });

  test('normalizarEntregaPedidoInput estrutura dados', () => {
    const resultado = helpers.normalizarEntregaPedidoInput({
      veiculo: 'moto',
      cep_destino: '68740-180',
      numero_destino: '123'
    });
    expect(resultado).toEqual({
      veiculo: 'moto',
      cepDestino: '68740180',
      numeroDestino: '123',
      estimate_id: null
    });
    expect(helpers.normalizarEntregaPedidoInput(null)).toBeNull();
  });
});

// ============================================================
// SUITE 5 — services/pagbankPaymentHelpers
// ============================================================
describe('pagbankPaymentHelpers', () => {
  const helpers = require('../services/pagbankPaymentHelpers');

  test('normalizarParcelasCartao retorna inteiro válido', () => {
    expect(helpers.normalizarParcelasCartao(3)).toBe(3);
    expect(helpers.normalizarParcelasCartao('2')).toBe(2);
    expect(helpers.normalizarParcelasCartao(0)).toBe(1);
    expect(helpers.normalizarParcelasCartao(-1)).toBe(1);
    // Não tem cap em 12 — apenas normaliza para inteiro >= 1
    expect(helpers.normalizarParcelasCartao(13)).toBeGreaterThanOrEqual(1);
  });

  test('normalizarTipoCartao normaliza tipos de cartão', () => {
    expect(helpers.normalizarTipoCartao('CREDITO')).toBe('credito');
    expect(helpers.normalizarTipoCartao('debito')).toBe('debito');
    expect(helpers.normalizarTipoCartao('cartao')).toBe('credito');
    expect(helpers.normalizarTipoCartao('')).toBe('credito');
  });

  test('validarAuthenticationMethodPagBank rejeita input inválido', () => {
    expect(helpers.validarAuthenticationMethodPagBank(null).ok).toBe(false);
    expect(helpers.validarAuthenticationMethodPagBank({}).ok).toBe(false);
  });

  test('montarAuthenticationMethodMock3DS gera mock válido', () => {
    const mock = helpers.montarAuthenticationMethodMock3DS();
    expect(mock).toHaveProperty('type');
    expect(mock.type).toMatch(/THREEDS/i);
  });
});

// ============================================================
// SUITE 6 — toMoney (lib/helpers) usado no fluxo monetário
// ============================================================
describe('toMoney — fluxo monetário', () => {
  test('arredonda para centavos (2 casas)', () => {
    expect(toMoney(10.005)).toBe(10.01);
    expect(toMoney(10.004)).toBe(10);
    expect(toMoney(0)).toBe(0);
    expect(toMoney(99.999)).toBe(100);
  });

  test('trata inputs não numéricos', () => {
    expect(toMoney(null)).toBe(0);
    expect(toMoney(undefined)).toBe(0);
    expect(toMoney('abc')).toBeNaN();
    expect(toMoney('25.50')).toBe(25.5);
  });

  test('preserva valores monetários exatos', () => {
    expect(toMoney(100.00)).toBe(100);
    expect(toMoney(49.90)).toBe(49.9);
    expect(toMoney(0.01)).toBe(0.01);
  });
});
