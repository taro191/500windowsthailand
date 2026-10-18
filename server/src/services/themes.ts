// Site themes: zips uploaded by admins (theme.json + optional theme.css + assets/), stored as
// files under UPLOAD_DIR/themes/<id>/ and served at /uploads/themes/<id>/<path>. Which theme each
// scope uses (main site, each region, promo pages) is kept in the settings row 'themes'.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import type { RegionId } from '@shared/types'
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import {
  cleanThemeManifest,
  emptyThemeAssignments,
  resolveThemeUrls,
  THEME_FILE_TYPES,
  THEME_LIMITS,
  THEME_VARIABLE_GROUPS,
  type ActiveTheme,
  type ActiveThemes,
  type ThemeAssignments,
  type ThemeInfo,
} from '@shared/themes'
import type { UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { badRequest, notFound } from '../lib/errors'
import { nowIso, type AppContext } from '../context'
import { audit } from './audit'
import { themePreviewHtml } from './themePreview'

type Admin = Pick<UserRow, 'id' | 'name'>
type ThemeRow = {
  id: string
  name: string
  description: string
  version: string
  author: string
  variables_json: string
  stylesheet: string
  files_json: string
  size: number
  created_at: string
  created_by: string
}

const ASSIGNMENTS_ID = 'themes'
const MB = 1024 * 1024

export const themeDir = (uploadDir: string, id: string) => path.join(uploadDir, 'themes', id)
const publicBase = (id: string) => `/uploads/themes/${id}/`

/** A path inside a theme: letters, digits, `-_.` and spaces per segment, no `..`, a known extension. */
const SEGMENT = /^[A-Za-z0-9_\-. ]{1,80}$/
export const themeFileExt = (file: string) => file.slice(file.lastIndexOf('.') + 1).toLowerCase()
export const isThemeFilePath = (file: string) =>
  file.split('/').every((s) => SEGMENT.test(s) && s !== '.' && s !== '..') && file.length <= 200 && themeFileExt(file) in THEME_FILE_TYPES

function toActive(row: ThemeRow): ActiveTheme {
  return {
    id: row.id,
    name: row.name,
    variables: resolveThemeUrls(JSON.parse(row.variables_json), publicBase(row.id)),
    stylesheet: row.stylesheet ? `${publicBase(row.id)}${row.stylesheet}` : '',
  }
}

function toInfo(row: ThemeRow): ThemeInfo {
  return {
    ...toActive(row),
    description: row.description,
    version: row.version,
    author: row.author,
    files: (JSON.parse(row.files_json) as unknown[]).length,
    size: row.size,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

const findTheme = (ctx: AppContext, id: string) => ctx.db.selectFrom('themes').selectAll().where('id', '=', id).executeTakeFirst()

export async function listThemes(ctx: AppContext): Promise<ThemeInfo[]> {
  const rows = await ctx.db.selectFrom('themes').selectAll().orderBy('created_at', 'desc').execute()
  return rows.map(toInfo)
}

export async function getAssignments(ctx: AppContext): Promise<ThemeAssignments> {
  const row = await ctx.db.selectFrom('settings').select('value_json').where('id', '=', ASSIGNMENTS_ID).executeTakeFirst()
  const stored = row ? (JSON.parse(row.value_json) as Partial<ThemeAssignments>) : {}
  return { ...emptyThemeAssignments(), ...stored, regions: { ...stored.regions } }
}

/** Themes the site applies, for /api/config. */
export async function activeThemes(ctx: AppContext): Promise<ActiveThemes> {
  const assigned = await getAssignments(ctx)
  const ids = [assigned.main, assigned.promo, ...Object.values(assigned.regions)].filter((id): id is string => !!id)
  const rows = ids.length ? await ctx.db.selectFrom('themes').selectAll().where('id', 'in', [...new Set(ids)]).execute() : []
  const byId = new Map(rows.map((r) => [r.id, toActive(r)]))
  const regions: ActiveThemes['regions'] = {}
  for (const region of REGION_IDS) {
    const theme = byId.get(assigned.regions[region] ?? '')
    if (theme) regions[region] = theme
  }
  return { main: byId.get(assigned.main ?? '') ?? null, regions, promo: byId.get(assigned.promo ?? '') ?? null }
}

/** Unpacks and checks an uploaded zip (base64), stores its files and adds it to the library. */
export async function uploadTheme(ctx: AppContext, admin: Admin, zipBase64: string): Promise<ThemeInfo> {
  const zip = Buffer.from(String(zipBase64 ?? '').replace(/^data:[^,]*,/, ''), 'base64')
  if (!zip.length) throw badRequest('กรุณาเลือกไฟล์ธีม (.zip)')
  if (zip.length > THEME_LIMITS.zipBytes) throw badRequest(`ไฟล์ธีมใหญ่เกิน ${THEME_LIMITS.zipBytes / MB} MB`)

  let entries: Record<string, Uint8Array>
  let unpacked = 0
  try {
    entries = unzipSync(zip, {
      filter: (file) => {
        unpacked += file.originalSize
        if (unpacked > THEME_LIMITS.unpackedBytes || file.originalSize > THEME_LIMITS.fileBytes) throw new RangeError('too big')
        return true
      },
    })
  } catch (error) {
    if (error instanceof RangeError) {
      throw badRequest(`ไฟล์ในธีมใหญ่เกินไป (ไฟล์ละไม่เกิน ${THEME_LIMITS.fileBytes / MB} MB รวมไม่เกิน ${THEME_LIMITS.unpackedBytes / MB} MB)`)
    }
    throw badRequest('เปิดไฟล์ zip ไม่ได้ กรุณาตรวจสอบว่าเป็นไฟล์ .zip ที่ถูกต้อง')
  }

  // Skip folders, system files and HTML (preview.html is only for looking at the theme offline, never served);
  // accept a zip of the theme folder itself (one top-level folder).
  let files = Object.entries(entries)
    .map(([name, data]) => [name.replace(/\\/g, '/').replace(/^\/+/, ''), data] as const)
    .filter(([name]) => !name.endsWith('/') && !name.startsWith('__MACOSX/') && !name.split('/').some((s) => s.startsWith('.')) && !/.html?$/i.test(name))
  if (!files.some(([name]) => name === 'theme.json')) {
    const tops = new Set(files.map(([name]) => name.split('/')[0]))
    const [top] = tops
    if (tops.size === 1 && files.some(([name]) => name === `${top}/theme.json`)) {
      files = files.map(([name, data]) => [name.slice(top.length + 1), data] as const)
    }
  }
  const manifestFile = files.find(([name]) => name === 'theme.json')
  if (!manifestFile) throw badRequest('ไม่พบไฟล์ theme.json ใน zip (ดาวน์โหลดธีมต้นแบบเพื่อดูโครงสร้าง)')
  if (files.length > THEME_LIMITS.files) throw badRequest(`ธีมมีไฟล์ได้ไม่เกิน ${THEME_LIMITS.files} ไฟล์`)
  const bad = files.find(([name]) => !isThemeFilePath(name))
  if (bad) {
    throw badRequest(
      `ไฟล์ "${bad[0].slice(0, 80)}" ใช้ไม่ได้ ชื่อไฟล์ต้องเป็นตัวอักษรอังกฤษ ตัวเลข - _ . และเป็นไฟล์ชนิด ${Object.keys(THEME_FILE_TYPES).join(', ')}`,
    )
  }

  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(manifestFile[1]).toString('utf8').replace(/^﻿/, ''))
  } catch {
    throw badRequest('theme.json ไม่ใช่ JSON ที่ถูกต้อง')
  }
  const { manifest, error } = cleanThemeManifest(raw)
  if (error) throw badRequest(error)
  const names = new Set(files.map(([name]) => name))
  const stylesheet = manifest.stylesheet || (names.has('theme.css') ? 'theme.css' : '')
  if (stylesheet && (!names.has(stylesheet) || themeFileExt(stylesheet) !== 'css')) throw badRequest(`ไม่พบไฟล์ CSS "${stylesheet}" ที่ระบุใน theme.json`)

  const id = newId('theme')
  const dir = themeDir(ctx.config.uploadDir, id)
  try {
    for (const [name, data] of files) {
      const target = path.join(dir, ...name.split('/'))
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, data)
    }
  } catch (e) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw e
  }

  const row: ThemeRow = {
    id,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    author: manifest.author,
    variables_json: JSON.stringify(manifest.variables),
    stylesheet,
    files_json: JSON.stringify(files.map(([name, data]) => ({ path: name, size: data.length }))),
    size: files.reduce((sum, [, data]) => sum + data.length, 0),
    created_at: nowIso(),
    created_by: admin.name.slice(0, 120),
  }
  await ctx.db.insertInto('themes').values(row).execute()
  await audit(ctx.db, admin, 'อัปโหลดธีม', `${manifest.name}${manifest.version ? ` v${manifest.version}` : ''} (${files.length} ไฟล์)`)
  return toInfo(row)
}

