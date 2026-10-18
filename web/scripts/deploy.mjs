// Builds the web app and the API server, then force-pushes them to the `deploy` branch of the
// GitHub repo. The Plesk host (500windowsthailand.com) pulls that branch into
// /500windowsthailand.com and runs it as a Node.js app (Passenger):
//
//   app.cjs           startup file (Passenger loads CommonJS; it imports server.mjs)
//   server.mjs        API + dependencies in one file, so the host needs no npm install
//   public/           the built web app (document root), served by the API as well
//   public/design/    the original Figma Make design (../design), built to live under /design
//   public/.htaccess  301 from the old subdomain (500windowsthailand.yaydang.com) to the new domain
//   tmp/restart.txt   changes every deploy, so Passenger restarts the app
//
//   npm run deploy
//   npm run deploy -- --dry-run   (build and package, but don't push)
//
// Before pushing, the packaged app is started once with a throwaway SQLite database (smokeTest):
// if it can't start or answer, nothing is pushed and the live site keeps the previous build.
import { execSync, spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = path.resolve(webDir, '../server')
const webDist = path.join(webDir, 'dist')
const serverBundle = path.join(serverDir, 'dist/server.mjs')
const designDir = path.resolve(webDir, '../design')
const designDist = path.join(designDir, 'dist')
const run = (cmd, cwd = webDir) => execSync(cmd, { cwd, stdio: 'inherit' })
const read = (cmd, cwd = webDir) => execSync(cmd, { cwd }).toString().trim()
const dryRun = process.argv.includes('--dry-run')

/** Starts the packaged app like Passenger does and checks that the API and the web page answer. */
async function smokeTest(appDir) {
  const data = mkdtempSync(path.join(tmpdir(), '500windows-smoke-'))
  const port = 40000 + Math.floor(Math.random() * 10000)
  let output = ''
  const child = spawn(process.execPath, ['app.cjs'], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      DB_CLIENT: 'sqlite',
      SQLITE_FILE: path.join(data, 'smoke.sqlite'),
      UPLOAD_DIR: path.join(data, 'uploads'),
      PUBLIC_DIR: path.join(appDir, 'public'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))
  let exited = false
  child.on('exit', () => (exited = true))

  const base = `http://127.0.0.1:${port}`
  const check = async (url, test) => {
    const res = await fetch(base + url)
    const body = await res.text()
    if (!res.ok || !test(body)) throw new Error(`${url} answered ${res.status}: ${body.slice(0, 200)}`)
  }
  try {
    const deadline = Date.now() + 60_000
    for (;;) {
      if (exited) throw new Error('the server stopped while starting')
      try {
        await check('/api/health', (b) => JSON.parse(b).success === true)
        break
      } catch (error) {
        if (Date.now() > deadline) throw error
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    await check('/api/config', (b) => JSON.parse(b).success === true)
    await check('/api/boards', (b) => JSON.parse(b).success === true)
    await check('/', (b) => b.includes('<div id="root">'))
    console.log('✅ Smoke test: the packaged server starts and answers.')
  } catch (error) {
    throw new Error(`Smoke test failed, nothing was pushed: ${error.message}
--- server output ---
${output.slice(-3000)}`)
  } finally {
    child.kill()
    await new Promise((resolve) => (exited ? resolve() : child.on('exit', resolve)))
    rmSync(data, { recursive: true, force: true })
  }
}

const remote = read('git remote get-url origin')
const sourceCommit = read('git rev-parse --short HEAD')
if (read('git status --porcelain')) {
  console.warn('⚠️  There are uncommitted changes; the deploy will include them but they are not on GitHub yet.')
}

run('npm run build')
run('npm test', serverDir)
run('npm run build', serverDir)
// The design is reference only: install without writing a lockfile, and build it for the /design path.
if (!existsSync(path.join(designDir, 'node_modules'))) run('npm install --no-package-lock --no-audit --no-fund', designDir)
execSync('npx vite build --emptyOutDir', { cwd: designDir, stdio: 'inherit', env: { ...process.env, FIGMA_PUBLIC_URL: '/design' } })
if (!existsSync(path.join(webDist, 'index.html'))) throw new Error('Build did not produce web/dist/index.html')
if (!existsSync(serverBundle)) throw new Error('Build did not produce server/dist/server.mjs')
if (!existsSync(path.join(designDist, 'index.html'))) throw new Error('Build did not produce design/dist/index.html')

const work = mkdtempSync(path.join(tmpdir(), '500windows-deploy-'))
try {
  cpSync(webDist, path.join(work, 'public'), { recursive: true })
  cpSync(designDist, path.join(work, 'public/design'), { recursive: true })
  // The site moved from the old subdomain; Apache sends its visitors to the same path on the new domain.
  writeFileSync(
    path.join(work, 'public/.htaccess'),
    [
      'RewriteEngine On',
      'RewriteCond %{HTTP_HOST} ^500windowsthailand\\.yaydang\\.com$ [NC]',
      'RewriteRule ^ https://500windowsthailand.com%{REQUEST_URI} [R=301,L]',
      '',
    ].join('\n'),
  )
  cpSync(serverBundle, path.join(work, 'server.mjs'))
  writeFileSync(path.join(work, 'app.cjs'), "import('./server.mjs').catch((error) => { console.error(error); process.exit(1) })\n")
  await smokeTest(work)
  mkdirSync(path.join(work, 'tmp'))
  writeFileSync(path.join(work, 'tmp/restart.txt'), `${sourceCommit} ${new Date().toISOString()}\n`)
  run('git init -q -b deploy', work)
  run('git config core.autocrlf false', work)
  run('git add -A', work)
  run(`git commit -q -m "deploy: build of ${sourceCommit}"`, work)
  if (dryRun) {
    console.log(`\nDry run, nothing pushed. The deploy branch would contain:\n${read('git ls-files', work)}`)
  } else {
    run(`git push -f "${remote}" deploy`, work)
    console.log(`\n✅ Pushed build of ${sourceCommit} to the deploy branch. Plesk will pull it (or press "Pull updates" in Plesk › Git).`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
