// "Contact us" form: each message is stored for the admin page, then sent to the admins' LINE.
import { CONTACT_SUBJECTS } from '@shared/settings'
import { isValidThaiMobile } from '@shared/identity'
import type { ContactMessageEntry } from '@shared/types'
import type { ContactMessageRow, UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { notifyLine } from './notify'
import { getSettings } from './settings'
import { digits, isEmail } from './users'

export interface ContactInput {
  name: string
  email?: string
  phone?: string
  subject: string
  message: string
  /** Hidden field only bots fill in. */
  website?: string
}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

export async function sendContactMessage(ctx: AppContext, input: ContactInput, user: UserRow | null, siteUrl: string) {
  const { contact } = await getSettings(ctx)
  if (!contact.formEnabled) throw forbidden('ปิดรับข้อความทางฟอร์มชั่วคราว กรุณาติดต่อทางช่องทางอื่น')
  // Bots get a normal answer so they don't retry.
  if (text(input.website, 200)) return { sent: true }

  const name = text(input.name, 100)
  const email = text(input.email, 200).toLowerCase()
  const phone = digits(text(input.phone, 30))
  const subject = CONTACT_SUBJECTS.includes(text(input.subject, 100)) ? text(input.subject, 100) : 'อื่นๆ'
  const message = text(input.message, 2000)
  if (!name) throw badRequest('กรุณากรอกชื่อ')
  if (!email && !phone) throw badRequest('กรุณากรอกอีเมลหรือเบอร์โทรศัพท์อย่างน้อย 1 ช่องทาง เพื่อให้ทีมงานติดต่อกลับ')
  if (email && !isEmail(email)) throw badRequest('อีเมลไม่ถูกต้อง')
  if (phone && !isValidThaiMobile(phone) && !/^0\d{8}$/.test(phone)) throw badRequest('เบอร์โทรศัพท์ไม่ถูกต้อง')
  if (message.length < 5) throw badRequest('กรุณาพิมพ์ข้อความที่ต้องการติดต่อ')

  const id = newId('msg')
  const createdAt = nowIso()
  await ctx.db
    .insertInto('contact_messages')
    .values({
      id,
      created_at: createdAt,
      name,
      email: email || null,
      phone: phone || null,
      subject,
      message,
      user_id: user?.id ?? null,
      status: 'new',
      admin_note: null,
      handled_by: null,
      handled_at: null,
    })
    .execute()

  const at = new Date(createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
  const lines = [
    '📨 ข้อความจากฟอร์มติดต่อเรา',
    `เรื่อง: ${subject}`,
    `ชื่อ: ${name}`,
    email ? `อีเมล: ${email}` : null,
    phone ? `โทร: ${phone}` : null,
    user ? `บัญชีผู้ใช้: ${user.name} (${user.email})` : 'บัญชีผู้ใช้: ไม่ได้เข้าสู่ระบบ',
    '',
    message,
    '',
    `เวลา: ${at}`,
    siteUrl ? `ดูทั้งหมด: ${siteUrl}/#admin/messages` : null,
  ]
  notifyLine(ctx, lines.filter((l) => l !== null).join('\n'), 'contact.message')
  return { sent: true }
}

function toEntry(row: ContactMessageRow, userName: string | null): ContactMessageEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    subject: row.subject,
    message: row.message,
    userId: row.user_id,
    userName,
    status: row.status === 'done' ? 'done' : 'new',
    adminNote: row.admin_note ?? '',
    handledBy: row.handled_by,
    handledAt: row.handled_at,
  }
}

/** The latest messages, newest first, with the sender's account name. */
export async function listContactMessages(ctx: AppContext, limit = 500): Promise<ContactMessageEntry[]> {
  const rows = await ctx.db
    .selectFrom('contact_messages')
    .leftJoin('users', 'users.id', 'contact_messages.user_id')
    .selectAll('contact_messages')
    .select('users.name as user_name')
    .orderBy('contact_messages.created_at', 'desc')
    .limit(limit)
    .execute()
  return rows.map(({ user_name, ...row }) => toEntry(row, user_name ?? null))
}

/** An admin marks a message done (or back to new), with an optional note for the other admins. */
export async function updateContactMessage(ctx: AppContext, admin: UserRow, id: string, input: { status?: unknown; note?: unknown }) {
  const row = await ctx.db.selectFrom('contact_messages').selectAll().where('id', '=', id).executeTakeFirst()
  if (!row) throw notFound('ไม่พบข้อความ')
  const status = input.status === 'done' ? 'done' : 'new'
  const note = text(input.note, 500) || null
  const done = status === 'done'
  await ctx.db
    .updateTable('contact_messages')
    .set({ status, admin_note: note, handled_by: done ? admin.name : null, handled_at: done ? nowIso() : null })
    .where('id', '=', id)
    .execute()
  await audit(ctx.db, admin, done ? 'จัดการข้อความติดต่อแล้ว' : 'เปิดข้อความติดต่ออีกครั้ง', `${row.name} · ${row.subject}${note ? ` · ${note}` : ''}`)
  return { ok: true }
}
