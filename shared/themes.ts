// Site themes: an admin uploads a zip (theme.json + optional theme.css + assets/) and picks a
// theme for the main site, for each region and for the promo pages. A theme overrides CSS
// variables (Tailwind colours, page background, fonts, promo page colours) and may add CSS.
import type { RegionId } from './types'

export type ThemeScope = 'main' | 'region' | 'promo'

/** What the site needs to apply a theme. */
export interface ActiveTheme {
  id: string
  name: string
  /** CSS custom properties, e.g. `{ '--color-amber-400': '#f5b301' }`; relative url()s already point at the theme's files. */
  variables: Record<string, string>
  /** Public URL of the theme's stylesheet, or ''. */
  stylesheet: string
}

/** A theme in the admin library. */
export interface ThemeInfo extends ActiveTheme {
  description: string
  version: string
  author: string
  files: number
  /** Unpacked size in bytes. */
  size: number
  createdAt: string
  createdBy: string
}

/** Theme id per scope; null / missing = the built-in design (regions fall back to the main theme). */
export interface ThemeAssignments {
  main: string | null
  regions: Partial<Record<RegionId, string>>
  promo: string | null
}

export interface ActiveThemes {
  main: ActiveTheme | null
  regions: Partial<Record<RegionId, ActiveTheme>>
  promo: ActiveTheme | null
}

export const emptyThemeAssignments = (): ThemeAssignments => ({ main: null, regions: {}, promo: null })
export const emptyActiveThemes = (): ActiveThemes => ({ main: null, regions: {}, promo: null })

export const THEME_LIMITS = {
  zipBytes: 10 * 1024 * 1024,
  unpackedBytes: 30 * 1024 * 1024,
  fileBytes: 5 * 1024 * 1024,
  files: 150,
  variables: 400,
  value: 500,
  name: 60,
  description: 300,
}

