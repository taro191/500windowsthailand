// Builds the web app and the API server, then force-pushes them to the `deploy` branch of the
// GitHub repo. The Plesk host (500windowsthailand.com) pulls that branch into
// /500windowsthailand.com and runs it as a Node.js app (Passenger):
//
//   app.cjs           startup file (Passenger loads CommonJS; it imports server.mjs)
//   server.mjs        API + dependencies in one file, so the host needs no npm install
//   public/           the built web app (document root), served by the API as well
//   public/.htaccess  301 from the old subdomain (500windowsthailand.yaydang.com) to the new domain
//   tmp/restart.txt   changes every deploy, so Passenger restarts the app
//
//   npm run deploy
//   npm run deploy -- --dry-run   (build and package, but don't push)
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = path.resolve(webDir, '../server')
const webDist = path.join(webDir, 'dist')
const serverBundle = path.join(serverDir, 'dist/server.mjs')
const run = (cmd, cwd = webDir) => execSync(cmd, { cwd, stdio: 'inherit' })
const read = (cmd, cwd = webDir) => execSync(cmd, { cwd }).toString().trim()
const dryRun = process.argv.includes('--dry-run')

const remote = read('git remote get-url origin')
const sourceCommit = read('git rev-parse --short HEAD')
if (read('git status --porcelain')) {
  console.warn('⚠️  There are uncommitted changes; the deploy will include them but they are not on GitHub yet.')
}

run('npm run build')
run('npm test', serverDir)
run('npm run build', serverDir)
if (!existsSync(path.join(webDist, 'index.html'))) throw new Error('Build did not produce web/dist/index.html')
if (!existsSync(serverBundle)) throw new Error('Build did not produce server/dist/server.mjs')

const work = mkdtempSync(path.join(tmpdir(), '500windows-deploy-'))
try {
  cpSync(webDist, path.join(work, 'public'), { recursive: true })
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
