/**
 * 媒体二进制 URL（与 axios `baseURL` 规则一致：空或 `/` 表示同源相对路径）。
 */
export function mediaBinaryUrl(code: string): string {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  const path = `/api/v1/media/${encodeURIComponent(code)}`
  if (raw === '' || raw === '/') {
    return path
  }
  return `${raw.replace(/\/$/, '')}${path}`
}
