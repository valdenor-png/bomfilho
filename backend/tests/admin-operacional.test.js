'use strict';

const express = require('express');
const request = require('supertest');

const createAdminOperacionalRoutes = require('../routes/admin-operacional');

describe('Admin operacional - revisão de pedido', () => {
  function criarApp({ pool, registrarAuditoria, enviarWhatsappPedido }) {
    const app = express();
    app.use(express.json());
    app.use(createAdminOperacionalRoutes({
      exigirAcessoLocalAdmin: (_req, _res, next) => next(),
      autenticarAdminToken: (_req, _res, next) => next(),
      pool,
      enviarWhatsappPedido,
      registrarAuditoria
    }));
    return app;
  }

  test('aprova revisão e libera pedido para pagamento', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 1, status: 'aguardando_revisao', usuario_id: 10, revisao_em: new Date(), revisao_aprovada_em: null }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ total: 50, forma_pagamento: 'pix', nome: 'Cliente', telefone: '91999999999', whatsapp_opt_in: 0 }]])
    };

    const registrarAuditoria = jest.fn();
    const enviarWhatsappPedido = jest.fn();
    const app = criarApp({ pool, registrarAuditoria, enviarWhatsappPedido });

    const res = await request(app)
      .put('/api/admin/pedidos/1/aprovar-revisao')
      .send({ observacao: 'Itens confirmados em estoque' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'pendente' });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE pedidos SET status = \?/i),
      expect.arrayContaining(['pendente'])
    );
    expect(registrarAuditoria).toHaveBeenCalledTimes(1);
    expect(enviarWhatsappPedido).not.toHaveBeenCalled();
  });
});
