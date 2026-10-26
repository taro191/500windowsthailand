// Shared window links (/w/<region>/<num>): index.html with the window's own preview tags,
// since chat apps and social sites read meta tags without running the app.
import { REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import type { RegionId } from '@shared/types'
import type { AppContext } from '../context'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Public origin of the request; Passenger/Apache pass the real scheme in X-Forwarded-Proto. */
export function requestOrigin(url: string, forwardedProto?: string) {
  const u = new URL(url)
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)
  const proto = forwardedProto?.split(',')[0].trim() || (local ? u.protocol.replace(':', '') : 'https')
  return `${proto}://${u.host}`
}

/** Replaces (or adds) one <meta> tag in the page head. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`
  const pattern = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`)
  return pattern.test(html) ? html.replace(pattern, () => tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

/** index.html for a shared window, or null when the link does not name a window. */
export async function windowSharePage(ctx: AppContext, html: string, region: string, numParam: string, origin: string) {
  const num = Number(numParam)
  if (!REGION_IDS.includes(region as RegionId) || !Number.isInteger(num)) return null
  const row = await ctx.db
    .selectFrom('windows')
    .select(['code', 'title', 'description', 'image_url'])
    .where('region', '=', region)
    .where('num', '=', num)
    .executeTakeFirst()
  if (!row) return null

  const title = `${row.title || `บาน ${row.code}`} · ${row.code} | 500 Windows to Thailand`
  const description = (row.description || REGIONS_BY_ID[region as RegionId].description).replace(/\s+/g, ' ').trim().slice(0, 200)
  const image = row.image_url && (/^https?:\/\//.test(row.image_url) ? row.image_url : row.image_url.startsWith('/') ? origin + row.image_url : '')

  let page = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
  page = setMeta(page, 'name', 'description', description)
  page = setMeta(page, 'property', 'og:title', title)
  page = setMeta(page, 'property', 'og:description', description)
  page = setMeta(page, 'property', 'og:url', `${origin}/w/${region}/${num}`)
  if (image) {
    page = setMeta(page, 'property', 'og:image', image)
    page = setMeta(page, 'name', 'twitter:image', image)
  }
  return page
}