const scopeNames = (assigned: ThemeAssignments, id: string) => [
  ...(assigned.main === id ? ['เว็บหลัก'] : []),
  ...REGION_IDS.filter((r) => assigned.regions[r] === id).map((r) => REGIONS_BY_ID[r].name),
  ...(assigned.promo === id ? ['หน้าโปรโมชัน'] : []),
]

export async function deleteTheme(ctx: AppContext, admin: Admin, id: string) {
  const row = await findTheme(ctx, id)
  if (!row) throw notFound('ไม่พบธีมนี้')
  const used = scopeNames(await getAssignments(ctx), id)
  if (used.length) throw badRequest(`ธีมนี้กำลังใช้งานอยู่ที่ ${used.join(', ')} กรุณาเปลี่ยนธีมก่อนลบ`)
  await ctx.db.deleteFrom('themes').where('id', '=', id).execute()
  await rm(themeDir(ctx.config.uploadDir, id), { recursive: true, force: true }).catch(() => {})
  await audit(ctx.db, admin, 'ลบธีม', row.name)
}

export async function setAssignments(ctx: AppContext, admin: Admin, input: Partial<ThemeAssignments>): Promise<ThemeAssignments> {
  const themes = new Map((await ctx.db.selectFrom('themes').select(['id', 'name']).execute()).map((t) => [t.id, t.name]))
  const pick = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string' || !themes.has(value)) throw badRequest('ไม่พบธีมที่เลือก กรุณารีเฟรชหน้าแล้วลองใหม่')
    return value
  }
  const next: ThemeAssignments = { main: pick(input.main), regions: {}, promo: pick(input.promo) }
  for (const region of REGION_IDS) {
    const id = pick(input.regions?.[region as RegionId])
    if (id) next.regions[region] = id
  }

  const value_json = JSON.stringify(next)
  const updated_at = nowIso()
  const updated = await ctx.db.updateTable('settings').set({ value_json, updated_at }).where('id', '=', ASSIGNMENTS_ID).executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) await ctx.db.insertInto('settings').values({ id: ASSIGNMENTS_ID, value_json, updated_at }).execute()

  const label = (id: string | null | undefined, fallback: string) => (id ? themes.get(id)! : fallback)
  const summary = [
    `เว็บหลัก: ${label(next.main, 'ค่าเริ่มต้น')}`,
    ...REGION_IDS.filter((r) => next.regions[r]).map((r) => `${REGIONS_BY_ID[r].name}: ${label(next.regions[r], '')}`),
    `หน้าโปรโมชัน: ${label(next.promo, 'ค่าเริ่มต้น')}`,
  ].join(' · ')
  await audit(ctx.db, admin, 'ตั้งค่าธีม', summary)
  return next
}

