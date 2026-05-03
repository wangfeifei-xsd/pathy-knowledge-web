import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_DEV_PROXY_TARGET ?? 'http://127.0.0.1:8765'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API_TARGET,
      '/openapi.json': API_TARGET,
      '/docs': API_TARGET,
      '/redoc': API_TARGET,
    },
  },
})
