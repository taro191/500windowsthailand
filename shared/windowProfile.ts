// The owner's public page for a window: limits, text cleaning and validation shared by the
// editor and the API. Images are checked by the server (uploads), not here.
import type { WindowOffering, WindowProfile } from './types'

export const PROFILE_LIMITS = {
  tags: 6,
  tagLength: 24,
  gallery: 5,
  offerings: 8,
  offeringName: 40,
  offeringNote: 60,
  highlights: 6,
  highlightLength: 80,
  about: 1000,
  serviceArea: 100,
  shipping: 100,
  reviewText: 500,
}

export const SOCIALS = [
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
] as const

export type SocialKey = (typeof SOCIALS)[number]['key']

export const emptyProfile = (): WindowProfile => ({
  logoUrl: '',
  tags: [],
  gallery: [],
  offerings: [],
  phone: '',
  lineId: '',
  email: '',
  website: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  about: '',
  highlights: [],
  serviceArea: '',
  shipping: '',
})

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const list = (value: unknown) => (Array.isArray(value) ? value : [])

/** Host of an https URL without "www.", or '' if it is not one. */
function httpsHost(url: string): string {
  const match = url.match(/^https:\/\/([^/?#\s]+)(?:[/?#]\S*)?$/i)
  return match ? match[1].toLowerCase().replace(/^www\.|^m\./, '') : ''
}

const hostMatches = (host: string, hosts: readonly string[]) => hosts.some((h) => host === h || host.endsWith(`.${h}`))

/** Link that opens a chat: official accounts start with "@", personal IDs use "~". */
export function lineUrl(lineId: string): string {
  const id = lineId.trim()
  if (!id) return ''
  return id.startsWith('@') ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : `https://line.me/ti/p/~${encodeURIComponent(id)}`
}

/** "tel:" target for a phone number as typed (keeps a leading +). */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/**
 * Trims and limits every text field and checks the formats. Image fields are passed through
 * as given (the server resolves uploads). Returns the first problem as a Thai message.
 */
export function cleanProfile(input: Partial<WindowProfile> | null | undefined): { profile: WindowProfile; error?: string } {
  const raw = input ?? {}
  const L = PROFILE_LIMITS
  const tags = [...new Set(list(raw.tags).map((t) => text(t, L.tagLength).replace(/^#/, '')).filter(Boolean))].slice(0, L.tags)
  const offerings: WindowOffering[] = list(raw.offerings)
    .map((o: Partial<WindowOffering>) => ({
      imageUrl: String(o?.imageUrl ?? ''),
      name: text(o?.name, L.offeringName),
      note: text(o?.note, L.offeringNote),
    }))
    .filter((o) => o.name || o.imageUrl)
    .slice(0, L.offerings)
  const profile: WindowProfile = {
    logoUrl: String(raw.logoUrl ?? ''),
    tags,
    gallery: list(raw.gallery).map(String).filter(Boolean).slice(0, L.gallery),
    offerings,
    phone: text(raw.phone, 20),
    lineId: text(raw.lineId, 40),
    email: text(raw.email, 120).toLowerCase(),
    website: text(raw.website, 300),
    facebook: text(raw.facebook, 300),
    instagram: text(raw.instagram, 300),
    tiktok: text(raw.tiktok, 300),
    youtube: text(raw.youtube, 300),
    about: text(raw.about, L.about),
    highlights: list(raw.highlights).map((h) => text(h, L.highlightLength)).filter(Boolean).slice(0, L.highlights),
    serviceArea: text(raw.serviceArea, L.serviceArea),
    shipping: text(raw.shipping, L.shipping),
  }

  let error: string | undefined
  const digits = profile.phone.replace(/\D/g, '')
  if (profile.phone && (!/^[\d\s+()-]+$/.test(profile.phone) || digits.length < 9 || digits.length > 15)) error = 'เบอร์โทรไม่ถูกต้อง'
  else if (profile.lineId && !/^@?[A-Za-z0-9._-]{2,40}$/.test(profile.lineId)) error = 'LINE ID ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ . _ - (บัญชีทางการขึ้นต้นด้วย @)'
  else if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) error = 'อีเมลไม่ถูกต้อง'
  else if (profile.website && !httpsHost(profile.website)) error = 'เว็บไซต์ต้องเป็นลิงก์ที่ขึ้นต้นด้วย https://'
  else {
    for (const social of SOCIALS) {
      const url = profile[social.key]
      if (url && !hostMatches(httpsHost(url), social.hosts)) {
        error = `ลิงก์ ${social.label} ต้องขึ้นต้นด้วย https:// และเป็นลิงก์ของ ${social.hosts[0]}`
        break
      }
    }
  }
  return { profile, error }
}

/** Every image URL the profile uses. */
export const profileImages = (p: WindowProfile) => [p.logoUrl, ...p.gallery, ...p.offerings.map((o) => o.imageUrl)].filter(Boolean)

export const hasContacts = (p: WindowProfile) => !!(p.phone || p.lineId || p.email || p.website)
export const hasSocials = (p: WindowProfile) => SOCIALS.some((s) => !!p[s.key])
export const hasDetails = (p: WindowProfile) => !!(p.about || p.highlights.length || p.serviceArea || p.shipping)