const STARTER_CSS = `/* CSS เพิ่มเติมของธีม (ไม่บังคับ ลบไฟล์นี้ได้ถ้าไม่ใช้)

   ธีมเดียวกันเลือกใช้ได้กับ 3 ที่ และ CSS นี้จะถูกโหลดดังนี้
   - ธีมเว็บหลัก   : โหลดทุกหน้าของเว็บ (ไม่รวมหน้าแอดมิน)
   - ธีมภูมิภาค    : โหลดเฉพาะตอนเปิดภูมิภาคนั้น
   - ธีมหน้าโปรโมชัน: โหลดตลอด จึงควรขึ้นต้น selector ด้วย .theme-scope-promo

   รูปและฟอนต์ให้ใส่ในโฟลเดอร์ assets/ แล้วอ้างถึงด้วย url(assets/ชื่อไฟล์)
   ตัวอย่าง:

   @font-face {
     font-family: 'MyFont';
     src: url(assets/myfont.woff2) format('woff2');
   }

   .theme-scope-promo h1 {
     letter-spacing: 0.02em;
   }
*/
`

const STARTER_README = `ธีม 500 Windows to Thailand
==========================

ไฟล์ในธีม
- theme.json  : ชื่อธีมและค่าตัวแปรสี/พื้นหลัง/ฟอนต์ (จำเป็น)
- theme.css   : CSS เพิ่มเติม (ไม่บังคับ)
- assets/     : รูปภาพและฟอนต์ที่ใช้ในธีม (ไม่บังคับ)
- preview.html: ดับเบิลคลิกเปิดในเบราว์เซอร์เพื่อดูตัวอย่างธีม (ไม่ถูกอัปโหลดขึ้นเว็บ)

วิธีแก้ไข
1. แก้ "name" และ "version" ใน theme.json ให้เป็นชื่อธีมใหม่
2. แก้ค่าใน "variables" — ใส่สีได้ทั้ง #ff9900, rgb(...), oklch(...)
   ไม่ต้องใส่ทุกตัว ตัวที่ลบออกจะใช้ค่าเดิมของเว็บ
   รูปพื้นหลัง: "--theme-page-bg-image": "url(assets/bg.jpg)"
3. บีบอัดไฟล์ทั้งหมดเป็น .zip (theme.json ต้องอยู่ชั้นบนสุด หรืออยู่ในโฟลเดอร์เดียว)
   ระหว่างแก้ เปิด preview.html แล้วกด "โหลด theme.json ที่แก้แล้ว" เพื่อดูผลทันที
4. อัปโหลดที่ หน้าแอดมิน > ธีมเว็บไซต์ แล้วกด "ดูตัวอย่าง" ก่อนเลือกใช้

กลุ่มตัวแปร
- page          : พื้นหลังหน้าเว็บ สีตัวอักษร และฟอนต์
- stone ... orange : ชุดสีของเว็บ (เลข 50 = อ่อนสุด, 950 = เข้มสุด)
                  เช่น เปลี่ยน amber ทั้งชุดเพื่อเปลี่ยนสีทองหลักของเว็บ
- promo-page    : หน้าโปรโมชันที่เปิดจากช่องโฆษณา
- promo-dialog  : หน้าฟอร์มขอโปรโมท

ข้อจำกัด
- zip ไม่เกิน 10 MB, ไฟล์ละไม่เกิน 5 MB, ไม่เกิน 150 ไฟล์
- ชื่อไฟล์ใช้ตัวอักษรอังกฤษ ตัวเลข - _ . เท่านั้น
- ชนิดไฟล์: ${Object.keys(THEME_FILE_TYPES).join(', ')}
`

