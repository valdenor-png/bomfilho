const STORAGE_KEY = 'bf_conversion_growth_v1';
export const GROWTH_UPDATE_EVENT_NAME = 'bf-growth-updated';

const MAX_EVENTS = 4500;
const RETENTION_DAYS = 120;
const DEFAULT_WINDOW_DAYS = 7;
const MIN_SAMPLE_PER_VARIANT = 12;
const STAGE_COMPARISON_MIN_BASE = 8;
const WINDOW_MIN_EVENTS_FOR_ACTION = 90;
const BOTTLENECK_MIN_BASE_FOR_ACTION = 28;
const BOTTLENECK_MIN_TARGET_FOR_ACTION = 8;
const TOP_PRODUCT_MIN_VIEWS = 4;
const TOP_PRODUCT_MIN_CARTS = 2;

const RELEVANT_EVENTS = new Set([
  'product_view',
  'add_to_cart',
  'start_checkout',
  'purchase'
]);

const FUNNEL_STAGES = [
  {
    id: 'view_to_cart',
    fromEvent: 'product_view',
    toEvent: 'add_to_cart',
    label: 'view -> cart'
  },
  {
    id: 'cart_to_checkout',
    fromEvent: 'add_to_cart',
    toEvent: 'start_checkout',
    label: 'cart -> checkout'
  },
  {
    id: 'checkout_to_purchase',
    fromEvent: 'start_checkout',
    toEvent: 'purchase',
    label: 'checkout -> purchase'
  }
];

const VARIANT_KEYS = ['control', 'valor_claro', 'urgencia_preco'];

export const GROWTH_BOTTLENECK_LABELS = {
  view_to_cart: 'view -> cart',
  cart_to_checkout: 'cart -> checkout',
  checkout_to_purchase: 'checkout -> purchase'
};

function cleanText(value) {
  const text = String(value || '').trim();
  return text || '';
}

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

  return Math.max(0, Math.trunc(toNumber(fallback)));
}

function normalizeVariantKey(value) {
  const normalized = cleanText(value).toLowerCase();
  return VARIANT_KEYS.includes(normalized) ? normalized : 'control';
}

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getNowMs() {
  return Date.now();
}

function parseTimestampMs(value, fallbackMs) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function getCutoffTimestampMs(windowDays) {
  const days = Math.max(1, Math.trunc(toNumber(windowDays || DEFAULT_WINDOW_DAYS)));
  return getNowMs() - (days * 24 * 60 * 60 * 1000);
}

function getRetentionCutoffTimestampMs() {
  return getNowMs() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function readGrowthState() {
  const storage = getLocalStorage();
  if (!storage) {
    return { events: [] };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { events: [] };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) {
      return { events: [] };
    }

    return {
      events: parsed.events
        .filter((eventItem) => eventItem && typeof eventItem === 'object')
        .slice(-MAX_EVENTS)
    };
  } catch {
    return { events: [] };
  }
}

function writeGrowthState(state) {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota and serialization errors.
  }
}

function emitGrowthUpdate() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new Event(GROWTH_UPDATE_EVENT_NAME));
}

function sanitizeLineItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.slice(0, 40).map((item) => ({
    product_id: toPositiveInt(item?.product_id || item?.id || item?.produto_id),
    product_name: cleanText(item?.product_name || item?.name || item?.nome) || 'Produto',
    quantity: Math.max(1, toPositiveInt(item?.quantity || item?.quantidade, 1))
  }));
}

function normalizeEventRecord(eventName, properties = {}) {
  const timestamp = cleanText(properties?.client_timestamp) || new Date().toISOString();
  const normalizedEventName = cleanText(eventName).toLowerCase();

  return {
    event_name: normalizedEventName,
    timestamp,
    timestamp_ms: parseTimestampMs(timestamp, getNowMs()),
    product_id: toPositiveInt(
      properties?.product_id
      || properties?.id
      || properties?.produto_id
      || properties?.item_id,
      0
    ),
    product_name: cleanText(properties?.product_name || properties?.name || properties?.nome) || '',
    variant_key: normalizeVariantKey(properties?.growth_variant_key),
    bottleneck: cleanText(properties?.growth_bottleneck).toLowerCase() || '',
    line_items: sanitizeLineItems(properties?.line_items),
    revenue: Number(toNumber(properties?.revenue || properties?.value || 0).toFixed(2))
  };
}

function pruneEvents(events = []) {
  const retentionCutoff = getRetentionCutoffTimestampMs();
  const retained = events
    .filter((eventItem) => Number(eventItem?.timestamp_ms || 0) >= retentionCutoff)
    .slice(-MAX_EVENTS);

  return retained;
}

function getWindowEvents(events = [], windowDays = DEFAULT_WINDOW_DAYS) {
  const cutoff = getCutoffTimestampMs(windowDays);
  return events.filter((eventItem) => Number(eventItem?.timestamp_ms || 0) >= cutoff);
}

