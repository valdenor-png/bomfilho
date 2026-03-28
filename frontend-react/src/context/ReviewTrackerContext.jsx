import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPedidoRevisaoAtiva, getPedidoStatus } from '../lib/api';
import { useToast } from './ToastContext';

const REVIEW_TRACKER_STORAGE_KEY = 'bf_review_tracker_v1';
const REVIEW_TRACKER_TTL_MS = 24 * 60 * 60 * 1000;
const REVIEW_TRACKER_POLL_MS = 8000;
const REVIEW_ACTIVE_STATUSES = new Set(['aguardando_revisao', 'pendente', 'pagamento_recusado']);

const ReviewTrackerContext = createContext(null);

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isStatusActiveForReviewFlow(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return REVIEW_ACTIVE_STATUSES.has(status);
}

function mapReviewStateFromStatus(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();

  if (status === 'aguardando_revisao') {
    return 'em_revisao';
  }

  if (status === 'pendente' || status === 'pagamento_recusado') {
    return 'aprovado';
  }

  if (status === 'cancelado') {
    return 'nao_aprovado';
  }

  if (status === 'expirado') {
    return 'expirado';
  }

  if (status === 'pago') {
    return 'pago';
  }

  return 'finalizado';
}

function mapReviewMessageByState(reviewState) {
  const state = String(reviewState || '').trim().toLowerCase();

  if (state === 'em_revisao') {
    return 'A equipe está validando os itens do seu pedido. Você pode continuar navegando sem perder o acompanhamento.';
  }

  if (state === 'aprovado') {
    return 'Pedido aprovado na revisão. O pagamento já está liberado para você continuar.';
  }

  if (state === 'nao_aprovado') {
    return 'Seu pedido não foi aprovado na revisão. Confira os detalhes para ajustar o carrinho.';
  }

  if (state === 'expirado') {
    return 'O prazo de revisão expirou. Confira os detalhes para seguir com um novo pedido.';
  }

  if (state === 'pago') {
    return 'Pagamento confirmado. Agora seguimos para separação e entrega.';
  }

  return 'Status do pedido atualizado.';
}

function normalizeTrackerPayload(data = {}, previous = null) {
  const orderId = toNumber(data?.id || data?.pedido_id || previous?.orderId || 0);
  const status = String(data?.status || previous?.status || '').trim().toLowerCase();
  const backendReviewStateRaw = String(data?.review_state || '').trim().toLowerCase();
  const backendReviewState = backendReviewStateRaw === 'aprovado_para_pagamento'
    ? 'aprovado'
    : backendReviewStateRaw;
  const reviewState = backendReviewState || mapReviewStateFromStatus(status);
  const reviewMessage = String(data?.review_message || '').trim() || mapReviewMessageByState(reviewState);

  return {
    orderId,
    status,
    reviewState,
    reviewMessage,
    canProceedPayment: Boolean(data?.can_proceed_payment || status === 'pendente' || status === 'pagamento_recusado'),
    estimatedReviewMaxMinutes: Number(data?.estimated_review_max_minutes || 5),
    formaPagamento: String(data?.forma_pagamento || previous?.formaPagamento || '').trim().toLowerCase(),
    tipoEntrega: String(data?.tipo_entrega || previous?.tipoEntrega || '').trim().toLowerCase(),
    total: Number(data?.total || previous?.total || 0),
    revisaoObs: String(data?.revisao_obs || previous?.revisaoObs || '').trim(),
    atualizadoEm: data?.atualizado_em || data?.updated_at || nowIso(),
    lastSyncAt: nowIso(),
    pollError: '',
    trackedAt: previous?.trackedAt || nowIso()
  };
}

function parseStorageTracker() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REVIEW_TRACKER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const trackedAtMs = Number(new Date(parsed.trackedAt || 0).getTime());
    const expired = !Number.isFinite(trackedAtMs)
      || trackedAtMs <= 0
      || (Date.now() - trackedAtMs) > REVIEW_TRACKER_TTL_MS;

    if (expired) {
      window.localStorage.removeItem(REVIEW_TRACKER_STORAGE_KEY);
      return null;
    }

    const trackerNormalizado = normalizeTrackerPayload(parsed, null);
    if (!trackerNormalizado?.orderId || !isStatusActiveForReviewFlow(trackerNormalizado.status)) {
      window.localStorage.removeItem(REVIEW_TRACKER_STORAGE_KEY);
      return null;
    }

    return trackerNormalizado;
  } catch {
    return null;
  }
}

function persistStorageTracker(tracker) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!tracker || !tracker.orderId) {
      window.localStorage.removeItem(REVIEW_TRACKER_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(REVIEW_TRACKER_STORAGE_KEY, JSON.stringify(tracker));
  } catch {
    // Não bloqueia experiência por erro de storage.
  }
}

