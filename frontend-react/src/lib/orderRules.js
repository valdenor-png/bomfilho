export const ORDER_RULES = {
  minOrderValue: 10.00,
  minOrderForDelivery: 30.00,
  freeShippingThreshold: 80.00,
};

export function validateCartMinimum(cartTotal, deliveryMode) {
  const minValue = deliveryMode === 'entrega'
    ? ORDER_RULES.minOrderForDelivery
    : ORDER_RULES.minOrderValue;

  if (cartTotal < minValue) {
    const missing = minValue - cartTotal;
    return {
      canProceed: false,
      message: `Pedido minimo de R$ ${minValue.toFixed(2).replace('.', ',')}${deliveryMode === 'entrega' ? ' para entrega' : ''}. Faltam R$ ${missing.toFixed(2).replace('.', ',')}.`,
      missingAmount: missing,
      minValue,
    };
  }
  return { canProceed: true, message: null, missingAmount: 0, minValue };
}
