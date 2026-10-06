// Server entry: migrate, seed, then serve the API and (if PUBLIC_DIR is set) the built web app.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { config } from './config'
import { createDb } from './db'
import { migrate } from './db/migrations'
import { seed } from './db/seed'
import { createSecrets } from './lib/crypto'
import { createApp } from './app'
import type { AppContext } from './context'

async function main() {
  const ctx: AppContext = { db: createDb(config.db), config, secrets: createSecrets(config.appSecret) }
  await migrate(ctx.db)
  await seed(ctx)

  const app = createApp(ctx)
  const indexHtml = config.publicDir && path.join(config.publicDir, 'index.html')
  if (indexHtml && existsSync(indexHtml)) {
    const root = path.relative(process.cwd(), config.publicDir) || '.'
    app.use('/assets/*', serveStatic({ root, onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }))
    app.use('*', serveStatic({ root }))
    // Single-page app: any other GET returns index.html.
    const html = readFileSync(indexHtml, 'utf8')
    app.get('*', (c) => c.html(html))
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
