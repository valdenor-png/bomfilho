import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { CartProvider } from './context/CartContext';
import { RecorrenciaProvider } from './context/RecorrenciaContext';
import { ToastProvider } from './context/ToastContext';
import { ReviewTrackerProvider } from './context/ReviewTrackerContext';
import { trackWebVitals } from './lib/trackWebVitals';
import {
  applyFontScale,
  applyHighContrast,
  applyReducedMotion,
  getStoredFontScale,
  getStoredHighContrast,
  getStoredReducedMotion
} from './lib/accessibility';

applyFontScale(getStoredFontScale());
applyHighContrast(getStoredHighContrast());
applyReducedMotion(getStoredReducedMotion());
void trackWebVitals();

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <CartProvider>
        <RecorrenciaProvider>
          <ReviewTrackerProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <App />
            </BrowserRouter>
          </ReviewTrackerProvider>
        </RecorrenciaProvider>
      </CartProvider>
    </ToastProvider>
  </React.StrictMode>
);
