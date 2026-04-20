/**
 * Vite Configuration for CQL Editor
 *
 * - Dev server proxies /api and /ws to maskservice backend
 * - Production build outputs to dist/ for nginx
 * - legacy/ folder excluded from build (reference only)
 */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'
  const wsTarget = env.VITE_WS_PROXY_TARGET || 'ws://localhost:8080'

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_CQL_PORT) || 3001,
      host: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/ws': { target: wsTarget, ws: true, changeOrigin: true },
      },
      fs: {
        // Keep the extracted TypeScript DSL source out of the module graph.
        deny: ['legacy/**'],
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        // Safety net: explicitly ignore the legacy reference tree.
        external: (id) => id.includes('/cql/legacy/'),
      },
    },
    base: '/',
  }
})
