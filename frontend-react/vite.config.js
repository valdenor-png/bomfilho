import { defineConfig } from 'vite';

const DEV_API_PROXY_TARGET = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: DEV_API_PROXY_TARGET,
        changeOrigin: true
      }
    }
  }
});
