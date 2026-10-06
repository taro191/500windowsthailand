// Builds the site and force-pushes web/dist to the `deploy` branch of the GitHub repo.
// The Plesk host (500windowsthailand.yaydang.com) pulls that branch into its web root,
// so the server only receives static files and never needs Node.js.
//
//   npm run deploy
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(webDir, 'dist')
const run = (cmd, cwd = webDir) => execSync(cmd, { cwd, stdio: 'inherit' })
const read = (cmd, cwd = webDir) => execSync(cmd, { cwd }).toString().trim()

const remote = read('git remote get-url origin')
const sourceCommit = read('git rev-parse --short HEAD')
if (read('git status --porcelain')) {
  console.warn('⚠️  There are uncommitted changes; the deploy will include them but they are not on GitHub yet.')
}

run('npm run build')
if (!existsSync(path.join(distDir, 'index.html'))) throw new Error('Build did not produce dist/index.html')

const work = mkdtempSync(path.join(tmpdir(), '500windows-deploy-'))
try {
  cpSync(distDir, work, { recursive: true })
  run('git init -q -b deploy', work)
  run('git add -A', work)
  run(`git commit -q -m "deploy: build of ${sourceCommit}"`, work)
  run(`git push -f "${remote}" deploy`, work)
  console.log(`\n✅ Pushed build of ${sourceCommit} to the deploy branch. Plesk will pull it (or press "Pull updates" in Plesk › Git).`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
