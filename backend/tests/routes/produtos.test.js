'use strict';

jest.mock('../../lib/config', () => ({
  DB_DIALECT: 'mysql',
  IS_PRODUCTION: false,
}));

jest.mock('../../lib/db', () => ({
  pool: { query: jest.fn() },
  queryWithRetry: jest.fn(),
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../lib/produtoCatalogoRules', () => ({
  enriquecerProdutoParaCatalogo: (p) => p,
  resolveVisibilidadePublica: () => ({ visivel_publico: true }),
}));

const express = require('express');
const request = require('supertest');
const { queryWithRetry } = require('../../lib/db');
const createProdutosPublicRoutes = require('../../routes/produtos');

const COLUNAS_PADRAO = new Set([
  'id', 'nome', 'preco', 'categoria', 'estoque', 'ativo',
  'imagem_url', 'descricao', 'marca', 'unidade', 'emoji',
  'validade', 'codigo_barras',
]);

const PRODUTO_1 = {
  id: 1,
  nome: 'Arroz Integral 1kg',
  descricao: 'Arroz integral tipo 1',
  marca: 'Tio Joao',
  preco: 8.99,
  unidade: 'un',
  categoria: 'mercearia',
  emoji: '\u{1F35A}',
  estoque: 50,
  validade: null,
  codigo_barras: '7891234567890',
  imagem_url: '/img/arroz.jpg',
  imagem: '/img/arroz.jpg',
};

const PRODUTO_2 = {
  id: 2,
  nome: 'Feijao Preto 1kg',
  descricao: 'Feijao preto tipo 1',
  marca: 'Camil',
  preco: 7.49,
  unidade: 'un',
  categoria: 'mercearia',
  emoji: '\u{1F372}',
  estoque: 30,
  validade: null,
  codigo_barras: '7891234567891',
  imagem_url: '/img/feijao.jpg',
  imagem: '/img/feijao.jpg',
};

function criarApp(overrides = {}) {
  const deps = {
    obterColunasProdutos: jest.fn().mockResolvedValue(COLUNAS_PADRAO),
    toLowerTrim: (s) => String(s || '').trim().toLowerCase(),
    parsePositiveInt: (v, def) => {
      const n = parseInt(v, 10);
      return n > 0 ? n : def;
    },
    escapeLike: (s) => String(s).replace(/%/g, '\\%').replace(/_/g, '\\_'),
    montarPaginacao: (total, page, limit) => ({
      pagina: page,
      limite: limit,
      total,
      total_paginas: Math.max(1, Math.ceil(total / limit)),
    }),
    montarChaveCacheProdutos: jest.fn().mockReturnValue('cache-key-test'),
    obterCacheProdutos: jest.fn().mockReturnValue(null),
    salvarCacheProdutos: jest.fn(),
    obterCacheLeitura: jest.fn().mockReturnValue(null),
    salvarCacheLeitura: jest.fn(),
    ...overrides,
  };

  const app = express();
  app.use(express.json());
  app.use(createProdutosPublicRoutes(deps));
  return { app, deps };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET /api/produtos ───────────────────────────────────────────────────────

describe('GET /api/produtos', () => {
  it('returns a paginated product list', async () => {
    const { app } = criarApp();

    // 1st call: escala preco (stats query)
    queryWithRetry.mockResolvedValueOnce([[{ total: 2, ge_100: 0, inteiros: 0, avg_preco: 8 }]]);
    // 2nd call: COUNT(*)
    queryWithRetry.mockResolvedValueOnce([[{ total: 2 }]]);
    // 3rd call: product list
    queryWithRetry.mockResolvedValueOnce([[PRODUTO_1, PRODUTO_2]]);

    const res = await request(app).get('/api/produtos');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('produtos');
    expect(res.body).toHaveProperty('paginacao');
    expect(Array.isArray(res.body.produtos)).toBe(true);
    expect(res.body.produtos).toHaveLength(2);
    expect(res.body.produtos[0]).toMatchObject({ id: 1, nome: 'Arroz Integral 1kg' });
    expect(res.body.produtos[1]).toMatchObject({ id: 2, nome: 'Feijao Preto 1kg' });
    expect(res.body.paginacao.total).toBe(2);
  });

  it('passes search term to the query when busca is provided', async () => {
    const { app } = criarApp();

    // escala preco
    queryWithRetry.mockResolvedValueOnce([[{ total: 1, ge_100: 0, inteiros: 0, avg_preco: 8 }]]);
    // COUNT
    queryWithRetry.mockResolvedValueOnce([[{ total: 1 }]]);
    // product list
    queryWithRetry.mockResolvedValueOnce([[PRODUTO_1]]);

    const res = await request(app).get('/api/produtos?busca=arroz');

    expect(res.status).toBe(200);
    expect(res.body.produtos).toHaveLength(1);
    expect(res.body.produtos[0]).toMatchObject({ nome: 'Arroz Integral 1kg' });

    // The count query (2nd call) and list query (3rd call) should include
    // LIKE parameters for the search term
    const countParams = queryWithRetry.mock.calls[1][1];
    expect(countParams).toBeDefined();
    expect(countParams.some((p) => typeof p === 'string' && p.includes('arroz'))).toBe(true);
  });

  it('returns 500 when the database query fails', async () => {
    const { app } = criarApp();

    // escala preco succeeds
    queryWithRetry.mockResolvedValueOnce([[{ total: 0, ge_100: 0, inteiros: 0, avg_preco: 0 }]]);
    // COUNT fails
    queryWithRetry.mockRejectedValueOnce(new Error('connection lost'));

    const res = await request(app).get('/api/produtos');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('erro');
  });

  it('returns cached response when cache hit is available', async () => {
    const cachedPayload = {
      produtos: [PRODUTO_1],
      paginacao: { pagina: 1, limite: 60, total: 1, total_paginas: 1 },
    };

    const { app } = criarApp({
      obterCacheProdutos: jest.fn().mockReturnValue(cachedPayload),
    });

    // escala preco still runs before cache check
    queryWithRetry.mockResolvedValueOnce([[{ total: 1, ge_100: 0, inteiros: 0, avg_preco: 8 }]]);

    const res = await request(app).get('/api/produtos');

    expect(res.status).toBe(200);
    expect(res.body.cache).toBe(true);
    expect(res.body.produtos).toHaveLength(1);
    // No count or list queries should have been made (only the escala query)
    expect(queryWithRetry).toHaveBeenCalledTimes(1);
  });
});
