'use strict';

const express = require('express');
const request = require('supertest');

const mockPool = {
  query: jest.fn()
};

jest.mock('../../lib/db', () => ({
  pool: mockPool
}));

jest.mock('../../lib/config', () => ({
  DB_DIALECT: 'mysql'
}));

const createPedidosRoutes = require('../../routes/pedidos');

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockOrder = {
  id: 42,
  usuario_id: 1,
  status: 'confirmado',
  total: 89.90,
  frete: 6.00,
  metodo_pagamento: 'pix',
  criado_em: '2026-03-15T10:30:00Z'
};

const mockItems = [
  { id: 1, pedido_id: 42, produto_id: 10, nome: 'Arroz Camil 5kg', quantidade: 2, preco_unitario: 22.90 },
  { id: 2, pedido_id: 42, produto_id: 20, nome: 'Feijao Carioca 1kg', quantidade: 1, preco_unitario: 8.50 }
];

// Columns returned by INFORMATION_SCHEMA query (MySQL format)
const mockColumns = [
  { COLUMN_NAME: 'id' },
  { COLUMN_NAME: 'usuario_id' },
  { COLUMN_NAME: 'total' },
  { COLUMN_NAME: 'taxa_servico' },
  { COLUMN_NAME: 'status' },
  { COLUMN_NAME: 'forma_pagamento' },
  { COLUMN_NAME: 'tipo_entrega' },
  { COLUMN_NAME: 'pix_codigo' },
  { COLUMN_NAME: 'pix_qrcode' },
  { COLUMN_NAME: 'pix_id' },
  { COLUMN_NAME: 'pix_status' },
  { COLUMN_NAME: 'frete_cobrado_cliente' },
  { COLUMN_NAME: 'frete_real_uber' },
  { COLUMN_NAME: 'margem_pedido' },
  { COLUMN_NAME: 'uber_delivery_id' },
  { COLUMN_NAME: 'uber_tracking_url' },
  { COLUMN_NAME: 'uber_vehicle_type' },
  { COLUMN_NAME: 'uber_eta_seconds' },
  { COLUMN_NAME: 'entrega_status' },
  { COLUMN_NAME: 'criado_em' },
  { COLUMN_NAME: 'atualizado_em' }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(createPedidosRoutes({
    autenticarToken: (req, _res, next) => {
      req.usuario = { id: 1, nome: 'Test' };
      next();
    },
    parsePositiveInt: (v, def) => {
      const n = parseInt(v);
      return n > 0 ? n : def;
    },
    montarPaginacao: (total, page, limit) => ({
      total,
      pagina: page,
      limite: limit,
      total_paginas: Math.ceil(total / limit),
      tem_mais: page * limit < total
    })
  }));
  return app;
}

/** Enqueue a columns-query response followed by additional responses. */
function mockColumnsAndQueries(...queryResults) {
  let chain = mockPool.query.mockResolvedValueOnce([mockColumns]);
  for (const result of queryResults) {
    chain = chain.mockResolvedValueOnce(result);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Pedidos routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = criarApp();
  });

  // -----------------------------------------------------------------------
  // GET /api/pedidos  --  paginated order list
  // -----------------------------------------------------------------------
  describe('GET /api/pedidos', () => {
    test('returns all orders for the authenticated user (no pagination)', async () => {
      mockColumnsAndQueries([[mockOrder]]);

      const res = await request(app).get('/api/pedidos');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pedidos');
      expect(res.body).toHaveProperty('total', 1);
      expect(res.body.pedidos).toHaveLength(1);
      expect(res.body.pedidos[0].id).toBe(42);
    });

    test('returns paginated orders when page query param is present', async () => {
      // First call: columns. Second: COUNT(*). Third: SELECT pedidos.
      mockPool.query
        .mockResolvedValueOnce([mockColumns])
        .mockResolvedValueOnce([[{ total: 25 }]])
        .mockResolvedValueOnce([[mockOrder]]);

      const res = await request(app).get('/api/pedidos?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pedidos');
      expect(res.body).toHaveProperty('paginacao');
      expect(res.body.paginacao).toMatchObject({
        total: 25,
        pagina: 1,
        limite: 10
      });
    });

    test('normalizes tipo_entrega to "entrega" by default', async () => {
      const orderWithDelivery = { ...mockOrder, tipo_entrega: '  Entrega  ' };
      mockColumnsAndQueries([[orderWithDelivery]]);

      const res = await request(app).get('/api/pedidos');

      expect(res.status).toBe(200);
      expect(res.body.pedidos[0].tipo_entrega).toBe('entrega');
    });

    test('normalizes tipo_entrega to "retirada" when applicable', async () => {
      const orderWithPickup = { ...mockOrder, tipo_entrega: 'Retirada' };
      mockColumnsAndQueries([[orderWithPickup]]);

      const res = await request(app).get('/api/pedidos');

      expect(res.status).toBe(200);
      expect(res.body.pedidos[0].tipo_entrega).toBe('retirada');
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/pedidos/:id  --  order detail with items
  // -----------------------------------------------------------------------
  describe('GET /api/pedidos/:id', () => {
    test('returns order details with items for a valid order', async () => {
      // Columns query, then pedido SELECT, then itens SELECT
      mockPool.query
        .mockResolvedValueOnce([mockColumns])
        .mockResolvedValueOnce([[mockOrder]])
        .mockResolvedValueOnce([mockItems]);

      const res = await request(app).get('/api/pedidos/42');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pedido');
      expect(res.body).toHaveProperty('itens');
      expect(res.body.pedido.id).toBe(42);
      expect(res.body.pedido.status).toBe('confirmado');
      expect(res.body.itens).toHaveLength(2);
      expect(res.body.itens[0].nome).toBe('Arroz Camil 5kg');
      expect(res.body.itens[1].nome).toBe('Feijao Carioca 1kg');
    });

    test('returns 404 for non-existent order', async () => {
      mockColumnsAndQueries([[]]);

      const res = await request(app).get('/api/pedidos/9999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('erro', 'Pedido não encontrado.');
    });

    test('returns 404 when order belongs to another user', async () => {
      // The query filters by usuario_id = req.usuario.id (1),
      // so an order with usuario_id = 99 will not be found.
      mockColumnsAndQueries([[]]);

      const res = await request(app).get('/api/pedidos/42');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('erro', 'Pedido não encontrado.');
    });
  });
});
