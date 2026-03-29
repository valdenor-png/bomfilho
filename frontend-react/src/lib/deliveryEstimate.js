export function getDeliveryEstimate(deliveryMode, itemCount) {
  if (deliveryMode === 'retirada') {
    const estimate = Math.min(15 + Math.ceil(itemCount * 0.5), 45);
    const lower = Math.floor(estimate / 5) * 5;
    const upper = lower + 15;
    return {
      minutes: estimate,
      range: `${lower}-${upper} min`,
      label: `Pronto para retirada em ~${lower}-${upper} min`,
    };
  }

  const estimate = Math.min(35 + Math.ceil(itemCount * 0.5), 90);
  const lower = Math.floor(estimate / 10) * 10;
  const upper = lower + 15;
  return {
    minutes: estimate,
    range: `${lower}-${upper} min`,
    label: `Entrega em ${lower}-${upper} min`,
  };
}
