// Bundles the API and its dependencies into dist/server.mjs, so the host only needs Node.js
// (no npm install). Start it with `npm start` or `node dist/server.mjs`.
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [path.join(serverDir, 'src/index.ts')],
  outfile: path.join(serverDir, 'dist/server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  alias: { '@shared': path.resolve(serverDir, '../shared') },
  // mysql2 is CommonJS and calls require() for Node built-ins, which an ESM bundle doesn't have.
  // Aliased so bundled packages that import createRequire themselves (e.g. fflate) don't clash.
  banner: { js: "import { createRequire as __bannerCreateRequire } from 'node:module'; const require = __bannerCreateRequire(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'info',
})
