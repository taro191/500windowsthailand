// Admin document library: files are stored under UPLOAD_DIR/documents/<id>.<ext> and are only
// ever sent to admins, always as downloads (images may also be shown inline as previews).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ADMIN_FILE_MAX_BYTES, ADMIN_FILE_TYPES, adminFileExt, type AdminFile } from '@shared/adminFiles'
import type { UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'

type Admin = Pick<UserRow, 'id' | 'name'>
type Row = { id: string; name: string; ext: string; size: number; note: string; uploaded_by: string; created_at: string }

const MB = 1024 * 1024
const filePath = (uploadDir: string, row: Pick<Row, 'id' | 'ext'>) => path.join(uploadDir, 'documents', `${row.id}.${row.ext}`)

const toDto = (row: Row): AdminFile => ({
  id: row.id,
  name: row.name,
  ext: row.ext,
  size: row.size,
  note: row.note,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
})

const OLE = 'd0cf11e0a1b11ae1'
/** The first bytes must match the extension, so a renamed file of another type is refused. */
function matchesType(ext: string, b: Buffer): boolean {
  const hex = b.subarray(0, 8).toString('hex')
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return b[0] === 0xff && b[1] === 0xd8
    case 'png':
      return hex.startsWith('89504e47')
    case 'gif':
      return b.subarray(0, 3).toString() === 'GIF'
    case 'webp':
      return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'
    case 'pdf':
      return b.subarray(0, 5).toString() === '%PDF-'
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return hex.startsWith('504b0304') || hex.startsWith('504b0506')
    case 'doc':
    case 'xls':
    case 'ppt':
      return hex === OLE
    case 'txt':
    case 'csv':
      return !b.subarray(0, 8192).includes(0)
    default:
      return false
  }
}

/** Keeps the name readable but safe for headers and file systems. */
const cleanName = (name: string) =>
  String(name ?? '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f"<>|*?:]/g, '')
    .trim()
    .slice(0, 150)

export async function listFiles(ctx: AppContext): Promise<AdminFile[]> {
  const rows = await ctx.db.selectFrom('admin_files').selectAll().orderBy('created_at', 'desc').execute()
  return rows.map(toDto)
}

export async function uploadFile(ctx: AppContext, admin: Admin, input: { name?: string; data?: string; note?: string }): Promise<AdminFile> {
  const name = cleanName(input.name ?? '')
  const ext = adminFileExt(name)
  if (!name || !ext) throw badRequest('ชื่อไฟล์ไม่ถูกต้อง')
  if (!(ext in ADMIN_FILE_TYPES)) throw badRequest(`ไม่รองรับไฟล์ .${ext} (รองรับ ${Object.keys(ADMIN_FILE_TYPES).join(', ')})`)
  const bytes = Buffer.from(String(input.data ?? '').replace(/^data:[^,]*,/, ''), 'base64')
  if (!bytes.length) throw badRequest('ไฟล์ว่างเปล่า')
  if (bytes.length > ADMIN_FILE_MAX_BYTES) throw badRequest(`ไฟล์ใหญ่เกิน ${ADMIN_FILE_MAX_BYTES / MB} MB`)
  if (!matchesType(ext, bytes)) throw badRequest(`เนื้อหาไฟล์ไม่ตรงกับนามสกุล .${ext}`)

  const row: Row = {
    id: newId('file'),
    name,
    ext,
    size: bytes.length,
    note: String(input.note ?? '').trim().slice(0, 300),
    uploaded_by: admin.name.slice(0, 120),
    created_at: nowIso(),
  }
  const target = filePath(ctx.config.uploadDir, row)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)
  try {
    await ctx.db.insertInto('admin_files').values(row).execute()
  } catch (error) {
    await rm(target, { force: true }).catch(() => {})
    throw error
  }
  await audit(ctx.db, admin, 'อัปโหลดเอกสาร', `${name} (${(bytes.length / MB).toFixed(2)} MB)`)
  return toDto(row)
}

const findRow = async (ctx: AppContext, id: string) => {
  const row = await ctx.db.selectFrom('admin_files').selectAll().where('id', '=', id).executeTakeFirst()
  if (!row) throw notFound('ไม่พบไฟล์นี้')
  return row
}

export async function readAdminFile(ctx: AppContext, id: string) {
  const row = await findRow(ctx, id)
  try {
    return { file: toDto(row), mime: ADMIN_FILE_TYPES[row.ext].mime, data: await readFile(filePath(ctx.config.uploadDir, row)) }
  } catch {
    throw notFound('ไม่พบไฟล์นี้ในที่เก็บไฟล์')
  }
}

export async function updateNote(ctx: AppContext, admin: Admin, id: string, note: string): Promise<AdminFile> {
  const row = await findRow(ctx, id)
  const clean = String(note ?? '').trim().slice(0, 300)
  await ctx.db.updateTable('admin_files').set({ note: clean }).where('id', '=', id).execute()
  await audit(ctx.db, admin, 'แก้คำอธิบายเอกสาร', row.name)
  return toDto({ ...row, note: clean })
}

export async function deleteFile(ctx: AppContext, admin: Admin, id: string) {
  const row = await findRow(ctx, id)
  await ctx.db.deleteFrom('admin_files').where('id', '=', id).execute()
  await rm(filePath(ctx.config.uploadDir, row), { force: true }).catch(() => {})
  await audit(ctx.db, admin, 'ลบเอกสาร', row.name)
}
