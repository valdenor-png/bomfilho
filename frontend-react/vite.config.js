import { defineConfig } from 'vite';

const buildId = process.env.VITE_BUILD_ID || Date.now().toString(36);

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-' + buildId + '-[hash].js',
        chunkFileNames: 'assets/[name]-' + buildId + '-[hash].js',
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name ? assetInfo.name.split('.').pop() : 'asset';
          return 'assets/[name]-' + buildId + '-[hash].' + ext;
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
