export const ORDER_RULES = {
  minOrderValue: 10.00,
  minOrderForDelivery: 30.00,
  freeShippingThreshold: 100.00,
};

// Frete por faixas
export const DELIVERY_TIERS = [
  { maxTotal: 50, fee: 8.00, label: 'R$ 8,00' },
  { maxTotal: 100, fee: 4.00, label: 'R$ 4,00' },
  { maxTotal: Infinity, fee: 0, label: 'Gratis' },
];

export function calculateDeliveryFee(cartTotal) {
  for (const tier of DELIVERY_TIERS) {
    if (cartTotal < tier.maxTotal) {
      return { fee: tier.fee, label: tier.label, isFree: tier.fee === 0 };
    }
  }
  return { fee: 0, label: 'Gratis', isFree: true };
}

export function getNextTierHint(cartTotal) {
  const currentFee = calculateDeliveryFee(cartTotal).fee;
  for (const tier of DELIVERY_TIERS) {
    if (tier.maxTotal === Infinity) continue;
    if (cartTotal < tier.maxTotal && tier.fee < currentFee) {
      const missing = tier.maxTotal - cartTotal;
      if (tier.fee === 0) return `Faltam R$ ${missing.toFixed(2).replace('.', ',')} para frete gratis!`;
      return `Faltam R$ ${missing.toFixed(2).replace('.', ',')} para frete de ${tier.label}!`;
    }
  }
  // Check free shipping threshold
  if (cartTotal < ORDER_RULES.freeShippingThreshold && currentFee > 0) {
    const missing = ORDER_RULES.freeShippingThreshold - cartTotal;
    return `Faltam R$ ${missing.toFixed(2).replace('.', ',')} para frete gratis!`;
  }
  return null;
}

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
