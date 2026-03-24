'use strict';

const express = require('express');
const logger = require('../lib/logger');
const { montarRespostaErroBanco } = require('../lib/db');
const { DB_DIALECT } = require('../lib/config');
const { criarErroHttp, toMoney } = require('../lib/helpers');
const { calculateCartLogistics } = require('../services/cartLogisticsService');

function normalizeCep(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function buildAddressLabel(endereco = {}) {
  const rua = String(endereco?.rua || endereco?.logradouro || '').trim();
  const numero = String(endereco?.numero || '').trim();
  const bairro = String(endereco?.bairro || '').trim();
  const cidade = String(endereco?.cidade || '').trim();
  const estado = String(endereco?.estado || '').trim().toUpperCase();
  const cep = normalizeCep(endereco?.cep || endereco?.cep_destino);

  if (!rua || !numero || !bairro || !cidade || !estado || cep.length !== 8) {
    return '';
  }

  return `${rua}, ${numero} - ${bairro}, ${cidade}/${estado}, ${cep}`;
}

function validarCarrinho(carrinho = []) {
  if (!Array.isArray(carrinho) || carrinho.length === 0) {
    throw criarErroHttp(400, 'Carrinho vazio. Adicione itens para calcular entrega.');
  }

  if (carrinho.length > 200) {
    throw criarErroHttp(400, 'Carrinho excede o limite operacional de itens.');
  }
}

function validarEndereco(endereco = {}) {
  const enderecoLabel = buildAddressLabel(endereco);
  if (!enderecoLabel) {
    throw criarErroHttp(400, 'Endereço incompleto. Informe rua, número, bairro, cidade, estado e CEP.');
  }

  return enderecoLabel;
}

function normalizarCarrinhoParaManifest(carrinho = []) {
  return carrinho.map((item) => ({
    nome: String(item?.nome || item?.name || 'Produto').trim(),
    categoria: String(item?.categoria || '').trim(),
    quantidade: Number(item?.quantidade || item?.quantity || 1),
    peso_kg: Number(item?.peso_kg || item?.pesoKg || 0)
  }));
}

module.exports = function createDeliveryRoutes({
  autenticarToken,
  exigirAcessoLocalAdmin,
  autenticarAdminToken,
  pool,
  uberDirectService,
  UBER_DIRECT_ENABLED
}) {
  const router = express.Router();

  router.post('/api/delivery/quote', autenticarToken, async (req, res) => {
    try {
      if (!UBER_DIRECT_ENABLED) {
        return res.status(503).json({ error: 'Entrega Uber indisponível no momento.' });
      }

      const endereco = req.body?.endereco || req.body?.address || {};
      const carrinho = Array.isArray(req.body?.carrinho) ? req.body.carrinho : [];

      validarCarrinho(carrinho);
      const dropoffAddress = validarEndereco(endereco);

      const cartNormalizado = normalizarCarrinhoParaManifest(carrinho);
      const logistics = calculateCartLogistics(cartNormalizado);

      if (!logistics.manifest_items.length) {
        throw criarErroHttp(400, 'Não foi possível montar os itens logísticos para cotação.');
      }

      if (Number(logistics.total_weight_kg || 0) <= 0 || Number(logistics.total_weight_kg || 0) > 220) {
        throw criarErroHttp(400, 'Peso total inválido para entrega. Revise os itens do carrinho.');
      }

      const externalId = `quote_user_${req.usuario.id}_${Date.now()}`;
      const estimate = await uberDirectService.getUberEstimate({
        externalId,
        dropoff: {
          address: dropoffAddress,
          name: String(endereco?.nome_contato || endereco?.nome || 'Cliente BomFilho').trim() || 'Cliente BomFilho',
          phone: String(endereco?.telefone || '').trim()
        },
        manifestItems: logistics.manifest_items,
        orderValue: Number(req.body?.valor_carrinho || 0)
      });

      if (!estimate.estimate_id) {
        throw criarErroHttp(502, 'Uber não retornou estimate_id válido para esta cotação.');
      }

      await pool.query(
        `INSERT INTO uber_delivery_quotes
          (usuario_id, estimate_id, endereco_destino, manifest_items, total_weight_kg, total_volume_points, valor_estimado, eta_seconds, raw_response)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.usuario.id,
          estimate.estimate_id,
          dropoffAddress,
          JSON.stringify(logistics.manifest_items),
          Number(logistics.total_weight_kg || 0),
          Number(logistics.total_volume_points || 0),
          Number(estimate.amount || 0),
          estimate.eta_seconds,
          JSON.stringify(estimate.raw || {})
        ]
      );

      return res.json({
        estimate_id: estimate.estimate_id,
        preco: Number(estimate.amount || 0),
        eta_segundos: estimate.eta_seconds,
        eta_minutos: estimate.eta_seconds ? Math.max(1, Math.round(Number(estimate.eta_seconds) / 60)) : null,
        vehicle_type: String(estimate?.raw?.vehicle_type || estimate?.raw?.vehicle || '').trim() || null,
        total_weight_kg: Number(logistics.total_weight_kg || 0),
        total_volume_points: Number(logistics.total_volume_points || 0),
        manifest_items: logistics.manifest_items,
        mensagem: 'Entrega calculada em tempo real pela Uber conforme endereço e volume do pedido'
      });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      logger.error('delivery.quote erro', {
        status,
        message: error?.message,
        details: error?.details || null
      });

      return res.status(status).json({
        error: status >= 500
          ? 'Não foi possível cotar entrega agora. Tente novamente em instantes.'
          : (error?.message || 'Falha ao calcular entrega.')
      });
    }
  });

  router.post('/api/delivery/create', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    const connection = await pool.getConnection();
    let transacaoAberta = false;

    try {
      if (!UBER_DIRECT_ENABLED) {
        return res.status(503).json({ error: 'Entrega Uber indisponível no momento.' });
      }

      const pedidoId = Number(req.body?.pedido_id || 0);
      const estimateIdBody = String(req.body?.estimate_id || '').trim();
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        throw criarErroHttp(400, 'pedido_id inválido para criação da entrega.');
      }

      await connection.beginTransaction();
      transacaoAberta = true;

      const [pedidos] = await connection.query(
        `SELECT p.id, p.usuario_id, p.status, p.forma_pagamento, p.total,
                p.frete_cobrado_cliente, p.uber_delivery_id, p.uber_estimate_id,
                u.nome AS cliente_nome, u.telefone AS cliente_telefone,
                e.rua, e.numero, e.bairro, e.cidade, e.estado, e.cep
         FROM pedidos p
         LEFT JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN enderecos e ON e.usuario_id = p.usuario_id
         WHERE p.id = ?
         LIMIT 1
         FOR UPDATE`,
        [pedidoId]
      );

      if (!pedidos.length) {
        throw criarErroHttp(404, 'Pedido não encontrado para criar entrega.');
      }

      const pedido = pedidos[0];
      const statusPedido = String(pedido?.status || '').trim().toLowerCase();
      const statusPronto = statusPedido === 'pronto_para_coleta' || statusPedido === 'pronto_para_retirada';
      if (!statusPronto) {
        throw criarErroHttp(409, 'Entrega só pode ser criada com pedido pronto para coleta.');
      }

      if (pedido?.uber_delivery_id) {
        throw criarErroHttp(409, 'Este pedido já possui entrega Uber criada.');
      }

      const statusPago = ['pago', 'preparando', 'pronto_para_retirada', 'pronto_para_coleta', 'enviado', 'entregue'].includes(statusPedido);
      if (!statusPago) {
        throw criarErroHttp(409, 'Pagamento ainda não confirmado para este pedido.');
      }

      const estimateId = estimateIdBody || String(pedido?.uber_estimate_id || '').trim();
      if (!estimateId) {
        throw criarErroHttp(400, 'estimate_id é obrigatório para criar entrega Uber.');
      }

      const [quotes] = await connection.query(
        `SELECT id, estimate_id, manifest_items, endereco_destino, valor_estimado
         FROM uber_delivery_quotes
         WHERE estimate_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [estimateId]
      );

      if (!quotes.length) {
        throw criarErroHttp(404, 'estimate_id não encontrado ou expirado. Recalcule a entrega.');
      }

      const quote = quotes[0];
      const manifestItems = JSON.parse(quote.manifest_items || '[]');
      const enderecoDestino = String(quote.endereco_destino || '').trim();

      if (!manifestItems.length || !enderecoDestino) {
        throw criarErroHttp(400, 'Manifest ou endereço inválido para criação da entrega.');
      }

      const externalId = `pedido_${pedidoId}_${Date.now()}`;
      const created = await uberDirectService.createUberDelivery({
        quoteId: estimateId,
        externalId,
        manifestItems,
        dropoff: {
          address: enderecoDestino,
          name: String(pedido?.cliente_nome || 'Cliente BomFilho').trim() || 'Cliente BomFilho',
          phone: String(pedido?.cliente_telefone || '').trim()
        }
      });

      if (!created.delivery_id) {
        throw criarErroHttp(502, 'Uber não retornou delivery_id válido para este pedido.');
      }

      const freteRealUber = Number(created.fee_amount || quote.valor_estimado || 0);
      const freteCobradoCliente = Number(pedido?.frete_cobrado_cliente || quote.valor_estimado || 0);
      const margem = toMoney(freteCobradoCliente - freteRealUber);

      await connection.query(
        `INSERT INTO uber_deliveries
          (pedido_id, estimate_id, uber_delivery_id, tracking_url, status, eta_seconds, vehicle_type, valor_real_uber, raw_response)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          estimateId,
          created.delivery_id,
          created.tracking_url || null,
          created.status,
          created.eta_seconds,
          null,
          freteRealUber,
          JSON.stringify(created.raw || {})
        ]
      );

      await connection.query(
        `UPDATE pedidos
            SET uber_delivery_id = ?,
                uber_tracking_url = ?,
                frete_real_uber = ?,
                margem_pedido = ?,
                entrega_status = 'pending',
                uber_eta_seconds = ?,
                uber_estimate_id = ?,
                status = 'enviado',
                saiu_entrega_em = COALESCE(saiu_entrega_em, NOW())
          WHERE id = ?`,
        [
          created.delivery_id,
          created.tracking_url || null,
          freteRealUber,
          margem,
          created.eta_seconds,
          estimateId,
          pedidoId
        ]
      );

      await connection.commit();
      transacaoAberta = false;

      return res.json({
        ok: true,
        pedido_id: pedidoId,
        uber_delivery_id: created.delivery_id,
        tracking_url: created.tracking_url || null,
        status: created.status,
        frete_real_uber: freteRealUber,
        frete_cobrado_cliente: freteCobradoCliente,
        margem_pedido: margem
      });
    } catch (error) {
      if (transacaoAberta) {
        await connection.rollback();
      }

      const pedidoId = Number(req.body?.pedido_id || 0);
      if (Number.isInteger(pedidoId) && pedidoId > 0) {
        try {
          await pool.query(
            `UPDATE pedidos
                SET entrega_status = 'erro_entrega'
              WHERE id = ?`,
            [pedidoId]
          );
        } catch (markErr) {
          logger.error('Falha ao marcar erro_entrega', { pedidoId, message: markErr?.message });
        }
      }

      const status = Number(error?.httpStatus || 500);
      logger.error('delivery.create erro', {
        status,
        pedido_id: req.body?.pedido_id || null,
        message: error?.message,
        details: error?.details || null
      });

      return res.status(status).json({
        error: status >= 500
          ? 'Não foi possível criar a entrega agora. Pedido segue válido para ação manual.'
          : (error?.message || 'Falha ao criar entrega.')
      });
    } finally {
      connection.release();
    }
  });

  router.post('/api/delivery/cancel', exigirAcessoLocalAdmin, autenticarAdminToken, async (req, res) => {
    try {
      const pedidoId = Number(req.body?.pedido_id || 0);
      const motivo = String(req.body?.motivo || 'cancelamento_operacional').trim();
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        throw criarErroHttp(400, 'pedido_id inválido para cancelamento.');
      }

      const [rows] = await pool.query(
        'SELECT id, uber_delivery_id FROM pedidos WHERE id = ? LIMIT 1',
        [pedidoId]
      );
      if (!rows.length || !rows[0].uber_delivery_id) {
        throw criarErroHttp(404, 'Pedido sem entrega Uber ativa para cancelamento.');
      }

      const cancelResult = await uberDirectService.cancelUberDelivery({
        deliveryId: rows[0].uber_delivery_id,
        reason: motivo
      });

      await pool.query(
        `UPDATE pedidos
            SET entrega_status = 'canceled'
          WHERE id = ?`,
        [pedidoId]
      );

      await pool.query(
        `INSERT INTO uber_delivery_events
          (pedido_id, uber_delivery_id, event_type, payload)
         VALUES (?, ?, ?, ?)`,
        [pedidoId, rows[0].uber_delivery_id, 'canceled', JSON.stringify(cancelResult.raw || {})]
      );

      return res.json({ ok: true, status: cancelResult.status });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'Falha ao cancelar entrega.' });
    }
  });

  router.get('/api/admin/delivery/pedidos', exigirAcessoLocalAdmin, autenticarAdminToken, async (_req, res) => {
    try {
      const [columnRows] = await pool.query(
        DB_DIALECT === 'postgres'
          ? `SELECT column_name
               FROM information_schema.columns
              WHERE table_schema = ANY(current_schemas(true))
                AND table_name = 'pedidos'`
          : `SELECT COLUMN_NAME
               FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'pedidos'`
      );
      const availableColumns = new Set(
        (columnRows || [])
          .map((row) => String(row?.COLUMN_NAME || row?.column_name || '').trim().toLowerCase())
          .filter(Boolean)
      );

      const selectPedidosColumn = (columnName, alias) => {
        const normalized = String(columnName || '').trim().toLowerCase();
        return availableColumns.has(normalized)
          ? `p.${columnName} AS ${alias}`
          : `NULL AS ${alias}`;
      };

      const [rows] = await pool.query(
        `SELECT p.id,
                p.status,
                p.tipo_entrega,
                p.total,
                p.criado_em,
                ${selectPedidosColumn('pronto_em', 'pronto_em')},
                ${selectPedidosColumn('entrega_status', 'entrega_status')},
                ${selectPedidosColumn('uber_delivery_id', 'uber_delivery_id')},
                ${selectPedidosColumn('uber_tracking_url', 'uber_tracking_url')},
                ${selectPedidosColumn('uber_estimate_id', 'uber_estimate_id')},
                ${selectPedidosColumn('frete_cobrado_cliente', 'frete_cobrado_cliente')},
                ${selectPedidosColumn('frete_real_uber', 'frete_real_uber')},
                ${selectPedidosColumn('margem_pedido', 'margem_pedido')},
                ${selectPedidosColumn('uber_vehicle_type', 'uber_vehicle_type')},
                ${selectPedidosColumn('uber_eta_seconds', 'uber_eta_seconds')},
                u.nome AS cliente_nome, u.telefone AS cliente_telefone
           FROM pedidos p
           LEFT JOIN usuarios u ON u.id = p.usuario_id
          WHERE p.tipo_entrega = 'entrega'
            AND p.status IN ('preparando', 'pronto_para_retirada', 'enviado', 'erro_entrega')
          ORDER BY ${availableColumns.has('atualizado_em') ? 'p.atualizado_em' : 'p.criado_em'} DESC
          LIMIT 200`
      );

      res.json({ pedidos: rows });
    } catch (error) {
      const respostaErro = montarRespostaErroBanco(error, {
        fallbackMessage: 'Não foi possível carregar fila de entregas.'
      });
      logger.error('admin.delivery.pedidos erro', {
        ...respostaErro.logMeta,
        route: '/api/admin/delivery/pedidos'
      });
      res.status(respostaErro.status).json({
        error: respostaErro.payload.erro,
        codigo: respostaErro.payload.codigo
      });
    }
  });

  return router;
};
