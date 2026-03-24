'use strict';

const express = require('express');
const { pool } = require('../lib/db');
const logger = require('../lib/logger');
const { DB_DIALECT } = require('../lib/config');

const DELIVERY_STATUS_RANK = Object.freeze({
  pending: 10,
  pickup: 20,
  in_transit: 30,
  near: 40,
  delivered: 50,
  returned: 60,
  canceled: 70
});

function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase();
}

async function getTableColumns(tableName) {
  const query = DB_DIALECT === 'postgres'
    ? `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true))
          AND table_name = ?`
    : `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`;

  const [rows] = await pool.query(query, [tableName]);

  return new Set(
    (rows || [])
      .map((row) => String(row?.COLUMN_NAME || row?.column_name || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

async function getPedidosColumns() {
  return getTableColumns('pedidos');
}

function selectOptional(columns, columnName, alias, tableAlias = 'p') {
  const normalized = String(columnName || '').trim().toLowerCase();
  return columns.has(normalized)
    ? `${tableAlias}.${columnName} AS ${alias}`
    : `NULL AS ${alias}`;
}

function getOrderByClause(columns, tableAlias = 'p') {
  if (columns.has('criado_em')) {
    return `${tableAlias}.criado_em DESC`;
  }

  if (columns.has('atualizado_em')) {
    return `${tableAlias}.atualizado_em DESC`;
  }

  return `${tableAlias}.id DESC`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatIso(value) {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Number(fallback || 0);
  }

  return Math.trunc(parsed);
}

function normalizeDeliveryProvider(pedido = {}) {
  const explicitProvider = toLowerTrim(pedido?.delivery_provider);
  if (explicitProvider === 'uber' || explicitProvider === 'own_bike') {
    return explicitProvider;
  }

  if (String(pedido?.uber_delivery_id || '').trim()) {
    return 'uber';
  }

  if (toLowerTrim(pedido?.tipo_entrega) === 'entrega') {
    return 'own_bike';
  }

  return 'none';
}

function normalizeDeliveryMode(pedido = {}, provider = 'none') {
  const explicitMode = toLowerTrim(pedido?.delivery_mode || pedido?.courier_vehicle || pedido?.uber_vehicle_type);
  if (explicitMode) {
    return explicitMode;
  }

  if (provider === 'own_bike') {
    return 'bike';
  }

  return 'unknown';
}

function deriveInternalDeliveryStatus(pedido = {}, provider = 'none') {
  const explicitInternal = toLowerTrim(pedido?.delivery_status_internal);
  if (explicitInternal) {
    return explicitInternal;
  }

  const entregaStatus = toLowerTrim(pedido?.entrega_status);
  if (entregaStatus && DELIVERY_STATUS_RANK[entregaStatus] !== undefined) {
    return entregaStatus;
  }

  const statusPedido = toLowerTrim(pedido?.status);
  if (statusPedido === 'entregue' || statusPedido === 'retirado') {
    return 'delivered';
  }

  if (statusPedido === 'cancelado') {
    return 'canceled';
  }

  if (statusPedido === 'enviado') {
    return 'in_transit';
  }

  if (statusPedido === 'pronto_para_retirada' && provider === 'uber') {
    return 'pickup';
  }

  return 'pending';
}

function buildEtaRange({ etaSeconds, etaMin, etaMax } = {}) {
  const min = toInt(etaMin, 0);
  const max = toInt(etaMax, 0);

  if (min > 0 && max >= min) {
    return { min, max };
  }

  const seconds = toInt(etaSeconds, 0);
  if (seconds <= 0) {
    return { min: null, max: null };
  }

  const etaCenter = Math.max(1, Math.round(seconds / 60));
  return {
    min: Math.max(etaCenter - 8, 5),
    max: etaCenter + 10
  };
}

function inferCurrentStage(statusInternal = 'pending', statusPedido = '') {
  const normalized = toLowerTrim(statusInternal);
  if (normalized === 'delivered') return 'Pedido entregue';
  if (normalized === 'near') return 'Entregador próximo';
  if (normalized === 'in_transit') return 'A caminho do seu endereço';
  if (normalized === 'pickup') return 'Entregador indo para coleta';
  if (normalized === 'returned') return 'Pedido retornando para loja';
  if (normalized === 'canceled') return 'Entrega cancelada';

  const pedidoStatus = toLowerTrim(statusPedido);
  if (pedidoStatus === 'preparando') return 'Seu pedido está em preparo';
  if (pedidoStatus === 'pronto_para_retirada') return 'Pedido pronto para saída';
  if (pedidoStatus === 'pago') return 'Pagamento aprovado';

  return 'Pedido recebido';
}

function inferStatusMessage(statusInternal = 'pending', statusPedido = '') {
  const normalized = toLowerTrim(statusInternal);
  if (normalized === 'delivered') return 'Entrega concluída com segurança. Se precisar, nossa equipe está disponível.';
  if (normalized === 'near') return 'O entregador está próximo. Tenha alguém pronto para receber.';
  if (normalized === 'in_transit') return 'Seu pedido já foi coletado e está a caminho.';
  if (normalized === 'pickup') return 'A entrega está sendo organizada com acompanhamento em tempo real.';
  if (normalized === 'returned') return 'Seu pedido está retornando para a loja. Nosso time vai orientar os próximos passos.';
  if (normalized === 'canceled') return 'A entrega foi cancelada. Fale com a loja para ajuste imediato.';

  const pedidoStatus = toLowerTrim(statusPedido);
  if (pedidoStatus === 'preparando') return 'Estamos separando seu pedido com cuidado.';
  if (pedidoStatus === 'pronto_para_retirada') return 'Pedido pronto e aguardando coleta do entregador.';
  if (pedidoStatus === 'pago') return 'Pagamento confirmado. Em instantes seu pedido segue para preparo.';

  return 'Seu pedido foi recebido e está protegido com atualização contínua.';
}

function buildTrackingTimeline({ pedido = {}, deliveryEvents = [] } = {}) {
  const createdAt = formatIso(pedido?.criado_em);
  const paidAt = formatIso(pedido?.pago_em);
  const preparingAt = formatIso(pedido?.em_preparo_em);
  const readyAt = formatIso(pedido?.pronto_em);
  const outAt = formatIso(pedido?.saiu_entrega_em);
  const deliveredAt = formatIso(pedido?.entregue_em || pedido?.retirado_em);
  const canceledAt = formatIso(pedido?.cancelado_em);

  const findEventAt = (matcher) => {
    const found = (deliveryEvents || []).find((event) => matcher(toLowerTrim(event?.event_name), toLowerTrim(event?.status_internal), toLowerTrim(event?.status_provider)));
    return found ? formatIso(found.occurred_at) : null;
  };

  const pickupAt = findEventAt((eventName, internal) => internal === 'pickup' || eventName.includes('pickup'));
  const inTransitAt = findEventAt((eventName, internal) => internal === 'in_transit' || eventName.includes('transit') || eventName.includes('dropoff_started'));
  const nearAt = findEventAt((eventName, internal) => internal === 'near' || eventName.includes('near') || eventName.includes('arriv'));

  return [
    { key: 'pedido_recebido', title: 'Pedido recebido', description: 'Recebemos seu pedido e iniciamos a operação.', at: createdAt },
    { key: 'pagamento_aprovado', title: 'Pagamento aprovado', description: 'Seu pagamento foi confirmado.', at: paidAt },
    { key: 'separando_itens', title: 'Loja separando itens', description: 'Estamos separando seu pedido com cuidado.', at: preparingAt },
    { key: 'pedido_pronto', title: 'Pedido pronto para retirada', description: 'Pedido conferido e pronto para o entregador.', at: readyAt },
    { key: 'entregador_loja', title: 'Entregador a caminho da loja', description: 'A entrega está sendo organizada para coleta.', at: pickupAt },
    { key: 'pedido_coletado', title: 'Pedido coletado', description: 'Pedido retirado e em trânsito para seu endereço.', at: outAt || inTransitAt },
    { key: 'a_caminho', title: 'A caminho do seu endereço', description: 'Você pode acompanhar o andamento da entrega.', at: inTransitAt || outAt },
    { key: 'entregador_proximo', title: 'Entregador próximo', description: 'Tenha seu celular por perto para receber com segurança.', at: nearAt },
    { key: 'entregue', title: 'Entregue', description: canceledAt ? 'Entrega encerrada com cancelamento registrado.' : 'Pedido entregue com sucesso.', at: canceledAt || deliveredAt }
  ];
}

async function hasTable(tableName) {
  const query = DB_DIALECT === 'postgres'
    ? `SELECT COUNT(*)::int AS total
         FROM information_schema.tables
        WHERE table_schema = ANY(current_schemas(true))
          AND table_name = ?`
    : `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`;

  const [rows] = await pool.query(query, [tableName]);

  return Number(rows?.[0]?.total || 0) > 0;
}

function maskedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return null;
  }

  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ****-${digits.slice(6)}`;
}

function normalizeClientDeliveryAction(rawAction) {
  const normalized = toLowerTrim(rawAction);
  const allowed = new Set([
    'open_tracking',
    'talk_to_courier',
    'talk_to_store',
    'open_help_center',
    'report_issue',
    'share_status',
    'pin_revealed',
    'open_proof',
    'set_receiver',
    'confirm_address'
  ]);

  return allowed.has(normalized) ? normalized : '';
}

function selectEndereco(columns, candidates, alias, tableAlias = 'e') {
  for (const columnName of candidates) {
    const normalized = String(columnName || '').trim().toLowerCase();
    if (columns.has(normalized)) {
      return `${tableAlias}.${columnName} AS ${alias}`;
    }
  }

  return `NULL AS ${alias}`;
}

/**
 * Customer-facing pedido read routes (list + detail).
 * POST /api/pedidos (creation) remains in server.js due to complex dependencies.
 *
 * @param {object} deps
 * @param {Function} deps.autenticarToken
 * @param {Function} deps.parsePositiveInt
 * @param {Function} deps.montarPaginacao
 */
module.exports = function createPedidosRoutes({ autenticarToken, parsePositiveInt, montarPaginacao }) {
  const router = express.Router();

  // Listar pedidos do usuário
  router.get('/api/pedidos', autenticarToken, async (req, res) => {
    try {
      const columns = await getPedidosColumns();
      const selectPedidosList = [
        'p.id',
        'p.usuario_id',
        'p.total',
        selectOptional(columns, 'taxa_servico', 'taxa_servico'),
        'p.status',
        selectOptional(columns, 'forma_pagamento', 'forma_pagamento'),
        selectOptional(columns, 'tipo_entrega', 'tipo_entrega'),
        selectOptional(columns, 'pix_codigo', 'pix_codigo'),
        selectOptional(columns, 'pix_qrcode', 'pix_qrcode'),
        selectOptional(columns, 'pix_id', 'pix_id'),
        selectOptional(columns, 'pix_status', 'pix_status'),
        selectOptional(columns, 'frete_cobrado_cliente', 'frete_cobrado_cliente'),
        selectOptional(columns, 'frete_real_uber', 'frete_real_uber'),
        selectOptional(columns, 'margem_pedido', 'margem_pedido'),
        selectOptional(columns, 'uber_delivery_id', 'uber_delivery_id'),
        selectOptional(columns, 'uber_tracking_url', 'uber_tracking_url'),
        selectOptional(columns, 'uber_vehicle_type', 'uber_vehicle_type'),
        selectOptional(columns, 'uber_eta_seconds', 'uber_eta_seconds'),
        selectOptional(columns, 'entrega_status', 'entrega_status'),
        selectOptional(columns, 'criado_em', 'criado_em'),
        selectOptional(columns, 'atualizado_em', 'atualizado_em')
      ].join(',\n                ');
      const orderByClause = getOrderByClause(columns);

      const usarPaginacao = ['page', 'pagina', 'limit', 'limite']
        .some((chave) => req.query?.[chave] !== undefined);

      if (!usarPaginacao) {
        const [pedidos] = await pool.query(
          `SELECT ${selectPedidosList}
             FROM pedidos p
            WHERE p.usuario_id = ?
            ORDER BY ${orderByClause}`,
          [req.usuario.id]
        );

        const pedidosNormalizados = pedidos.map((pedido) => ({
          ...pedido,
          tipo_entrega: String(pedido?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
            ? 'retirada'
            : 'entrega'
        }));

        return res.json({
          pedidos: pedidosNormalizados,
          total: pedidosNormalizados.length
        });
      }

      const limite = parsePositiveInt(req.query?.limit || req.query?.limite, 20, { min: 1, max: 100 });
      const paginaSolicitada = parsePositiveInt(req.query?.page || req.query?.pagina, 1, { min: 1, max: 500000 });

      const [[countRow]] = await pool.query(
        'SELECT COUNT(*) AS total FROM pedidos WHERE usuario_id = ?',
        [req.usuario.id]
      );
      const total = Number(countRow?.total || 0);
      const paginacao = montarPaginacao(total, paginaSolicitada, limite);
      const offset = (paginacao.pagina - 1) * paginacao.limite;

      const [pedidos] = await pool.query(
        `SELECT ${selectPedidosList}
           FROM pedidos p
          WHERE p.usuario_id = ?
          ORDER BY ${orderByClause}
          LIMIT ? OFFSET ?`,
        [req.usuario.id, paginacao.limite, offset]
      );

      const pedidosNormalizados = pedidos.map((pedido) => ({
        ...pedido,
        tipo_entrega: String(pedido?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
          ? 'retirada'
          : 'entrega'
      }));

      return res.json({
        pedidos: pedidosNormalizados,
        paginacao
      });
    } catch (erro) {
      logger.error('Erro ao buscar pedidos:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar seus pedidos.' });
    }
  });

  // Detalhes de um pedido
  router.get('/api/pedidos/:id', autenticarToken, async (req, res) => {
    try {
      const columns = await getPedidosColumns();

      const [pedidos] = await pool.query(
        `SELECT p.id,
                p.usuario_id,
                p.total,
                ${selectOptional(columns, 'taxa_servico', 'taxa_servico')},
                p.status,
                ${selectOptional(columns, 'forma_pagamento', 'forma_pagamento')},
                ${selectOptional(columns, 'tipo_entrega', 'tipo_entrega')},
                ${selectOptional(columns, 'pix_codigo', 'pix_codigo')},
                ${selectOptional(columns, 'pix_qrcode', 'pix_qrcode')},
                ${selectOptional(columns, 'pix_id', 'pix_id')},
                ${selectOptional(columns, 'pix_status', 'pix_status')},
                ${selectOptional(columns, 'frete_cobrado_cliente', 'frete_cobrado_cliente')},
                ${selectOptional(columns, 'frete_real_uber', 'frete_real_uber')},
                ${selectOptional(columns, 'margem_pedido', 'margem_pedido')},
                ${selectOptional(columns, 'uber_delivery_id', 'uber_delivery_id')},
                ${selectOptional(columns, 'uber_tracking_url', 'uber_tracking_url')},
                ${selectOptional(columns, 'uber_vehicle_type', 'uber_vehicle_type')},
                ${selectOptional(columns, 'uber_eta_seconds', 'uber_eta_seconds')},
                ${selectOptional(columns, 'entrega_status', 'entrega_status')},
                ${selectOptional(columns, 'criado_em', 'criado_em')},
                ${selectOptional(columns, 'atualizado_em', 'atualizado_em')}
           FROM pedidos p
          WHERE p.id = ? AND p.usuario_id = ?`,
        [req.params.id, req.usuario.id]
      );

      if (pedidos.length === 0) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }

      // Buscar itens com informações do produto (incluindo emoji)
      const [itens] = await pool.query(`
        SELECT 
          pi.*,
          p.emoji,
          p.nome
        FROM pedido_itens pi
        LEFT JOIN produtos p ON pi.produto_id = p.id
        WHERE pi.pedido_id = ?
      `, [req.params.id]);

      res.json({
        pedido: {
          ...pedidos[0],
          tipo_entrega: String(pedidos[0]?.tipo_entrega || '').trim().toLowerCase() === 'retirada'
            ? 'retirada'
            : 'entrega'
        },
        itens: itens
      });
    } catch (erro) {
      logger.error('Erro ao buscar pedido:', erro);
      res.status(500).json({ erro: 'Não foi possível carregar os detalhes do pedido.' });
    }
  });

  // Consultar status em tempo real (polling leve — sem itens, só status)
  router.get('/api/pedidos/:id/status', autenticarToken, async (req, res) => {
    try {
      const columns = await getPedidosColumns();

      const [rows] = await pool.query(
        `SELECT p.id,
                p.status,
                ${selectOptional(columns, 'tipo_entrega', 'tipo_entrega')},
                ${selectOptional(columns, 'forma_pagamento', 'forma_pagamento')},
                ${selectOptional(columns, 'uber_delivery_id', 'uber_delivery_id')},
                ${selectOptional(columns, 'uber_tracking_url', 'uber_tracking_url')},
                ${selectOptional(columns, 'uber_vehicle_type', 'uber_vehicle_type')},
                ${selectOptional(columns, 'uber_eta_seconds', 'uber_eta_seconds')},
                ${selectOptional(columns, 'entrega_status', 'entrega_status')},
                ${selectOptional(columns, 'frete_cobrado_cliente', 'frete_cobrado_cliente')},
                ${selectOptional(columns, 'frete_real_uber', 'frete_real_uber')},
                ${selectOptional(columns, 'margem_pedido', 'margem_pedido')},
                ${selectOptional(columns, 'pago_em', 'pago_em')},
                ${selectOptional(columns, 'em_preparo_em', 'em_preparo_em')},
                ${selectOptional(columns, 'pronto_em', 'pronto_em')},
                ${selectOptional(columns, 'saiu_entrega_em', 'saiu_entrega_em')},
                ${selectOptional(columns, 'entregue_em', 'entregue_em')},
                ${selectOptional(columns, 'retirado_em', 'retirado_em')},
                ${selectOptional(columns, 'cancelado_em', 'cancelado_em')},
                ${selectOptional(columns, 'atualizado_em', 'atualizado_em')}
           FROM pedidos p
          WHERE p.id = ? AND p.usuario_id = ?
          LIMIT 1`,
        [req.params.id, req.usuario.id]
      );
      if (!rows.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }
      res.json(rows[0]);
    } catch (erro) {
      logger.error('Erro ao buscar status do pedido:', erro);
      res.status(500).json({ erro: 'Não foi possível consultar o status.' });
    }
  });

  // Tracking detalhado da entrega para experiencia de pos-compra
  router.get('/api/pedidos/:id/delivery-tracking', autenticarToken, async (req, res) => {
    try {
      const pedidoId = Number(req.params.id || 0);
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ erro: 'Pedido inválido para tracking.' });
      }

      const pedidosColumns = await getPedidosColumns();
      const enderecosColumns = await getTableColumns('enderecos');
      const enderecosTableExists = await hasTable('enderecos');
      const enderecoSelect = enderecosTableExists
        ? [
            selectEndereco(enderecosColumns, ['rua', 'logradouro'], 'rua'),
            selectEndereco(enderecosColumns, ['numero'], 'numero'),
            selectEndereco(enderecosColumns, ['complemento'], 'complemento'),
            selectEndereco(enderecosColumns, ['referencia', 'ponto_referencia'], 'referencia'),
            selectEndereco(enderecosColumns, ['bairro'], 'bairro'),
            selectEndereco(enderecosColumns, ['cidade'], 'cidade'),
            selectEndereco(enderecosColumns, ['estado', 'uf'], 'estado'),
            selectEndereco(enderecosColumns, ['cep'], 'cep')
          ].join(',\n                ')
        : [
            'NULL AS rua',
            'NULL AS numero',
            'NULL AS complemento',
            'NULL AS referencia',
            'NULL AS bairro',
            'NULL AS cidade',
            'NULL AS estado',
            'NULL AS cep'
          ].join(',\n                ');
      const enderecoJoin = enderecosTableExists
        ? 'LEFT JOIN enderecos e ON e.usuario_id = p.usuario_id'
        : '';

      const [rows] = await pool.query(
        `SELECT p.id,
                p.usuario_id,
                p.total,
                p.status,
                ${selectOptional(pedidosColumns, 'forma_pagamento', 'forma_pagamento')},
                ${selectOptional(pedidosColumns, 'tipo_entrega', 'tipo_entrega')},
                ${selectOptional(pedidosColumns, 'criado_em', 'criado_em')},
                ${selectOptional(pedidosColumns, 'pago_em', 'pago_em')},
                ${selectOptional(pedidosColumns, 'em_preparo_em', 'em_preparo_em')},
                ${selectOptional(pedidosColumns, 'pronto_em', 'pronto_em')},
                ${selectOptional(pedidosColumns, 'saiu_entrega_em', 'saiu_entrega_em')},
                ${selectOptional(pedidosColumns, 'entregue_em', 'entregue_em')},
                ${selectOptional(pedidosColumns, 'retirado_em', 'retirado_em')},
                ${selectOptional(pedidosColumns, 'cancelado_em', 'cancelado_em')},
                ${selectOptional(pedidosColumns, 'entrega_status', 'entrega_status')},
                ${selectOptional(pedidosColumns, 'uber_delivery_id', 'uber_delivery_id')},
                ${selectOptional(pedidosColumns, 'uber_tracking_url', 'uber_tracking_url')},
                ${selectOptional(pedidosColumns, 'uber_vehicle_type', 'uber_vehicle_type')},
                ${selectOptional(pedidosColumns, 'uber_eta_seconds', 'uber_eta_seconds')},
                ${selectOptional(pedidosColumns, 'delivery_provider', 'delivery_provider')},
                ${selectOptional(pedidosColumns, 'delivery_mode', 'delivery_mode')},
                ${selectOptional(pedidosColumns, 'delivery_status_internal', 'delivery_status_internal')},
                ${selectOptional(pedidosColumns, 'delivery_status_provider', 'delivery_status_provider')},
                ${selectOptional(pedidosColumns, 'delivery_eta_min', 'delivery_eta_min')},
                ${selectOptional(pedidosColumns, 'delivery_eta_max', 'delivery_eta_max')},
                ${selectOptional(pedidosColumns, 'delivery_tracking_url', 'delivery_tracking_url')},
                ${selectOptional(pedidosColumns, 'delivery_pin', 'delivery_pin')},
                ${selectOptional(pedidosColumns, 'delivery_pin_revealed_at', 'delivery_pin_revealed_at')},
                ${selectOptional(pedidosColumns, 'delivery_proof_photo_url', 'delivery_proof_photo_url')},
                ${selectOptional(pedidosColumns, 'delivery_proof_signature_url', 'delivery_proof_signature_url')},
                ${selectOptional(pedidosColumns, 'courier_name', 'courier_name')},
                ${selectOptional(pedidosColumns, 'courier_phone_masked', 'courier_phone_masked')},
                ${selectOptional(pedidosColumns, 'courier_vehicle', 'courier_vehicle')},
                ${selectOptional(pedidosColumns, 'courier_lat', 'courier_lat')},
                ${selectOptional(pedidosColumns, 'courier_lng', 'courier_lng')},
                ${selectOptional(pedidosColumns, 'last_delivery_event_at', 'last_delivery_event_at')},
                ${selectOptional(pedidosColumns, 'delivery_help_state', 'delivery_help_state')},
                ${selectOptional(pedidosColumns, 'delivery_issue_flag', 'delivery_issue_flag')},
                ${selectOptional(pedidosColumns, 'delivery_recipient_name', 'delivery_recipient_name')},
                ${selectOptional(pedidosColumns, 'delivery_recipient_note', 'delivery_recipient_note')},
                u.nome AS cliente_nome,
                u.telefone AS cliente_telefone,
                 ${enderecoSelect}
           FROM pedidos p
           LEFT JOIN usuarios u ON u.id = p.usuario_id
               ${enderecoJoin}
          WHERE p.id = ? AND p.usuario_id = ?
          LIMIT 1`,
        [pedidoId, req.usuario.id]
      );

      if (!rows.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado para tracking.' });
      }

      const pedido = rows[0];
      const provider = normalizeDeliveryProvider(pedido);
      const mode = normalizeDeliveryMode(pedido, provider);
      const internalStatus = deriveInternalDeliveryStatus(pedido, provider);
      const statusProvider = toLowerTrim(pedido?.delivery_status_provider || pedido?.entrega_status || pedido?.status);
      const etaRange = buildEtaRange({
        etaSeconds: pedido?.uber_eta_seconds,
        etaMin: pedido?.delivery_eta_min,
        etaMax: pedido?.delivery_eta_max
      });

      let deliveryEvents = [];
      if (await hasTable('delivery_tracking_events')) {
        const [eventsRows] = await pool.query(
          `SELECT event_name, status_internal, status_provider, title, description, occurred_at, source
             FROM delivery_tracking_events
            WHERE pedido_id = ?
            ORDER BY occurred_at DESC
            LIMIT 80`,
          [pedidoId]
        );
        deliveryEvents = eventsRows;
      } else if (await hasTable('uber_delivery_events')) {
        const [uberEventsRows] = await pool.query(
          `SELECT event_type AS event_name, event_type AS status_internal, event_type AS status_provider, created_at AS occurred_at
             FROM uber_delivery_events
            WHERE pedido_id = ?
            ORDER BY created_at DESC
            LIMIT 60`,
          [pedidoId]
        );
        deliveryEvents = uberEventsRows;
      }

      let itensCountRows = [{ total_itens: 0, quantidade_itens: 0 }];
      if (await hasTable('pedido_itens')) {
        const [rowsPedidoItens] = await pool.query(
          'SELECT COUNT(*) AS total_itens, COALESCE(SUM(quantidade), 0) AS quantidade_itens FROM pedido_itens WHERE pedido_id = ?',
          [pedidoId]
        );
        itensCountRows = rowsPedidoItens;
      } else if (await hasTable('itens_pedido')) {
        const [rowsItensPedido] = await pool.query(
          'SELECT COUNT(*) AS total_itens, COALESCE(SUM(quantidade), 0) AS quantidade_itens FROM itens_pedido WHERE pedido_id = ?',
          [pedidoId]
        );
        itensCountRows = rowsItensPedido;
      }

      const totalItens = Number(itensCountRows?.[0]?.quantidade_itens || 0);
      const trackingUrl = String(pedido?.delivery_tracking_url || pedido?.uber_tracking_url || '').trim() || null;
      const telefoneMasked = String(pedido?.courier_phone_masked || '').trim() || maskedPhone(pedido?.cliente_telefone) || null;
      const timeline = buildTrackingTimeline({ pedido, deliveryEvents });
      const currentStage = inferCurrentStage(internalStatus, pedido?.status);
      const statusMessage = inferStatusMessage(internalStatus, pedido?.status);
      const endereco = {
        rua: String(pedido?.rua || '').trim() || null,
        numero: String(pedido?.numero || '').trim() || null,
        complemento: String(pedido?.complemento || '').trim() || null,
        referencia: String(pedido?.referencia || '').trim() || null,
        bairro: String(pedido?.bairro || '').trim() || null,
        cidade: String(pedido?.cidade || '').trim() || null,
        estado: String(pedido?.estado || '').trim() || null,
        cep: String(pedido?.cep || '').trim() || null
      };

      const response = {
        pedido_id: pedidoId,
        provider,
        mode,
        status_internal: internalStatus,
        status_provider: statusProvider || null,
        status_label: currentStage,
        status_message: statusMessage,
        created_at: formatIso(pedido?.criado_em),
        payment_confirmed: ['pago', 'preparando', 'pronto_para_retirada', 'enviado', 'entregue', 'retirado'].includes(toLowerTrim(pedido?.status)),
        payment_status_label: ['pago', 'preparando', 'pronto_para_retirada', 'enviado', 'entregue', 'retirado'].includes(toLowerTrim(pedido?.status))
          ? 'Pagamento confirmado'
          : 'Pagamento em validação',
        eta_min: etaRange.min,
        eta_max: etaRange.max,
        tracking_url: trackingUrl,
        safety_pin: String(pedido?.delivery_pin || '').trim() || null,
        safety_pin_revealed_at: formatIso(pedido?.delivery_pin_revealed_at),
        proof: {
          photo_url: String(pedido?.delivery_proof_photo_url || '').trim() || null,
          signature_url: String(pedido?.delivery_proof_signature_url || '').trim() || null,
          via_pin: Boolean(String(pedido?.delivery_pin || '').trim())
        },
        courier: {
          name: String(pedido?.courier_name || '').trim() || null,
          phone_masked: telefoneMasked,
          vehicle: String(pedido?.courier_vehicle || pedido?.uber_vehicle_type || '').trim() || null,
          status: internalStatus,
          lat: pedido?.courier_lat !== null ? Number(pedido?.courier_lat) : null,
          lng: pedido?.courier_lng !== null ? Number(pedido?.courier_lng) : null,
          last_event_at: formatIso(pedido?.last_delivery_event_at)
        },
        endereco,
        summary: {
          total: Number(pedido?.total || 0),
          total_itens: totalItens,
          loja_nome: 'BomFilho Supermercado'
        },
        recipient: {
          name: String(pedido?.delivery_recipient_name || '').trim() || null,
          note: String(pedido?.delivery_recipient_note || '').trim() || null
        },
        help_state: String(pedido?.delivery_help_state || '').trim() || null,
        issue_flag: Boolean(Number(pedido?.delivery_issue_flag || 0) === 1),
        timeline,
        events: (deliveryEvents || []).map((event) => ({
          event_name: String(event?.event_name || '').trim() || null,
          status_internal: String(event?.status_internal || '').trim() || null,
          status_provider: String(event?.status_provider || '').trim() || null,
          title: String(event?.title || '').trim() || null,
          description: String(event?.description || '').trim() || null,
          source: String(event?.source || '').trim() || null,
          occurred_at: formatIso(event?.occurred_at)
        }))
      };

      return res.json(response);
    } catch (error) {
      logger.error('Erro no tracking detalhado da entrega:', error);
      return res.status(500).json({ erro: 'Não foi possível carregar o acompanhamento da entrega.' });
    }
  });

  // Registra ações do cliente na jornada de entrega e atualiza estado de ajuda/segurança
  router.post('/api/pedidos/:id/delivery-event', autenticarToken, async (req, res) => {
    try {
      const pedidoId = Number(req.params.id || 0);
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ erro: 'Pedido inválido para evento de entrega.' });
      }

      const action = normalizeClientDeliveryAction(req.body?.action);
      if (!action) {
        return res.status(400).json({ erro: 'Ação de entrega inválida.' });
      }

      const [pedidoRows] = await pool.query(
        'SELECT id FROM pedidos WHERE id = ? AND usuario_id = ? LIMIT 1',
        [pedidoId, req.usuario.id]
      );
      if (!pedidoRows.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado para registrar evento.' });
      }

      const pedidosColumns = await getPedidosColumns();
      const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

      if (await hasTable('delivery_tracking_events')) {
        await pool.query(
          `INSERT INTO delivery_tracking_events
            (pedido_id, source, event_name, status_internal, status_provider, title, description, occurred_at, payload)
           VALUES (?, 'client', ?, NULL, NULL, ?, ?, NOW(), ?)`,
          [
            pedidoId,
            action,
            `Cliente: ${action.replace(/_/g, ' ')}`,
            action === 'report_issue' ? 'Cliente sinalizou um problema na entrega.' : 'Ação registrada pelo cliente na jornada de entrega.',
            JSON.stringify(metadata)
          ]
        );
      }

      const updateFields = [];
      const updateParams = [];

      const setOptional = (columnName, valueOrSql, useRaw = false) => {
        if (!pedidosColumns.has(String(columnName || '').trim().toLowerCase())) {
          return;
        }

        if (useRaw) {
          updateFields.push(`${columnName} = ${valueOrSql}`);
          return;
        }

        updateFields.push(`${columnName} = ?`);
        updateParams.push(valueOrSql);
      };

      if (action === 'report_issue') {
        setOptional('delivery_issue_flag', 1);
        setOptional('delivery_help_state', String(metadata?.help_topic || 'issue_reported').trim().slice(0, 64));
      }

      if (action === 'pin_revealed') {
        setOptional('delivery_pin_revealed_at', 'COALESCE(delivery_pin_revealed_at, NOW())', true);
      }

      if (action === 'set_receiver') {
        const receiverName = String(metadata?.receiver_name || '').trim().slice(0, 120);
        const receiverNote = String(metadata?.receiver_note || '').trim().slice(0, 255);
        if (receiverName) {
          setOptional('delivery_recipient_name', receiverName);
        }
        if (receiverNote) {
          setOptional('delivery_recipient_note', receiverNote);
        }
      }

      if (action === 'open_help_center' && !updateFields.some((field) => field.startsWith('delivery_help_state'))) {
        setOptional('delivery_help_state', 'open_help_center');
      }

      if (updateFields.length > 0) {
        await pool.query(
          `UPDATE pedidos
              SET ${updateFields.join(', ')}
            WHERE id = ? AND usuario_id = ?`,
          [...updateParams, pedidoId, req.usuario.id]
        );
      }

      return res.json({ ok: true, action });
    } catch (error) {
      logger.error('Erro ao registrar evento de entrega do cliente:', error);
      return res.status(500).json({ erro: 'Não foi possível registrar a ação de entrega.' });
    }
  });

  // Cliente confirma recebimento do pedido
  router.put('/api/pedidos/:id/confirmar-recebimento', autenticarToken, async (req, res) => {
    try {
      const pedidoId = req.params.id;
      const [rows] = await pool.query(
        'SELECT id, status, usuario_id FROM pedidos WHERE id = ? AND usuario_id = ? LIMIT 1',
        [pedidoId, req.usuario.id]
      );
      if (!rows.length) {
        return res.status(404).json({ erro: 'Pedido não encontrado.' });
      }
      if (rows[0].status !== 'enviado') {
        return res.status(400).json({ erro: 'Só é possível confirmar recebimento de pedidos em entrega.' });
      }
      await pool.query(
        'UPDATE pedidos SET status = ?, entregue_em = COALESCE(entregue_em, NOW()) WHERE id = ?',
        ['entregue', pedidoId]
      );
      logger.info(`Cliente ${req.usuario.id} confirmou recebimento do pedido #${pedidoId}`);
      res.json({ mensagem: 'Recebimento confirmado com sucesso!', status: 'entregue' });
    } catch (erro) {
      logger.error('Erro ao confirmar recebimento:', erro);
      res.status(500).json({ erro: 'Não foi possível confirmar o recebimento.' });
    }
  });

  return router;
};
