// 500 Windows Thailand : Pod — one public link-in-bio page per account, served at /pod/<slug>.
import type { Pod, PodInput, PodLink, PodWindow } from '@shared/pod'
import {
  normalizePodSlug,
  POD_BIO_MAX,
  POD_COLORS,
  POD_LINK_DESC_MAX,
  POD_LINK_TITLE_MAX,
  POD_LINK_URL_MAX,
  POD_LINKS_MAX,
  POD_NAME_MAX,
  podLinkHref,
  podSlugError,
} from '@shared/pod'
import type { PodRow, UserRow } from '../db/schema'
import { badRequest, conflict, notFound } from '../lib/errors'
import { deleteUpload, isDataUrl, saveImage } from '../lib/files'
import { nowIso, type AppContext } from '../context'

export type { PodInput }

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const colorIndex = (value: unknown, min: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n < POD_COLORS.length ? n : min < 0 ? -1 : 0
}

/** Windows the user holds, for the pod's window card. */
export async function podWindowsOf(db: AppContext['db'], userId: string): Promise<PodWindow[]> {
  const rows = await db
    .selectFrom('windows')
    .select(['region', 'num', 'code', 'title'])
    .where('owner_id', '=', userId)
    .orderBy('region')
    .orderBy('num')
    .execute()
  return rows.map((r) => ({ region: r.region, num: r.num, code: r.code, title: r.title }))
}

async function toPod(db: AppContext['db'], row: PodRow): Promise<Pod> {
  // Only a window the owner still holds is shown.
  const window =
    row.window_region && row.window_num != null
      ? await db
          .selectFrom('windows')
          .select(['region', 'num', 'code', 'title'])
          .where('region', '=', row.window_region)
          .where('num', '=', row.window_num)
          .where('owner_id', '=', row.user_id)
          .executeTakeFirst()
      : undefined
  return {
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    avatar: row.avatar,
    profileColor: row.profile_color,
    window: window ? { region: window.region, num: window.num, code: window.code, title: window.title } : null,
    windowColor: row.window_color,
    links: JSON.parse(row.links_json || '[]') as PodLink[],
    updatedAt: row.updated_at,
  }
}

const imagesOf = (row: Pick<PodRow, 'avatar' | 'links_json'> | undefined) =>
  row ? [row.avatar, ...(JSON.parse(row.links_json || '[]') as PodLink[]).map((l) => l.img)].filter(Boolean) : []

/** A public pod; the owner (signed in) also gets the windows they can show on it. */
export async function getPod(ctx: AppContext, slugParam: string, viewer: UserRow | null) {
  const row = await ctx.db.selectFrom('pods').selectAll().where('slug', '=', normalizePodSlug(slugParam)).executeTakeFirst()
  const owner = row && (await ctx.db.selectFrom('users').select(['id', 'disabled']).where('id', '=', row.user_id).executeTakeFirst())
  if (!row || !owner || owner.disabled) throw notFound('ไม่พบหน้า Pod นี้')
  const isOwner = viewer?.id === row.user_id
  return { pod: await toPod(ctx.db, row), isOwner, windows: isOwner ? await podWindowsOf(ctx.db, row.user_id) : undefined }
}

/** The Link Pod shown in a window's "ช่องทางนำเสนอผลงาน" card: its owner's pod, if they made one. */
export async function windowPod(ctx: AppContext, region: string, num: number) {
  const pod = await ctx.db
    .selectFrom('windows')
    .innerJoin('pods', 'pods.user_id', 'windows.owner_id')
    .innerJoin('users', 'users.id', 'windows.owner_id')
    .select(['pods.slug', 'pods.name', 'pods.bio', 'pods.avatar'])
    .where('windows.region', '=', region)
    .where('windows.num', '=', num)
    .where('users.disabled', '=', 0)
    .executeTakeFirst()
  return { pod: pod ?? null }
}

/** The signed-in user's pod (null before it is made) and their windows. */
export async function myPod(ctx: AppContext, user: UserRow) {
  const row = await ctx.db.selectFrom('pods').selectAll().where('user_id', '=', user.id).executeTakeFirst()
  return { pod: row ? await toPod(ctx.db, row) : null, windows: await podWindowsOf(ctx.db, user.id) }
}

