'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { buildErrorPayload } = require('../lib/apiError');

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Number(fallback || 0);
  }
  return Math.trunc(parsed);
}

module.exports = function createAdminPagamentosRoutes({
  exigirAcessoLocalAdmin,
  autenticarAdminToken,
  paymentSyncService,
  registrarAuditoria
}) {
  const router = express.Router();

  router.post(
    '/api/admin/pagamentos/mercadopago/reconciliar',
    exigirAcessoLocalAdmin,
    autenticarAdminToken,
    async (req, res) => {
      const requestId = String(req.requestId || req.headers['x-request-id'] || '').trim() || null;

      if (!paymentSyncService) {
        return res.status(503).json(buildErrorPayload(
          'Servico de reconciliacao de pagamentos indisponivel no momento.',
          { code: 'MP_RECONCILIATION_SERVICE_UNAVAILABLE' }
        ));
      }

      const pedidoId = toInt(req.body?.pedido_id, 0);
      const paymentId = String(req.body?.payment_id || '').trim();

      if (pedidoId <= 0 && !paymentId) {
        return res.status(400).json(buildErrorPayload(
          'Informe pedido_id ou payment_id para reconciliar.',
          { code: 'MP_RECONCILIATION_IDENTIFIER_REQUIRED' }
        ));
      }

      try {
        const resultado = pedidoId > 0
          ? await paymentSyncService.reconciliarPagamentoPorPedido({
            pedidoId,
            source: 'reconciliacao_manual_admin',
            requestId
          })
          : await paymentSyncService.reconciliarPagamentoPorPaymentId({
            paymentId,
            source: 'reconciliacao_manual_admin',
            requestId
          });

        if (typeof registrarAuditoria === 'function') {
          await registrarAuditoria({
            acao: 'reconciliar_pagamento_mercadopago',
            entidade: 'pedido',
            entidade_id: Number(resultado?.pedido?.id || pedidoId || 0) || null,
            detalhes: {
              request_id: requestId,
              input: {
                pedido_id: pedidoId > 0 ? pedidoId : null,
                payment_id: paymentId || null
              },
              resultado: {
                applied: Boolean(resultado?.applied),
                reason: String(resultado?.reason || '').trim() || null,
                pedido: resultado?.pedido || null,
                gateway: resultado?.gateway || null
              }
            },
            admin_usuario: String(req?.admin?.usuario || req?.admin?.email || 'admin').trim() || 'admin',
            ip: req.ip || null
          });
        }

        logger.info('[MP Reconciliacao] Reconciliacao manual concluida.', {
          request_id: requestId,
          pedido_id: Number(resultado?.pedido?.id || pedidoId || 0) || null,
          payment_id: String(resultado?.gateway?.payment_id || paymentId || '').trim() || null,
          applied: Boolean(resultado?.applied),
          reason: String(resultado?.reason || '').trim() || null
        });

        return res.json({
          ok: true,
          source: 'reconciliacao_manual_admin',
          applied: Boolean(resultado?.applied),
          reason: String(resultado?.reason || '').trim() || null,
          pedido: resultado?.pedido || null,
          gateway: resultado?.gateway || null
        });
      } catch (error) {
        const status = Number(error?.status || 500);
        logger.error('[MP Reconciliacao] Falha ao reconciliar pagamento.', {
          request_id: requestId,
          pedido_id: pedidoId > 0 ? pedidoId : null,
          payment_id: paymentId || null,
          status,
          message: error?.message || null
        });

        return res.status(status).json(buildErrorPayload(
          error?.message || 'Nao foi possivel reconciliar o pagamento no momento.',
          { code: 'MP_RECONCILIATION_FAILED' }
        ));
      }
    }
  );

  return router;
};