/** The built-in design as an editable starter theme. */
function starterZip(): Uint8Array {
  const manifest = {
    name: 'ธีมเริ่มต้น',
    description: 'ค่าการออกแบบเดิมของเว็บ ใช้เป็นต้นแบบสำหรับสร้างธีมใหม่',
    version: '1.0',
    author: '500 Windows to Thailand',
    stylesheet: 'theme.css',
    variables: Object.fromEntries(THEME_VARIABLE_GROUPS.map((g) => [g.key, g.variables])),
  }
  return zipSync({
    'theme.json': strToU8(JSON.stringify(manifest, null, 2)),
    'theme.css': strToU8(STARTER_CSS),
    'README.txt': strToU8(STARTER_README),
    'preview.html': strToU8(themePreviewHtml(manifest)),
    'assets/': {},
  })
}

/** Zip of a stored theme (as uploaded), or of the built-in design for id 'default'. */
export async function exportTheme(ctx: AppContext, id: string): Promise<{ fileName: string; data: Uint8Array }> {
  if (id === 'default') return { fileName: 'theme-default.zip', data: starterZip() }
  const row = await findTheme(ctx, id)
  if (!row) throw notFound('ไม่พบธีมนี้')
  const dir = themeDir(ctx.config.uploadDir, id)
  const files: Zippable = {}
  let manifest: unknown = { name: row.name, version: row.version, variables: JSON.parse(row.variables_json) }
  for (const { path: name } of JSON.parse(row.files_json) as { path: string }[]) {
    files[name] = new Uint8Array(await readFile(path.join(dir, ...name.split('/'))))
  }
  try {
    manifest = JSON.parse(Buffer.from(files['theme.json'] as Uint8Array).toString('utf8').replace(/^﻿/, ''))
  } catch {
    // keep the stored values
  }
  files['preview.html'] = strToU8(themePreviewHtml(manifest))
  const slug = row.name.replace(/[^A-Za-z0-9ก-๙_-]+/g, '-').replace(/^-+|-+$/g, '') || 'theme'
  return { fileName: `${slug}${row.version ? `-v${row.version}` : ''}.zip`, data: zipSync(files) }
}

/** Absolute path of a public theme file, or null. */
export function themeFilePath(uploadDir: string, id: string, file: string): string | null {
  if (!/^theme_[A-Za-z0-9_-]{8,40}$/.test(id) || !isThemeFilePath(file)) return null
  return path.join(themeDir(uploadDir, id), ...file.split('/'))
}
