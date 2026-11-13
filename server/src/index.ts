// Server entry: migrate, seed, then serve the API and (if PUBLIC_DIR is set) the built web app.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Context } from 'hono'
import { config } from './config'
import { createDb } from './db'
import { migrate } from './db/migrations'
import { seed } from './db/seed'
import { createSecrets } from './lib/crypto'
import { createApp } from './app'
import { startFinanceFeed } from './services/financeFeed'
import { startTrialSweep } from './services/purchases'
import { requestOrigin } from './services/sharePage'
import { fallbackPage, homePage, podPage, regionPage, robotsTxt, sitemapXml, windowPage, type SeoPage } from './services/seo'
import type { AppContext } from './context'

async function main() {
  const ctx: AppContext = { db: createDb(config.db), config, secrets: createSecrets(config.appSecret) }
  await migrate(ctx.db)
  await seed(ctx)

  const app = createApp(ctx)
  startFinanceFeed(ctx)
  startTrialSweep(ctx)
  const indexHtml = config.publicDir && path.join(config.publicDir, 'index.html')
  if (indexHtml && existsSync(indexHtml)) {
    const root = path.relative(process.cwd(), config.publicDir) || '.'
    const html = readFileSync(indexHtml, 'utf8')
    const originOf = (c: Context) => requestOrigin(c.req.url, c.req.header('x-forwarded-proto'))
    // Pages Google indexes get real content and their own status; on a database error the plain app still opens.
    const seo = async (c: Context, load: (origin: string) => Promise<SeoPage>) => {
      const page = await load(originOf(c)).catch((error) => {
        console.error(error)
        return { status: 200 as const, html }
      })
      return c.html(page.html, page.status)
    }
    app.get('/robots.txt', (c) => c.text(robotsTxt(originOf(c))))
    app.get('/sitemap.xml', async (c) => {
      const xml = await sitemapXml(ctx, originOf(c))
      return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' })
    })
    // Before serveStatic, which would answer / with the plain index.html.
    app.get('/', (c) => seo(c, (origin) => homePage(ctx, html, origin)))
    app.get('/index.html', (c) => c.redirect('/', 301))
    // The original design is a separate static site under public/design/.
    app.get('/design', (c) => c.redirect('/design/', 301))
    app.use('/assets/*', serveStatic({ root, onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }))
    app.use('*', serveStatic({ root }))
    // Single-page app: these paths return index.html with that page's preview tags and content.
    app.get('/r/:region', (c) => seo(c, (origin) => regionPage(ctx, html, c.req.param('region'), origin)))
    app.get('/w/:region/:num', (c) => seo(c, (origin) => windowPage(ctx, html, c.req.param('region'), c.req.param('num'), origin)))
    app.get('/pod/:slug', (c) => seo(c, (origin) => podPage(ctx, html, c.req.param('slug'), origin)))
    app.get('*', (c) => {
      const page = fallbackPage(html, new URL(c.req.url).pathname)
      return c.html(page.html, page.status)
    })
    console.log(`serving web app from ${config.publicDir}`)
  }

  // Passenger (Plesk) passes the port through PORT as well.
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`500 Windows API listening on http://localhost:${info.port} (${config.db.client})`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
