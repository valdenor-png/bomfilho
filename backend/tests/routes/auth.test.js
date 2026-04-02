'use strict';

jest.mock('../../lib/config', () => ({
  JWT_SECRET: 'test-jwt-secret',
  USER_AUTH_COOKIE_NAME: 'user_token',
  ADMIN_AUTH_COOKIE_NAME: 'admin_token',
  CSRF_COOKIE_NAME: 'csrf_token',
  USER_AUTH_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  ADMIN_AUTH_COOKIE_MAX_AGE: 12 * 60 * 60 * 1000,
  ADMIN_USER: 'admin',
  ADMIN_PASSWORD_HASH: null,
  ADMIN_PASSWORD: null,
  IS_PRODUCTION: false,
}));

jest.mock('../../lib/db', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const createAuthRoutes = require('../../routes/auth');

function criarApp(overrides = {}) {
  const pool = require('../../lib/db').pool;
  const deps = {
    authLimiter: (req, res, next) => next(),
    loginLimiter: (req, res, next) => next(),
    adminAuthLimiter: (req, res, next) => next(),
    autenticarToken: (req, res, next) => {
      req.usuario = { id: 1, nome: 'Test', email: 'test@test.com' };
      next();
    },
    autenticarAdminToken: (req, res, next) => next(),
    exigirAcessoLocalAdmin: (req, res, next) => next(),
    validarRecaptcha: jest.fn().mockResolvedValue(),
    emitirCsrfToken: jest.fn(() => 'csrf-test-token'),
    definirCookieAuth: jest.fn(),
    limparCookie: jest.fn(),
    compararTextoSegura: (a, b) => a === b,
    registrarAuditoria: jest.fn().mockResolvedValue(),
    extrairIpRequisicao: () => '127.0.0.1',
    enviarWhatsappTexto: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  const app = express();
  app.use(express.json());
  app.use(createAuthRoutes(deps));
  return { app, deps, pool };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── POST /api/auth/cadastro ─────────────────────────────────────────────────

describe('POST /api/auth/cadastro', () => {
  it('returns 201 on successful registration', async () => {
    const { app, pool } = criarApp();

    // No existing user
    pool.query.mockResolvedValueOnce([[]]);
    // INSERT result
    pool.query.mockResolvedValueOnce([{ insertId: 42 }]);

    const res = await request(app)
      .post('/api/auth/cadastro')
      .send({
        nome: 'Maria Silva',
        email: 'maria@example.com',
        senha: 'Senha123Forte',
        telefone: '11999999999',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('mensagem');
    expect(res.body).toHaveProperty('csrfToken', 'csrf-test-token');
    expect(res.body.usuario).toMatchObject({
      id: 42,
      nome: 'Maria Silva',
      email: 'maria@example.com',
    });
  });

  it('returns 400 when required fields are missing', async () => {
    const { app } = criarApp();

    const res = await request(app)
      .post('/api/auth/cadastro')
      .send({ nome: 'Maria' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });

  it('returns 400 for invalid email', async () => {
    const { app } = criarApp();

    const res = await request(app)
      .post('/api/auth/cadastro')
      .send({
        nome: 'Maria',
        email: 'not-an-email',
        senha: 'Senha123Forte',
        telefone: '11999999999',
      });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/e-mail/i);
  });

  it('returns 409 when email already exists', async () => {
    const { app, pool } = criarApp();

    // Existing user found
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);

    const res = await request(app)
      .post('/api/auth/cadastro')
      .send({
        nome: 'Maria',
        email: 'existing@example.com',
        senha: 'Senha123Forte',
        telefone: '11999999999',
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('erro');
  });
});

// ── POST /api/auth/login ────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const TEST_PASSWORD = 'Senha123Forte';
  let hashedPassword;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash(TEST_PASSWORD, 4); // low rounds for speed
  });

  it('returns 200 on successful login', async () => {
    const { app, pool } = criarApp();

    pool.query.mockResolvedValueOnce([[{
      id: 7,
      nome: 'João',
      email: 'joao@example.com',
      telefone: '11888888888',
      senha: hashedPassword,
      whatsapp_opt_in: 1,
    }]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'joao@example.com', senha: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensagem');
    expect(res.body).toHaveProperty('csrfToken', 'csrf-test-token');
    expect(res.body.usuario).toMatchObject({
      id: 7,
      nome: 'João',
      email: 'joao@example.com',
    });
  });

  it('returns 401 with wrong password', async () => {
    const { app, pool } = criarApp();

    pool.query.mockResolvedValueOnce([[{
      id: 7,
      nome: 'João',
      email: 'joao@example.com',
      telefone: '11888888888',
      senha: hashedPassword,
      whatsapp_opt_in: 0,
    }]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'joao@example.com', senha: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('erro');
  });

  it('returns 401 when user does not exist', async () => {
    const { app, pool } = criarApp();

    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', senha: 'Senha123Forte' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('erro');
  });

  it('returns 400 when email or password is missing', async () => {
    const { app } = criarApp();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'joao@example.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('erro');
  });
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and calls limparCookie', async () => {
    const { app, deps } = criarApp();

    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensagem');
    expect(deps.limparCookie).toHaveBeenCalledTimes(2);
  });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns user data when authenticated', async () => {
    const { app, pool } = criarApp();

    pool.query.mockResolvedValueOnce([[{
      id: 1,
      nome: 'Test',
      email: 'test@test.com',
      telefone: '11999999999',
      whatsapp_opt_in: 0,
    }]]);

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({
      id: 1,
      nome: 'Test',
      email: 'test@test.com',
    });
  });

  it('returns 401 when user not found in database', async () => {
    const { app, pool } = criarApp();

    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('erro');
  });

  it('returns 401 when autenticarToken rejects', async () => {
    const { app } = criarApp({
      autenticarToken: (req, res, _next) => {
        return res.status(401).json({ erro: 'Token inválido.' });
      },
    });

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('erro');
  });
});
