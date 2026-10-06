// Thin client for the 500 Windows API (server/). Same origin in production; in development
// Vite proxies /api and /uploads to the API server (see vite.config.ts).

export type ApiResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string; status?: number; requiresKYC?: boolean; quotaExceeded?: boolean }

const OFFLINE = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง'

export async function api<T extends object = object>(method: 'GET' | 'POST' | 'PATCH' | 'PUT', path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
    const json = await res.json().catch(() => null)
    if (!json || typeof json.success !== 'boolean') {
      return { success: false, status: res.status, error: res.ok ? 'คำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง' : `เซิร์ฟเวอร์ขัดข้อง (${res.status})` }
    }
    return json.success ? json : { ...json, status: res.status }
  } catch {
    return { success: false, error: OFFLINE }
  }
}

export const get = <T extends object>(path: string) => api<T>('GET', path)
export const post = <T extends object>(path: string, body?: unknown) => api<T>('POST', path, body)
export const patch = <T extends object>(path: string, body?: unknown) => api<T>('PATCH', path, body)
export const put = <T extends object>(path: string, body?: unknown) => api<T>('PUT', path, body)
