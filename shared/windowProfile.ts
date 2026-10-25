// The owner's public page for a window: limits, text cleaning and validation shared by the
// window page and the API. Images are checked by the server (uploads), not here.
import type { FriendSettings, ProfileDisplay, ProfileLink, ShowcaseItem, WindowProfile } from './types'

export const PROFILE_LIMITS = {
  tags: 6,
  tagLength: 24,
  gallery: 5,
  works: 3,
  /** Older profiles could list 8 products and services; they are all kept. */
  products: 8,
  showcaseImages: 3,
  showcaseName: 60,
  showcaseSub: 40,
  showcaseDetail: 500,
  links: 8,
  linkLabel: 30,
  linkUrl: 300,
  about: 1500,
  friendNote: 200,
  reviewText: 500,
  updateText: 500,
  /** Daily updates shown on the window. */
  updatesShown: 30,
  /** "Friend and Co" slots. */
  partners: 3,
  linkMessage: 200,
}

/** Kinds of link the owner picks from: [icon, default label]. */
export const PROFILE_LINK_TYPES: [string, string][] = [
  ['▶️', 'YouTube'],
  ['🎞️', 'TikTok / Reels'],
  ['🌐', 'เว็บไซต์'],
  ['📄', 'Portfolio PDF'],
  ['📘', 'Facebook'],
  ['📷', 'Instagram'],
  ['🛍️', 'ร้านค้าออนไลน์'],
  ['✉️', 'อีเมล'],
  ['🔗', 'ลิงก์อื่นๆ'],
]

const LINK_ICONS = PROFILE_LINK_TYPES.map(([icon]) => icon)

export const defaultDisplay = (): ProfileDisplay => ({ views: true, likes: true, today: true, followers: true, follow: true, reviews: true })
export const defaultFriend = (): FriendSettings => ({ open: true, from: '', to: '', note: '' })

export const emptyProfile = (): WindowProfile => ({
  logoUrl: '',
  tags: [],
  gallery: [],
  works: [],
  products: [],
  links: [],
  phone: '',
  lineId: '',
  about: '',
  display: defaultDisplay(),
  friend: defaultFriend(),
})

type Raw = Record<string, unknown>
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const obj = (value: unknown): Raw => (value && typeof value === 'object' ? (value as Raw) : {})
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())

/** Link that opens a chat: official accounts start with "@", personal IDs use "~". */
export function lineUrl(lineId: string): string {
  const id = lineId.trim()
  if (!id) return ''
  return id.startsWith('@') ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : `https://line.me/ti/p/~${encodeURIComponent(id)}`
}

