/**
 * 生产环境常设 VITE_API_BASE_URL=/，表示「当前站点根路径」下转发 API。
 * axios 的 baseURL 为 / 时会正确解析为同源路径；若用 fetch 做 `'/' + '/api/...'` 拼接，
 * 会得到 //api/...，浏览器按协议相对 URL 解析为 https://api/...，触发跨域 CORS 失败。
 */
export function resolveApiBaseForFetch(): string {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (raw === '/' || raw === '') {
    return ''
  }
  return raw.replace(/\/$/, '')
}
