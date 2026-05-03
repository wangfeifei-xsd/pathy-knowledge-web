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

const STORAGE_KEY = 'pathy_api_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(STORAGE_KEY, token)
  else localStorage.removeItem(STORAGE_KEY)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '',
  timeout: 120_000,
})

api.interceptors.request.use((config) => {
  const t = getStoredToken()
  if (t) {
    config.headers.Authorization = `Bearer ${t}`
  }
  return config
})
