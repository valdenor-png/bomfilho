'use strict';

const {
  mapGatewayStatusToOrderStatus,
  mapGatewayStatusToPixStatus,
  buildTransitionDecision
} = require('../services/mercadoPagoStatusPolicy');

describe('mercadoPagoStatusPolicy', () => {
  test('mapeia approved para status interno pago', () => {
    expect(mapGatewayStatusToOrderStatus('approved')).toBe('pago');
    expect(mapGatewayStatusToPixStatus('approved')).toBe('PAID');
  });

  test('bloqueia regressao de gateway approved -> pending', () => {
    const result = buildTransitionDecision({
      currentGatewayStatus: 'approved',
      nextGatewayStatus: 'pending',
      currentOrderStatus: 'pago',
      nextOrderStatus: 'pendente'
    });

    expect(result.shouldApply).toBe(false);
    expect(result.reason).toBe('gateway_regression');
  });

  test('bloqueia regressao operacional quando pedido ja esta em preparo', () => {
    const result = buildTransitionDecision({
      currentGatewayStatus: 'unknown',
      nextGatewayStatus: 'pending',
      currentOrderStatus: 'preparando',
      nextOrderStatus: 'pendente'
    });

    expect(result.shouldApply).toBe(false);
    expect(result.reason).toBe('order_regression_operational');
  });

  test('permite progressao pending -> approved', () => {
    const result = buildTransitionDecision({
      currentGatewayStatus: 'pending',
      nextGatewayStatus: 'approved',
      currentOrderStatus: 'pendente',
      nextOrderStatus: 'pago'
    });

    expect(result.shouldApply).toBe(true);
    expect(result.reason).toBe('apply');
  });
});
