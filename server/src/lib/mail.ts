// Email over SMTP (e.g. the domain's mailbox in Plesk), used for password reset codes.
import nodemailer, { type Transporter } from 'nodemailer'
import { ApiError } from './errors'

export interface MailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

let transporter: Transporter | undefined

/** Sends one plain-text email; throws a 502 the client can show when SMTP fails. */
export async function sendMail(mail: MailConfig, to: string, subject: string, text: string): Promise<void> {
  if (!mail.host) throw new ApiError(503, 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
  transporter ??= nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    connectionTimeout: 15_000,
  })
  try {
    await transporter.sendMail({ from: mail.from || mail.user, to, subject, text })
  } catch (err) {
    console.error('[mail] SMTP send failed:', err)
    throw new ApiError(502, 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
  }
}
