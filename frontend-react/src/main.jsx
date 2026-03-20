import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { CartProvider } from './context/CartContext';
import { RecorrenciaProvider } from './context/RecorrenciaContext';
import { ToastProvider } from './context/ToastContext';
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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <CartProvider>
        <RecorrenciaProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </RecorrenciaProvider>
      </CartProvider>
    </ToastProvider>
  </React.StrictMode>
);
