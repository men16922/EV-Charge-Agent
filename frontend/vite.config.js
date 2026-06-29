import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build output goes to ../dist so Flask (agent.py) serves it from the same
// Cloud Run service. Dev proxy forwards API + chat to the local Flask on :8080
// so `npm run dev` (5173) talks to the real backend without CORS.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8090', changeOrigin: true },
      '/chat': { target: 'http://localhost:8090', changeOrigin: true },
      '/static': { target: 'http://localhost:8090', changeOrigin: true },
    },
  },
})
