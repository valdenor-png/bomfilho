import { defineConfig, loadEnv } from 'vite';

function criarManualChunks(id) {
  const caminhoNormalizado = id.replace(/\\/g, '/');

  if (!caminhoNormalizado.includes('/node_modules/')) {
    return undefined;
  }

  if (caminhoNormalizado.includes('firebase') || caminhoNormalizado.includes('@firebase')) {
    return 'vendor-firebase';
  }

  if (caminhoNormalizado.includes('qrcode')) {
    return 'vendor-qrcode';
  }

  if (caminhoNormalizado.includes('react-window')) {
    return 'vendor-virtualized';
  }

  if (caminhoNormalizado.includes('lucide-react')) {
    return 'vendor-icons';
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
  const apiUrl = String(env.VITE_API_URL || '').trim();

  if (mode !== 'development' && !apiUrl) {
    throw new Error('VITE_API_URL is required for preview/production builds.');
  }

  return {
    envPrefix: 'VITE_',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: criarManualChunks
        }
      }
    }
  };
});
