function shouldTrackWebVitals() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (String(import.meta.env.VITE_ENABLE_WEB_VITALS || '').toLowerCase() === 'true') {
    return true;
  }

  return Boolean(import.meta.env.PROD);
}

function normalizeMetric(metric) {
  return {
    name: metric?.name || '',
    value: Number(metric?.value || 0),
    rating: metric?.rating || 'unknown',
    delta: Number(metric?.delta || 0),
    id: metric?.id || '',
    navigationType: metric?.navigationType || 'unknown'
  };
}

function reportMetric(metric) {
  const payload = normalizeMetric(metric);
  const posthogClient = window.posthog;

  if (posthogClient && typeof posthogClient.capture === 'function') {
    posthogClient.capture('web_vital', payload);
    return;
  }

  // Fallback leve para ambiente sem PostHog.
  console.info('[web-vitals]', payload);
}

export async function trackWebVitals() {
  if (!shouldTrackWebVitals()) {
    return;
  }

  try {
    const { onCLS, onINP, onLCP } = await import('web-vitals');
    onLCP(reportMetric);
    onCLS(reportMetric);
    onINP(reportMetric);
  } catch (error) {
    console.warn('[web-vitals] monitoramento indisponivel:', error);
  }
}
