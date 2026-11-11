// 500 Windows Thailand : Pod — a public link-in-bio page, one per account (/pod/<slug>).

export const POD_NAME_MAX = 30
export const POD_BIO_MAX = 300
export const POD_LINK_TITLE_MAX = 30
export const POD_LINK_DESC_MAX = 100
export const POD_LINK_URL_MAX = 500
export const POD_LINKS_MAX = 20

/** Card and profile colours; the profile can also use the page's own panel colour (-1). */
export const POD_COLORS = ['#CBD97E', '#FFC857', '#EB5A4F', '#D9DAD3', '#F6F1E4', '#F4A259', '#8EC5E8'] as const
/** Link cards cycle through the first four colours. */
export const POD_LINK_COLORS = POD_COLORS.slice(0, 4)

export const POD_SLUG_MIN = 3
export const POD_SLUG_MAX = 30
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const RESERVED_SLUGS = new Set(['admin', 'api', 'me', 'new', 'edit', 'pod', 'pods', 'login', 'signup', 'help', 'support', 'www'])

export interface PodLink {
  title: string
  desc: string
  url: string
  /** `/uploads/pods/...`, or a data URL when sent to be saved. */
  img: string
}

/** The window shown on the pod's window card: one the pod's owner holds. */
export interface PodWindow {
  region: string
  num: number
  code: string
  title: string
}

export interface Pod {
  slug: string
  name: string
  bio: string
  avatar: string
  /** Index into POD_COLORS, or -1 for the page's panel colour. */
  profileColor: number
  window: PodWindow | null
  /** Index into POD_COLORS. */
  windowColor: number
  links: PodLink[]
  updatedAt: string
}

/** What the owner sends to save the pod. */
export interface PodInput {
  slug: string
  name: string
  bio: string
  avatar: string
  profileColor: number
  window: { region: string; num: number } | null
  windowColor: number
  links: PodLink[]
}

export const normalizePodSlug = (value: string) => value.trim().toLowerCase()

/** Thai error for a pod address that can't be used, or null when it is fine. */
export function podSlugError(slug: string): string | null {
  if (slug.length < POD_SLUG_MIN || slug.length > POD_SLUG_MAX) return `ชื่อลิงก์ Pod ต้องยาว ${POD_SLUG_MIN}–${POD_SLUG_MAX} ตัวอักษร`
  if (!SLUG_PATTERN.test(slug) || slug.includes('--')) return 'ชื่อลิงก์ Pod ใช้ได้เฉพาะ a-z, 0-9 และขีด (-) คั่นกลาง'
  if (RESERVED_SLUGS.has(slug)) return 'ชื่อลิงก์ Pod นี้สงวนไว้ กรุณาเลือกชื่ออื่น'
  return null
}

/** A link a visitor can open: http(s) only, `https://` added when missing; '' when unusable. */
export function podLinkHref(url: string): string {
  const value = url.trim()
  if (!value) return ''
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : ''
  } catch {
    return ''
  }
}

/** Host name shown under a link card. */
export function podLinkHost(url: string): string {
  const href = podLinkHref(url)
  if (!href) return 'ยังไม่ได้ใส่ลิงก์'
  return new URL(href).hostname.replace(/^www\./, '')
}
