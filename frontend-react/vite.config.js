import { defineConfig, loadEnv } from 'vite';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiProxyTarget = String(env.VITE_DEV_API_PROXY_TARGET || '').trim() || 'http://localhost:3000';
  const devAdminApiProxyTarget = String(env.VITE_DEV_ADMIN_API_PROXY_TARGET || '').trim() || 'http://localhost:3000';
  const apiUrl = String(env.VITE_API_URL || '').trim();

  if (mode !== 'development' && !apiUrl) {
    throw new Error('VITE_API_URL is required for preview/production builds.');
  }

  return {
    envPrefix: 'VITE_',
    server: {
      port: 5173,
      proxy: {
        '/api/admin': {
          target: devAdminApiProxyTarget,
          changeOrigin: true
        },
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter(
            (dep) => !dep.includes('admin') && !dep.includes('vendor-xlsx')
          )
      },
      rollupOptions: {
        output: {
          manualChunks: criarManualChunks
        }
      }
    }
  };
});
