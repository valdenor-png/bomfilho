import { defineConfig } from 'vite';

const DEV_API_PROXY_TARGET = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000';

function criarManualChunks(id) {
  const caminhoNormalizado = id.replace(/\\/g, '/');

  if (caminhoNormalizado.includes('/src/lib/importacaoPlanilha.js')) {
    return 'admin-importacao-planilha';
  }

  if (!caminhoNormalizado.includes('/node_modules/')) {
    return undefined;
  }

  if (caminhoNormalizado.includes('xlsx')) {
    return 'vendor-xlsx';
  }

  if (caminhoNormalizado.includes('qrcode')) {
    return 'vendor-qrcode';
  }

  if (caminhoNormalizado.includes('react-google-recaptcha')) {
    return 'vendor-recaptcha';
  }

  if (caminhoNormalizado.includes('react-window')) {
    return 'vendor-virtualized';
  }

  if (caminhoNormalizado.includes('react-router-dom') || caminhoNormalizado.includes('@remix-run/router')) {
    return 'vendor-router';
  }

  if (caminhoNormalizado.includes('react-dom') || caminhoNormalizado.includes('/react/')) {
    return 'vendor-react';
  }

  return undefined;
}

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: DEV_API_PROXY_TARGET,
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: criarManualChunks
      }
    }
  }
});
