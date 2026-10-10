// LINE Messaging API (https://developers.line.biz/en/reference/messaging-api/): pushes alerts to
// the finance admin's LINE through the site's LINE Official Account. LINE Notify no longer exists.
import { createHmac, timingSafeEqual } from 'node:crypto'

const PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const REPLY_URL = 'https://api.line.me/v2/bot/message/reply'

export interface LineConfig {
  /** Channel access token (long-lived) of the Messaging API channel. */
  token: string
  /** Channel secret, to check that webhook calls come from LINE. */
  secret: string
  /** User IDs (U…) or group IDs (C…) that receive the alerts. */
  to: string[]
}

export const lineReady = (line: LineConfig) => !!line.token && line.to.length > 0

async function call(token: string, url: string, body: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.ok) return
  const reply = (await res.json().catch(() => undefined)) as { message?: string; details?: { message?: string }[] } | undefined
  const detail = [reply?.message, ...(reply?.details ?? []).map((d) => d.message)].filter(Boolean).join(' · ')
  throw new Error(`LINE HTTP ${res.status}${detail ? `: ${detail}` : ''}`)
}

/** Sends one text to every recipient; resolves with the recipients that failed and why. */
export async function pushLine(line: LineConfig, text: string): Promise<{ to: string; error: string }[]> {
  const failures: { to: string; error: string }[] = []
  for (const to of line.to) {
    try {
      await call(line.token, PUSH_URL, { to, messages: [{ type: 'text', text: text.slice(0, 5000) }] })
    } catch (err) {
      failures.push({ to, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return failures
}

export const replyLine = (line: LineConfig, replyToken: string, text: string) =>
  call(line.token, REPLY_URL, { replyToken, messages: [{ type: 'text', text }] })

/** True when the X-Line-Signature header matches the raw request body. */
export function validLineSignature(secret: string, rawBody: string, signature: string | undefined) {
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const given = Buffer.from(signature, 'base64')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
