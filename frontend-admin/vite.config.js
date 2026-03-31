import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiProxyTarget = String(env.VITE_DEV_API_PROXY_TARGET || '').trim() || 'http://localhost:3000';
  const apiUrl = String(env.VITE_API_URL || '').trim();

  if (mode !== 'development' && !apiUrl) {
    throw new Error('VITE_API_URL is required for preview/production builds.');
  }

  return {
    envPrefix: 'VITE_',
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const path = id.replace(/\\/g, '/');
            if (path.includes('/src/lib/importacaoPlanilha.js')) return 'admin-importacao';
            if (!path.includes('/node_modules/')) return undefined;
            if (path.includes('xlsx')) return 'vendor-xlsx';
            if (path.includes('react-router-dom') || path.includes('@remix-run/router')) return 'vendor-router';
            if (path.includes('react-dom') || path.includes('/react/')) return 'vendor-react';
            return undefined;
          }
        }
      }
    }
  };
});