export function ReviewTrackerProvider({ children }) {
  const toast = useToast();
  const [tracker, setTracker] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const lastNotifiedRef = useRef('');
  const trackerPollAbortRef = useRef(null);
  const trackerPollInFlightRef = useRef(false);

  useEffect(() => {
    const fromStorage = parseStorageTracker();
    if (fromStorage?.orderId) {
      setTracker(fromStorage);
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    return () => {
      if (trackerPollAbortRef.current) {
        trackerPollAbortRef.current.abort();
        trackerPollAbortRef.current = null;
      }
      trackerPollInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    persistStorageTracker(tracker);
  }, [hydrated, tracker]);

  const trackOrder = useCallback((orderIdRaw, seed = {}) => {
    const orderId = toNumber(orderIdRaw);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return;
    }

    let shouldCollapse = false;

    setTracker((current) => {
      const merged = normalizeTrackerPayload({
        ...current,
        ...seed,
        id: orderId,
        pedido_id: orderId,
        status: seed?.status || current?.status || 'aguardando_revisao'
      }, current);

      if (!merged?.orderId || !isStatusActiveForReviewFlow(merged.status)) {
        shouldCollapse = true;
        return null;
      }

      return merged;
    });

    if (shouldCollapse) {
      setExpanded(false);
    }
  }, []);

  const clearTracking = useCallback(() => {
    if (trackerPollAbortRef.current) {
      trackerPollAbortRef.current.abort();
      trackerPollAbortRef.current = null;
    }
    trackerPollInFlightRef.current = false;
    setTracker(null);
    setExpanded(false);
    persistStorageTracker(null);
  }, []);

  const applyIncomingStatus = useCallback((incomingData) => {
    let shouldCollapse = false;

    setTracker((current) => {
      const merged = current?.orderId
        ? normalizeTrackerPayload(incomingData, current)
        : normalizeTrackerPayload(incomingData, null);

      if (!merged?.orderId || !isStatusActiveForReviewFlow(merged.status)) {
        shouldCollapse = true;
        return null;
      }

      const previousKey = `${current?.status || ''}|${current?.reviewState || ''}`;
      const nextKey = `${merged.status}|${merged.reviewState}`;

      if (previousKey !== nextKey && lastNotifiedRef.current !== nextKey) {
        if (merged.reviewState === 'aprovado') {
          toast.success(`Pedido #${merged.orderId} aprovado. Você já pode ir para o pagamento.`);
        } else if (merged.reviewState === 'nao_aprovado') {
          toast.error(`Pedido #${merged.orderId} não foi aprovado na revisão.`);
        } else if (merged.reviewState === 'expirado') {
          toast.error(`Pedido #${merged.orderId} expirou durante a revisão.`);
        } else if (merged.reviewState === 'em_revisao' && current?.status !== 'aguardando_revisao') {
          toast.info(`Pedido #${merged.orderId} voltou para revisão.`);
        }

        lastNotifiedRef.current = nextKey;
      }

      return merged;
    });

    if (shouldCollapse) {
      setExpanded(false);
    }
  }, [toast]);

  const refreshStatus = useCallback(async () => {
    if (!tracker?.orderId || trackerPollInFlightRef.current) {
      return null;
    }

    trackerPollInFlightRef.current = true;
    if (trackerPollAbortRef.current) {
      trackerPollAbortRef.current.abort();
    }
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    trackerPollAbortRef.current = abortController;

    try {
      const data = await getPedidoStatus(tracker.orderId, {
        signal: abortController?.signal
      });
      applyIncomingStatus(data || {});
      return data;
    } catch (error) {
      const erroCancelado = error?.name === 'AbortError'
        || error?.code === 'API_ABORTED'
        || Number(error?.status || 0) === 499;
      if (erroCancelado) {
        return null;
      }

      setTracker((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          pollError: String(error?.message || 'Falha temporária para atualizar status.'),
          lastSyncAt: nowIso()
        };
      });
      return null;
    } finally {
      if (trackerPollAbortRef.current === abortController) {
        trackerPollAbortRef.current = null;
      }
      trackerPollInFlightRef.current = false;
    }
  }, [applyIncomingStatus, tracker?.orderId]);

  useEffect(() => {
    if (!hydrated || tracker?.orderId) {
      return;
    }

    // Não executar em rotas administrativas — o admin usa bf_admin_token, não bf_access_token.
    // Chamar esta rota de cliente sem autenticação de cliente gera 401 desnecessário.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return;
    }

    let ativo = true;
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    async function bootstrapFromBackend() {
      try {
        const data = await getPedidoRevisaoAtiva({
          signal: abortController?.signal
        });
        const pedido = data?.pedido || null;

        if (!ativo || !pedido?.id) {
          return;
        }

        setTracker((current) => {
          if (current?.orderId) {
            return current;
          }

          const normalized = normalizeTrackerPayload(pedido, null);
          return normalized?.orderId && isStatusActiveForReviewFlow(normalized.status)
            ? normalized
            : null;
        });
      } catch (error) {
        const erroCancelado = error?.name === 'AbortError'
          || error?.code === 'API_ABORTED'
          || Number(error?.status || 0) === 499;
        if (erroCancelado) {
          return;
        }

        // Não bloqueia a aplicação quando a retomada automática falha.
      }
    }

    void bootstrapFromBackend();

    return () => {
      ativo = false;
      abortController?.abort();
    };
  }, [hydrated, tracker?.orderId]);

  useEffect(() => {
    if (!tracker?.orderId) {
      return undefined;
    }

    let ativo = true;

    const run = async () => {
      const data = await refreshStatus();
      if (!ativo || !data) {
        return;
      }
    };

    void run();

    const interval = window.setInterval(() => {
      void run();
    }, REVIEW_TRACKER_POLL_MS);

    return () => {
      ativo = false;
      window.clearInterval(interval);
      if (trackerPollAbortRef.current) {
        trackerPollAbortRef.current.abort();
        trackerPollAbortRef.current = null;
      }
      trackerPollInFlightRef.current = false;
    };
  }, [refreshStatus, tracker?.orderId]);

  const value = useMemo(() => {
    return {
      tracker,
      expanded,
      setExpanded,
      trackOrder,
      clearTracking,
      refreshStatus,
      isTracking: Boolean(tracker?.orderId)
    };
  }, [clearTracking, expanded, refreshStatus, trackOrder, tracker]);

  return (
    <ReviewTrackerContext.Provider value={value}>
      {children}
    </ReviewTrackerContext.Provider>
  );
}

export function useReviewTracker() {
  const context = useContext(ReviewTrackerContext);
  if (!context) {
    throw new Error('useReviewTracker deve ser usado dentro de ReviewTrackerProvider');
  }
  return context;
}
