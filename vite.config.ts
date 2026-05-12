import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_DEV_PROXY_TARGET ?? 'http://127.0.0.1:8765'

/** 与 agent-plant-ui 的 `/agentplatform/` 类似：静态资源与入口 HTML 挂在站点子路径下。默认 `/wiki/`；本地根路径开发可设 `VITE_BASE=/`。 */
function normalizeBase(v: string | undefined): string {
  if (v === undefined || v === '') return '/wiki/'
  const t = v.trim()
  if (t === '/') return '/'
  return t.endsWith('/') ? t : `${t}/`
}

const base = normalizeBase(process.env.VITE_BASE)

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // 与 base 同名输出目录，便于整包部署到 Nginx 的 `/wiki/` 等路径（可用 VITE_OUT_DIR 覆盖）
    outDir: process.env.VITE_OUT_DIR?.trim() || 'wiki',
  },
  server: {
    proxy: {
      '/api': API_TARGET,
      '/openapi.json': API_TARGET,
      '/docs': API_TARGET,
      '/redoc': API_TARGET,
    },
  },
})
