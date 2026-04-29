// dsl/frontend/vite.config.ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Use main frontend components
      '@shared': fileURLToPath(new URL('../../frontend/src', import.meta.url))
    }
  },
  server: {
    port: 8106,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8105',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
