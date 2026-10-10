// SMS through THSMS (https://www.thsms.com/sms-api), used for KYC OTP when OTP_MODE=sms.
import { ApiError } from './errors'

const SEND_URL = 'https://thsms.com/api/send-sms'
const ME_URL = 'https://thsms.com/api/me'

export interface SmsConfig {
  token: string
  sender: string
}

/** The last refusal from THSMS, so a super admin can see why without server logs. */
let lastFailure: { at: string; httpStatus: number; message: string } | null = null

/** Sends one SMS; throws a 502 the client can show when THSMS refuses or doesn't answer. */
export async function sendSms(sms: SmsConfig, phone: string, message: string): Promise<void> {
  if (!sms.token) throw new ApiError(503, 'ระบบส่ง SMS ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
  let reply: { success?: boolean; message?: string } | undefined
  let status = 0
  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sms.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: sms.sender, msisdn: [phone], message }),
      signal: AbortSignal.timeout(15_000),
    })
    status = res.status
    reply = (await res.json().catch(() => undefined)) as typeof reply
    if (res.ok && reply?.success) return
  } catch (err) {
    console.error('[sms] THSMS request failed:', err)
    lastFailure = { at: new Date().toISOString(), httpStatus: 0, message: String(err) }
    throw new ApiError(502, 'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }
  console.error(`[sms] THSMS refused (HTTP ${status}):`, reply?.message ?? reply)
  lastFailure = { at: new Date().toISOString(), httpStatus: status, message: describe(reply) }
  throw new ApiError(502, 'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
}

/** Asks THSMS whether the token works and how much credit is left. Never returns the token. */
export async function smsStatus(sms: SmsConfig) {
  const base = { configured: !!sms.token, tokenLength: sms.token.length, sender: sms.sender, lastFailure }
  if (!sms.token) return { ...base, account: null }
  try {
    const res = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${sms.token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    const reply = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined
    return { ...base, account: { httpStatus: res.status, ok: res.ok && !!reply?.success, message: describe(reply), credit: findCredit(reply) } }
  } catch (err) {
    return { ...base, account: { httpStatus: 0, ok: false, message: String(err), credit: null } }
  }
}

const describe = (reply: unknown) => {
  const r = reply as { message?: unknown; error?: unknown } | undefined
  return String(r?.message ?? r?.error ?? (reply === undefined ? 'no JSON reply' : JSON.stringify(reply).slice(0, 300)))
}

/** The credit figure wherever THSMS puts it in the reply (only numbers, no account details). */
function findCredit(value: unknown, depth = 0): number | string | null {
  if (!value || typeof value !== 'object' || depth > 3) return null
  for (const [key, v] of Object.entries(value)) {
    if (/credit/i.test(key) && (typeof v === 'number' || typeof v === 'string')) return v
    const nested = findCredit(v, depth + 1)
    if (nested !== null) return nested
  }
  return null
}
