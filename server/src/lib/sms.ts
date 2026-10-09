// SMS through THSMS (https://www.thsms.com/sms-api), used for KYC OTP when OTP_MODE=sms.
import { ApiError } from './errors'

const SEND_URL = 'https://thsms.com/api/send-sms'

export interface SmsConfig {
  token: string
  sender: string
}

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
    throw new ApiError(502, 'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }
  console.error(`[sms] THSMS refused (HTTP ${status}):`, reply?.message ?? reply)
  throw new ApiError(502, 'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
}
