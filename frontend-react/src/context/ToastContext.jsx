import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { X } from '../icons';

const ToastContext = createContext(null);

const TOAST_DURATION_MS = 3500;
let toastIdCounter = 0;

/**
 * Tipos suportados: 'success' | 'error' | 'info'
 * Cada toast: { id, message, type, visible }
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback((message, type = 'info', durationMs = TOAST_DURATION_MS) => {
    const id = ++toastIdCounter;
    setToasts((current) => [...current.slice(-4), { id, message, type }]);

    timersRef.current[id] = setTimeout(() => {
      dismiss(id);
    }, durationMs);

    return id;
  }, [dismiss]);

  const success = useCallback((msg, ms) => show(msg, 'success', ms), [show]);
  const error = useCallback((msg, ms) => show(msg, 'error', ms), [show]);
  const info = useCallback((msg, ms) => show(msg, 'info', ms), [show]);

  const value = useMemo(() => ({ show, success, error, info, dismiss }), [show, success, error, info, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div className="toast-container" aria-live="polite" role="status">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-item is-${toast.type}`}>
              <span className="toast-message">{toast.message}</span>
              <button
                className="toast-dismiss"
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar notificação"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de ToastProvider');
  }
  return context;
}
