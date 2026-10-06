// Uploaded images arrive as data URLs (the browser downscales them first) and are stored
// as files under UPLOAD_DIR/<folder>/. Public folders are served at /uploads/<folder>/...;
// transfer slips are served only to admins and the payer (see routes/files.ts).
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { badRequest } from './errors'
import { newId } from './crypto'

export type UploadFolder = 'windows' | 'promo' | 'slips' | 'avatars'

const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { ext: 'png', magic: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'image/gif': { ext: 'gif', magic: (b) => b.subarray(0, 3).toString() === 'GIF' },
}

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export const isDataUrl = (value: string) => value.startsWith('data:')

/** Saves a base64 image data URL and returns its public path, e.g. `/uploads/windows/img_x.jpg`. */
export async function saveImage(uploadDir: string, dataUrl: string, folder: UploadFolder): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/)
  const type = match && TYPES[match[1]]
  if (!match || !type) throw badRequest('รองรับเฉพาะไฟล์รูป JPG, PNG, WEBP หรือ GIF')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > MAX_IMAGE_BYTES) throw badRequest('ไฟล์รูปใหญ่เกิน 3 MB กรุณาลดขนาดรูป')
  if (!type.magic(bytes)) throw badRequest('ไฟล์รูปไม่ถูกต้อง')

  const name = `${newId('img')}.${type.ext}`
  const dir = path.join(uploadDir, folder)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), bytes)
  return `/uploads/${folder}/${name}`
}

/** Absolute file path for a stored `/uploads/...` path, or null if it is not one. */
export function uploadFilePath(uploadDir: string, publicPath: string): string | null {
  const match = publicPath.match(/^\/uploads\/(windows|promo|slips|avatars)\/(img_[A-Za-z0-9_-]+\.(jpg|png|webp|gif))$/)
  return match ? path.join(uploadDir, match[1], match[2]) : null
}