/** "tel:" target for a phone number as typed (keeps a leading +). */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** The link as it may be opened: https added when there is no scheme, '' for anything but http(s) and mailto. */
export function safeLinkUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''
  if (/^https?:\/\/[^\s/?#]+/i.test(u)) return u
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(u)) return u
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return ''
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return `mailto:${u}`
  return /^[^\s/?#]+\.[^\s/?#]+/.test(u) ? `https://${u}` : ''
}

function showcase(value: unknown, max: number): ShowcaseItem[] {
  const L = PROFILE_LIMITS
  return list(value)
    .map((v) => {
      const o = obj(v)
      return {
        images: list(o.images).map((x) => String(x ?? '')).filter(Boolean).slice(0, L.showcaseImages),
        name: text(o.name, L.showcaseName),
        sub: text(o.sub, L.showcaseSub),
        detail: text(o.detail, L.showcaseDetail),
      }
    })
    .filter((o) => o.images.length || o.name || o.detail)
    .slice(0, max)
}

/** Profiles saved before the window page redesign: offerings, social fields and extra detail fields. */
function fromLegacy(raw: Raw): Raw {
  const links: ProfileLink[] = []
  const add = (icon: string, label: string, url: unknown) => {
    if (url) links.push({ icon, label, url: String(url) })
  }
  add('🌐', 'เว็บไซต์', raw.website)
  add('▶️', 'YouTube', raw.youtube)
  add('🎞️', 'TikTok / Reels', raw.tiktok)
  add('📘', 'Facebook', raw.facebook)
  add('📷', 'Instagram', raw.instagram)
  if (raw.email) add('✉️', 'อีเมล', `mailto:${raw.email}`)

  const highlights = list(raw.highlights).map((h) => text(h, 200)).filter(Boolean)
  const about = [
    text(raw.about, 2000),
    highlights.length ? `★ จุดเด่นของเรา\n${highlights.map((h) => `✓ ${h}`).join('\n')}` : '',
    raw.serviceArea ? `📍 พื้นที่ให้บริการ: ${text(raw.serviceArea, 200)}` : '',
    raw.shipping ? `🚚 การจัดส่ง: ${text(raw.shipping, 200)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const products = list(raw.offerings).map((v) => {
    const o = obj(v)
    return { images: o.imageUrl ? [String(o.imageUrl)] : [], name: o.name, sub: '', detail: o.note }
  })
  return { ...raw, links: raw.links ?? links, about, products: raw.products ?? products }
}

/**
 * Any stored or submitted profile in the current shape: missing fields get defaults, text is
 * trimmed and limited, lists are capped. Image fields are passed through as given.
 */
export function normalizeProfile(input: unknown): WindowProfile {
  let raw = obj(input)
  // Profiles from before the redesign have no `display` and may carry the old fields.
  if (!('display' in raw)) raw = fromLegacy(raw)
  const L = PROFILE_LIMITS
  const display = { ...defaultDisplay() }
  const shown = obj(raw.display)
  for (const key of Object.keys(display) as (keyof ProfileDisplay)[]) if (key in shown) display[key] = shown[key] !== false
  const friend = obj(raw.friend)
  const from = text(friend.from, 10)
  const to = text(friend.to, 10)
  return {
    logoUrl: String(raw.logoUrl ?? ''),
    tags: [...new Set(list(raw.tags).map((t) => text(t, L.tagLength).replace(/^#/, '').trim()).filter(Boolean))].slice(0, L.tags),
    gallery: list(raw.gallery).map((x) => String(x ?? '')).filter(Boolean).slice(0, L.gallery),
    works: showcase(raw.works, L.works),
    products: showcase(raw.products, L.products),
    links: list(raw.links)
      .map((v) => {
        const o = obj(v)
        const icon = String(o.icon ?? '')
        return { icon: LINK_ICONS.includes(icon) ? icon : '🔗', label: text(o.label, L.linkLabel), url: text(o.url, L.linkUrl) }
      })
      .filter((k) => k.url)
      .slice(0, L.links),
    phone: text(raw.phone, 20),
    lineId: text(raw.lineId, 40),
    about: text(raw.about, L.about),
    display,
    friend: { open: friend.open !== false, from: isDay(from) ? from : '', to: isDay(to) ? to : '', note: text(friend.note, L.friendNote) },
  }
}

/** Cleans a submitted profile and checks the formats; returns the first problem as a Thai message. */
export function cleanProfile(input: unknown): { profile: WindowProfile; error?: string } {
  const profile = normalizeProfile(input)
  const raw = obj(obj(input).friend)
  let error: string | undefined
  const digits = profile.phone.replace(/\D/g, '')
  if (profile.phone && (!/^[\d\s+()-]+$/.test(profile.phone) || digits.length < 9 || digits.length > 15)) error = 'เบอร์โทรไม่ถูกต้อง'
  else if (profile.lineId && !/^@?[A-Za-z0-9._-]{2,40}$/.test(profile.lineId)) error = 'LINE ID ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ . _ - (บัญชีทางการขึ้นต้นด้วย @)'
  else if (profile.links.some((k) => !safeLinkUrl(k.url))) error = 'ลิงก์ช่องทางต้องเป็นเว็บที่ขึ้นต้นด้วย https:// หรืออีเมล'
  else if ((raw.from && !profile.friend.from) || (raw.to && !profile.friend.to)) error = 'วันที่เปิดรับ Friend and Co ไม่ถูกต้อง'
  else if (profile.friend.from && profile.friend.to && profile.friend.to < profile.friend.from) error = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'
  for (const k of profile.links) k.url = safeLinkUrl(k.url) || k.url
  return { profile, error }
}

/** Every image URL the profile uses. */
export const profileImages = (p: WindowProfile) =>
  [p.logoUrl, ...p.gallery, ...p.works.flatMap((o) => o.images), ...p.products.flatMap((o) => o.images)].filter(Boolean)

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** `2026-10-25` → `25 ต.ค. 2569`. */
export function thaiDayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`
}

/** Whether "Friend and Co" takes requests on `today` (`YYYY-MM-DD`, Thai time), with the reason in Thai. */
export function friendStatus(friend: FriendSettings, today: string): { open: boolean; reason: string } {
  if (!friend.open) return { open: false, reason: 'เจ้าของปิดรับการเชื่อมต่อลิงก์ในขณะนี้' }
  if (friend.from && today < friend.from) return { open: false, reason: `ยังไม่ถึงช่วงเวลา จะเปิดรับตั้งแต่ ${thaiDayLabel(friend.from)}` }
  if (friend.to && today > friend.to) return { open: false, reason: `หมดช่วงเวลารับการเชื่อมต่อแล้ว (สิ้นสุด ${thaiDayLabel(friend.to)})` }
  return { open: true, reason: friend.to ? `เปิดรับการเชื่อมต่อถึง ${thaiDayLabel(friend.to)}` : 'เปิดรับการเชื่อมต่อ' }
}
