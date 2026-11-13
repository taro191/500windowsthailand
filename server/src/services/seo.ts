// Search engines: robots.txt, sitemap.xml, and index.html with real content for the pages Google indexes
// (home, region pages /r/<region>, windows /w/<region>/<num>, pods /pod/<slug>). The app replaces the
// server-rendered content in #root as soon as it starts, so visitors see the same app as before.
import { CATEGORIES } from '@shared/categories'
import { REGIONS, REGION_IDS, REGIONS_BY_ID } from '@shared/regions'
import type { PodLink } from '@shared/pod'
import type { CategoryId, Region, RegionId, WindowProfile } from '@shared/types'
import type { AppContext } from '../context'
import { escapeHtml, podSharePage, setMeta, windowSharePage } from './sharePage'

export interface SeoPage {
  status: 200 | 404
  html: string
}

const SITE = '500 Windows to Thailand'
const HOME_TITLE = '500 Windows to Thailand - 500 หน้าต่างสู่ประเทศไทย'
const HOME_DESCRIPTION =
  "500 Windows to Thailand - 500 หน้าต่างสู่ประเทศไทย 'ประกาศให้โลกรู้ ฉันอยู่ตรงนี้' แพลตฟอร์มถือครองและจัดแสดงหน้าต่างตัวแทนแห่งสยามประเทศ 3,500 บาน ใน 7 ภูมิภาค"

/** Owned windows anyone may find on Google: published, not held or taken down, paid (not a free trial), owner not opted out. */
function searchableWindows(ctx: AppContext) {
  return ctx.db
    .selectFrom('windows')
    .innerJoin('users', 'users.id', 'windows.owner_id')
    .where('windows.published_at', 'is not', null)
    .where('windows.suspended_at', 'is', null)
    .where('windows.taken_down_at', 'is', null)
    .where('windows.trial_ends_at', 'is', null)
    .where('users.disabled', '=', 0)
    .where('users.hide_from_search', '=', 0)
}

const regionLabel = (r: Region) => (r.isCoreHeart ? r.name : `หน้าต่าง${r.name}`)
const text = (s: string, max = 2000) => escapeHtml(s.trim().slice(0, max)).replace(/\r?\n/g, '<br>')
const day = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined)

function setCanonical(html: string, url: string) {
  const tag = `<link rel="canonical" href="${escapeHtml(url)}" />`
  const pattern = /<link\s+rel="canonical"[^>]*>/
  return pattern.test(html) ? html.replace(pattern, () => tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

const noindex = (html: string) => setMeta(html, 'name', 'robots', 'noindex')

function setTitle(html: string, title: string, description: string, url: string) {
  let page = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
  page = setMeta(page, 'name', 'description', description)
  page = setMeta(page, 'property', 'og:title', title)
  page = setMeta(page, 'property', 'og:description', description)
  page = setMeta(page, 'property', 'og:url', url)
  return setCanonical(page, url)
}

/** Puts readable content (and JSON-LD) in the empty #root of index.html. */
function setBody(html: string, content: string, jsonLd: object[]) {
  const scripts = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('')
  const main =
    '<main style="max-width:720px;margin:0 auto;padding:24px 16px;line-height:1.7;color:#d6d3d1;font-family:Prompt,sans-serif">' +
    content +
    '</main>'
  return html.replace(/<div id="root"><\/div>/, () => `<div id="root">${main}</div>${scripts}`)
}

const link = (href: string, label: string) => `<a href="${escapeHtml(href)}" style="color:#fda4af">${escapeHtml(label)}</a>`

function breadcrumb(origin: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: origin + item.path })),
  }
}

/** 404 for a link that names nothing; the app still opens so a visitor lands on the board. */
export const notFoundPage = (html: string): SeoPage => ({ status: 404, html: noindex(html) })

/** Any other path: /pod (your own pod) is an app page kept out of search, everything else is a 404. */
export function fallbackPage(html: string, pathname: string): SeoPage {
  return /^\/pod\/?$/.test(pathname) ? { status: 200, html: noindex(html) } : notFoundPage(html)
}

export function robotsTxt(origin: string) {
  // /api/ stays crawlable: Google loads it to render the app.
  return `User-agent: *\nAllow: /\nDisallow: /design/\n\nSitemap: ${origin}/sitemap.xml\n`
}