/** Creates or replaces the user's pod. New images arrive as data URLs; kept ones must be this pod's own. */
export async function savePod(ctx: AppContext, user: UserRow, input: Partial<PodInput> | undefined) {
  const existing = await ctx.db.selectFrom('pods').selectAll().where('user_id', '=', user.id).executeTakeFirst()
  const slug = normalizePodSlug(String(input?.slug ?? ''))
  const slugError = podSlugError(slug)
  if (slugError) throw badRequest(slugError)
  const taken = await ctx.db.selectFrom('pods').select('user_id').where('slug', '=', slug).executeTakeFirst()
  if (taken && taken.user_id !== user.id) throw conflict('ชื่อลิงก์ Pod นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น')

  const name = text(input?.name, POD_NAME_MAX)
  if (!name) throw badRequest('กรุณาระบุชื่อ')
  const bio = String(input?.bio ?? '').slice(0, POD_BIO_MAX)

  let window: { region: string; num: number } | null = null
  if (input?.window) {
    const held = await ctx.db
      .selectFrom('windows')
      .select(['region', 'num'])
      .where('region', '=', String(input.window.region))
      .where('num', '=', Number(input.window.num))
      .where('owner_id', '=', user.id)
      .executeTakeFirst()
    if (!held) throw badRequest('เลือกได้เฉพาะบานหน้าต่างที่คุณถือครอง')
    window = held
  }

  const rawLinks = Array.isArray(input?.links) ? input.links : []
  if (rawLinks.length > POD_LINKS_MAX) throw badRequest(`ใส่ลิงก์ได้ไม่เกิน ${POD_LINKS_MAX} ลิงก์`)
  const links = rawLinks.map((l) => ({
    title: text(l?.title, POD_LINK_TITLE_MAX),
    desc: String(l?.desc ?? '').slice(0, POD_LINK_DESC_MAX),
    url: text(l?.url, POD_LINK_URL_MAX),
    img: String(l?.img ?? ''),
  }))
  for (const link of links) {
    if (link.url && !podLinkHref(link.url)) throw badRequest(`ลิงก์ "${link.title || link.url}" ไม่ถูกต้อง ใช้ได้เฉพาะลิงก์ปลอดภัยที่ขึ้นต้นด้วย https://`)
  }

  const avatarInput = String(input?.avatar ?? '')
  const kept = new Set(imagesOf(existing))
  const reused = [avatarInput, ...links.map((l) => l.img)].filter((i) => i && !isDataUrl(i))
  if (reused.some((i) => !kept.has(i))) throw badRequest('รูปที่เลือกไม่ถูกต้อง กรุณาอัปโหลดรูปใหม่')

  const fresh: string[] = []
  const store = async (image: string) => {
    if (!isDataUrl(image)) return image
    const path = await saveImage(ctx.config.uploadDir, image, 'pods')
    fresh.push(path)
    return path
  }
  let avatar: string
  try {
    avatar = await store(avatarInput)
    for (const link of links) link.img = await store(link.img)
  } catch (error) {
    await Promise.all(fresh.map((p) => deleteUpload(ctx.config.uploadDir, p)))
    throw error
  }

  const now = nowIso()
  const values = {
    slug,
    name,
    bio,
    avatar,
    profile_color: colorIndex(input?.profileColor, -1),
    window_region: window?.region ?? null,
    window_num: window?.num ?? null,
    window_color: colorIndex(input?.windowColor, 0),
    links_json: JSON.stringify(links),
    updated_at: now,
  }
  try {
    if (existing) await ctx.db.updateTable('pods').set(values).where('user_id', '=', user.id).execute()
    else await ctx.db.insertInto('pods').values({ user_id: user.id, created_at: now, ...values }).execute()
  } catch {
    // Another account took the address (or a second first save raced) between the check and the write.
    await Promise.all(fresh.map((p) => deleteUpload(ctx.config.uploadDir, p)))
    throw conflict('ชื่อลิงก์ Pod นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น')
  }

  const row = await ctx.db.selectFrom('pods').selectAll().where('user_id', '=', user.id).executeTakeFirstOrThrow()
  const inUse = new Set(imagesOf(row))
  await Promise.all([...kept].filter((p) => !inUse.has(p)).map((p) => deleteUpload(ctx.config.uploadDir, p)))
  return { pod: await toPod(ctx.db, row) }
}