function safeRate(numerator, denominator) {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

function computeFunnel(events = []) {
  const counts = {
    product_view: 0,
    add_to_cart: 0,
    start_checkout: 0,
    purchase: 0
  };

  events.forEach((eventItem) => {
    const name = cleanText(eventItem?.event_name).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, name)) {
      counts[name] += 1;
    }
  });

  const stages = FUNNEL_STAGES.map((stage) => {
    const fromCount = counts[stage.fromEvent] || 0;
    const toCount = counts[stage.toEvent] || 0;
    const conversionRate = safeRate(toCount, fromCount);

    return {
      id: stage.id,
      label: stage.label,
      fromEvent: stage.fromEvent,
      toEvent: stage.toEvent,
      fromCount,
      toCount,
      conversionRate,
      dropRate: Number((1 - conversionRate).toFixed(4))
    };
  });

  return {
    counts,
    stages
  };
}

function chooseBottleneck(stages = []) {
  const withBase = stages
    .filter((stage) => stage.fromCount >= STAGE_COMPARISON_MIN_BASE)
    .sort((a, b) => {
      const conversionDiff = a.conversionRate - b.conversionRate;
      if (conversionDiff !== 0) {
        return conversionDiff;
      }

      const volumeDiff = b.fromCount - a.fromCount;
      if (volumeDiff !== 0) {
        return volumeDiff;
      }

      return a.id.localeCompare(b.id);
    });

  if (withBase.length > 0) {
    return withBase[0].id;
  }

  const fallback = [...stages].sort((a, b) => {
    const conversionDiff = a.conversionRate - b.conversionRate;
    if (conversionDiff !== 0) {
      return conversionDiff;
    }

    return b.fromCount - a.fromCount;
  });

  return fallback[0]?.id || 'view_to_cart';
}

function getIsoWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - dayNumber + 3);

  const firstThursday = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 4));
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3);

  const weekNumber = 1 + Math.floor((utcDate - firstThursday) / 604800000);
  return `${utcDate.getUTCFullYear()}-W${String(Math.max(1, weekNumber)).padStart(2, '0')}`;
}

function hashString(input) {
  let hash = 0;
  const text = String(input || '');

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getDistinctId() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const posthog = window.posthog;
    if (posthog && typeof posthog.get_distinct_id === 'function') {
      return cleanText(posthog.get_distinct_id());
    }
  } catch {
    // Ignore PostHog access errors.
  }

  return '';
}

function getFallbackVariantKey(weekKey, bottleneck) {
  const distinctId = getDistinctId() || 'anon';
  const seed = `${weekKey}|${bottleneck}|${distinctId}`;
  const index = hashString(seed) % VARIANT_KEYS.length;
  return VARIANT_KEYS[index] || 'control';
}

function computeVariantPerformance(events = [], bottleneck) {
  const stage = FUNNEL_STAGES.find((item) => item.id === bottleneck) || FUNNEL_STAGES[0];
  const statsByVariant = new Map(
    VARIANT_KEYS.map((variantKey) => [variantKey, { variantKey, baseCount: 0, targetCount: 0 }])
  );

  events.forEach((eventItem) => {
    const variantKey = normalizeVariantKey(eventItem?.variant_key);
    const stats = statsByVariant.get(variantKey);

    if (!stats) {
      return;
    }

    if (eventItem.event_name === stage.fromEvent) {
      stats.baseCount += 1;
    }

    if (eventItem.event_name === stage.toEvent) {
      stats.targetCount += 1;
    }
  });

  const rows = Array.from(statsByVariant.values()).map((row) => ({
    ...row,
    conversionRate: safeRate(row.targetCount, row.baseCount)
  }));

  const winnerCandidates = rows
    .filter((row) => row.baseCount >= MIN_SAMPLE_PER_VARIANT)
    .sort((a, b) => {
      const conversionDiff = b.conversionRate - a.conversionRate;
      if (conversionDiff !== 0) {
        return conversionDiff;
      }

      const targetDiff = b.targetCount - a.targetCount;
      if (targetDiff !== 0) {
        return targetDiff;
      }

      return a.variantKey.localeCompare(b.variantKey);
    });

  return {
    variants: rows,
    winner: winnerCandidates[0] || null
  };
}

function ensureProductEntry(map, productId, productName = '') {
  if (!map.has(productId)) {
    map.set(productId, {
      productId,
      productName: cleanText(productName) || `Produto #${productId}`,
      views: 0,
      carts: 0,
      purchases: 0
    });
  }

  const entry = map.get(productId);
  if (cleanText(productName) && !entry.productName.startsWith('Produto #')) {
    return entry;
  }

  if (cleanText(productName)) {
    entry.productName = cleanText(productName);
  }

  return entry;
}

