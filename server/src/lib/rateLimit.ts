import { ApiError } from './errors'

/** In-memory fixed-window limiter (per process; enough to slow down password guessing). */
export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return {
    hit(key: string) {
      const now = Date.now()
      const entry = hits.get(key)
      if (!entry || entry.resetAt <= now) {
        if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return
      }
      entry.count++
      if (entry.count > max) {
        const minutes = Math.ceil((entry.resetAt - now) / 60_000)
        throw new ApiError(429, `ทำรายการบ่อยเกินไป กรุณาลองใหม่ในอีก ${minutes} นาที`)
      }
    },
  }
}
