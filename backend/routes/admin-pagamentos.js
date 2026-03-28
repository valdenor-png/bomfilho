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
  registrarAuditoria,
  pool
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

  // ============================================
  // GET /api/admin/pagamentos/diagnostico/:pedidoId
  // Diagnóstico rápido de pagamento: pedido + histórico de auditoria
  // ============================================
  router.get(
    '/api/admin/pagamentos/diagnostico/:pedidoId',
    exigirAcessoLocalAdmin,
    autenticarAdminToken,
    async (req, res) => {
      const requestId = String(req.requestId || req.headers['x-request-id'] || '').trim() || null;

      if (!pool) {
        return res.status(503).json(buildErrorPayload(
          'Diagnostico de pagamentos indisponivel no momento.',
          { code: 'DIAGNOSTICO_DB_UNAVAILABLE' }
        ));
      }

      const pedidoId = toInt(req.params?.pedidoId, 0);
      if (pedidoId <= 0) {
        return res.status(400).json(buildErrorPayload(
          'Informe um pedido_id valido.',
          { code: 'DIAGNOSTICO_INVALID_PEDIDO_ID' }
        ));
      }

      try {
        const [pedidoRows] = await pool.query(
          `SELECT
             p.id,
             p.status,
             p.total,
             p.forma_pagamento,
             p.tipo_entrega,
             p.criado_em,
             p.mp_payment_id,
             p.mp_payment_id_mp,
             p.mp_external_reference,
             p.mp_status,
             p.mp_status_detail,
             p.mp_payment_status_internal,
             p.mp_data_criacao_pagamento,
             p.mp_data_aprovacao_pagamento,
             p.mp_last_webhook_at,
             p.mp_last_reconciled_at,
             u.nome  AS cliente_nome,
             u.email AS cliente_email
           FROM pedidos p
           LEFT JOIN usuarios u ON u.id = p.usuario_id
           WHERE p.id = ?
           LIMIT 1`,
          [pedidoId]
        );

        if (!pedidoRows || pedidoRows.length === 0) {
          return res.status(404).json(buildErrorPayload(
            `Pedido #${pedidoId} nao encontrado.`,
            { code: 'DIAGNOSTICO_PEDIDO_NOT_FOUND' }
          ));
        }

        const pedido = pedidoRows[0];

        const [auditoriaRows] = await pool.query(
          `SELECT
             id,
             mp_payment_id,
             mp_external_reference,
             status_gateway_anterior,
             status_gateway_novo,
             status_interno_anterior,
             status_interno_novo,
             origem,
             motivo,
             event_id,
             request_id,
             aplicado,
             created_at
           FROM pedido_pagamento_auditoria
           WHERE pedido_id = ?
           ORDER BY created_at DESC
           LIMIT 10`,
          [pedidoId]
        );

        logger.info('[MP Diagnostico] Consulta de diagnostico de pagamento.', {
          request_id: requestId,
          pedido_id: pedidoId,
          admin_usuario: String(req?.admin?.usuario || req?.admin?.email || 'admin').trim()
        });

        return res.json({
          ok: true,
          pedido: {
            id: Number(pedido.id),
            status: pedido.status || null,
            total: Number(pedido.total || 0),
            forma_pagamento: pedido.forma_pagamento || null,
            tipo_entrega: pedido.tipo_entrega || null,
            criado_em: pedido.criado_em || null,
            cliente_nome: pedido.cliente_nome || null,
            cliente_email: pedido.cliente_email || null
          },
          gateway: {
            mp_payment_id: pedido.mp_payment_id || null,
            mp_payment_id_mp: pedido.mp_payment_id_mp || null,
            mp_external_reference: pedido.mp_external_reference || null,
            mp_status: pedido.mp_status || null,
            mp_status_detail: pedido.mp_status_detail || null,
            mp_payment_status_internal: pedido.mp_payment_status_internal || null,
            mp_data_criacao_pagamento: pedido.mp_data_criacao_pagamento || null,
            mp_data_aprovacao_pagamento: pedido.mp_data_aprovacao_pagamento || null,
            mp_last_webhook_at: pedido.mp_last_webhook_at || null,
            mp_last_reconciled_at: pedido.mp_last_reconciled_at || null
          },
          auditoria: (auditoriaRows || []).map((a) => ({
            id: Number(a.id),
            mp_payment_id: a.mp_payment_id || null,
            status_gateway_anterior: a.status_gateway_anterior || null,
            status_gateway_novo: a.status_gateway_novo || null,
            status_interno_anterior: a.status_interno_anterior || null,
            status_interno_novo: a.status_interno_novo || null,
            origem: a.origem || null,
            motivo: a.motivo || null,
            aplicado: Boolean(a.aplicado),
            created_at: a.created_at || null
          }))
        });
      } catch (error) {
        logger.error('[MP Diagnostico] Falha ao buscar diagnostico de pagamento.', {
          request_id: requestId,
          pedido_id: pedidoId,
          message: error?.message || null
        });

        return res.status(500).json(buildErrorPayload(
          'Nao foi possivel carregar o diagnostico do pagamento.',
          { code: 'DIAGNOSTICO_QUERY_FAILED' }
        ));
      }
    }
  );

  return router;
};