/** File types a theme may contain, by extension. */
export const THEME_FILE_TYPES: Record<string, string> = {
  json: 'application/json',
  css: 'text/css; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

/** Built-in design values, grouped as they appear in a downloaded theme.json. */
export const THEME_VARIABLE_GROUPS: { key: string; title: string; variables: Record<string, string> }[] = [
  {
    key: 'page',
    title: 'หน้าเว็บ: พื้นหลังและตัวอักษร',
    variables: {
      '--theme-page-bg': '#09080e',
      '--theme-page-bg-image': 'none',
      '--theme-page-text': 'var(--color-stone-100)',
      '--app-font-body': "'Prompt', sans-serif",
      '--theme-font-heading': "'Plus Jakarta Sans', 'Prompt', sans-serif",
    },
  },
  {
    key: 'stone',
    title: 'สีเทา (ตัวอักษร เส้น กล่อง) — stone',
    variables: {
      '--color-stone-50': 'oklch(98.5% 0.001 106.423)',
      '--color-stone-100': 'oklch(97% 0.001 106.424)',
      '--color-stone-200': 'oklch(92.3% 0.003 48.717)',
      '--color-stone-300': 'oklch(93% 0.005 56)',
      '--color-stone-400': 'oklch(84% 0.01 56)',
      '--color-stone-500': 'oklch(73% 0.012 58)',
      '--color-stone-600': 'oklch(62% 0.012 73)',
      '--color-stone-700': 'oklch(37.4% 0.01 67.558)',
      '--color-stone-800': 'oklch(26.8% 0.007 34.298)',
      '--color-stone-900': 'oklch(21.6% 0.006 56.043)',
      '--color-stone-950': 'oklch(14.7% 0.004 49.25)',
    },
  },
  {
    key: 'amber',
    title: 'สีทอง (สีหลัก) — amber',
    variables: {
      '--color-amber-50': 'oklch(98.7% 0.022 95.277)',
      '--color-amber-100': 'oklch(96.2% 0.059 95.617)',
      '--color-amber-200': 'oklch(92.4% 0.12 95.746)',
      '--color-amber-300': 'oklch(87.9% 0.169 91.605)',
      '--color-amber-400': 'oklch(82.8% 0.189 84.429)',
      '--color-amber-500': 'oklch(76.9% 0.188 70.08)',
      '--color-amber-600': 'oklch(66.6% 0.179 58.318)',
      '--color-amber-700': 'oklch(55.5% 0.163 48.998)',
      '--color-amber-800': 'oklch(47.3% 0.137 46.201)',
      '--color-amber-900': 'oklch(41.4% 0.112 45.904)',
      '--color-amber-950': 'oklch(27.9% 0.077 45.635)',
    },
  },
  {
    key: 'rose',
    title: 'สีชมพู — rose',
    variables: {
      '--color-rose-50': 'oklch(96.9% 0.015 12.422)',
      '--color-rose-100': 'oklch(94.1% 0.03 12.58)',
      '--color-rose-200': 'oklch(89.2% 0.058 10.001)',
      '--color-rose-300': 'oklch(81% 0.117 11.638)',
      '--color-rose-400': 'oklch(71.2% 0.194 13.428)',
      '--color-rose-500': 'oklch(64.5% 0.246 16.439)',
      '--color-rose-600': 'oklch(58.6% 0.253 17.585)',
      '--color-rose-700': 'oklch(51.4% 0.222 16.935)',
      '--color-rose-800': 'oklch(45.5% 0.188 13.697)',
      '--color-rose-900': 'oklch(41% 0.159 10.272)',
      '--color-rose-950': 'oklch(27.1% 0.105 12.094)',
    },
  },
  {
    key: 'purple',
    title: 'สีม่วง — purple',
    variables: {
      '--color-purple-50': 'oklch(97.7% 0.014 308.299)',
      '--color-purple-100': 'oklch(94.6% 0.033 307.174)',
      '--color-purple-200': 'oklch(90.2% 0.063 306.703)',
      '--color-purple-300': 'oklch(82.7% 0.119 306.383)',
      '--color-purple-400': 'oklch(71.4% 0.203 305.504)',
      '--color-purple-500': 'oklch(62.7% 0.265 303.9)',
      '--color-purple-600': 'oklch(55.8% 0.288 302.321)',
      '--color-purple-700': 'oklch(49.6% 0.265 301.924)',
      '--color-purple-800': 'oklch(43.8% 0.218 303.724)',
      '--color-purple-900': 'oklch(38.1% 0.176 304.987)',
      '--color-purple-950': 'oklch(29.1% 0.149 302.717)',
    },
  },
  {
    key: 'emerald',
    title: 'สีเขียว (ว่าง/สำเร็จ) — emerald',
    variables: {
      '--color-emerald-50': 'oklch(97.9% 0.021 166.113)',
      '--color-emerald-100': 'oklch(95% 0.052 163.051)',
      '--color-emerald-200': 'oklch(90.5% 0.093 164.15)',
      '--color-emerald-300': 'oklch(84.5% 0.143 164.978)',
      '--color-emerald-400': 'oklch(76.5% 0.177 163.223)',
      '--color-emerald-500': 'oklch(69.6% 0.17 162.48)',
      '--color-emerald-600': 'oklch(59.6% 0.145 163.225)',
      '--color-emerald-700': 'oklch(50.8% 0.118 165.612)',
      '--color-emerald-800': 'oklch(43.2% 0.095 166.913)',
      '--color-emerald-900': 'oklch(37.8% 0.077 168.94)',
      '--color-emerald-950': 'oklch(26.2% 0.051 172.552)',
    },
  },
  {
    key: 'orange',
    title: 'สีส้ม — orange',
    variables: {
      '--color-orange-50': 'oklch(98% 0.016 73.684)',
      '--color-orange-100': 'oklch(95.4% 0.038 75.164)',
      '--color-orange-200': 'oklch(90.1% 0.076 70.697)',
      '--color-orange-300': 'oklch(83.7% 0.128 66.29)',
      '--color-orange-400': 'oklch(75% 0.183 55.934)',
      '--color-orange-500': 'oklch(70.5% 0.213 47.604)',
      '--color-orange-600': 'oklch(64.6% 0.222 41.116)',
      '--color-orange-700': 'oklch(55.3% 0.195 38.402)',
      '--color-orange-800': 'oklch(47% 0.157 37.304)',
      '--color-orange-900': 'oklch(40.8% 0.123 38.172)',
      '--color-orange-950': 'oklch(26.6% 0.079 36.259)',
    },
  },
  {
    key: 'promo-page',
    title: 'หน้าโปรโมชัน (เปิดจากช่องโฆษณา)',
    variables: {
      '--promo-page-bg': '#0b0814',
      '--promo-page-glow': '#2a1245',
      '--promo-page-media-bg': '#1c1530',
      '--promo-page-text': '#fafaf9',
      '--promo-page-muted': '#b8b2ad',
      '--promo-page-highlight': '#fbbf24',
      '--promo-page-badge': '#fde68a',
      '--promo-page-button-from': '#ea580c',
      '--promo-page-button-to': '#c026d3',
      '--promo-page-offer-from': '#c2410c',
      '--promo-page-offer-to': '#a21caf',
      '--promo-page-shadow': 'rgba(192, 38, 211, 0.35)',
      '--promo-page-glass': 'rgba(10, 8, 20, 0.58)',
      '--promo-page-font': "'Prompt', 'Noto Sans Thai', sans-serif",
    },
  },
  {
    key: 'promo-dialog',
    title: 'หน้าขอโปรโมท (ฟอร์มจองช่องโฆษณา)',
    variables: {
      '--promo-bg': '#09080e',
      '--promo-surface': '#100c1c',
      '--promo-surface-active': '#1c1432',
      '--promo-border': 'rgb(88 28 135 / 35%)',
      '--promo-text': '#fafaf9',
      '--promo-muted': '#a8a29e',
      '--promo-accent': '#fda4af',
      '--promo-orange': '#f97316',
      '--promo-fuchsia': '#d946ef',
    },
  },
]

export const DEFAULT_THEME_VARIABLES: Record<string, string> = Object.assign({}, ...THEME_VARIABLE_GROUPS.map((g) => g.variables))

/** Where a scope's variables apply. The admin area is never themed. */
export function themeSelector(scope: ThemeScope, region?: RegionId): string {
  const site = ":root:not([data-view='admin'])"
  if (scope === 'region') return `${site}[data-region='${region}']`
  if (scope === 'promo') return ':root .theme-scope-promo'
  return site
}

/** CSS text that sets `variables` under `selector`. */
export const themeVariablesCss = (selector: string, variables: Record<string, string>) => {
  const lines = Object.entries(variables).map(([name, value]) => `  ${name}: ${value};`)
  return lines.length ? `${selector} {\n${lines.join('\n')}\n}\n` : ''
}

export interface ThemeManifest {
  name: string
  description: string
  version: string
  author: string
  variables: Record<string, string>
  /** Path of the stylesheet inside the zip, or ''. */
  stylesheet: string
}

const VARIABLE_NAME = /^--[A-Za-z0-9_-]{1,80}$/
// Values go into a <style> block, so anything that could end a declaration or the block is refused.
const UNSAFE_VALUE = /[;{}<>\\]|\/\*|expression\s*\(|javascript:/i

/** Checks theme.json; `variables` may be flat or grouped one level deep. Returns the first problem in Thai. */
export function cleanThemeManifest(raw: unknown): { manifest: ThemeManifest; error?: string } {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (value: unknown, max: number) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '')
  const manifest: ThemeManifest = {
    name: text(input.name, THEME_LIMITS.name),
    description: text(input.description, THEME_LIMITS.description),
    version: text(input.version, 20),
    author: text(input.author, 60),
    variables: {},
    stylesheet: text(input.stylesheet, 200),
  }
  if (!manifest.name) return { manifest, error: 'theme.json ต้องมี "name" (ชื่อธีม)' }

  const entries: [string, unknown][] = []
  const vars = input.variables && typeof input.variables === 'object' && !Array.isArray(input.variables) ? (input.variables as Record<string, unknown>) : {}
  for (const [key, value] of Object.entries(vars)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) entries.push(...Object.entries(value as Record<string, unknown>))
    else entries.push([key, value])
  }
  if (entries.length > THEME_LIMITS.variables) return { manifest, error: `ตัวแปรในธีมมีได้ไม่เกิน ${THEME_LIMITS.variables} ตัว` }
  for (const [name, value] of entries) {
    if (!VARIABLE_NAME.test(name)) return { manifest, error: `ชื่อตัวแปร "${name.slice(0, 40)}" ไม่ถูกต้อง ต้องขึ้นต้นด้วย -- และใช้ตัวอักษรอังกฤษ ตัวเลข - _` }
    const v = text(value, THEME_LIMITS.value + 1)
    if (!v) continue
    if (v.length > THEME_LIMITS.value || UNSAFE_VALUE.test(v)) return { manifest, error: `ค่าของ ${name} ไม่ถูกต้อง (ห้ามมี ; { } < > \\ หรือยาวเกิน ${THEME_LIMITS.value} ตัวอักษร)` }
    manifest.variables[name] = v
  }
  return { manifest }
}

/** Points relative url()s in variable values at the theme's folder, e.g. `url(assets/bg.jpg)`. */
export function resolveThemeUrls(variables: Record<string, string>, base: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(variables)) {
    out[name] = value.replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (match, quote: string, url: string) => {
      if (/^(https?:|data:|\/)/i.test(url)) return match
      const clean = url.replace(/^\.\//, '')
      return clean.split('/').includes('..') ? 'none' : `url(${quote}${base}${clean}${quote})`
    })
  }
  return out
}
