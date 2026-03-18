import {
  getGrowthExperimentContext,
  recordGrowthEvent
} from './conversionGrowth';

const MAX_LINE_ITEMS = 10;

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value || '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveInt(value, fallback = 0) {
  const parsed = Math.trunc(toNumber(value));
  if (parsed > 0) {
    return parsed;
  }
  return Math.trunc(Math.max(0, Number(fallback || 0)));
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || '';
}

function getProductId(produto) {
  const parsed = toPositiveInt(produto?.id || produto?.produto_id || produto?.product_id);
  return parsed > 0 ? parsed : null;
}

function getProductPrice(produto) {
  const candidates = [
    produto?.preco,
    produto?.price,
    produto?.precoAtual,
    produto?.preco_atual,
    produto?.preco_promocional
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed > 0) {
      return Number(parsed.toFixed(2));
    }
  }

  return 0;
}

function getStockQuantity(produto) {
  const candidates = [
    produto?.estoque,
    produto?.estoque_atual,
    produto?.quantidade_estoque,
    produto?.saldo_estoque,
    produto?.saldo
  ];

  for (const candidate of candidates) {
    const asText = String(candidate ?? '').trim();
    if (!asText || !/\d/.test(asText)) {
      continue;
    }

    return Math.max(0, Math.trunc(toNumber(asText)));
  }

  return null;
}

function sanitizeProperties(properties = {}) {
  const result = {};

  Object.entries(properties || {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (typeof value === 'number') {
      result[key] = Number.isFinite(value) ? value : 0;
      return;
    }

    if (typeof value === 'string') {
      result[key] = cleanText(value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function buildLineItems(itens = []) {
  const safeItens = Array.isArray(itens) ? itens : [];

  return safeItens.slice(0, MAX_LINE_ITEMS).map((item) => {
    const quantity = Math.max(1, toPositiveInt(item?.quantidade || item?.quantity, 1));
    const unitPrice = Number(toNumber(item?.preco || item?.price || 0).toFixed(2));

    return {
      product_id: getProductId(item),
      product_name: cleanText(item?.nome || item?.name) || 'Produto',
      quantity,
      unit_price: unitPrice,
      subtotal: Number((unitPrice * quantity).toFixed(2))
    };
  });
}

function getPosthogClient() {
  if (typeof window === 'undefined') {
    return null;
  }

  const client = window.posthog;
  if (!client || typeof client.capture !== 'function') {
    return null;
  }

  return client;
}

function canLogFallback() {
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
}

export function captureCommerceEvent(eventName, properties = {}) {
  const name = cleanText(eventName);
  if (!name) {
    return;
  }

  const growthContext = getGrowthExperimentContext();

  const payload = sanitizeProperties({
    ...properties,
    growth_window_days: properties?.growth_window_days ?? growthContext.growth_window_days,
    growth_week_key: properties?.growth_week_key ?? growthContext.growth_week_key,
    growth_bottleneck: properties?.growth_bottleneck ?? growthContext.growth_bottleneck,
    growth_variant_key: properties?.growth_variant_key ?? growthContext.growth_variant_key,
    growth_variant_mode: properties?.growth_variant_mode ?? growthContext.growth_variant_mode,
    event_origin: 'frontend-react',
    client_timestamp: new Date().toISOString()
  });

  try {
    const posthog = getPosthogClient();
    if (posthog) {
      posthog.capture(name, payload);
    } else if (canLogFallback()) {
      console.info(`[tracking:${name}]`, payload);
    }
  } catch (error) {
    if (canLogFallback()) {
      console.warn(`[tracking:${name}] failed:`, error);
    }
  }

  recordGrowthEvent(name, payload);
}

export function buildProductEventPayload(produto = {}, extras = {}) {
  const stockQuantity = getStockQuantity(produto);

  return sanitizeProperties({
    product_id: getProductId(produto),
    product_name: cleanText(produto?.nome || produto?.name) || 'Produto',
    category: cleanText(produto?.categoria || produto?.category) || null,
    unit: cleanText(produto?.unidade || produto?.unit) || null,
    price: getProductPrice(produto),
    stock_quantity: stockQuantity,
    in_stock: stockQuantity === null ? null : stockQuantity > 0,
    ...extras
  });
}

export function buildCartEventPayload({ itens = [], resumo = {} } = {}) {
  const safeItens = Array.isArray(itens) ? itens : [];
  const lineItems = buildLineItems(safeItens);
  const cartItems = safeItens.reduce((acc, item) => acc + Math.max(1, toPositiveInt(item?.quantidade || 1, 1)), 0);

  return sanitizeProperties({
    cart_items: cartItems,
    cart_total: Number(toNumber(resumo?.total || 0).toFixed(2)),
    distinct_products: safeItens.length,
    line_items: lineItems
  });
}

export function buildOrderItemsPayload(itens = []) {
  return buildLineItems(itens);
}