export async function sitemapXml(ctx: AppContext, origin: string) {
  const windows = await searchableWindows(ctx)
    .select(['windows.region', 'windows.num', 'windows.content_updated_at', 'windows.published_at'])
    .orderBy('windows.region')
    .orderBy('windows.num')
    .execute()
  const pods = await ctx.db
    .selectFrom('pods')
    .innerJoin('users', 'users.id', 'pods.user_id')
    .select(['pods.slug', 'pods.updated_at'])
    .where('users.disabled', '=', 0)
    .where('users.hide_from_search', '=', 0)
    .orderBy('pods.slug')
    .execute()
  const urls: { path: string; lastmod?: string }[] = [
    { path: '/' },
    ...REGION_IDS.map((r) => ({ path: `/r/${r}` })),
    { path: '/kap/central.html' },
    { path: '/kap/co-center.html' },
    ...windows.map((w) => ({ path: `/w/${w.region}/${w.num}`, lastmod: day(w.content_updated_at ?? w.published_at) })),
    ...pods.map((p) => ({ path: `/pod/${p.slug}`, lastmod: day(p.updated_at) })),
  ]
  const body = urls
    .map((u) => `  <url><loc>${escapeHtml(origin + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

/** Home: what the site is, with links to the 7 region pages. */
export async function homePage(ctx: AppContext, html: string, origin: string): Promise<SeoPage> {
  const counts = await searchableWindows(ctx)
    .select(['windows.region', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('windows.region')
    .execute()
  const open = Object.fromEntries(counts.map((c) => [c.region, Number(c.n)]))
  const regions = REGIONS.map(
    (r) =>
      `<li>${link(`/r/${r.id}`, `${r.icon} ${regionLabel(r)} (${r.englishName})`)} — ${escapeHtml(r.description)}` +
      `${open[r.id] ? ` · เปิดแล้ว ${open[r.id]} บาน` : ''}</li>`,
  ).join('')
  const content =
    `<h1>${escapeHtml(HOME_TITLE)}</h1>` +
    `<p>${escapeHtml(HOME_DESCRIPTION)}</p>` +
    `<h2>ภูมิภาค</h2><ul>${regions}</ul>` +
    `<p>${link('/kap/central.html', 'ส่วนกลาง 500 Windows Thailand')} · ${link('/kap/co-center.html', 'Co Center')}</p>`
  let page = setTitle(html, `${HOME_TITLE} | Kapsulep`, HOME_DESCRIPTION, `${origin}/`)
  page = setBody(page, content, [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, alternateName: '500 หน้าต่างสู่ประเทศไทย', url: `${origin}/`, inLanguage: 'th' }])
  return { status: 200, html: page }
}

/** /r/<region>: the region with a link to each of its windows that can be found on Google. */
export async function regionPage(ctx: AppContext, html: string, regionParam: string, origin: string): Promise<SeoPage> {
  if (!REGION_IDS.includes(regionParam as RegionId)) return notFoundPage(html)
  const region = REGIONS_BY_ID[regionParam as RegionId]
  const windows = await searchableWindows(ctx)
    .select(['windows.num', 'windows.code', 'windows.title', 'windows.province'])
    .where('windows.region', '=', region.id)
    .orderBy('windows.num')
    .execute()
  const label = regionLabel(region)
  const list = windows.length
    ? `<ul>${windows.map((w) => `<li>${link(`/w/${region.id}/${w.num}`, `${w.title || `บาน ${w.code}`} · ${w.code}`)}${w.province ? ` (${escapeHtml(w.province)})` : ''}</li>`).join('')}</ul>`
    : '<p>ยังไม่มีหน้าต่างที่เปิดแล้ว จองหน้าต่างของคุณได้เลย</p>'
  const others = REGIONS.filter((r) => r.id !== region.id)
    .map((r) => link(`/r/${r.id}`, regionLabel(r)))
    .join(' · ')
  const content =
    `<p>${link('/', SITE)} › ${escapeHtml(label)}</p>` +
    `<h1>${escapeHtml(region.icon)} ${escapeHtml(label)} (${escapeHtml(region.englishName)})</h1>` +
    `<p>${escapeHtml(region.description)}</p>` +
    `<p>${region.windowCount} บาน · จังหวัด: ${escapeHtml(region.provinces.join(', '))}</p>` +
    `<h2>หน้าต่างที่เปิดแล้ว (${windows.length} บาน)</h2>${list}` +
    `<h2>ภูมิภาคอื่น</h2><p>${others}</p>`
  const url = `${origin}/r/${region.id}`
  let page = setTitle(html, `${label} (${region.englishName}) | ${SITE}`, region.description, url)
  page = setBody(page, content, [breadcrumb(origin, [{ name: SITE, path: '/' }, { name: label, path: `/r/${region.id}` }])])
  return { status: 200, html: page }
}

function parseProfile(json: string | null): Partial<WindowProfile> {
  try {
    return json ? (JSON.parse(json) as Partial<WindowProfile>) : {}
  } catch {
    return {}
  }
}

/** /w/<region>/<num>: the window's content for Google; vacant, held, trial and opted-out windows are noindex. */
export async function windowPage(ctx: AppContext, html: string, regionParam: string, numParam: string, origin: string): Promise<SeoPage> {
  const num = Number(numParam)
  if (!REGION_IDS.includes(regionParam as RegionId) || !Number.isInteger(num)) return notFoundPage(html)
  const region = REGIONS_BY_ID[regionParam as RegionId]
  const row = await ctx.db
    .selectFrom('windows')
    .leftJoin('users', 'users.id', 'windows.owner_id')
    .select([
      'windows.code',
      'windows.title',
      'windows.description',
      'windows.image_url',
      'windows.category',
      'windows.province',
      'windows.profile_json',
      'windows.owner_id',
      'windows.published_at',
      'windows.suspended_at',
      'windows.taken_down_at',
      'windows.trial_ends_at',
      'users.name as owner_name',
      'users.disabled as owner_disabled',
      'users.hide_from_search',
    ])
    .where('windows.region', '=', region.id)
    .where('windows.num', '=', num)
    .executeTakeFirst()
  if (!row) return notFoundPage(html)

  const url = `${origin}/w/${region.id}/${num}`
  let page = setCanonical((await windowSharePage(ctx, html, region.id, String(num), origin)) ?? html, url)
  const searchable =
    row.owner_id && row.published_at && !row.suspended_at && !row.taken_down_at && !row.trial_ends_at && !row.owner_disabled && !row.hide_from_search
  if (!searchable) return { status: 200, html: noindex(page) }

  const profile = parseProfile(row.profile_json)
  const title = row.title || `บาน ${row.code}`
  const owner = profile.ownerLabel?.trim() || row.owner_name || ''
  const category = CATEGORIES[row.category as CategoryId]?.label
  const image = /^https?:\/\//.test(row.image_url) ? row.image_url : row.image_url.startsWith('/') ? origin + row.image_url : ''
  const label = regionLabel(region)
  const content =
    `<p>${link('/', SITE)} › ${link(`/r/${region.id}`, label)} › ${escapeHtml(row.code)}</p>` +
    `<article><h1>${escapeHtml(title)}</h1>` +
    `<p>${[row.code, row.province, category].filter(Boolean).map((s) => escapeHtml(s!)).join(' · ')}</p>` +
    (image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="max-width:100%;height:auto;border-radius:12px" />` : '') +
    (row.description ? `<p>${text(row.description)}</p>` : '') +
    (owner ? `<p>เจ้าของหน้าต่าง: ${escapeHtml(owner)}</p>` : '') +
    (profile.about?.trim() ? `<h2>เกี่ยวกับ</h2><p>${text(profile.about)}</p>` : '') +
    (profile.tags?.length ? `<p>${profile.tags.slice(0, 20).map((t) => `#${escapeHtml(String(t))}`).join(' ')}</p>` : '') +
    '</article>'
  page = setBody(page, content, [
    breadcrumb(origin, [
      { name: SITE, path: '/' },
      { name: label, path: `/r/${region.id}` },
      { name: `${title} · ${row.code}`, path: `/w/${region.id}/${num}` },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: row.description.slice(0, 300) || region.description,
      url,
      ...(image ? { primaryImageOfPage: image } : {}),
      inLanguage: 'th',
    },
  ])
  return { status: 200, html: page }
}

/** /pod/<slug>: the pod's name, intro and links; noindex when the owner opted out. */
export async function podPage(ctx: AppContext, html: string, slug: string, origin: string): Promise<SeoPage> {
  const row = await ctx.db
    .selectFrom('pods')
    .innerJoin('users', 'users.id', 'pods.user_id')
    .select(['pods.slug', 'pods.name', 'pods.bio', 'pods.links_json', 'users.disabled', 'users.hide_from_search'])
    .where('pods.slug', '=', slug.toLowerCase())
    .executeTakeFirst()
  if (!row || row.disabled) return notFoundPage(html)
  let page = setCanonical((await podSharePage(ctx, html, row.slug, origin)) ?? html, `${origin}/pod/${row.slug}`)
  if (row.hide_from_search) return { status: 200, html: noindex(page) }

  let links: PodLink[] = []
  try {
    links = JSON.parse(row.links_json || '[]') as PodLink[]
  } catch {
    links = []
  }
  const items = links
    .filter((l) => /^https?:\/\//.test(l.url))
    .map(
      (l) =>
        `<li><a href="${escapeHtml(l.url)}" rel="nofollow ugc noopener" style="color:#fda4af">${escapeHtml(l.title || l.url)}</a>` +
        `${l.desc ? ` — ${escapeHtml(l.desc)}` : ''}</li>`,
    )
    .join('')
  const content =
    `<h1>${escapeHtml(row.name)}</h1>` +
    (row.bio ? `<p>${text(row.bio)}</p>` : '') +
    (items ? `<ul>${items}</ul>` : '') +
    `<p>${link('/', SITE)} : Pod</p>`
  page = setBody(page, content, [])
  return { status: 200, html: page }
}
