import axios from 'axios'

/** 解析 FastAPI 常见错误体 `{ detail: string | [...] }`，用于提示用户。 */
export function apiErrorDetail(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined
  const d = err.response?.data as { detail?: unknown } | undefined
  if (typeof d?.detail === 'string') return d.detail
  if (Array.isArray(d?.detail) && d.detail.length > 0) {
    const first = d.detail[0] as { msg?: string }
    if (typeof first?.msg === 'string') return first.msg
  }
  return undefined
}

/** 与 agent-plant-ui 一致：由 `VITE_API_BASE_URL` 控制；开发环境可留空走 Vite 代理。 */
const BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 120_000) || 120_000

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})
