import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { CartProvider } from './context/CartContext';
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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CartProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </CartProvider>
  </React.StrictMode>
);