function computeTopProducts(events = []) {
  const productMap = new Map();

  events.forEach((eventItem) => {
    if (eventItem.event_name === 'product_view' || eventItem.event_name === 'add_to_cart') {
      const productId = toPositiveInt(eventItem.product_id, 0);
      if (!productId) {
        return;
      }

      const entry = ensureProductEntry(productMap, productId, eventItem.product_name);
      if (eventItem.event_name === 'product_view') {
        entry.views += 1;
      } else {
        entry.carts += 1;
      }
      return;
    }

    if (eventItem.event_name === 'purchase') {
      eventItem.line_items.forEach((lineItem) => {
        const productId = toPositiveInt(lineItem.product_id, 0);
        if (!productId) {
          return;
        }

        const entry = ensureProductEntry(productMap, productId, lineItem.product_name);
        entry.purchases += Math.max(1, toPositiveInt(lineItem.quantity, 1));
      });
    }
  });

  const ranked = Array.from(productMap.values())
    .map((row) => {
      const conversionRate = safeRate(row.carts, row.views);
      const purchaseRate = safeRate(row.purchases, Math.max(1, row.carts));
      const score = Number((
        (conversionRate * 100)
        + (Math.min(row.carts, 40) * 0.7)
        + (Math.min(row.purchases, 50) * 0.45)
      ).toFixed(4));

      return {
        ...row,
        conversionRate,
        purchaseRate,
        score
      };
    })
    .filter((row) => row.views >= TOP_PRODUCT_MIN_VIEWS && row.carts >= TOP_PRODUCT_MIN_CARTS)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const conversionDiff = b.conversionRate - a.conversionRate;
      if (conversionDiff !== 0) {
        return conversionDiff;
      }

      const cartDiff = b.carts - a.carts;
      if (cartDiff !== 0) {
        return cartDiff;
      }

      return a.productId - b.productId;
    });

  return ranked.slice(0, 18);
}

function buildExperimentUi(bottleneck, variantKey, { enabled = true } = {}) {
  const key = normalizeVariantKey(variantKey);

  const ui = {
    catalog: {
      enabled: Boolean(enabled) && bottleneck === 'view_to_cart',
      ctaMode: 'default',
      badgeLabel: '',
      priceHighlight: 'none',
      helperText: ''
    },
    checkoutEntry: {
      enabled: Boolean(enabled) && bottleneck === 'cart_to_checkout',
      ctaText: 'Ir para checkout',
      badgeLabel: '',
      priceHighlight: 'none'
    },
    checkoutPayment: {
      enabled: Boolean(enabled) && bottleneck === 'checkout_to_purchase',
      ctaPrefix: 'Finalizar pedido',
      badgeLabel: '',
      priceHighlight: 'none'
    }
  };

  if (key === 'valor_claro') {
    if (ui.catalog.enabled) {
      ui.catalog.ctaMode = 'valor';
      ui.catalog.badgeLabel = 'Melhor valor da semana';
      ui.catalog.priceHighlight = 'value';
      ui.catalog.helperText = 'Decisao rapida: preco e economia em destaque.';
    }

    if (ui.checkoutEntry.enabled) {
      ui.checkoutEntry.ctaText = 'Fechar compra com economia';
      ui.checkoutEntry.badgeLabel = 'Priorize o fechamento com melhor valor';
      ui.checkoutEntry.priceHighlight = 'value';
    }

    if (ui.checkoutPayment.enabled) {
      ui.checkoutPayment.ctaPrefix = 'Confirmar pagamento com melhor valor';
      ui.checkoutPayment.badgeLabel = 'Concluir agora reduz atrito de compra';
      ui.checkoutPayment.priceHighlight = 'value';
    }
  }

  if (key === 'urgencia_preco') {
    if (ui.catalog.enabled) {
      ui.catalog.ctaMode = 'urgencia';
      ui.catalog.badgeLabel = 'Giro rapido';
      ui.catalog.priceHighlight = 'urgency';
      ui.catalog.helperText = 'Estoque muda rapido: garanta o preco atual.';
    }

    if (ui.checkoutEntry.enabled) {
      ui.checkoutEntry.ctaText = 'Garantir preco e ir ao checkout';
      ui.checkoutEntry.badgeLabel = 'Finalize antes da virada de estoque';
      ui.checkoutEntry.priceHighlight = 'urgency';
    }

    if (ui.checkoutPayment.enabled) {
      ui.checkoutPayment.ctaPrefix = 'Concluir pagamento agora';
      ui.checkoutPayment.badgeLabel = 'Confirmacao imediata evita abandono';
      ui.checkoutPayment.priceHighlight = 'urgency';
    }
  }

  return ui;
}

