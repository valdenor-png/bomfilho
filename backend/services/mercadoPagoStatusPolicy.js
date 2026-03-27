'use strict';

const GATEWAY_STATUS_ALIAS = Object.freeze({
  waiting: 'pending',
  pending: 'pending',
  in_process: 'in_process',
  in_mediation: 'in_process',
  processing: 'in_process',
  authorized: 'authorized',
  approved: 'approved',
  rejected: 'rejected',
  declined: 'rejected',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'charged_back',
  expired: 'expired'
});

const GATEWAY_STATUS_RANK = Object.freeze({
  unknown: 0,
  pending: 10,
  in_process: 20,
  authorized: 30,
  rejected: 70,
  cancelled: 80,
  expired: 90,
  approved: 100,
  refunded: 110,
  charged_back: 120
});

const ORDER_STATUS_BY_GATEWAY = Object.freeze({
  pending: 'pendente',
  in_process: 'pendente',
  authorized: 'pago',
  approved: 'pago',
  rejected: 'pagamento_recusado',
  cancelled: 'cancelado',
  refunded: 'cancelado',
  charged_back: 'cancelado',
  expired: 'expirado',
  unknown: 'pendente'
});

const PIX_STATUS_BY_GATEWAY = Object.freeze({
  pending: 'WAITING',
  in_process: 'IN_PROCESS',
  authorized: 'AUTHORIZED',
  approved: 'PAID',
  rejected: 'DECLINED',
  cancelled: 'CANCELED',
  refunded: 'CANCELED',
  charged_back: 'CANCELED',
  expired: 'EXPIRED',
  unknown: 'WAITING'
});

const INTERNAL_PAYMENT_STATUS_BY_GATEWAY = Object.freeze({
  pending: 'aguardando',
  in_process: 'em_analise',
  authorized: 'autorizado',
  approved: 'aprovado',
  rejected: 'recusado',
  cancelled: 'cancelado',
  refunded: 'reembolsado',
  charged_back: 'chargeback',
  expired: 'expirado',
  unknown: 'desconhecido'
});

const ORDER_FLOW_ADVANCED_STATUSES = new Set([
  'preparando',
  'pronto_para_retirada',
  'enviado',
  'entregue',
  'retirado'
]);

const ORDER_LOCKED_STATUSES = new Set([
  'entregue',
  'retirado'
]);

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeGatewayStatus(value) {
  const normalized = normalizeStatus(value);
  return GATEWAY_STATUS_ALIAS[normalized] || 'unknown';
}

function getGatewayStatusRank(status) {
  const normalized = normalizeGatewayStatus(status);
  return Number(GATEWAY_STATUS_RANK[normalized] || 0);
}

function mapGatewayStatusToOrderStatus(status) {
  const normalized = normalizeGatewayStatus(status);
  return ORDER_STATUS_BY_GATEWAY[normalized] || ORDER_STATUS_BY_GATEWAY.unknown;
}

function mapGatewayStatusToPixStatus(status) {
  const normalized = normalizeGatewayStatus(status);
  return PIX_STATUS_BY_GATEWAY[normalized] || PIX_STATUS_BY_GATEWAY.unknown;
}

function mapGatewayStatusToInternalPaymentStatus(status) {
  const normalized = normalizeGatewayStatus(status);
  return INTERNAL_PAYMENT_STATUS_BY_GATEWAY[normalized] || INTERNAL_PAYMENT_STATUS_BY_GATEWAY.unknown;
}

function isTerminalGatewayStatus(status) {
  const normalized = normalizeGatewayStatus(status);
  return ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back', 'expired'].includes(normalized);
}

function buildTransitionDecision({
  currentGatewayStatus,
  nextGatewayStatus,
  currentOrderStatus,
  nextOrderStatus
} = {}) {
  const currentGateway = normalizeGatewayStatus(currentGatewayStatus);
  const nextGateway = normalizeGatewayStatus(nextGatewayStatus);
  const currentOrder = normalizeStatus(currentOrderStatus);
  const nextOrder = normalizeStatus(nextOrderStatus);
  const currentRank = getGatewayStatusRank(currentGateway);
  const nextRank = getGatewayStatusRank(nextGateway);

  if (currentGateway === nextGateway && currentOrder === nextOrder) {
    return {
      shouldApply: false,
      reason: 'no_change',
      currentGateway,
      nextGateway,
      currentOrder,
      nextOrder,
      currentRank,
      nextRank
    };
  }

  if (nextRank < currentRank) {
    return {
      shouldApply: false,
      reason: 'gateway_regression',
      currentGateway,
      nextGateway,
      currentOrder,
      nextOrder,
      currentRank,
      nextRank
    };
  }

  if (currentOrder === 'cancelado' && nextOrder !== 'cancelado') {
    return {
      shouldApply: false,
      reason: 'order_locked_cancelled',
      currentGateway,
      nextGateway,
      currentOrder,
      nextOrder,
      currentRank,
      nextRank
    };
  }

  if (ORDER_LOCKED_STATUSES.has(currentOrder) && nextOrder !== currentOrder) {
    return {
      shouldApply: false,
      reason: 'order_locked_fulfilled',
      currentGateway,
      nextGateway,
      currentOrder,
      nextOrder,
      currentRank,
      nextRank
    };
  }

  if (
    ORDER_FLOW_ADVANCED_STATUSES.has(currentOrder)
    && ['pendente', 'pagamento_recusado', 'cancelado', 'expirado'].includes(nextOrder)
  ) {
    return {
      shouldApply: false,
      reason: 'order_regression_operational',
      currentGateway,
      nextGateway,
      currentOrder,
      nextOrder,
      currentRank,
      nextRank
    };
  }

  if (currentOrder === 'pago' && ['pendente', 'pagamento_recusado', 'expirado'].includes(nextOrder)) {
    return {
      shouldApply: false,
      reason: 'order_regression_paid',
      currentGateway,
      nextGateway,
      currentOrder,
      nextOrder,
      currentRank,
      nextRank
    };
  }

  return {
    shouldApply: true,
    reason: 'apply',
    currentGateway,
    nextGateway,
    currentOrder,
    nextOrder,
    currentRank,
    nextRank
  };
}

module.exports = {
  normalizeGatewayStatus,
  getGatewayStatusRank,
  mapGatewayStatusToOrderStatus,
  mapGatewayStatusToPixStatus,
  mapGatewayStatusToInternalPaymentStatus,
  isTerminalGatewayStatus,
  buildTransitionDecision
};
