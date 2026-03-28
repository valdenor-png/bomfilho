import { useEffect, useRef } from 'react';
import API_BASE_URL from '../config/api';

const USER_TOKEN_KEY = 'bf_user_access_token';

function getUserToken() {
  try {
    return String(localStorage.getItem(USER_TOKEN_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Hook que abre uma conexão SSE para receber atualizações de status
 * de um pedido em tempo real.
 *
 * Substitui polling por push — o backend envia eventos quando o
 * status muda (via webhook MP ou ação do admin).
 *
 * Fallback: se SSE falhar ou não estiver disponível, retorna
 * para o caller decidir (não faz polling internamente).
 *
 * @param {number|null} pedidoId - ID do pedido para acompanhar
 * @param {function} onStatusUpdate - callback chamado com { status, pedido_id, timestamp }
 * @param {object} options - { enabled: boolean }
 */
export default function useOrderStream(pedidoId, onStatusUpdate, { enabled = true } = {}) {
  const callbackRef = useRef(onStatusUpdate);
  callbackRef.current = onStatusUpdate;

  useEffect(() => {
    if (!enabled || !pedidoId || typeof EventSource === 'undefined') {
      return;
    }

    const token = getUserToken();
    if (!token) return;

    const url = `${API_BASE_URL}/api/pedidos/${pedidoId}/stream?token=${encodeURIComponent(token)}`;
    let source;

    try {
      source = new EventSource(url);
    } catch {
      return;
    }

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'status_update' && callbackRef.current) {
          callbackRef.current(data);
        }
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      // EventSource reconnects automatically.
      // If the server is down, it will keep retrying.
      // We don't need to do anything here.
    };

    return () => {
      source.close();
    };
  }, [pedidoId, enabled]);
}