function evaluateDataVolume({
  windowEventCount = 0,
  bottleneckStage = null
} = {}) {
  const baseCount = Math.max(0, toPositiveInt(bottleneckStage?.fromCount, 0));
  const targetCount = Math.max(0, toPositiveInt(bottleneckStage?.toCount, 0));
  const normalizedWindowEventCount = Math.max(0, toPositiveInt(windowEventCount, 0));

  const missingWindowEvents = Math.max(0, WINDOW_MIN_EVENTS_FOR_ACTION - normalizedWindowEventCount);
  const missingBottleneckBase = Math.max(0, BOTTLENECK_MIN_BASE_FOR_ACTION - baseCount);
  const missingBottleneckTarget = Math.max(0, BOTTLENECK_MIN_TARGET_FOR_ACTION - targetCount);

  const reasons = [];

  if (missingWindowEvents > 0) {
    reasons.push('window_events');
  }

  if (missingBottleneckBase > 0) {
    reasons.push('bottleneck_base');
  }

  if (missingBottleneckTarget > 0) {
    reasons.push('bottleneck_target');
  }

  return {
    readyForAction: reasons.length === 0,
    reasons,
    windowEventCount: normalizedWindowEventCount,
    bottleneckFromCount: baseCount,
    bottleneckToCount: targetCount,
    missingWindowEvents,
    missingBottleneckBase,
    missingBottleneckTarget,
    thresholds: {
      windowEvents: WINDOW_MIN_EVENTS_FOR_ACTION,
      bottleneckBase: BOTTLENECK_MIN_BASE_FOR_ACTION,
      bottleneckTarget: BOTTLENECK_MIN_TARGET_FOR_ACTION,
      samplePerVariant: MIN_SAMPLE_PER_VARIANT,
      topProductsMinViews: TOP_PRODUCT_MIN_VIEWS,
      topProductsMinCarts: TOP_PRODUCT_MIN_CARTS
    }
  };
}

export function getGrowthInsights({ windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const normalizedWindowDays = Math.max(1, Math.trunc(toNumber(windowDays || DEFAULT_WINDOW_DAYS)));
  const state = readGrowthState();
  const allEvents = pruneEvents(state.events || []);
  const windowEvents = getWindowEvents(allEvents, normalizedWindowDays);
  const funnel = computeFunnel(windowEvents);
  const bottleneck = chooseBottleneck(funnel.stages);
  const bottleneckStage = funnel.stages.find((stage) => stage.id === bottleneck) || funnel.stages[0] || null;
  const dataVolume = evaluateDataVolume({
    windowEventCount: windowEvents.length,
    bottleneckStage
  });
  const experimentEnabled = Boolean(dataVolume.readyForAction);
  const weekKey = getIsoWeekKey();

  const variantPerformance = computeVariantPerformance(windowEvents, bottleneck);
  const fallbackVariantKey = experimentEnabled
    ? getFallbackVariantKey(weekKey, bottleneck)
    : 'control';
  const winnerVariantKey = experimentEnabled
    ? (variantPerformance.winner?.variantKey || '')
    : '';
  const activeVariantKey = winnerVariantKey || fallbackVariantKey;
  const mode = !experimentEnabled
    ? 'collecting_data'
    : (winnerVariantKey ? 'scaled_winner' : 'testing');
  const topProducts = experimentEnabled ? computeTopProducts(windowEvents) : [];

  return {
    windowDays: normalizedWindowDays,
    weekKey,
    counts: funnel.counts,
    funnel: funnel.stages,
    bottleneck,
    bottleneckLabel: GROWTH_BOTTLENECK_LABELS[bottleneck] || GROWTH_BOTTLENECK_LABELS.view_to_cart,
    dataVolume,
    experiment: {
      enabled: experimentEnabled,
      mode,
      variantKey: activeVariantKey,
      winnerVariantKey: winnerVariantKey || null,
      variants: variantPerformance.variants,
      ui: buildExperimentUi(bottleneck, activeVariantKey, { enabled: experimentEnabled })
    },
    topProducts
  };
}

export function getGrowthExperimentContext({ windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const insights = getGrowthInsights({ windowDays });

  return {
    growth_window_days: insights.windowDays,
    growth_week_key: insights.weekKey,
    growth_bottleneck: insights.bottleneck,
    growth_variant_key: insights.experiment.variantKey,
    growth_variant_mode: insights.experiment.mode
  };
}

export function recordGrowthEvent(eventName, properties = {}) {
  const normalizedEventName = cleanText(eventName).toLowerCase();
  if (!RELEVANT_EVENTS.has(normalizedEventName)) {
    return;
  }

  const currentState = readGrowthState();
  const nextEvents = pruneEvents([
    ...(Array.isArray(currentState.events) ? currentState.events : []),
    normalizeEventRecord(normalizedEventName, properties)
  ]);

  writeGrowthState({ events: nextEvents });
  emitGrowthUpdate();
}
