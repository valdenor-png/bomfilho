'use strict';

const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

jest.mock('../lib/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

const { pool } = require('../lib/db');
const createWebhookRoutes = require('../routes/webhooks');
const { criarMercadoPagoService } = require('../services/mercadoPagoService');

describe('Mercado Pago webhook signature policy', () => {
  test('sem secret: modo padrao rejeita assinatura (fail-closed)', () => {
    const service = criarMercadoPagoService({
      accessToken: 'TEST-ACCESS',
      webhookSecret: '',
      allowInsecureWebhookWithoutSecret: false
    });

    expect(service.validarAssinaturaWebhook('', 'req-1', '10')).toBe(false);
  });

  test('sem secret: modo inseguro explicito permite (somente quando habilitado)', () => {
    const service = criarMercadoPagoService({
      accessToken: 'TEST-ACCESS',
      webhookSecret: '',
      allowInsecureWebhookWithoutSecret: true
    });

    expect(service.validarAssinaturaWebhook('', 'req-1', '10')).toBe(true);
  });

  test('com secret: assinatura invalida e rejeitada', () => {
    const service = criarMercadoPagoService({
      accessToken: 'TEST-ACCESS',
      webhookSecret: 'segredo_mp'
    });

    expect(service.validarAssinaturaWebhook('ts=1,v1=assinatura_errada', 'req-1', '10')).toBe(false);
  });

  test('com secret: assinatura valida e aceita', () => {
    const secret = 'segredo_mp';
    const service = criarMercadoPagoService({
      accessToken: 'TEST-ACCESS',
      webhookSecret: secret
    });

    const ts = '1712345678';
    const requestId = 'req-ok-1';
    const dataId = '999';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const assinatura = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${assinatura}`;

    expect(service.validarAssinaturaWebhook(xSignature, requestId, dataId)).toBe(true);
  });
});

describe('POST /api/webhooks/mercadopago', () => {
  function criarAppComWebhook(mercadoPagoService, paymentSyncService = null) {
    const paymentSyncDefault = paymentSyncService || {
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

    const app = express();
    app.use(express.json());
    app.use(createWebhookRoutes({
      validarWebhookEvolution: () => true,
      extrairDadosMensagemEvolution: () => ({ remoteJid: null, fromMe: false, messageId: null, temConteudo: false }),
      isJidGrupoOuBroadcast: () => false,
      formatarTelefoneWhatsapp: () => null,
      enviarWhatsappTexto: async () => true,
      limparCacheEvolution: () => {},
      evolutionProcessedMessageIds: new Map(),
      evolutionLastReplyByNumber: new Map(),
      mercadoPagoService,
      paymentSyncService: paymentSyncDefault,
      enviarWhatsappPedido: jest.fn()
    }));
    return app;
  }

  beforeEach(() => {
    pool.query.mockReset();
  });

  test('retorna 401 com payload dual quando assinatura e invalida', async () => {
    const app = criarAppComWebhook({
      validarAssinaturaWebhook: jest.fn().mockReturnValue(false),
      consultarPagamento: jest.fn()
    });

    const res = await request(app)
      .post('/api/webhooks/mercadopago')
      .set('x-signature', 'ts=1,v1=invalido')
      .set('x-request-id', 'req-x')
      .send({ type: 'payment', action: 'payment.updated', data: { id: '321' } });

    expect(res.status).toBe(401);
    expect(String(res.body?.erro || '')).toMatch(/assinatura/i);
    expect(String(res.body?.error || '')).toMatch(/assinatura/i);
  });

  test('processa webhook com assinatura valida e sincroniza pedido', async () => {
    const mercadoPagoService = {
      validarAssinaturaWebhook: jest.fn().mockReturnValue(true),
      consultarPagamento: jest.fn().mockResolvedValue({
        id: 'mp_123',
        status: 'pending',
        external_reference: '10'
      })
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

    pool.query.mockImplementation(async (sql) => {
      const texto = String(sql || '');
      if (/INSERT INTO webhook_events/i.test(texto)) return [{ affectedRows: 1 }];
      return [[], null];
    });

    const app = criarAppComWebhook(mercadoPagoService, paymentSyncService);

    const res = await request(app)
      .post('/api/webhooks/mercadopago')
      .set('x-signature', 'ts=1,v1=ok')
      .set('x-request-id', 'req-ok')
      .send({ type: 'payment', action: 'payment.updated', data: { id: '321' } });

    expect(res.status).toBe(200);
    expect(mercadoPagoService.consultarPagamento).toHaveBeenCalledWith('321');
    expect(paymentSyncService.sincronizarPagamentoComPedido).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'webhook_mercadopago'
      })
    );
  });

  test('evento ja processado retorna 200 sem consultar pagamento novamente', async () => {
    const mercadoPagoService = {
      validarAssinaturaWebhook: jest.fn().mockReturnValue(true),
      consultarPagamento: jest.fn()
    };

    pool.query.mockImplementation(async (sql) => {
      const texto = String(sql || '');
      if (/INSERT INTO webhook_events/i.test(texto)) {
        const erro = new Error('Duplicate entry');
        erro.code = 'ER_DUP_ENTRY';
        throw erro;
      }
      return [[], null];
    });

    const app = criarAppComWebhook(mercadoPagoService);

    const res = await request(app)
      .post('/api/webhooks/mercadopago')
      .set('x-signature', 'ts=1,v1=ok')
      .set('x-request-id', 'req-dup')
      .send({ type: 'payment', action: 'payment.updated', data: { id: '777' } });

    expect(res.status).toBe(200);
    expect(mercadoPagoService.consultarPagamento).not.toHaveBeenCalled();
  });
});
