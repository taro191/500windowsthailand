// End-to-end API tests against an in-memory SQLite database: npm test
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { before, describe, it } from 'node:test'
import { config } from '../src/config'
import { createDb } from '../src/db'
import { migrate } from '../src/db/migrations'
import { seed } from '../src/db/seed'
import { createSecrets } from '../src/lib/crypto'
import { createApp } from '../src/app'
import { pushFinanceFeed } from '../src/services/financeFeed'
import { expireTrials } from '../src/services/purchases'
import { requestOrigin, windowSharePage } from '../src/services/sharePage'
import { firstRoundOfDay, freePromoRounds, schedulePromoRounds } from '@shared/promo'
import type { AppContext } from '../src/context'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** A valid Thai citizen ID built from 12 digits plus the checksum digit. */
function citizenId(seed: number) {
  const base = String(110000000000 + seed).slice(0, 12)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (13 - i)
  return base + ((11 - (sum % 11)) % 10)
}

let app: ReturnType<typeof createApp>
let ctx: AppContext

let clientSeq = 0
/** A browser-like client that keeps its cookies, from its own address (separate login rate limit). */
function client() {
  let cookies: Record<string, string> = {}
  const address = `10.0.${Math.floor(++clientSeq / 250)}.${clientSeq % 250}`
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(`/api${url}`, {
      method,
      headers: {
        ...(body !== undefined || method !== 'GET' ? { 'content-type': 'application/json' } : {}),
        cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
        'x-forwarded-for': address,
        ...headers,
      },
      body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
    })
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(';')
      const [name, value] = pair.split('=')
      if (value) cookies[name] = value
      else delete cookies[name]
    }
    const json = (await res.json()) as any
    return { status: res.status, ...json }
  }
  return {
    get: (url: string) => call('GET', url),
    post: (url: string, body?: unknown, headers?: Record<string, string>) => call('POST', url, body, headers),
    patch: (url: string, body?: unknown) => call('PATCH', url, body),
    put: (url: string, body?: unknown) => call('PUT', url, body),
    reset: () => (cookies = {}),
  }
}

let seq = 0
/** Signs up a new account and completes KYC. */
async function verifiedUser(name = 'ผู้ทดสอบ') {
  const c = client()
  seq++
  const phone = `081${String(1000000 + seq).slice(-7)}`
  const citizen = citizenId(seq * 7919)
  const signup = await c.post('/auth/signup', { name: `${name} ${seq}`, email: `user${seq}@test.th`, phone, citizenId: citizen, password: 'secret-pass' })
  assert.equal(signup.success, true, signup.error)
  const otp = await c.post('/kyc/otp', { phone })
  assert.ok(otp.devCode)
  const kyc = await c.post('/kyc/verify', { citizenId: citizen, phone, otp: otp.devCode })
  assert.equal(kyc.success, true, kyc.error)
  assert.equal(kyc.user.isVerified, true)
  return { c, user: kyc.user }
}

async function adminClient() {
  const c = client()
  const res = await c.post('/auth/login', { identifier: 'admin@test.th', password: 'admin-pass-123' })
  assert.equal(res.success, true, res.error)
  return c
}

const wallet = (amount: number) => ({ walletAmount: amount, externalAmount: 0 })
const content = { title: 'บานทดสอบ', description: 'ทดสอบ', imageUrl: PNG, category: 'street_food', province: 'กรุงเทพมหานคร' }

/** Credits a wallet through the simulated card channel. */
async function topUpByCard(c: ReturnType<typeof client>, amount: number) {
  const res = await c.post('/wallet/topup', { amount, channelId: 'ch-card' })
  assert.equal(res.success, true, res.error)
  assert.equal(res.pending, false)
  return res.user.balance as number
}

before(async () => {
  ctx = {
    db: createDb({ client: 'sqlite', sqliteFile: ':memory:' }),
    config: {
      ...config,
      uploadDir: mkdtempSync(path.join(tmpdir(), '500w-test-')),
      admin: { email: 'admin@test.th', password: 'admin-pass-123' },
      superAdminEmail: 'admin@test.th',
      cardPayments: 'simulated',
      otpMode: 'dev',
      demoTools: true,
    },
    secrets: createSecrets('test-secret-test-secret-test-secret'),
  }
  await migrate(ctx.db, false)
  await seed(ctx)
  app = createApp(ctx)
})

describe('public API', () => {
  it('serves config and boards', async () => {
    const c = client()
    const cfg = await c.get('/config')
    assert.equal(cfg.success, true)
    assert.ok(cfg.settings.paymentChannels.length > 0)
    const boards = await c.get('/boards')
    assert.ok(boards.windows.some((w: any) => w.code === 'KAP-TH-001'), 'demo windows are seeded')
    assert.ok(boards.windows.every((w: any) => w.ownerContact === undefined), 'owner contact is private')
  })

  it('rejects non-JSON mutations (CSRF guard)', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })
    assert.equal(res.status, 415)
  })

  it('counts one like per visitor per day', async () => {
    const c = client()
    const first = await c.post('/windows/thailand/1/like')
    const second = await c.post('/windows/thailand/1/like')
    assert.equal(first.counted, true)
    assert.equal(second.counted, false)
    assert.equal(second.window.likesCount, first.window.likesCount)
  })

  it('gives shared window links that window\'s preview tags', async () => {
    const html = '<head>\n<title>Site</title>\n<meta\n  name="description"\n  content="site"\n/>\n<meta property="og:title" content="Site" />\n</head>'
    const page = await windowSharePage(ctx, html, 'thailand', '1', 'https://example.th')
    assert.ok(page)
    assert.match(page, /<meta property="og:image" content="https:\/\/(images\.unsplash\.com|example\.th\/)/)
    assert.match(page, /<meta property="og:url" content="https:\/\/example\.th\/w\/thailand\/1" \/>/)
    assert.match(page, /<title>[^<]*KAP-TH-001[^<]*<\/title>/)
    assert.equal(page.match(/name="description"/g)?.length, 1, 'the description tag is replaced, not duplicated')
    assert.equal(await windowSharePage(ctx, html, 'mars', '1', 'https://example.th'), null)
    assert.equal(await windowSharePage(ctx, html, 'thailand', '9999', 'https://example.th'), null)
    assert.equal(requestOrigin('http://500windowsthailand.com/w/thailand/1'), 'https://500windowsthailand.com')
    assert.equal(requestOrigin('http://localhost:3001/w/thailand/1'), 'http://localhost:3001')
  })
})

describe('accounts', () => {
  it('validates sign-up and refuses duplicates', async () => {
    const c = client()
    const bad = await c.post('/auth/signup', { name: 'x', email: 'x@test.th', phone: '0811111111', citizenId: '1234567890123', password: 'secret-pass' })
    assert.equal(bad.status, 400)
    const { user } = await verifiedUser()
    const dup = await client().post('/auth/signup', { name: 'y', email: user.email, phone: '0899999999', citizenId: citizenId(424242), password: 'secret-pass' })
    assert.equal(dup.status, 409)
  })

  it('logs in by email or phone and never returns the password', async () => {
    const { user } = await verifiedUser()
    const c = client()
    const wrong = await c.post('/auth/login', { identifier: user.email, password: 'nope' })
    assert.equal(wrong.status, 401)
    const byPhone = await c.post('/auth/login', { identifier: user.phone, password: 'secret-pass' })
    assert.equal(byPhone.success, true)
    assert.equal(byPhone.user.password, undefined)
    const session = await c.get('/session')
    assert.equal(session.user.id, user.id)
    await c.post('/auth/logout')
    assert.equal((await c.get('/session')).user, null)
  })

  it('stores citizen IDs encrypted, not in clear text', async () => {
    const { user } = await verifiedUser()
    const row = await ctx.db.selectFrom('users').selectAll().where('id', '=', user.id).executeTakeFirstOrThrow()
    const digits = user.citizenId.replace(/-/g, '')
    assert.ok(!JSON.stringify(row).includes(digits))
  })

  it('requires KYC before buying', async () => {
    const c = client()
    await c.post('/auth/signup', { name: 'ไม่ยืนยัน', email: 'nokyc@test.th', phone: '0822222222', citizenId: citizenId(99), password: 'secret-pass' })
    const res = await c.post('/windows/thailand/10/claim', { content, payment: wallet(500) })
    assert.equal(res.status, 403)
    assert.equal(res.requiresKYC, true)
  })
})

describe('claiming and paying', () => {
  it('claims with the wallet after a card top-up, and enforces the quota', async () => {
    const { c } = await verifiedUser()
    const noMoney = await c.post('/windows/thailand/20/claim', { content, payment: wallet(500) })
    assert.equal(noMoney.status, 400)
    assert.equal(await topUpByCard(c, 1000), 1000)

    const claim = await c.post('/windows/thailand/20/claim', { content, payment: wallet(500) })
    assert.equal(claim.success, true, claim.error)
    assert.equal(claim.pending, false)
    assert.equal(claim.window.status, 'occupied')
    assert.equal(claim.user.balance, 500)
    assert.match(claim.window.imageUrl, /^\/uploads\/windows\//)

    const second = await c.post('/windows/thailand/21/claim', { content, payment: wallet(500) })
    assert.equal(second.status, 403)
    assert.equal(second.quotaExceeded, true)
  })

  it('refuses a payment that does not add up to the price', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 1000)
    const res = await c.post('/windows/north/5/claim', { content, payment: wallet(100) })
    assert.equal(res.status, 400)
  })

  it('holds a window while the slip is checked, then completes on approval', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 200)
    const payment = { walletAmount: 200, externalAmount: 300, channelId: 'ch-kbank', slip: { slipUrl: PNG, slipRef: 'REF1' } }
    const claim = await c.post('/windows/central/7/claim', { content, payment })
    assert.equal(claim.success, true, claim.error)
    assert.equal(claim.pending, true)
    assert.equal(claim.user.balance, 0, 'wallet part is taken right away')
    assert.equal(claim.window.reserved, true)

    const other = await verifiedUser()
    await topUpByCard(other.c, 500)
    const blocked = await other.c.post('/windows/central/7/claim', { content, payment: wallet(500) })
    assert.equal(blocked.status, 409)

    // The slip is private: the payer and admins only.
    const slip = await app.request(claim.order.slipUrl)
    assert.equal(slip.status, 403)

    const admin = await adminClient()
    const decided = await admin.post(`/admin/orders/${claim.order.id}/decide`, { decision: 'approved' })
    assert.equal(decided.success, true, decided.error)
    const window = await c.get('/windows/central/7')
    assert.equal(window.window.ownerId, claim.user.id)
    assert.equal(window.window.reserved, undefined)
  })

  it('returns the wallet part and frees the window when the slip is rejected', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 100)
    const payment = { walletAmount: 100, externalAmount: 400, channelId: 'ch-promptpay', slip: { slipUrl: PNG } }
    const claim = await c.post('/windows/east/9/claim', { content, payment })
    assert.equal(claim.pending, true)
    const admin = await adminClient()
    const noReason = await admin.post(`/admin/orders/${claim.order.id}/decide`, { decision: 'rejected' })
    assert.equal(noReason.status, 400)
    await admin.post(`/admin/orders/${claim.order.id}/decide`, { decision: 'rejected', note: 'ยอดไม่ตรง' })
    const session = await c.get('/session')
    assert.equal(session.user.balance, 100)
    assert.equal(session.orders[0].status, 'rejected')
    const window = await c.get('/windows/east/9')
    assert.equal(window.window.status, 'available')
    assert.equal(window.window.reserved, undefined)
    const again = await admin.post(`/admin/orders/${claim.order.id}/decide`, { decision: 'approved' })
    assert.equal(again.status, 409)
  })

  it('tops up by slip only after admin approval', async () => {
    const { c } = await verifiedUser()
    const res = await c.post('/wallet/topup', { amount: 700, channelId: 'ch-truemoney', slip: { slipUrl: PNG } })
    assert.equal(res.pending, true)
    assert.equal(res.user.balance, 0)
    const admin = await adminClient()
    await admin.post(`/admin/orders/${res.order.id}/decide`, { decision: 'approved' })
    assert.equal((await c.get('/session')).user.balance, 700)
  })
})


describe('window status', () => {
  it('shows a reserved window as pending, welcomes the new owner once, and hides a suspended window', async () => {
    const { c } = await verifiedUser('สมหญิง ใจดี')
    const payment = { walletAmount: 0, externalAmount: 500, channelId: 'ch-kbank', slip: { slipUrl: PNG } }
    const claim = await c.post('/windows/central/30/claim', { content, payment })
    assert.equal(claim.pending, true, claim.error)
    const pending = (await client().get('/windows/central/30')).window
    assert.equal(pending.lifecycle, 'pending')
    assert.equal(pending.reservedBy, 'สมหญ', 'only the first letters of the first name')
    assert.equal(pending.reservedByMe, undefined)
    assert.equal((await c.get('/windows/central/30')).window.reservedByMe, true)
    const onBoardPending = (viewer: ReturnType<typeof client>) => viewer.get('/boards').then((b) => b.windows.find((w: any) => w.region === 'central' && w.id === 30))
    assert.equal((await onBoardPending(client())).lifecycle, 'pending')
    assert.equal((await onBoardPending(client())).reservedByMe, undefined)
    assert.equal((await onBoardPending(c)).reservedByMe, true, 'the reserver finds it under "บานของฉัน"')

    const admin = await adminClient()
    await admin.post(`/admin/orders/${claim.order.id}/decide`, { decision: 'approved' })
    const owned = (await c.get('/windows/central/30')).window
    assert.equal(owned.lifecycle, undefined)
    assert.equal(owned.welcome, true)
    assert.equal((await client().get('/windows/central/30')).window.welcome, undefined, 'only the owner is welcomed')
    assert.equal((await c.post('/windows/central/30/welcomed')).window.welcome, undefined)
    assert.equal((await c.get('/windows/central/30')).window.welcome, undefined)

    assert.equal((await admin.post('/admin/windows/central/30/suspend', { suspended: true, reason: '' })).status, 400)
    assert.equal((await admin.post('/admin/windows/central/1/suspend', { suspended: true, reason: 'x' })).status, 400, 'an empty window cannot be held')
    const held = await admin.post('/admin/windows/central/30/suspend', { suspended: true, reason: 'มีผู้แจ้งเนื้อหาไม่เหมาะสม' })
    assert.equal(held.success, true, held.error)
    const seen = (await client().get('/windows/central/30')).window
    assert.equal(seen.lifecycle, 'suspended')
    assert.equal(seen.title, '')
    assert.equal(seen.imageUrl, '')
    assert.equal(seen.ownerName, '')
    assert.equal(seen.ownerId, '')
    assert.deepEqual(seen.profile.gallery, [])
    const onBoard = (await client().get('/boards')).windows.find((w: any) => w.region === 'central' && w.id === 30)
    assert.equal(onBoard.title, '')
    assert.equal((await admin.get('/windows/central/30')).window.title, content.title, 'admins still see the content')

    // The owner keeps their content and can edit it, but can't publish or link while held.
    const ownView = (await c.get('/windows/central/30')).window
    assert.equal(ownView.lifecycle, 'suspended')
    assert.equal(ownView.title, content.title)
    assert.equal(ownView.unpublished, undefined)
    const edited = await c.put('/windows/central/30/profile', { tags: ['x'] })
    assert.equal(edited.success, true, edited.error)
    assert.equal((await c.post('/windows/central/30/publish')).status, 403)
    assert.equal((await client().post('/windows/central/30/like')).status, 403)
    assert.equal(await windowSharePage(ctx, '<head><title>Site</title></head>', 'central', '30', 'https://example.th'), null)

    const released = await admin.post('/admin/windows/central/30/suspend', { suspended: false, reason: 'ตรวจแล้วไม่พบปัญหา' })
    assert.equal(released.success, true, released.error)
    assert.equal((await client().get('/windows/central/30')).window.title, content.title)
  })

  it('keeps a window "กำลังพัฒนา" until its owner publishes, including after a takedown', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 500)
    const claim = await c.post('/windows/central/31/claim', { content, payment: wallet(500) })
    assert.equal(claim.success, true, claim.error)
    assert.equal((await client().get('/windows/central/31')).window.lifecycle, undefined, 'the claim form publishes')

    const admin = await adminClient()
    const down = await admin.post('/admin/windows/central/31/takedown', { reason: 'ภาพไม่เหมาะสม' })
    assert.equal(down.success, true, down.error)
    const visitor = (await client().get('/windows/central/31')).window
    assert.equal(visitor.lifecycle, 'building')
    assert.equal(visitor.title, '', 'unpublished content is not sent to visitors')
    assert.equal(visitor.unpublished, undefined)
    const own = (await c.get('/windows/central/31')).window
    assert.equal(own.lifecycle, 'building')
    assert.equal(own.unpublished, true)
    assert.equal(own.title, claim.window.title, 'the content is kept for the owner')
    assert.equal(own.imageUrl, claim.window.imageUrl)
    assert.equal(own.takenDown.reason, 'ภาพไม่เหมาะสม')
    assert.equal((await admin.get('/windows/central/31')).window.title, claim.window.title, 'admins see it too')
    assert.equal((await client().get('/windows/central/31')).window.takenDown, undefined)
    assert.ok(!(await client().get('/co-center')).windows.some((x: any) => x.url === '/w/central/31'))

    // An admin can lift it; taking it down again keeps it hidden until the owner edits.
    const lifted = await admin.post('/admin/windows/central/31/takedown', { reason: 'ตรวจแล้วไม่ผิด', hidden: false })
    assert.equal(lifted.success, true, lifted.error)
    assert.equal((await client().get('/windows/central/31')).window.title, claim.window.title)
    assert.equal((await admin.post('/admin/windows/central/31/takedown', { reason: 'ภาพไม่เหมาะสม' })).success, true)

    assert.equal((await c.post('/windows/central/31/publish')).status, 400, 'needs an edit first')
    const { c: other } = await verifiedUser()
    assert.equal((await other.post('/windows/central/31/publish')).status, 403)
    assert.equal((await client().post('/windows/central/31/publish')).status, 401)

    const edited = await c.put('/windows/central/31/profile', { gallery: [PNG] })
    assert.equal(edited.success, true, edited.error)
    const published = await c.post('/windows/central/31/publish')
    assert.equal(published.success, true, published.error)
    assert.equal(published.window.lifecycle, undefined)
    assert.equal(published.window.unpublished, undefined)
    assert.equal((await client().get('/windows/central/31')).window.lifecycle, undefined)
    assert.equal((await c.post('/windows/central/31/publish')).success, true, 'publishing again is harmless')
  })
})

describe('free trial window', () => {
  const backdate = (num: number, days: number) =>
    ctx.db.updateTable('windows').set({ trial_ends_at: new Date(Date.now() - days * 86_400_000).toISOString() }).where('region', '=', 'central').where('num', '=', num).execute()

  it('holds one window per user unpaid, shown to visitors, not for resale until paid', async () => {
    assert.equal((await client().post('/windows/central/40/trial', { content })).status, 401)
    const { c } = await verifiedUser()
    const started = await c.post('/windows/central/40/trial', { content })
    assert.equal(started.success, true, started.error)
    assert.equal(started.user.trialUsed, true)
    assert.equal(started.window.lifecycle, undefined, 'public from the start')
    assert.ok(Date.parse(started.window.trialEndsAt) > Date.now() + 59 * 86_400_000)
    const visitor = (await client().get('/windows/central/40')).window
    assert.equal(visitor.title, content.title, 'visitors see the content')
    assert.ok(visitor.trialEndsAt, 'marked as a trial for everyone')
    assert.equal((await c.post('/windows/central/41/trial', { content })).status, 403, 'one trial per user')
    assert.equal((await c.post('/windows/central/40/listing', { price: 900 })).status, 403, 'no resale during the trial')

    await topUpByCard(c, 500)
    const paid = await c.post('/windows/central/40/trial/pay', { payment: wallet(500) })
    assert.equal(paid.success, true, paid.error)
    assert.equal(paid.window.lifecycle, undefined, 'published right after paying')
    assert.equal(paid.window.trialEndsAt, undefined)
    assert.equal(paid.user.balance, 0)
    assert.equal((await client().get('/windows/central/40')).window.title, content.title)
    assert.equal((await c.post('/windows/central/40/trial/pay', { payment: wallet(500) })).status, 400)
  })

  it('completes a trial payment when the slip is approved', async () => {
    const { c } = await verifiedUser()
    assert.equal((await c.post('/windows/central/42/trial', { content })).success, true)
    const payment = { walletAmount: 0, externalAmount: 500, channelId: 'ch-kbank', slip: { slipUrl: PNG } }
    const pending = await c.post('/windows/central/42/trial/pay', { payment })
    assert.equal(pending.success, true, pending.error)
    assert.equal(pending.pending, true)
    const admin = await adminClient()
    const decided = await admin.post(`/admin/orders/${pending.order.id}/decide`, { decision: 'approved' })
    assert.equal(decided.success, true, decided.error)
    const w = (await c.get('/windows/central/42')).window
    assert.equal(w.lifecycle, undefined)
    assert.equal(w.trialEndsAt, undefined)
  })

  it('releases an unpaid trial when it ends and restores it only into the same window', async () => {
    const { c } = await verifiedUser()
    const edited = { ...content, title: 'บานทดลองของฉัน' }
    assert.equal((await c.post('/windows/central/43/trial', { content: edited })).success, true)
    assert.equal((await c.put('/windows/central/43/profile', { gallery: [PNG] })).success, true)
    await backdate(43, -1)
    assert.equal(await expireTrials(ctx), 0, 'still in the trial')
    await backdate(43, 0.01)
    assert.equal((await c.post('/windows/central/43/trial/pay', { payment: wallet(500) })).status, 400, 'too late to pay')
    assert.equal(await expireTrials(ctx), 1, 'released as soon as the trial ends')
    const freed = (await client().get('/windows/central/43')).window
    assert.equal(freed.status, 'available')
    assert.equal(freed.lifecycle, undefined)

    const me = (await c.get('/session')).user
    assert.equal(me.trialArchive.title, 'บานทดลองของฉัน')
    assert.equal(me.trialArchive.code, freed.code)
    assert.ok(Date.parse(me.trialArchive.restoreUntil) > Date.now() + 29 * 86_400_000)
    assert.equal((await c.post('/windows/central/44/trial', { content })).status, 403, 'the trial is used up')
    await topUpByCard(c, 500)
    const restore = (num: number) =>
      c.post(`/windows/central/${num}/claim`, { content: { ...content, imageUrl: me.trialArchive.imageUrl }, payment: wallet(500), restoreTrial: true })
    const elsewhere = await restore(44)
    assert.equal(elsewhere.status, 400, 'not into another window')
    assert.match(elsewhere.error, /เฉพาะบานเดิม/)
    const claim = await restore(43)
    assert.equal(claim.success, true, claim.error)
    assert.equal(claim.user.trialArchive, undefined)
    assert.equal(claim.window.profile.gallery.length, 1, 'profile restored')
  })

  it('keeps a released trial restorable for 30 days only', async () => {
    const { c, user } = await verifiedUser()
    assert.equal((await c.post('/windows/central/47/trial', { content })).success, true)
    await backdate(47, 0.01)
    assert.equal(await expireTrials(ctx), 1)
    const archive = JSON.parse((await ctx.db.selectFrom('users').select('trial_archive_json').where('id', '=', user.id).executeTakeFirstOrThrow()).trial_archive_json!)
    archive.archived_at = new Date(Date.now() - 31 * 86_400_000).toISOString()
    await ctx.db.updateTable('users').set({ trial_archive_json: JSON.stringify(archive) }).where('id', '=', user.id).execute()
    assert.equal((await c.get('/session')).user.trialArchive, undefined)
    await topUpByCard(c, 500)
    const late = await c.post('/windows/central/47/claim', { content, payment: wallet(500), restoreTrial: true })
    assert.equal(late.status, 400)
  })

  it('ends the trial at once when the user buys another window', async () => {
    const { c } = await verifiedUser()
    assert.equal((await c.post('/windows/central/45/trial', { content })).success, true)
    await topUpByCard(c, 500)
    const bought = await c.post('/windows/central/46/claim', { content, payment: wallet(500) })
    assert.equal(bought.success, true, bought.error)
    const trial = (await client().get('/windows/central/45')).window
    assert.equal(trial.status, 'available', 'the trial window is free again')
    assert.equal(bought.user.trialArchive, undefined, 'its content is not kept')
  })

  it('keeps paid-only window codes for paying owners', async () => {
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    const save = (codes: string) => admin.put('/admin/settings', { settings: { ...settings, paidOnly: { codes } }, what: 'รหัสสงวน' })
    assert.equal((await save('KAP-XX-001')).status, 400)
    assert.equal((await save('KAP-S-TH-152..150')).status, 400, 'the range must go up')
    const saved = await save('kap-s-th-150..152')
    assert.equal(saved.success, true, saved.error)
    assert.equal(saved.settings.paidOnly.codes, 'KAP-S-TH-150..152')

    const { c } = await verifiedUser()
    const refused = await c.post('/windows/south/151/trial', { content })
    assert.equal(refused.status, 403)
    assert.match(refused.error, /สงวน/)
    assert.equal((await c.post('/windows/south/153/trial', { content })).success, true)
    const buyer = await verifiedUser()
    await topUpByCard(buyer.c, 500)
    assert.equal((await buyer.c.post('/windows/south/151/claim', { content, payment: wallet(500) })).success, true, 'paying owners can take it')
    assert.equal((await save('')).success, true)
  })

  it('keeps not-for-sale window codes off sale', async () => {
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    const save = (codes: string) => admin.put('/admin/settings', { settings: { ...settings, notForSale: { codes } }, what: 'บานไม่เปิดขาย' })
    assert.equal((await save('KAP-XX-001')).status, 400)
    const saved = await save('kap-s-th-161..162')
    assert.equal(saved.success, true, saved.error)
    assert.equal(saved.settings.notForSale.codes, 'KAP-S-TH-161..162')

    const buyer = await verifiedUser()
    await topUpByCard(buyer.c, 500)
    const claim = await buyer.c.post('/windows/south/161/claim', { content, payment: wallet(500) })
    assert.equal(claim.status, 403)
    assert.match(claim.error, /ไม่เปิดให้จับจอง/)
    assert.equal((await buyer.c.post('/windows/south/162/trial', { content })).status, 403, 'nor as a free trial')
    assert.equal((await buyer.c.post('/windows/south/163/claim', { content, payment: wallet(500) })).success, true)
    assert.equal((await save('')).success, true)
    const reopened = await (await verifiedUser()).c.post('/windows/south/162/trial', { content })
    assert.equal(reopened.success, true, reopened.error)
  })

  it('locks Friend and Co on trial windows', async () => {
    const trial = await verifiedUser()
    assert.equal((await trial.c.post('/windows/south/154/trial', { content })).success, true)
    const host = await verifiedUser()
    await topUpByCard(host.c, 500)
    const claimed = await host.c.post('/windows/south/155/claim', { content, payment: wallet(500) })
    assert.equal(claimed.success, true, claimed.error)
    await host.c.put('/windows/south/155/profile', { ...claimed.window.profile, friend: { open: true, from: '', to: '', note: '' } })
    const asked = await trial.c.post('/windows/south/155/links', { fromRegion: 'south', fromNum: 154 })
    assert.equal(asked.status, 403)
    assert.match(asked.error, /Friend and Co/)
    assert.equal((await host.c.post('/windows/south/154/links', { fromRegion: 'south', fromNum: 155 })).status, 403, 'nor receive requests')
  })

  it('refunds a window bought from the system within 15 days unless Friend and Co was used', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 500)
    const claimed = await c.post('/windows/south/156/claim', { content, payment: wallet(500) })
    assert.equal(claimed.success, true, claimed.error)
    assert.ok(Date.parse(claimed.window.refundUntil) > Date.now() + 14 * 86_400_000)
    assert.equal((await client().get('/windows/south/156')).window.refundUntil, undefined, 'owner only')
    const { c: other } = await verifiedUser()
    assert.equal((await other.post('/windows/south/156/refund')).status, 403)
    const refunded = await c.post('/windows/south/156/refund')
    assert.equal(refunded.success, true, refunded.error)
    assert.equal(refunded.amount, 500)
    assert.equal(refunded.user.balance, 500)
    assert.equal(refunded.window.status, 'available')
    assert.equal(refunded.window.ownerId, '')
    assert.equal((await c.post('/windows/south/156/refund')).status, 403)

    // Used Friend and Co: no refund.
    const host = await verifiedUser()
    await topUpByCard(host.c, 500)
    const h = await host.c.post('/windows/south/157/claim', { content, payment: wallet(500) })
    await host.c.put('/windows/south/157/profile', { ...h.window.profile, friend: { open: true, from: '', to: '', note: '' } })
    assert.equal((await c.post('/windows/south/158/claim', { content, payment: wallet(500) })).success, true)
    assert.equal((await c.post('/windows/south/157/links', { fromRegion: 'south', fromNum: 158 })).success, true)
    const used = await c.post('/windows/south/158/refund')
    assert.equal(used.status, 400)
    assert.match(used.error, /Friend and Co/)

    // After 15 days: no refund.
    await ctx.db.updateTable('windows').set({ claimed_at: new Date(Date.now() - 16 * 86_400_000).toISOString() }).where('region', '=', 'south').where('num', '=', 157).execute()
    assert.equal((await host.c.post('/windows/south/157/refund')).status, 400)
  })

  it('pays a refund by bank transfer once an admin records it, or returns it to the wallet', async () => {
    const { c } = await verifiedUser('ขอโอนคืน')
    await topUpByCard(c, 1000)
    assert.equal((await c.post('/windows/south/159/claim', { content, payment: wallet(500) })).success, true)
    assert.equal((await c.post('/windows/south/159/refund', { toBank: true })).status, 400, 'needs a payout account')
    const account = { type: 'bank', bankCode: 'kbank', bankName: 'กสิกรไทย', accountNumber: '1234567890', accountName: 'ผู้ทดสอบ', autoPayout: false }
    assert.equal((await c.patch('/me', { payoutAccount: account })).success, true)
    const asked = await c.post('/windows/south/159/refund', { toBank: true })
    assert.equal(asked.success, true, asked.error)
    assert.equal(asked.toBank, true)
    assert.equal(asked.user.balance, 500, 'not put in the wallet')
    assert.equal(asked.window.status, 'available')
    const mine = (await c.get('/me/refund-payouts')).payouts
    assert.equal(mine.length, 1)
    assert.equal(mine[0].status, 'pending')

    const admin = await adminClient()
    assert.ok((await admin.get('/admin/overview')).pendingRefundPayouts >= 1)
    assert.equal((await c.get('/admin/refund-payouts')).status, 403)
    const id = mine[0].id
    assert.equal((await admin.post(`/admin/refund-payouts/${id}/decide`, { decision: 'paid', note: '' })).status, 400, 'needs the reference')
    const paid = await admin.post(`/admin/refund-payouts/${id}/decide`, { decision: 'paid', note: 'REF-001' })
    assert.equal(paid.success, true, paid.error)
    assert.equal(paid.payouts.find((p: any) => p.id === id).status, 'paid')
    assert.equal((await admin.post(`/admin/refund-payouts/${id}/decide`, { decision: 'returned', note: 'x' })).status, 409, 'only once')
    assert.equal((await c.get('/session')).user.balance, 500, 'a transfer leaves the wallet as is')

    // A transfer that can't be made goes to the wallet.
    assert.equal((await c.post('/windows/south/160/claim', { content, payment: wallet(500) })).success, true)
    assert.equal((await c.post('/windows/south/160/refund', { toBank: true })).success, true)
    const second = (await c.get('/me/refund-payouts')).payouts.find((p: any) => p.status === 'pending')
    assert.equal((await admin.post(`/admin/refund-payouts/${second.id}/decide`, { decision: 'returned', note: 'บัญชีไม่ถูกต้อง' })).success, true)
    assert.equal((await c.get('/session')).user.balance, 500)
  })
})

describe('Kapsulep & Co', () => {
  it('lists owned public windows for Co Center and keeps Co Store links safe', async () => {
    const data = await client().get('/co-center')
    assert.ok(Date.parse(data.serverTime) > 0)
    const w = data.windows.find((x: any) => x.url === '/w/thailand/2')
    assert.ok(w, 'an owned window is listed')
    assert.equal(w.group, 'thailand')
    assert.equal(w.rank, 2)
    assert.ok(w.updatedAt)
    assert.ok(data.windows.every((x: any) => x.name !== undefined && x.ownerId === undefined), 'public fields only')

    const admin = await adminClient()
    await admin.post('/admin/windows/thailand/2/suspend', { suspended: true, reason: 'ทดสอบ' })
    assert.ok(!(await client().get('/co-center')).windows.some((x: any) => x.url === '/w/thailand/2'), 'held windows are left out')
    assert.ok(data.windows.every((x: any) => x.cover), 'windows without a main image (taken down) are left out')
    await admin.post('/admin/windows/thailand/2/suspend', { suspended: false, reason: 'ทดสอบ' })

    const { settings } = await client().get('/config')
    const app = { id: 'a1', name: 'สร้างโลโก้', description: 'ฟรี', url: 'https://example.com/logo', icon: '🎨', iconUrl: '', category: 'ออกแบบ', badge: 'ใหม่' }
    const bad = await admin.put('/admin/settings', { settings: { ...settings, coStore: { title: 'Kapsulep & Co', apps: [{ ...app, url: 'javascript:alert(1)' }] } }, what: 'x' })
    assert.equal(bad.status, 400)
    const saved = await admin.put('/admin/settings', { settings: { ...settings, coStore: { title: 'Kapsulep & Co', apps: [app] } }, what: 'Co Store' })
    assert.equal(saved.success, true, saved.error)
    assert.equal((await client().get('/config')).settings.coStore.apps[0].name, 'สร้างโลโก้')
    await admin.put('/admin/settings', { settings, what: 'คืนค่าเดิม' })
  })

  it('counts a profile save as an update only when visitors see a change', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 500)
    await c.post('/windows/south/77/claim', { content, payment: wallet(500) })
    const at = async () => (await ctx.db.selectFrom('windows').select('content_updated_at').where('region', '=', 'south').where('num', '=', 77).executeTakeFirstOrThrow()).content_updated_at
    await ctx.db.updateTable('windows').set({ content_updated_at: '2020-01-01T00:00:00.000Z' }).where('region', '=', 'south').where('num', '=', 77).execute()
    const { window } = await c.get('/windows/south/77')
    await c.put('/windows/south/77/profile', { ...window.profile, display: { ...window.profile.display, views: false } })
    assert.equal(await at(), '2020-01-01T00:00:00.000Z', 'hiding a counter is not an update')
    await c.put('/windows/south/77/profile', { ...window.profile, about: 'ร้านใหม่' })
    assert.notEqual(await at(), '2020-01-01T00:00:00.000Z')
  })
})
describe('resale', () => {
  it('lists after 30 days within the cap and pays the seller 95%', async () => {
    const seller = await verifiedUser('ผู้ขาย')
    await topUpByCard(seller.c, 500)
    await seller.c.post('/windows/south/3/claim', { content, payment: wallet(500) })

    const early = await seller.c.post('/windows/south/3/listing', { price: 1000 })
    assert.equal(early.status, 400, 'needs 30 days of ownership')
    await seller.c.post('/demo/windows/south/3/backdate', { days: 35 })
    const tooHigh = await seller.c.post('/windows/south/3/listing', { price: 999_999 })
    assert.equal(tooHigh.status, 400, 'price cap')
    const listed = await seller.c.post('/windows/south/3/listing', { price: 1000 })
    assert.equal(listed.window.status, 'for_resale')

    const buyer = await verifiedUser('ผู้ซื้อ')
    await topUpByCard(buyer.c, 1000)
    const stale = await buyer.c.post('/windows/south/3/buy', { expectedPrice: 900, payment: wallet(900) })
    assert.equal(stale.status, 409, 'price changed')
    const bought = await buyer.c.post('/windows/south/3/buy', { expectedPrice: 1000, payment: wallet(1000) })
    assert.equal(bought.success, true, bought.error)
    assert.equal(bought.window.ownerId, buyer.user.id)
    assert.equal((await seller.c.get('/session')).user.balance, 950)
  })

  it('follows the rules the admin sets: claim price, holding days, minimum price and commission', async () => {
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    const rules = { claimPrice: 700, commissionPercent: 10, minHoldingDays: 7, minResalePrice: 300, promoPricePerWindowRound: 40, promoMonthlyRounds: 28, promoAdvanceDays: 30 }
    const invalid = await admin.put('/admin/settings', { settings: { ...settings, rules: { ...rules, commissionPercent: 80 } }, what: 'x' })
    assert.equal(invalid.status, 400)
    const saved = await admin.put('/admin/settings', { settings: { ...settings, rules }, what: 'กติกาทั่วไป' })
    assert.equal(saved.success, true, saved.error)
    try {
      assert.deepEqual((await client().get('/config')).settings.rules, rules)
      assert.equal((await client().get('/windows/north/12')).window.claimPrice, 700)

      const seller = await verifiedUser('ผู้ขายกติกาใหม่')
      await topUpByCard(seller.c, 700)
      assert.equal((await seller.c.post('/windows/north/12/claim', { content, payment: wallet(500) })).status, 400)
      const claimed = await seller.c.post('/windows/north/12/claim', { content, payment: wallet(700) })
      assert.equal(claimed.success, true, claimed.error)

      await seller.c.post('/demo/windows/north/12/backdate', { days: 8 })
      assert.equal((await seller.c.post('/windows/north/12/listing', { price: 200 })).status, 400, 'below the minimum price')
      const listed = await seller.c.post('/windows/north/12/listing', { price: 1000 })
      assert.equal(listed.success, true, listed.error)

      const buyer = await verifiedUser('ผู้ซื้อกติกาใหม่')
      await topUpByCard(buyer.c, 1000)
      const bought = await buyer.c.post('/windows/north/12/buy', { expectedPrice: 1000, payment: wallet(1000) })
      assert.equal(bought.success, true, bought.error)
      assert.equal((await seller.c.get('/session')).user.balance, 900, '10% commission')
    } finally {
      await admin.put('/admin/settings', { settings, what: 'คืนค่าเดิม' })
    }
    assert.equal((await client().get('/windows/north/13')).window.claimPrice, 500)
  })
})

describe('promo', () => {
  const request = (startDate: string) => ({
    brand: 'ร้านทดสอบ',
    tagline: 'อร่อย',
    link: 'https://example.com',
    contact: 'line',
    images: [PNG],
    size: 2,
    rounds: 1,
    scheduleMode: 'calendar',
    startDate,
    termsAccepted: true,
  })
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)

  it('is refused while the user only holds a free trial window', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 600)
    assert.equal((await c.post('/windows/north/161/trial', { content })).success, true)
    const refused = await c.post('/promo/requests', { request: request(future), payment: wallet(60) })
    assert.equal(refused.status, 403)
    assert.match(refused.error, /บานทดลอง/)
    assert.equal((await c.post('/windows/north/161/trial/pay', { payment: wallet(500) })).success, true)
    assert.equal((await c.post('/promo/requests', { request: request(future), payment: wallet(60) })).success, true, 'paid owners can book')
  })

  it('charges on submit and refunds the full amount when rejected', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 100)
    const res = await c.post('/promo/requests', { request: request(future), payment: wallet(60) })
    assert.equal(res.success, true, res.error)
    assert.equal(res.user.balance, 40)
    const admin = await adminClient()
    const decided = await admin.post(`/admin/promo/${res.request.id}/decide`, { decision: 'rejected', note: 'ภาพไม่ชัด' })
    assert.equal(decided.refunded, 60)
    assert.equal((await c.get('/session')).user.balance, 100)
  })

  it('needs the slip checked before the request can be decided, and limits rounds per day', async () => {
    const { c } = await verifiedUser()
    const slipPayment = { walletAmount: 0, externalAmount: 60, channelId: 'ch-kbank', slip: { slipUrl: PNG } }
    const res = await c.post('/promo/requests', { request: request(future), payment: slipPayment })
    assert.equal(res.request.payment.orderStatus, 'pending')
    const admin = await adminClient()
    const early = await admin.post(`/admin/promo/${res.request.id}/decide`, { decision: 'approved' })
    assert.equal(early.status, 400)
    await admin.post(`/admin/orders/${res.request.payment.orderId}/decide`, { decision: 'approved' })
    const approved = await admin.post(`/admin/promo/${res.request.id}/decide`, { decision: 'approved' })
    assert.equal(approved.success, true, approved.error)
    assert.ok((await c.get('/promo')).ads.some((ad: any) => ad.brand === 'ร้านทดสอบ'))

    const day = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10)
    await topUpByCard(c, 1000)
    const full = await c.post('/promo/requests', { request: { ...request(day), rounds: 4 }, payment: wallet(240) })
    assert.equal(full.success, true, full.error)
    const over = await c.post('/promo/requests', { request: request(day), payment: wallet(60) })
    assert.equal(over.status, 409)
  })

  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

  it('books at most the monthly rounds per user and only up to 30 days ahead', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 1000)
    assert.equal((await c.post('/promo/requests', { request: request(inDays(32)), payment: wallet(60) })).status, 400, 'too far ahead')
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    await admin.put('/admin/settings', { settings: { ...settings, rules: { ...settings.rules, promoMonthlyRounds: 2 } }, what: 'กติกาทั่วไป' })
    try {
      const sameMonth = inDays(12)
      assert.equal((await c.post('/promo/requests', { request: request(sameMonth), payment: wallet(60) })).success, true)
      const over = await c.post('/promo/requests', { request: { ...request(sameMonth), rounds: 2 }, payment: wallet(120) })
      assert.equal(over.status, 400)
      assert.match(over.error, /สูงสุด 2 รอบต่อเดือน/)
      const nextMonth = new Date(`${sameMonth.slice(0, 7)}-01T12:00:00Z`)
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      const later = nextMonth.toISOString().slice(0, 10)
      if (later <= inDays(30)) assert.equal((await c.post('/promo/requests', { request: { ...request(later), rounds: 2 }, payment: wallet(120) })).success, true, 'a new month has its own rounds')
    } finally {
      await admin.put('/admin/settings', { settings, what: 'กติกาทั่วไป' })
    }
  })

  it('saves promo designs, reuses their images and approves an unchanged approved design at once', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 1000)
    const saved = await c.post('/promo/templates', { template: { ...request(future), name: 'แบบหลัก' } })
    assert.equal(saved.success, true, saved.error)
    const t = saved.template
    assert.equal(t.name, 'แบบหลัก')
    assert.match(t.images[0], /^\/uploads\/promo\//)
    assert.ok(t.bytes > 0)
    assert.equal(t.approved, false)

    const book = (day: string, extra: object = {}) =>
      c.post('/promo/requests', { request: { ...request(day), images: t.images, layout: t.layout, details: t.details, ...extra }, payment: wallet(60) })
    const first = await book(inDays(14))
    assert.equal(first.success, true, first.error)
    assert.equal(first.request.status, 'pending', 'a new design is reviewed')
    assert.equal(first.request.images[0], t.images[0], 'the stored image is reused')
    const admin = await adminClient()
    assert.equal((await admin.post(`/admin/promo/${first.request.id}/decide`, { decision: 'approved' })).success, true)
    assert.equal((await c.get('/promo/templates')).templates[0].approved, true)

    const again = await book(inDays(15))
    assert.equal(again.request.status, 'approved', 'the same design is approved at once')
    const changed = await book(inDays(16), { brand: 'ร้านทดสอบใหม่' })
    assert.equal(changed.request.status, 'pending', 'an edited design goes to review')

    const other = await verifiedUser('ผู้อื่น')
    await topUpByCard(other.c, 100)
    const stolen = await other.c.post('/promo/requests', { request: { ...request(inDays(17)), images: t.images }, payment: wallet(60) })
    assert.equal(stolen.status, 400, "another user's image can't be reused")

    for (let i = 0; i < 4; i++) assert.equal((await c.post('/promo/templates', { template: { ...request(future), name: `แบบ ${i}` } })).success, true)
    assert.equal((await c.post('/promo/templates', { template: request(future) })).status, 400, 'five designs at most')
    const renamed = await c.put(`/promo/templates/${t.id}`, { template: { ...t, name: 'แบบหลัก 2' } })
    assert.equal(renamed.template.name, 'แบบหลัก 2')
    assert.equal(renamed.template.approved, true)
    const removed = await c.post(`/promo/templates/${t.id}/delete`)
    assert.equal(removed.templates.length, 4)
  })

  it('saves a public pod with a held window, its own images and a unique address', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 1000)
    assert.equal((await c.post('/windows/north/71/claim', { content, payment: wallet(500) })).success, true)
    assert.equal((await c.get('/me/pod')).pod, null)
    assert.equal((await c.get('/me/pod')).windows.length, 1)

    const pod = {
      slug: 'My-Shop',
      name: 'ร้านของฉัน',
      bio: 'แนะนำตัว',
      avatar: PNG,
      profileColor: 2,
      window: { region: 'north', num: 71 },
      windowColor: 1,
      links: [{ title: 'Shop', desc: 'ร้านออนไลน์', url: 'shop.example.com', img: PNG }],
    }
    const saved = await c.put('/me/pod', { pod })
    assert.equal(saved.success, true, saved.error)
    assert.equal(saved.pod.slug, 'my-shop')
    assert.match(saved.pod.avatar, /^\/uploads\/pods\//)
    assert.equal(saved.pod.window.num, 71)

    const visitor = await client().get('/pods/my-shop')
    assert.equal(visitor.pod.name, 'ร้านของฉัน')
    assert.equal(visitor.isOwner, false)
    assert.equal(visitor.windows, undefined)
    assert.equal((await c.get('/pods/my-shop')).isOwner, true)
    assert.equal((await client().get('/pods/nobody-here')).status, 404)
    assert.equal((await client().get('/windows/north/71/pod')).pod.slug, 'my-shop', "shown on the owner's window")
    assert.equal((await client().get('/windows/north/72/pod')).pod, null)
    for (const url of ['http://shop.example.com', 'https://user:pw@shop.example.com', 'https://localhost/x', 'https://10.0.0.1/']) {
      const unsafe = await c.put('/me/pod', { pod: { ...pod, links: [{ title: 'x', desc: '', url, img: '' }] } })
      assert.equal(unsafe.status, 400, url)
    }

    const other = await verifiedUser('ผู้อื่น')
    assert.equal((await other.c.put('/me/pod', { pod: { ...pod, avatar: '', links: [], window: null } })).status, 409, 'address taken')
    const stolen = await other.c.put('/me/pod', { pod: { ...pod, slug: 'other-shop', avatar: saved.pod.avatar, links: [], window: null } })
    assert.equal(stolen.status, 400, "another pod's image can't be reused")
    const notHeld = await other.c.put('/me/pod', { pod: { ...pod, slug: 'other-shop', avatar: '', links: [] } })
    assert.equal(notHeld.status, 400, "a window you don't hold")
    assert.equal((await other.c.put('/me/pod', { pod: { ...pod, slug: 'admin', avatar: '', links: [], window: null } })).status, 400)
    const badLink = { ...pod, slug: 'other-shop', avatar: '', window: null, links: [{ title: 'x', desc: '', url: 'javascript:alert(1)', img: '' }] }
    assert.equal((await other.c.put('/me/pod', { pod: badLink })).status, 400)

    const kept = await c.put('/me/pod', { pod: { ...saved.pod, window: { region: 'north', num: 71 }, links: [] } })
    assert.equal(kept.success, true, kept.error)
    assert.equal(kept.pod.avatar, saved.pod.avatar, 'the stored avatar is kept')
    assert.equal(kept.pod.links.length, 0)
  })

  it('gives each booking its own rounds of the day and drops ads once their rounds are over', async () => {
    const day = '2030-01-15'
    const first = firstRoundOfDay(day)
    const at = (h: number) => new Date(Date.parse(`${day}T00:00:00+07:00`) + h * 3_600_000).toISOString()
    const { schedule, nextFree } = schedulePromoRounds([
      { id: 'b', startDate: day, rounds: 1, createdAt: '2030-01-02T00:00:00Z' },
      { id: 'a', startDate: day, rounds: 2, createdAt: '2030-01-01T00:00:00Z' },
      { id: 'late', startDate: day, rounds: 2, createdAt: at(19) },
    ])
    assert.deepEqual(schedule.get('a'), { from: first, to: first + 2 })
    assert.deepEqual(schedule.get('b'), { from: first + 2, to: first + 3 })
    assert.deepEqual(schedule.get('late'), { from: first + 3, to: first + 4 }, 'booked in the last round, gets only that one')
    assert.equal(freePromoRounds(day, nextFree, Date.parse(at(-48))), 0)
    assert.equal(freePromoRounds('2030-01-16', nextFree, Date.parse(at(13))), 4)
    assert.equal(freePromoRounds('2030-01-16', new Map(), Date.parse(`2030-01-16T13:00:00+07:00`)), 2, 'past rounds of today are not bookable')

    // An approved ad whose day is over is no longer placed on the board.
    const { c } = await verifiedUser()
    await topUpByCard(c, 100)
    const res = await c.post('/promo/requests', { request: { ...request(future), brand: 'โฆษณาเก่า' }, payment: wallet(60) })
    const admin = await adminClient()
    await admin.post(`/admin/promo/${res.request.id}/decide`, { decision: 'approved' })
    assert.ok((await client().get('/promo')).ads.some((ad: any) => ad.id === res.request.id))
    await ctx.db.updateTable('promo_requests').set({ start_date: '2020-01-01' }).where('id', '=', res.request.id).execute()
    assert.ok(!(await client().get('/promo')).ads.some((ad: any) => ad.id === res.request.id))
  })

  it('keeps the optional promo page details, checked, and shows them on the live ad', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 200)
    const day = new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 10)
    const bad = (details: object) => c.post('/promo/requests', { request: { ...request(day), details }, payment: wallet(60) })
    assert.equal((await bad({ mapUrl: 'javascript:alert(1)' })).status, 400)
    assert.equal((await bad({ validFrom: '2026-12-10', validTo: '2026-12-01' })).status, 400)
    assert.equal((await bad({ line: 'not a line id!' })).status, 400)
    const badLayout = await c.post('/promo/requests', { request: { ...request(day), layout: 'diagonal' }, payment: wallet(60) })
    assert.equal(badLayout.status, 400)

    const details = {
      role: 'คาเฟ่',
      offer: 'ซื้อ 1 แถม 1',
      price: '฿60',
      oldPrice: '฿120',
      validTo: day,
      line: '@cafe',
      links: [{ label: 'เมนู', url: 'https://example.com/menu' }, { label: 'ว่าง', url: '' }],
      points: ['เปิดทุกวัน', ''],
      terms: ['วันศุกร์เท่านั้น'],
    }
    const res = await c.post('/promo/requests', { request: { ...request(day), brand: 'คาเฟ่รายละเอียด', details, layout: 'vertical' }, payment: wallet(60) })
    assert.equal(res.success, true, res.error)
    assert.equal(res.request.layout, 'vertical')
    assert.equal(res.request.details.offer, 'ซื้อ 1 แถม 1')
    assert.deepEqual(res.request.details.links, [{ label: 'เมนู', url: 'https://example.com/menu' }])
    assert.deepEqual(res.request.details.points, ['เปิดทุกวัน'])
    assert.equal(res.request.details.address, '')

    const admin = await adminClient()
    assert.equal((await admin.post(`/admin/promo/${res.request.id}/decide`, { decision: 'approved' })).success, true)
    const ad = (await client().get('/promo')).ads.find((a: any) => a.id === res.request.id)
    assert.equal(ad.details.line, '@cafe')
    assert.equal(ad.layout, 'vertical')
    assert.equal(ad.contact, 'line')
    assert.equal(ad.images.length, 1)
  })
})

describe('admin', () => {
  it('is closed to normal users', async () => {
    const { c } = await verifiedUser()
    assert.equal((await c.get('/admin/overview')).status, 403)
    assert.equal((await client().get('/admin/overview')).status, 401)
  })

  it('validates and saves settings, with an audit entry', async () => {
    const admin = await adminClient()
    const { settings } = await admin.get('/config')
    const invalid = await admin.put('/admin/settings', { settings: { ...settings, topUp: { min: 500, max: 100, presets: [] } }, what: 'x' })
    assert.equal(invalid.status, 400)
    const saved = await admin.put('/admin/settings', { settings: { ...settings, topUp: { ...settings.topUp, min: 50 } }, what: 'ยอดเติมขั้นต่ำ' })
    assert.equal(saved.settings.topUp.min, 50)
    const overview = await admin.get('/admin/overview')
    assert.ok(overview.auditLog.some((a: any) => a.detail === 'ยอดเติมขั้นต่ำ'))
    assert.ok(overview.users.every((u: any) => !/^\d-\d{4}-\d{5}-\d{2}-\d$/.test(u.citizenId)), 'citizen IDs are masked')
  })

  it('suspends a user, which ends their sessions and blocks trading', async () => {
    const { c, user } = await verifiedUser()
    const admin = await adminClient()
    await admin.post(`/admin/users/${user.id}/suspend`, { suspended: true })
    assert.equal((await c.get('/session')).user, null)
    const login = await c.post('/auth/login', { identifier: user.email, password: 'secret-pass' })
    const claim = await c.post('/windows/thailand/30/claim', { content, payment: wallet(500) })
    assert.equal(login.success, true)
    assert.equal(claim.status, 403)
  })

  it('grants a user extra windows on top of the normal quota', async () => {
    const { c, user } = await verifiedUser()
    const admin = await adminClient()
    await topUpByCard(c, 2000)
    assert.equal((await c.post('/windows/northeast/70/claim', { content, payment: wallet(500) })).success, true)
    assert.equal((await c.post('/windows/south/70/claim', { content, payment: wallet(500) })).status, 403)

    assert.equal((await admin.post(`/admin/users/${user.id}/extra-windows`, { thailand: 0, regional: -1 })).status, 400)
    const granted = await admin.post(`/admin/users/${user.id}/extra-windows`, { thailand: 0, regional: 1 })
    assert.deepEqual(granted.user.extraWindows, { thailand: 0, regional: 1 })
    assert.deepEqual((await c.get('/session')).user.extraWindows, { thailand: 0, regional: 1 })
    assert.equal((await c.post('/windows/south/70/claim', { content, payment: wallet(500) })).success, true)
    const third = await c.post('/windows/north/70/claim', { content, payment: wallet(500) })
    assert.equal(third.status, 403)
    assert.match(third.error, /ไม่เกิน 2 บาน/)

    // Lowering the grant keeps the windows already held.
    const reset = await admin.post(`/admin/users/${user.id}/extra-windows`, { thailand: 0, regional: 0 })
    assert.equal(reset.user.extraWindows, undefined)
    const overview = await admin.get('/admin/overview')
    assert.equal(overview.windows.filter((w: any) => w.ownerId === user.id).length, 2)
    assert.ok(overview.auditLog.some((a: any) => a.action === 'กำหนดโควตาบานเพิ่ม'))
  })
})

describe('editing a window', () => {
  const edit = { title: 'แก้ไขแล้ว', description: 'ใหม่', category: 'street_food', province: 'กรุงเทพมหานคร' }

  async function setEditPolicy(freeEditsPerDay: number, paidEditPrice: number) {
    const admin = await adminClient()
    const { settings } = await admin.get('/config')
    const saved = await admin.put('/admin/settings', { settings: { ...settings, editPolicy: { freeEditsPerDay, paidEditPrice } }, what: 'สิทธิ์แก้ไขบาน' })
    assert.equal(saved.success, true, saved.error)
  }

  it('allows one free edit a day by default and refuses more while paid edits are off', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 500)
    assert.equal((await c.post('/windows/west/11/claim', { content, payment: wallet(500) })).success, true)

    const first = await c.patch('/windows/west/11/content', edit)
    assert.equal(first.success, true, first.error)
    assert.equal(first.charged, 0)
    assert.equal(first.window.editsToday.count, 1)

    const second = await c.patch('/windows/west/11/content', edit)
    assert.equal(second.status, 400)
    assert.match(second.error, /ครบ 1 ครั้ง/)
  })

  it('lets the admin set free edits and a price, then charges the wallet for extra edits', async () => {
    await setEditPolicy(2, 50)
    try {
      const { c } = await verifiedUser()
      await topUpByCard(c, 500)
      assert.equal((await c.post('/windows/northeast/12/claim', { content, payment: wallet(500) })).success, true)

      for (let i = 0; i < 2; i++) assert.equal((await c.patch('/windows/northeast/12/content', edit)).charged, 0)

      const unconfirmed = await c.patch('/windows/northeast/12/content', edit)
      assert.equal(unconfirmed.status, 409, 'a paid edit needs the price confirmed')
      assert.equal(unconfirmed.editFee, 50)

      const broke = await c.patch('/windows/northeast/12/content', { ...edit, editFee: 50 })
      assert.equal(broke.status, 400)
      assert.equal(broke.requiresTopUp, true)

      await topUpByCard(c, 100)
      const paid = await c.patch('/windows/northeast/12/content', { ...edit, editFee: 50 })
      assert.equal(paid.success, true, paid.error)
      assert.equal(paid.charged, 50)
      assert.equal(paid.window.editsToday.count, 3)

      const session = await c.get('/session')
      assert.equal(session.user.balance, 50)
      const fee = session.transactions.find((t: any) => t.type === 'edit_fee')
      assert.equal(fee?.amount, 50)
    } finally {
      await setEditPolicy(1, 0)
    }
  })

  it('refuses a policy with no free edits and no price', async () => {
    const admin = await adminClient()
    const { settings } = await admin.get('/config')
    const res = await admin.put('/admin/settings', { settings: { ...settings, editPolicy: { freeEditsPerDay: 0, paidEditPrice: 0 } }, what: 'x' })
    assert.equal(res.status, 400)
  })
})

describe('user management', () => {
  it('disables an account so it cannot log in, and enables it again', async () => {
    const admin = await adminClient()
    const { c, user } = await verifiedUser()
    const disabled = await admin.post(`/admin/users/${user.id}/disable`, { disabled: true })
    assert.equal(disabled.user.disabled, true)
    assert.equal((await c.get('/session')).user, null, 'existing sessions end')
    const blocked = await client().post('/auth/login', { identifier: user.email, password: 'secret-pass' })
    assert.equal(blocked.status, 403)

    await admin.post(`/admin/users/${user.id}/disable`, { disabled: false })
    const back = await client().post('/auth/login', { identifier: user.email, password: 'secret-pass' })
    assert.equal(back.success, true, back.error)
  })

  it('changes a user to admin and back', async () => {
    const admin = await adminClient()
    const { c, user } = await verifiedUser()
    assert.equal((await c.get('/admin/overview')).status, 403)
    const promoted = await admin.post(`/admin/users/${user.id}/role`, { role: 'admin' })
    assert.equal(promoted.user.role, 'admin')
    assert.equal((await c.get('/admin/overview')).success, true, 'takes effect without logging in again')

    await admin.post(`/admin/users/${user.id}/role`, { role: 'user' })
    assert.equal((await c.get('/admin/overview')).status, 403)
    const overview = await admin.get('/admin/overview')
    assert.ok(overview.auditLog.some((a: any) => a.action === 'เปลี่ยนสิทธิ์ผู้ใช้'))
  })

  it('stops admins from disabling or demoting themselves', async () => {
    const admin = await adminClient()
    const me = (await admin.get('/session')).user
    assert.equal((await admin.post(`/admin/users/${me.id}/disable`, { disabled: true })).status, 400)
    assert.equal((await admin.post(`/admin/users/${me.id}/role`, { role: 'user' })).status, 400)
  })

  it('lets the super admin create users who can log in', async () => {
    const admin = await adminClient()
    assert.equal((await admin.get('/session')).user.superAdmin, true)
    const created = await admin.post('/admin/users', { name: 'ทีมงานใหม่', email: 'Staff@Test.th', password: 'staff-pass-1', role: 'admin' })
    assert.equal(created.success, true, created.error)
    assert.equal(created.user.role, 'admin')
    assert.equal(created.user.email, 'staff@test.th')
    assert.equal(created.user.balance, 0)

    const staff = client()
    assert.equal((await staff.post('/auth/login', { identifier: 'staff@test.th', password: 'staff-pass-1' })).success, true)
    assert.equal((await staff.get('/admin/overview')).success, true)
    assert.equal((await admin.post('/admin/users', { name: 'ซ้ำ', email: 'staff@test.th', password: 'staff-pass-1', role: 'user' })).status, 409)
    assert.equal((await admin.post('/admin/users', { name: 'สั้น', email: 'short@test.th', password: 'short', role: 'user' })).status, 400)
    const overview = await admin.get('/admin/overview')
    assert.ok(overview.auditLog.some((a: any) => a.action === 'สร้างผู้ใช้'))
  })

  it('starts new members at 0 and keeps money away from admins', async () => {
    const admin = await adminClient()
    const { c, user } = await verifiedUser()
    assert.equal(user.balance, 0)
    assert.equal((await admin.post('/wallet/topup', { amount: 500, channelId: 'ch-card' })).status, 403)

    await topUpByCard(c, 500)
    const refused = await admin.post(`/admin/users/${user.id}/role`, { role: 'admin' })
    assert.equal(refused.status, 400)
    assert.match(refused.error, /ยอดเงิน/)
  })

  it('gives the signup bonus set by an admin, only within its period', async () => {
    const admin = await adminClient()
    const setBonus = async (signupBonus: object) => {
      const { settings } = await admin.get('/config')
      return admin.put('/admin/settings', { settings: { ...settings, signupBonus }, what: 'โบนัสสมัครสมาชิก' })
    }
    const hour = 3_600_000
    const at = (offset: number) => new Date(Date.now() + offset).toISOString()

    const saved = await setBonus({ amount: 300, startsAt: at(-hour), endsAt: at(hour) })
    assert.equal(saved.success, true, saved.error)
    const { c, user } = await verifiedUser()
    assert.equal(user.balance, 300)
    const tx = (await c.get('/session')).transactions
    assert.ok(tx.some((t: any) => t.type === 'bonus' && t.amount === 300), 'recorded in the wallet history')

    await setBonus({ amount: 300, startsAt: at(hour), endsAt: null })
    assert.equal((await verifiedUser()).user.balance, 0, 'not started yet')
    await setBonus({ amount: 300, startsAt: null, endsAt: at(-hour) })
    assert.equal((await verifiedUser()).user.balance, 0, 'already ended')

    assert.equal((await setBonus({ amount: 300, startsAt: at(hour), endsAt: at(-hour) })).status, 400)
    assert.equal((await setBonus({ amount: -1, startsAt: null, endsAt: null })).status, 400)
    await setBonus({ amount: 0, startsAt: null, endsAt: null })
  })

  it('keeps user creation and admin rights to the super admin', async () => {
    const admin = await adminClient()
    const { c: other, user } = await verifiedUser()
    await admin.post(`/admin/users/${user.id}/role`, { role: 'admin' })
    const superId = (await admin.get('/session')).user.id
    const { user: target } = await verifiedUser()

    assert.equal((await other.get('/session')).user.superAdmin, undefined)
    assert.equal((await other.post('/admin/users', { name: 'x', email: 'x@test.th', password: 'xxxxxxxx', role: 'user' })).status, 403)
    assert.equal((await other.post(`/admin/users/${target.id}/role`, { role: 'admin' })).status, 403)
    assert.equal((await other.post(`/admin/users/${superId}/disable`, { disabled: true })).status, 403)
    assert.equal((await other.post(`/admin/users/${superId}/suspend`, { suspended: true })).status, 403)
    assert.equal((await other.post(`/admin/users/${target.id}/disable`, { disabled: true })).success, true, 'other admin tools still work')
  })

  it('lets admins verify KYC for a user without OTP, but not their own', async () => {
    const admin = await adminClient()
    const { c: user, user: kycUser } = await verifiedUser()

    // Revoked user: verified again with the ID and phone on file.
    await admin.post(`/admin/users/${kycUser.id}/revoke-kyc`)
    assert.equal((await user.get('/session')).user.isVerified, false)
    const again = await admin.post(`/admin/users/${kycUser.id}/verify-kyc`, {})
    assert.equal(again.success, true, again.error)
    assert.equal(again.user.isVerified, true)
    assert.equal((await user.get('/session')).user.isVerified, true)

    // Account without ID or phone (created by the super admin): refused, even if some are sent.
    const created = await admin.post('/admin/users', { name: 'ไม่มีบัตร', email: 'kyc-by-admin@test.th', password: 'xxxxxxxx', role: 'user' })
    assert.equal(created.success, true, created.error)
    const incomplete = await admin.post(`/admin/users/${created.user.id}/verify-kyc`, { citizenId: citizenId(424242), phone: '0899999999' })
    assert.equal(incomplete.status, 400)
    assert.match(incomplete.error, /ข้อมูลไม่ครบ/)

    // Other admins can too, but not for their own account.
    const { c: other, user: otherUser } = await verifiedUser()
    await admin.post(`/admin/users/${otherUser.id}/role`, { role: 'admin' })
    await admin.post(`/admin/users/${kycUser.id}/revoke-kyc`)
    const byAdmin = await other.post(`/admin/users/${kycUser.id}/verify-kyc`, {})
    assert.equal(byAdmin.success, true, byAdmin.error)
    assert.equal(byAdmin.user.isVerified, true)
    await admin.post(`/admin/users/${otherUser.id}/revoke-kyc`)
    assert.equal((await other.post(`/admin/users/${otherUser.id}/verify-kyc`, {})).status, 400)
  })

  it('lets only the super admin edit user details and reset the password', async () => {
    const admin = await adminClient()
    const { c: user, user: target } = await verifiedUser('ก่อนแก้')
    const { user: someone } = await verifiedUser()
    const info = { name: 'หลังแก้', email: 'edited@test.th', phone: '0812345670', citizenId: '', bio: 'สวัสดี', password: '' }

    const saved = await admin.put(`/admin/users/${target.id}`, info)
    assert.equal(saved.success, true, saved.error)
    assert.equal(saved.user.name, 'หลังแก้')
    assert.equal(saved.user.email, 'edited@test.th')
    assert.equal(saved.user.isVerified, true)
    // Blank citizen ID keeps the one on file; the session survives without a new password.
    const me = (await user.get('/session')).user
    assert.equal(me.citizenId, target.citizenId)
    assert.equal(me.phone, '081-234-5670')

    // Another account's phone or email, or no phone on a verified user, is refused.
    assert.equal((await admin.put(`/admin/users/${target.id}`, { ...info, phone: someone.phone })).status, 409)
    assert.equal((await admin.put(`/admin/users/${target.id}`, { ...info, email: someone.email })).status, 409)
    assert.equal((await admin.put(`/admin/users/${target.id}`, { ...info, phone: '' })).status, 400)
    assert.equal((await admin.put(`/admin/users/${target.id}`, { ...info, citizenId: '1234567890123' })).status, 400)

    // A new password signs the user out and works for login.
    const reset = await admin.put(`/admin/users/${target.id}`, { ...info, password: 'new-pass-123' })
    assert.equal(reset.success, true, reset.error)
    assert.equal((await user.get('/session')).user, null)
    const login = await client().post('/auth/login', { identifier: 'edited@test.th', password: 'new-pass-123' })
    assert.equal(login.success, true, login.error)

    // Other admins can't.
    const { c: other, user: otherUser } = await verifiedUser()
    await admin.post(`/admin/users/${otherUser.id}/role`, { role: 'admin' })
    assert.equal((await other.put(`/admin/users/${target.id}`, info)).status, 403)
  })
})

describe('KYC OTP by SMS', () => {
  /** Runs `body` with OTP_MODE=sms and THSMS answered by `reply`; returns the requests sent to THSMS. */
  async function withSms(reply: { success: boolean; message?: string }, body: () => Promise<void>) {
    const sent: { url: string; auth: string; payload: any }[] = []
    const realFetch = globalThis.fetch
    const { otpMode, sms } = ctx.config
    ctx.config.otpMode = 'sms'
    ctx.config.sms = { token: 'test-token', sender: 'TESTER' }
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent.push({ url: String(url), auth: new Headers(init.headers).get('authorization') || '', payload: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify(reply), { status: reply.success ? 200 : 400, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      await body()
    } finally {
      globalThis.fetch = realFetch
      Object.assign(ctx.config, { otpMode, sms })
    }
    return sent
  }

  async function newMember() {
    const c = client()
    seq++
    const phone = `086${String(1000000 + seq).slice(-7)}`
    const citizen = citizenId(seq * 6007)
    const signup = await c.post('/auth/signup', { name: `SMS ${seq}`, email: `sms${seq}@test.th`, phone, citizenId: citizen, password: 'secret-pass' })
    assert.equal(signup.success, true, signup.error)
    return { c, phone, citizen }
  }

  it('sends the OTP through THSMS and never returns it to the app', async () => {
    const { c, phone, citizen } = await newMember()
    let otp: any
    const sent = await withSms({ success: true }, async () => {
      otp = await c.post('/kyc/otp', { phone })
    })
    assert.equal(otp.success, true, otp.error)
    assert.equal(otp.devCode, undefined)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].url, 'https://thsms.com/api/send-sms')
    assert.equal(sent[0].auth, 'Bearer test-token')
    assert.equal(sent[0].payload.sender, 'TESTER')
    assert.deepEqual(sent[0].payload.msisdn, [phone])
    assert.match(String(sent[0].payload.message), /^ใช้ OTP \d{6} ยืนยันตัวตนใน 500Windows$/)
    const code = String(sent[0].payload.message).match(/\d{6}/)?.[0]
    assert.ok(code)
    const kyc = await c.post('/kyc/verify', { citizenId: citizen, phone, otp: code })
    assert.equal(kyc.success, true, kyc.error)
    assert.equal(kyc.user.isVerified, true)
  })

  it('reports a failed SMS and keeps no usable code', async () => {
    const { c, phone, citizen } = await newMember()
    let otp: any
    await withSms({ success: false, message: 'Credit not enough' }, async () => {
      otp = await c.post('/kyc/otp', { phone })
    })
    assert.equal(otp.status, 502)
    assert.equal(otp.success, false)
    const kyc = await c.post('/kyc/verify', { citizenId: citizen, phone, otp: '123456' })
    assert.equal(kyc.status, 400)
    assert.match(kyc.error, /ขอรหัส OTP/)
  })

  it('shows the super admin why THSMS refused, without the token', async () => {
    const admin = await adminClient()
    const { c, phone } = await newMember()
    let status: any
    await withSms({ success: false, message: 'Sender name not approved' }, async () => {
      await c.post('/kyc/otp', { phone })
      status = await admin.get('/admin/sms-status')
    })
    assert.equal(status.success, true, status.error)
    assert.equal(status.otpMode, 'sms')
    assert.equal(status.tokenLength, 'test-token'.length)
    assert.equal(status.lastFailure.message, 'Sender name not approved')
    assert.equal(status.account.ok, false)
    assert.doesNotMatch(JSON.stringify(status), /test-token/)

    const { user: other } = await verifiedUser()
    await admin.post(`/admin/users/${other.id}/role`, { role: 'admin' })
    const otherAdmin = client()
    await otherAdmin.post('/auth/login', { identifier: other.email, password: 'secret-pass' })
    assert.equal((await otherAdmin.get('/admin/sms-status')).status, 403)
  })
})

describe('forgot password and personal info', () => {
  it('resets the password with the emailed code and signs the account out', async () => {
    const { c, user } = await verifiedUser()
    // Unknown emails get the same answer, with no code.
    const unknown = await client().post('/auth/password/forgot', { email: 'nobody@test.th' })
    assert.equal(unknown.success, true, unknown.error)
    assert.equal(unknown.devCode, undefined)

    const forgot = await client().post('/auth/password/forgot', { email: user.email.toUpperCase() })
    assert.equal(forgot.success, true, forgot.error)
    assert.match(forgot.devCode, /^\d{6}$/)

    const wrong = await client().post('/auth/password/reset', { email: user.email, code: '000000', password: 'brand-new-pass' })
    assert.equal(wrong.status, 400)
    const short = await client().post('/auth/password/reset', { email: user.email, code: forgot.devCode, password: 'short' })
    assert.equal(short.status, 400)
    const reset = await client().post('/auth/password/reset', { email: user.email, code: forgot.devCode, password: 'brand-new-pass' })
    assert.equal(reset.success, true, reset.error)

    assert.equal((await c.get('/session')).user, null)
    assert.equal((await client().post('/auth/login', { identifier: user.email, password: 'secret-pass' })).status, 401)
    assert.equal((await client().post('/auth/login', { identifier: user.email, password: 'brand-new-pass' })).success, true)
    // The code works once.
    const again = await client().post('/auth/password/reset', { email: user.email, code: forgot.devCode, password: 'another-pass-1' })
    assert.equal(again.status, 400)
  })

  it('never hands out the code in production without SMTP', async () => {
    const { user } = await verifiedUser()
    ctx.config.isProduction = true
    try {
      const res = await client().post('/auth/password/forgot', { email: user.email })
      assert.equal(res.status, 503)
      assert.equal(res.devCode, undefined)
    } finally {
      ctx.config.isProduction = false
    }
  })

  it('lets users edit their name, bio and email (email needs the password)', async () => {
    const { c } = await verifiedUser()
    const { user: other } = await verifiedUser()
    const named = await c.patch('/me', { name: 'ชื่อใหม่', bio: 'สวัสดีครับ' })
    assert.equal(named.success, true, named.error)
    assert.equal(named.user.name, 'ชื่อใหม่')
    assert.equal(named.user.bio, 'สวัสดีครับ')

    assert.equal((await c.patch('/me', { email: 'mine@test.th', currentPassword: 'wrong' })).status, 400)
    assert.equal((await c.patch('/me', { email: other.email, currentPassword: 'secret-pass' })).status, 409)
    const moved = await c.patch('/me', { email: 'Mine@Test.th', currentPassword: 'secret-pass' })
    assert.equal(moved.success, true, moved.error)
    assert.equal(moved.user.email, 'mine@test.th')
    assert.equal((await client().post('/auth/login', { identifier: 'mine@test.th', password: 'secret-pass' })).success, true)
    // Unchanged email needs no password.
    assert.equal((await c.patch('/me', { name: 'อีกชื่อ', email: 'mine@test.th' })).success, true)
  })

  it('lets users upload their own profile photo, replacing the old file, and go back to the default', async () => {
    const { c, user } = await verifiedUser()
    assert.equal(user.avatarUrl, '')
    assert.equal((await c.patch('/me', { avatar: 'https://example.com/me.jpg' })).status, 400)
    assert.equal((await c.patch('/me', { avatar: 'data:text/plain;base64,aGVsbG8=' })).status, 400)

    const first = await c.patch('/me', { avatar: PNG })
    assert.equal(first.success, true, first.error)
    assert.match(first.user.avatarUrl, /^\/uploads\/avatars\/img_.+\.png$/)
    const firstFile = path.join(ctx.config.uploadDir, first.user.avatarUrl.replace('/uploads/', ''))
    assert.equal(existsSync(firstFile), true)

    const second = await c.patch('/me', { avatar: PNG })
    assert.notEqual(second.user.avatarUrl, first.user.avatarUrl)
    assert.equal(existsSync(firstFile), false)
    assert.equal((await app.request(second.user.avatarUrl)).status, 200)

    const reset = await c.patch('/me', { avatar: '' })
    assert.equal(reset.user.avatarUrl, '')
    assert.equal(existsSync(path.join(ctx.config.uploadDir, second.user.avatarUrl.replace('/uploads/', ''))), false)
  })

  it('lets admins take down a profile photo, with an audit entry', async () => {
    const { c, user } = await verifiedUser()
    const { user: other } = await verifiedUser()
    const uploaded = await c.patch('/me', { avatar: PNG })
    assert.equal((await c.post(`/admin/users/${other.id}/remove-avatar`)).status, 403)

    const admin = await adminClient()
    const removed = await admin.post(`/admin/users/${user.id}/remove-avatar`)
    assert.equal(removed.success, true, removed.error)
    assert.equal(removed.user.avatarUrl, '')
    assert.equal((await c.get('/session')).user.avatarUrl, '')
    assert.equal(existsSync(path.join(ctx.config.uploadDir, uploaded.user.avatarUrl.replace('/uploads/', ''))), false)
    assert.equal((await admin.post(`/admin/users/${user.id}/remove-avatar`)).status, 400)
    const overview = await admin.get('/admin/overview')
    assert.ok(overview.auditLog.some((e: { action: string; detail: string }) => e.action === 'ลบรูปโปรไฟล์ผู้ใช้' && e.detail === user.name))
  })

  it('changes the password with the current one', async () => {
    const { c, user } = await verifiedUser()
    assert.equal((await c.post('/me/password', { currentPassword: 'nope', newPassword: 'next-pass-123' })).status, 400)
    assert.equal((await c.post('/me/password', { currentPassword: 'secret-pass', newPassword: 'next-pass-123' })).success, true)
    assert.equal((await client().post('/auth/login', { identifier: user.email, password: 'next-pass-123' })).success, true)
  })
})

describe('window profile and reviews', () => {
  async function owner(path: string) {
    const o = await verifiedUser('เจ้าของร้าน')
    await topUpByCard(o.c, 1000)
    const claim = await o.c.post(`${path}/claim`, { content, payment: wallet(500) })
    assert.equal(claim.success, true, claim.error)
    return o
  }

  it('lets the owner fill in a public page with photos, works, products and links, only in the detail', async () => {
    const { c } = await owner('/windows/east/40')
    const empty = await client().get('/windows/east/40')
    assert.equal(empty.window.profile.logoUrl, '')
    assert.equal(empty.window.profile.display.follow, true)
    assert.deepEqual(empty.window.reviews, [])

    const profile = {
      logoUrl: PNG,
      tags: ['#สินค้าเกษตร', 'ของฝาก', 'ของฝาก'],
      gallery: [PNG, PNG],
      works: [{ images: [PNG, PNG], name: 'งานออกแบบ', sub: 'โลโก้ · 2569', detail: 'โจทย์และผลลัพธ์' }, { images: [], name: '', sub: '', detail: '' }],
      products: [{ images: [PNG], name: 'ผักออร์แกนิก', sub: '฿120', detail: 'สด สะอาด' }],
      links: [
        { icon: '🌐', label: 'เว็บไซต์', url: 'baansuan.example.com' },
        { icon: '💣', label: 'อื่นๆ', url: 'https://example.com/x' },
      ],
      phone: '081-234-5678',
      lineId: '@baansuan',
      ownerLabel: '  ร้านบ้านสวน  ',
      about: 'ร้านของครอบครัว',
      display: { views: false, likes: true, today: true, followers: true, follow: true, reviews: true },
      friend: { open: true, from: '2026-01-01', to: '2026-12-31', note: 'รับเฉพาะธุรกิจในภาคตะวันออก' },
    }
    assert.equal((await client().put('/windows/east/40/profile', profile)).status, 401)
    const other = await verifiedUser()
    assert.equal((await other.c.put('/windows/east/40/profile', profile)).status, 403)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, links: [{ icon: '🔗', label: 'x', url: 'javascript:alert(1)' }] })).status, 400)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, friend: { ...profile.friend, from: '2026-12-31', to: '2026-01-01' } })).status, 400)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, gallery: ['https://example.com/x.jpg'] })).status, 400)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, works: [{ images: ['https://example.com/x.jpg'], name: 'x' }] })).status, 400)

    const saved = await c.put('/windows/east/40/profile', profile)
    assert.equal(saved.success, true, saved.error)
    const p = saved.window.profile
    assert.match(p.logoUrl, /^\/uploads\/windows\//)
    assert.equal(p.gallery.length, 2)
    assert.deepEqual(p.tags, ['สินค้าเกษตร', 'ของฝาก'])
    assert.equal(p.works.length, 1)
    assert.equal(p.works[0].images.length, 2)
    assert.match(p.products[0].images[0], /^\/uploads\/windows\//)
    assert.deepEqual(p.links, [
      { icon: '🌐', label: 'เว็บไซต์', url: 'https://baansuan.example.com' },
      { icon: '🔗', label: 'อื่นๆ', url: 'https://example.com/x' },
    ])
    assert.equal(p.display.views, false)
    assert.equal(p.friend.note, 'รับเฉพาะธุรกิจในภาคตะวันออก')
    // The owner's name for this window shows on the board instead of the account name.
    assert.equal(p.ownerLabel, 'ร้านบ้านสวน')
    assert.equal(saved.window.ownerLabel, 'ร้านบ้านสวน')
    assert.equal((await client().get('/boards')).windows.find((x: any) => x.region === 'east' && x.id === 40).ownerLabel, 'ร้านบ้านสวน')
    // Profile edits are free and don't use the daily content edits.
    assert.equal(saved.window.editsToday, undefined)

    // Dropping a work deletes its photos.
    const noWorks = await c.put('/windows/east/40/profile', { ...p, works: [] })
    assert.equal(noWorks.success, true, noWorks.error)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, p.works[0].images[0].replace('/uploads/', ''))), false)

    // Keeping one gallery photo deletes the other file.
    const kept = await c.put('/windows/east/40/profile', { ...noWorks.window.profile, gallery: [p.gallery[0]] })
    assert.equal(kept.success, true, kept.error)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, p.gallery[1].replace('/uploads/', ''))), false)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, p.gallery[0].replace('/uploads/', ''))), true)

    const boards = await client().get('/boards')
    const onBoard = boards.windows.find((w: { region: string; id: number }) => w.region === 'east' && w.id === 40)
    assert.equal(onBoard.profile, undefined)
    assert.equal((await client().get('/windows/east/40')).window.profile.phone, '081-234-5678')
  })

  it('reads profiles saved before the redesign in the new shape', async () => {
    await owner('/windows/east/46')
    const legacy = {
      logoUrl: '',
      tags: ['ของฝาก'],
      gallery: [],
      offerings: [{ imageUrl: '/uploads/windows/img_old.jpg', name: 'น้ำผึ้ง', note: 'แท้ 100%' }],
      phone: '081-234-5678',
      lineId: '@baansuan',
      ownerLabel: '  ร้านบ้านสวน  ',
      email: 'shop@test.th',
      website: 'https://baansuan.example.com',
      facebook: 'https://www.facebook.com/baansuan',
      instagram: '',
      tiktok: '',
      youtube: '',
      about: 'ร้านของครอบครัว',
      highlights: ['ปลอดสาร'],
      serviceArea: 'ทั่วประเทศ',
      shipping: '',
    }
    await ctx.db.updateTable('windows').set({ profile_json: JSON.stringify(legacy) }).where('region', '=', 'east').where('num', '=', 46).execute()
    const p = (await client().get('/windows/east/46')).window.profile
    assert.deepEqual(p.products, [{ images: ['/uploads/windows/img_old.jpg'], name: 'น้ำผึ้ง', sub: '', detail: 'แท้ 100%' }])
    assert.deepEqual(
      p.links.map((k: { icon: string; url: string }) => [k.icon, k.url]),
      [
        ['🌐', 'https://baansuan.example.com'],
        ['📘', 'https://www.facebook.com/baansuan'],
        ['✉️', 'mailto:shop@test.th'],
      ],
    )
    assert.equal(p.about, 'ร้านของครอบครัว\n\n★ จุดเด่นของเรา\n✓ ปลอดสาร\n\n📍 พื้นที่ให้บริการ: ทั่วประเทศ')
    assert.deepEqual(p.display, { views: true, likes: true, today: true, followers: true, follow: true, reviews: true })
    assert.equal(p.offerings, undefined)
  })

  it('lets the owner close follows, new reviews and Friend and Co requests', async () => {
    const { c } = await owner('/windows/east/47')
    const visitor = await verifiedUser('ลูกค้า')
    const fan = await verifiedUser('แฟน')
    assert.equal((await fan.c.post('/windows/east/47/follow')).following, true)
    assert.equal((await fan.c.post('/windows/east/47/review', { rating: 5 })).success, true)

    const closed = await c.put('/windows/east/47/profile', {
      display: { views: true, likes: true, today: true, followers: true, follow: false, reviews: false },
      friend: { open: false, from: '', to: '', note: '' },
    })
    assert.equal(closed.success, true, closed.error)
    assert.equal((await visitor.c.post('/windows/east/47/follow')).status, 403)
    assert.equal((await visitor.c.post('/windows/east/47/review', { rating: 4 })).status, 403)
    // Existing followers and reviewers keep their choice.
    assert.equal((await fan.c.post('/windows/east/47/review', { rating: 3 })).success, true)
    assert.equal((await fan.c.post('/windows/east/47/follow')).following, false)

    const partner = await owner('/windows/east/48')
    const ask = () => partner.c.post('/windows/east/47/links', { fromRegion: 'east', fromNum: 48, message: 'ขอเชื่อมลิงก์' })
    const refused = await ask()
    assert.equal(refused.status, 400)
    assert.match(refused.error, /ปิดรับ/)
    await c.put('/windows/east/47/profile', { ...closed.window.profile, friend: { open: true, from: '2000-01-01', to: '2000-12-31', note: '' } })
    assert.match((await ask()).error, /หมดช่วงเวลา/)
    await c.put('/windows/east/47/profile', { ...closed.window.profile, friend: { open: true, from: '', to: '', note: '' } })
    assert.equal((await ask()).success, true)
  })

  it('takes reviews from visitors, one each, and starts over for a new owner', async () => {
    const { c } = await owner('/windows/east/41')
    const a = await verifiedUser('ลูกค้า')
    const b = await verifiedUser('ลูกค้า')
    assert.equal((await client().post('/windows/east/41/review', { rating: 5 })).status, 401)
    assert.equal((await c.post('/windows/east/41/review', { rating: 5, text: 'ร้านฉันเอง' })).status, 403)
    assert.equal((await a.c.post('/windows/east/41/review', { rating: 6 })).status, 400)
    assert.equal((await a.c.post('/windows/east/40/review', { rating: 5 })).success, true)
    assert.equal((await a.c.post('/windows/east/2/review', { rating: 5 })).status, 400)

    await a.c.post('/windows/east/41/review', { rating: 2, text: 'ช้า' })
    const again = await a.c.post('/windows/east/41/review', { rating: 4, text: 'ดีขึ้นแล้ว' })
    await b.c.post('/windows/east/41/review', { rating: 5, text: 'อร่อย' })
    assert.equal(again.window.reviews.length, 1)
    const detail = (await client().get('/windows/east/41')).window
    assert.deepEqual(detail.reviewStats, { count: 2, average: 4.5 })
    assert.equal(detail.reviews.find((r: { userId: string }) => r.userId === a.user.id).text, 'ดีขึ้นแล้ว')

    const removed = await b.c.post('/windows/east/41/review/delete')
    assert.equal(removed.window.reviews.length, 1)

    const admin = await adminClient()
    const reviewId = detail.reviews.find((r: { userId: string }) => r.userId === a.user.id).id
    assert.equal((await a.c.post(`/admin/reviews/${reviewId}/delete`)).status, 403)
    const moderated = await admin.post(`/admin/reviews/${reviewId}/delete`)
    assert.equal(moderated.success, true, moderated.error)
    assert.equal(moderated.window.reviews.length, 0)
    assert.ok((await admin.get('/admin/overview')).auditLog.some((e: { action: string }) => e.action === 'ลบรีวิว'))

    // Released and claimed again: a new owner starts without the old page or reviews.
    await a.c.post('/windows/east/41/review', { rating: 3 })
    await c.put('/windows/east/41/profile', { about: 'เดิม' })
    const released = await admin.post('/admin/windows/east/41/release', { reason: 'ทดสอบ' })
    assert.equal(released.success, true, released.error)
    const next = await owner('/windows/east/41')
    const fresh = (await next.c.get('/windows/east/41')).window
    assert.equal(fresh.profile.about, '')
    assert.deepEqual(fresh.reviews, [])
  })

  it('lets only the owner post, edit and delete daily updates, and admins remove them', async () => {
    const { c } = await owner('/windows/east/42')
    const other = await verifiedUser()
    assert.equal((await client().post('/windows/east/42/updates', { text: 'สวัสดี' })).status, 401)
    assert.equal((await other.c.post('/windows/east/42/updates', { text: 'แอบโพสต์' })).status, 403)
    assert.equal((await c.post('/windows/east/42/updates', { text: '   ' })).status, 400)
    assert.equal((await c.post('/windows/east/42/updates', { text: 'x'.repeat(501) })).status, 400)

    await c.post('/windows/east/42/updates', { text: 'เปิดร้านวันแรก' })
    const posted = await c.post('/windows/east/42/updates', { text: 'มีของใหม่' })
    assert.equal(posted.success, true, posted.error)
    assert.deepEqual(posted.window.updates.map((u: { text: string }) => u.text), ['มีของใหม่', 'เปิดร้านวันแรก'])
    const [latest, first] = posted.window.updates

    assert.equal((await other.c.post(`/windows/east/42/updates/${latest.id}`, { text: 'แก้' })).status, 403)
    const edited = await c.post(`/windows/east/42/updates/${latest.id}`, { text: 'มีของใหม่ 3 อย่าง' })
    assert.equal(edited.window.updates[0].text, 'มีของใหม่ 3 อย่าง')
    assert.ok(edited.window.updates[0].editedAt)
    const deleted = await c.post(`/windows/east/42/updates/${first.id}/delete`)
    assert.equal(deleted.window.updates.length, 1)
    assert.equal((await client().get('/windows/east/42')).window.updates.length, 1)

    const admin = await adminClient()
    const moderated = await admin.post(`/admin/updates/${latest.id}/delete`)
    assert.equal(moderated.success, true, moderated.error)
    assert.deepEqual(moderated.window.updates, [])
    assert.ok((await admin.get('/admin/overview')).auditLog.some((e: { action: string }) => e.action === 'ลบอัปเดตประจำวัน'))
  })

  it('links other windows after the owner approves, up to 3, while both owners stay', async () => {
    const host = await owner('/windows/east/43')
    const friends = [await owner('/windows/thailand/60'), await owner('/windows/thailand/61'), await owner('/windows/thailand/62'), await owner('/windows/thailand/63')]
    const request = (i: number, message = '') => friends[i].c.post('/windows/east/43/links', { fromRegion: 'thailand', fromNum: 60 + i, message })

    assert.equal((await friends[0].c.post('/windows/east/43/links', { fromRegion: 'thailand', fromNum: 61 })).status, 403)
    assert.equal((await host.c.post('/windows/east/43/links', { fromRegion: 'east', fromNum: 43 })).status, 400)
    assert.equal((await friends[0].c.post('/windows/east/2/links', { fromRegion: 'thailand', fromNum: 60 })).status, 400)

    const first = await request(0, 'ร้านเพื่อนบ้าน')
    assert.equal(first.success, true, first.error)
    assert.equal(first.window.myLinkRequests[0].status, 'pending')
    assert.equal(first.window.linkRequests, undefined)
    await request(0, 'ส่งซ้ำ')
    for (const i of [1, 2, 3]) await request(i)

    const pending = (await host.c.get('/windows/east/43')).window.linkRequests
    assert.equal(pending.length, 4)
    assert.equal(pending.find((r: { window: { id: number } }) => r.window.id === 60).message, 'ส่งซ้ำ')
    const idOf = (i: number) => pending.find((r: { window: { id: number } }) => r.window.id === 60 + i).id

    assert.equal((await friends[0].c.post(`/windows/east/43/links/${idOf(0)}/decide`, { approve: true })).status, 403)
    for (const i of [0, 1, 2]) assert.equal((await host.c.post(`/windows/east/43/links/${idOf(i)}/decide`, { approve: true })).success, true)
    assert.equal((await host.c.post(`/windows/east/43/links/${idOf(3)}/decide`, { approve: true })).status, 400)
    const rejected = await host.c.post(`/windows/east/43/links/${idOf(3)}/decide`, { approve: false })
    assert.equal(rejected.window.linkRequests.length, 0)
    assert.equal((await friends[3].c.get('/windows/east/43')).window.myLinkRequests[0].status, 'rejected')

    const visitor = (await client().get('/windows/east/43')).window
    assert.deepEqual(visitor.links.map((l: { window: { id: number } }) => l.window.id).sort(), [60, 61, 62])
    assert.equal((await request(1)).status, 400)

    // The linked side can remove its own link; a stranger can't.
    assert.equal((await friends[3].c.post(`/windows/east/43/links/${idOf(1)}/delete`)).status, 403)
    assert.equal((await friends[1].c.post(`/windows/east/43/links/${idOf(1)}/delete`)).window.links.length, 2)

    // A linked window that changes hands drops off.
    const admin = await adminClient()
    assert.equal((await admin.post('/admin/windows/thailand/60/release', { reason: 'ทดสอบ' })).success, true)
    assert.equal((await client().get('/windows/east/43')).window.links.length, 1)
  })
})

describe('LINE alerts to the finance admin', () => {
  /** Runs `body` with LINE set up and api.line.me stubbed; returns the calls made to LINE. */
  async function withLine(body: () => Promise<void>, reply = { status: 200, json: {} as object }) {
    const calls: { url: string; auth: string; payload: any }[] = []
    const realFetch = globalThis.fetch
    const { line } = ctx.config
    ctx.config.line = { token: 'line-token', secret: 'line-secret', to: ['Ufinance'] }
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), auth: new Headers(init.headers).get('authorization') || '', payload: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    try {
      await body()
      await new Promise((r) => setTimeout(r, 50)) // alerts are sent in the background
    } finally {
      globalThis.fetch = realFetch
      ctx.config.line = line
    }
    return calls
  }

  it('alerts the finance admin when a slip waits for review, and only then', async () => {
    const { c } = await verifiedUser('สลิป')
    const calls = await withLine(async () => {
      const bySlip = await c.post('/wallet/topup', { amount: 700, channelId: 'ch-truemoney', slip: { slipUrl: PNG } }, { host: 'shop.test' })
      assert.equal(bySlip.pending, true, bySlip.error)
      const byCard = await c.post('/wallet/topup', { amount: 300, channelId: 'ch-card' })
      assert.equal(byCard.pending, false, byCard.error)
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.line.me/v2/bot/message/push')
    assert.equal(calls[0].auth, 'Bearer line-token')
    assert.equal(calls[0].payload.to, 'Ufinance')
    const text = calls[0].payload.messages[0].text
    assert.match(text, /มีสลิปรอตรวจ/)
    assert.match(text, /เติมเงินเข้ากระเป๋า/)
    assert.match(text, /฿700/)
    assert.match(text, /https:\/\/shop\.test\/#admin\/payments/)
  })

  it('sends every money movement to LINE once, from committed transactions only', async () => {
    const { c } = await verifiedUser('เคลื่อนไหว')
    const calls = await withLine(async () => {
      await pushFinanceFeed(ctx) // first run only starts from now
      await new Promise((r) => setTimeout(r, 20))
      await topUpByCard(c, 800)
      assert.equal((await c.post('/windows/west/21/claim', { content, payment: wallet(500) })).success, true)
      assert.equal((await c.post('/windows/west/22/claim', { content, payment: wallet(500) })).status, 403, 'quota: nothing recorded')
      const later = Date.now() + 10_000
      assert.equal(await pushFinanceFeed(ctx, later), 2)
      assert.equal(await pushFinanceFeed(ctx, later), 0, 'each movement is sent once')
    })
    assert.equal(calls.length, 1)
    const text = calls[0].payload.messages[0].text
    assert.match(text, /ความเคลื่อนไหวทางการเงิน 2 รายการ/)
    assert.match(text, /🟢 เติมเงิน \+฿800 · เคลื่อนไหว/)
    assert.match(text, /🔴 จับจองบาน KAP-W-TH-021 ฿500 · เคลื่อนไหว \d+ \(จ่ายด้วย กระเป๋า ฿500\)/)
  })

  it('lets the super admin switch each kind of alert off, without a backlog when it comes back on', async () => {
    const admin = await adminClient()
    const { c } = await verifiedUser('ปิดแจ้งเตือน')
    let status: any
    const calls = await withLine(async () => {
      await pushFinanceFeed(ctx, Date.now())
      status = await admin.put('/admin/line-topics', { 'slips.topup': false, 'finance.topup': false, 'not.a.topic': false })
      assert.equal(status.topics['slips.topup'], false)
      assert.equal(status.topics['finance.topup'], false)
      assert.equal(status.topics['slips.claim'], true)
      assert.equal(status.topics['finance.claim'], true)
      assert.equal('not.a.topic' in status.topics, false)
      await c.post('/wallet/topup', { amount: 500, channelId: 'ch-truemoney', slip: { slipUrl: PNG } })
      await topUpByCard(c, 300)
      await new Promise((r) => setTimeout(r, 20))
      assert.equal(await pushFinanceFeed(ctx, Date.now() + 10_000), 0, 'switched off: nothing sent')
      await admin.put('/admin/line-topics', { 'slips.topup': true, 'finance.topup': true })
      assert.equal(await pushFinanceFeed(ctx, Date.now() + 10_000), 0, 'no backlog after switching back on')

      // Only the kinds still on are listed.
      await admin.put('/admin/line-topics', { 'finance.topup': false })
      await topUpByCard(c, 500)
      assert.equal((await c.post('/windows/west/31/claim', { content, payment: wallet(500) })).success, true)
      await new Promise((r) => setTimeout(r, 20))
      assert.equal(await pushFinanceFeed(ctx, Date.now() + 10_000), 1)
      await admin.put('/admin/line-topics', { 'finance.topup': true })
    })
    assert.equal(calls.length, 1)
    assert.match(calls[0].payload.messages[0].text, /🔴 จับจองบาน KAP-W-TH-031/)
    assert.doesNotMatch(calls[0].payload.messages[0].text, /เติมเงิน/)

    const { user: other } = await verifiedUser()
    await admin.post(`/admin/users/${other.id}/role`, { role: 'admin' })
    const otherAdmin = client()
    await otherAdmin.post('/auth/login', { identifier: other.email, password: 'secret-pass' })
    assert.equal((await otherAdmin.put('/admin/line-topics', { 'slips.topup': false })).status, 403)
  })

  it('still honours the switches saved per group before topics existed', async () => {
    await ctx.db.deleteFrom('settings').where('id', '=', 'line_alert_groups').execute()
    await ctx.db.insertInto('settings').values({ id: 'line_alert_groups', value_json: JSON.stringify({ slips: false }), updated_at: new Date().toISOString() }).execute()
    const status = await (await adminClient()).get('/admin/line-status')
    assert.equal(status.topics['slips.topup'], false)
    assert.equal(status.topics['slips.promo'], false)
    assert.equal(status.topics['finance.topup'], true)
    await ctx.db.deleteFrom('settings').where('id', '=', 'line_alert_groups').execute()
  })

  it('tells LINE about new users, KYC and what admins do to accounts', async () => {
    const admin = await adminClient()
    let user: any
    const calls = await withLine(async () => {
      ;({ user } = await verifiedUser('แจ้งผู้ใช้'))
      await admin.post(`/admin/users/${user.id}/suspend`, { suspended: true })
      await admin.put('/admin/line-topics', { 'security.suspend': false })
      await admin.post(`/admin/users/${user.id}/suspend`, { suspended: false })
      await admin.put('/admin/line-topics', { 'security.suspend': true })
    })
    const texts = calls.map((call) => call.payload.messages[0].text)
    assert.equal(texts.length, 3, texts.join('\n---\n'))
    assert.match(texts[0], /👤 สมัครสมาชิกใหม่\nผู้ใช้: แจ้งผู้ใช้ \d+ \(user\d+@test\.th\)/)
    assert.match(texts[1], /👤 ยืนยันตัวตน \(KYC\) ด้วย OTP สำเร็จ/)
    assert.match(texts[2], /🔐 ระงับบัญชี\nผู้ใช้: แจ้งผู้ใช้ \d+\nโดย: /)
  })

  it('keeps every contact form message for the admins and sends it to LINE', async () => {
    const admin = await adminClient()
    const message = { name: 'คุณติดต่อ', email: 'ask@test.th', phone: '', subject: 'การชำระเงิน / เติมเงิน', message: 'โอนแล้วยอดยังไม่เข้า' }
    const withoutLine = await client().post('/contact', { ...message, message: 'ส่งตอน LINE ยังไม่พร้อม' })
    assert.equal(withoutLine.success, true, 'stored even when LINE is not set up')
    const { c: member, user } = await verifiedUser('สมาชิกติดต่อ')
    let missing: any
    let sent: any
    let bot: any
    const calls = await withLine(async () => {
      missing = await client().post('/contact', { ...message, email: '', phone: '' })
      sent = await member.post('/contact', message, { host: 'shop.test' })
      bot = await client().post('/contact', { ...message, website: 'http://spam' })
    })
    assert.equal(missing.status, 400)
    assert.equal(sent.success, true, sent.error)
    assert.equal(bot.success, true)
    assert.equal(calls.length, 1)
    const text = calls[0].payload.messages[0].text
    assert.match(text, /📨 ข้อความจากฟอร์มติดต่อเรา\nเรื่อง: การชำระเงิน \/ เติมเงิน\nชื่อ: คุณติดต่อ\nอีเมล: ask@test\.th\nบัญชีผู้ใช้: สมาชิกติดต่อ \d+/)
    assert.match(text, /https:\/\/shop\.test\/#admin\/messages/)

    const { contactMessages } = await admin.get('/admin/overview')
    assert.equal(contactMessages.length, 2, 'the bot message is not kept')
    const [latest, first] = contactMessages
    assert.equal(first.message, 'ส่งตอน LINE ยังไม่พร้อม')
    assert.equal(first.userId, null)
    assert.equal(latest.userName, user.name)
    assert.equal(latest.status, 'new')
    assert.equal((await member.post(`/admin/contact-messages/${latest.id}`, { status: 'done' })).status, 403)
    assert.equal((await admin.post(`/admin/contact-messages/${latest.id}`, { status: 'done', note: 'โทรกลับแล้ว' })).success, true)
    const after = (await admin.get('/admin/overview')).contactMessages[0]
    assert.equal(after.status, 'done')
    assert.equal(after.adminNote, 'โทรกลับแล้ว')
    assert.ok(after.handledBy && after.handledAt)
  })

  it('lets admins edit the contact details, which the public config shows, and tells LINE', async () => {
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    assert.equal(settings.contact.lineId, '@370lknmk')
    const contact = { ...settings.contact, phone: '02-123-4567', email: 'hello@500windows.test' }
    let calls: Awaited<ReturnType<typeof withLine>> = []
    try {
      assert.equal((await admin.put('/admin/settings', { settings: { ...settings, contact: { ...contact, lineUrl: 'line.me/x' } }, what: 'ติดต่อเรา' })).status, 400)
      calls = await withLine(async () => {
        assert.equal((await admin.put('/admin/settings', { settings: { ...settings, contact }, what: 'ติดต่อเรา' })).success, true)
      })
      assert.equal((await client().get('/config')).settings.contact.phone, '02-123-4567')
      const closed = await admin.put('/admin/settings', { settings: { ...settings, contact: { ...contact, formEnabled: false } }, what: 'ปิดฟอร์ม' })
      assert.equal(closed.success, true)
      assert.equal((await client().post('/contact', { name: 'x', email: 'x@test.th', subject: 'อื่นๆ', message: 'ทดสอบข้อความ' })).status, 403)
    } finally {
      await admin.put('/admin/settings', { settings, what: 'คืนค่าเดิม' })
    }
    assert.equal(calls.length, 1)
    assert.match(calls[0].payload.messages[0].text, /• ติดต่อเรา เบอร์โทร: - → 02-123-4567\n• ติดต่อเรา อีเมล: 500windowsthailand@gmail\.com → hello@500windows\.test/)
  })

  it('never fails the purchase when LINE is down', async () => {
    const { c } = await verifiedUser()
    let res: any
    await withLine(
      async () => {
        res = await c.post('/wallet/topup', { amount: 500, channelId: 'ch-truemoney', slip: { slipUrl: PNG } })
      },
      { status: 500, json: { message: 'down' } },
    )
    assert.equal(res.success, true, res.error)
    assert.equal(res.pending, true)
  })

  it('answers "id" on the webhook only when LINE signed the call', async () => {
    const event = { events: [{ type: 'message', replyToken: 'rt-1', message: { type: 'text', text: 'id' }, source: { type: 'user', userId: 'Uabc123' } }] }
    const raw = JSON.stringify(event)
    const signature = createHmac('sha256', 'line-secret').update(raw).digest('base64')
    let forged: any
    let signed: any
    const calls = await withLine(async () => {
      forged = await client().post('/line/webhook', event, { 'x-line-signature': 'bad' })
      signed = await client().post('/line/webhook', event, { 'x-line-signature': signature })
    })
    assert.equal(forged.status, 401)
    assert.equal(signed.success, true, signed.error)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.line.me/v2/bot/message/reply')
    assert.equal(calls[0].payload.replyToken, 'rt-1')
    assert.match(calls[0].payload.messages[0].text, /Uabc123/)
  })

  it('tells the finance admin on LINE what changed whenever the settings are saved', async () => {
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    const channels = settings.paymentChannels.map((c: any) => (c.id === 'ch-kbank' ? { ...c, accountNumber: '240-2-76668-1' } : c))
    let calls: Awaited<ReturnType<typeof withLine>> = []
    try {
      calls = await withLine(async () => {
        const rules = { ...settings.rules, claimPrice: 650, commissionPercent: 7.5 }
        assert.equal((await admin.put('/admin/settings', { settings: { ...settings, rules }, what: 'กติกาทั่วไป' })).success, true)
        assert.equal((await admin.put('/admin/settings', { settings: { ...settings, rules, paymentChannels: channels }, what: 'บัญชีรับเงิน' })).success, true)
        // Saving without any change sends nothing.
        assert.equal((await admin.put('/admin/settings', { settings: { ...settings, rules, paymentChannels: channels }, what: 'ไม่เปลี่ยน' })).success, true)
      })
    } finally {
      await admin.put('/admin/settings', { settings, what: 'คืนค่าเดิม' })
    }
    assert.equal(calls.length, 2)
    const [rulesText, channelText] = calls.map((call) => call.payload.messages[0].text)
    assert.match(rulesText, /มีการแก้ไขการตั้งค่า/)
    assert.match(rulesText, /เรื่อง: กติกาทั่วไป/)
    assert.match(rulesText, /ราคาจับจองบาน: 500 บาท → 650 บาท/)
    assert.match(rulesText, /ค่าคอมมิชชั่นขายต่อ: 5% → 7\.5%/)
    assert.doesNotMatch(rulesText, /ระยะถือครอง/)
    assert.match(channelText, /เลขบัญชี: 189-2-50012-3 → 240-2-76668-1/)
    assert.doesNotMatch(channelText, /ราคาจับจอง/)
  })

  it('sends alerts to recipients saved from the admin page, without LINE_ADMIN_TO', async () => {
    const admin = await adminClient()
    const saved = 'U' + 'a'.repeat(32)
    let bad: any
    let status: any
    let test: any
    const calls = await withLine(async () => {
      ctx.config.line.to = []
      bad = await admin.put('/admin/line-recipients', { ids: ['not-an-id'] })
      status = await admin.put('/admin/line-recipients', { ids: [saved, saved] })
      test = await admin.post('/admin/line-test')
    })
    assert.equal(bad.status, 400)
    assert.equal(status.success, true, status.error)
    assert.deepEqual(status.saved, [saved])
    assert.equal(status.configured, true)
    assert.equal(test.success, true, test.error)
    assert.deepEqual(
      calls.map((call) => call.payload.to),
      [saved],
    )
    assert.doesNotMatch(JSON.stringify(await client().get('/config')), new RegExp(saved))
    await admin.put('/admin/line-recipients', { ids: [] })
  })

  it('lets only the super admin check the setup and send a test alert', async () => {
    const admin = await adminClient()
    let status: any
    let test: any
    const calls = await withLine(async () => {
      status = await admin.get('/admin/line-status')
      test = await admin.post('/admin/line-test')
    })
    assert.equal(status.configured, true)
    assert.equal(status.recipients, 1)
    assert.doesNotMatch(JSON.stringify(status), /line-token|line-secret/)
    assert.equal(test.success, true, test.error)
    assert.equal(calls.length, 1)
    assert.match(calls[0].payload.messages[0].text, /ทดสอบการแจ้งเตือน/)

    const { user: other } = await verifiedUser()
    await admin.post(`/admin/users/${other.id}/role`, { role: 'admin' })
    const otherAdmin = client()
    await otherAdmin.post('/auth/login', { identifier: other.email, password: 'secret-pass' })
    assert.equal((await otherAdmin.get('/admin/line-status')).status, 403)
  })
})

describe('site themes', () => {
  const zipBase64 = (files: Record<string, string>) =>
    Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))).toString('base64')
  const manifest = (extra: object = {}) =>
    JSON.stringify({ name: 'ธีมทดสอบ', version: '2', variables: { page: { '--theme-page-bg': 'url(assets/bg.png)' }, '--color-amber-400': '#ff0000' }, ...extra })

  it('uploads a theme zip, assigns it and serves its files', async () => {
    const admin = await adminClient()
    const up = await admin.post('/admin/themes', { zip: zipBase64({ 'my-theme/theme.json': manifest(), 'my-theme/theme.css': 'body{}', 'my-theme/assets/bg.png': 'x' }) })
    assert.equal(up.success, true, up.error)
    const id = up.theme.id
    assert.equal(up.theme.files, 3)
    assert.equal(up.theme.variables['--theme-page-bg'], `url(/uploads/themes/${id}/assets/bg.png)`)
    assert.equal(up.theme.stylesheet, `/uploads/themes/${id}/theme.css`)

    const css = await app.request(`/uploads/themes/${id}/theme.css`)
    assert.equal(css.status, 200)
    assert.match(css.headers.get('content-type')!, /text\/css/)
    assert.equal((await app.request(`/uploads/themes/${id}/../../x.css`)).status, 404)

    assert.equal((await client().get('/config')).themes.main, null)
    const set = await admin.put('/admin/themes/assignments', { assignments: { main: null, regions: { north: id }, promo: id } })
    assert.equal(set.success, true, set.error)
    const config = await client().get('/config')
    assert.equal(config.themes.regions.north.id, id)
    assert.equal(config.themes.promo.variables['--color-amber-400'], '#ff0000')

    const blocked = await admin.post(`/admin/themes/${id}/delete`)
    assert.equal(blocked.status, 400)
    assert.match(blocked.error, /ภาคเหนือ/)

    const download = await app.request(`/api/admin/themes/${id}/download`, { headers: { cookie: (await loginCookie()) } })
    assert.equal(download.status, 200)
    const files = unzipSync(new Uint8Array(await download.arrayBuffer()))
    assert.deepEqual(Object.keys(files).sort(), ['assets/bg.png', 'preview.html', 'theme.css', 'theme.json'])
    assert.match(strFromU8(files['preview.html']), /ธีมทดสอบ/)

    await admin.put('/admin/themes/assignments', { assignments: { main: null, regions: {}, promo: null } })
    assert.equal((await admin.post(`/admin/themes/${id}/delete`)).success, true)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, 'themes', id)), false)
  })

  it('offers the built-in design as a starter theme that can be uploaded back', async () => {
    const download = await app.request('/api/admin/themes/default/download', { headers: { cookie: await loginCookie() } })
    assert.equal(download.status, 200)
    const files = unzipSync(new Uint8Array(await download.arrayBuffer()))
    assert.ok(files['theme.json'] && files['theme.css'] && files['README.txt'] && files['preview.html'])
    assert.doesNotMatch(strFromU8(files['preview.html']), /__[A-Z_]+__/)
    const up = await (await adminClient()).post('/admin/themes', { zip: Buffer.from(await (await app.request('/api/admin/themes/default/download', { headers: { cookie: await loginCookie() } })).arrayBuffer()).toString('base64') })
    assert.equal(up.success, true, up.error)
    assert.ok(Object.keys(up.theme.variables).length > 50)
    // The preview page is for offline use only and is never stored on the site.
    assert.equal(up.theme.files, 3)
  })

  it('rejects broken or unsafe theme zips and non-admins', async () => {
    const admin = await adminClient()
    assert.match((await admin.post('/admin/themes', { zip: 'bm90IGEgemlw' })).error, /zip/)
    assert.match((await admin.post('/admin/themes', { zip: zipBase64({ 'a.css': '' }) })).error, /theme\.json/)
    assert.match((await admin.post('/admin/themes', { zip: zipBase64({ 'theme.json': manifest(), 'run.js': '' }) })).error, /run\.js/)
    assert.match((await admin.post('/admin/themes', { zip: zipBase64({ 'theme.json': manifest({ variables: { '--x': 'red; } body { color: red' } }) }) })).error, /--x/)
    assert.match((await admin.post('/admin/themes', { zip: zipBase64({ 'theme.json': '{}' }) })).error, /name/)
    assert.equal((await admin.put('/admin/themes/assignments', { assignments: { main: 'theme_missing' } })).status, 400)
    const { c: user } = await verifiedUser()
    assert.equal((await user.post('/admin/themes', { zip: zipBase64({ 'theme.json': manifest() }) })).status, 403)
  })
})

/** Session cookie of the seeded admin, for requests that return files rather than JSON. */
async function loginCookie() {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
    body: JSON.stringify({ identifier: 'admin@test.th', password: 'admin-pass-123' }),
  })
  return res.headers.getSetCookie().map((h) => h.split(';')[0]).join('; ')
}

describe('admin document library', () => {
  const b64 = (data: string | Buffer) => Buffer.from(data).toString('base64')
  const PDF = b64('%PDF-1.4\n%test\n')

  it('lets admins upload, download, describe and delete files, with audit entries', async () => {
    const admin = await adminClient()
    const up = await admin.post('/admin/files', { name: 'สัญญา เช่า.pdf', data: PDF, note: 'ฉบับลงนาม' })
    assert.equal(up.success, true, up.error)
    assert.equal(up.file.name, 'สัญญา เช่า.pdf')
    assert.equal(up.file.ext, 'pdf')
    const image = await admin.post('/admin/files', { name: 'logo.png', data: PNG })
    assert.equal(image.success, true, image.error)
    const zip = await admin.post('/admin/files', { name: 'backup.zip', data: b64(Buffer.from(zipSync({ 'a.txt': strToU8('hi') }))) })
    assert.equal(zip.success, true, zip.error)

    const list = await admin.get('/admin/files')
    assert.ok(list.files.some((f: any) => f.id === up.file.id))

    const cookie = await loginCookie()
    const res = await app.request(`/api/admin/files/${up.file.id}/download`, { headers: { cookie } })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    assert.match(res.headers.get('content-disposition')!, /^attachment;.*filename\*=UTF-8''%E0%B8%AA/)
    assert.equal(Buffer.from(await res.arrayBuffer()).toString(), '%PDF-1.4\n%test\n')
    const preview = await app.request(`/api/admin/files/${image.file.id}/download?inline=1`, { headers: { cookie } })
    assert.match(preview.headers.get('content-disposition')!, /^inline/)
    const pdfInline = await app.request(`/api/admin/files/${up.file.id}/download?inline=1`, { headers: { cookie } })
    assert.match(pdfInline.headers.get('content-disposition')!, /^attachment/)

    assert.equal((await admin.post(`/admin/files/${up.file.id}/note`, { note: 'แก้แล้ว' })).file.note, 'แก้แล้ว')
    assert.equal((await admin.post(`/admin/files/${up.file.id}/delete`)).success, true)
    assert.equal((await app.request(`/api/admin/files/${up.file.id}/download`, { headers: { cookie } })).status, 404)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, 'documents', `${up.file.id}.pdf`)), false)
    const log = (await admin.get('/admin/overview')).auditLog.map((e: any) => e.action)
    assert.ok(log.includes('อัปโหลดเอกสาร') && log.includes('ลบเอกสาร'))
  })

  it('refuses other types, renamed files, files over 10 MB and non-admins', async () => {
    const admin = await adminClient()
    assert.match((await admin.post('/admin/files', { name: 'run.exe', data: b64('MZ') })).error, /\.exe/)
    assert.match((await admin.post('/admin/files', { name: 'page.html', data: b64('<script>') })).error, /\.html/)
    assert.match((await admin.post('/admin/files', { name: 'fake.pdf', data: PNG })).error, /\.pdf/)
    assert.match((await admin.post('/admin/files', { name: 'big.txt', data: b64(Buffer.alloc(10 * 1024 * 1024 + 1, 97)) })).error, /10 MB/)
    const { c: user } = await verifiedUser()
    assert.equal((await user.post('/admin/files', { name: 'a.pdf', data: PDF })).status, 403)
    assert.equal((await user.get('/admin/files')).status, 403)
  })
})

describe('Life Space journal', () => {
  it('keeps one journal per account and deletes it when consent is withdrawn', async () => {
    const { c: a } = await verifiedUser()
    const { c: b } = await verifiedUser()
    assert.equal((await a.get('/me/life-space')).data, null)

    const journal = JSON.stringify({ profiles: [{ name: 'ฉัน', birth: '1990-01-01', target: 80, votes: { '2026-11-02': { v: 4, n: 'วันดี', t: ['งาน'] } } }], consent: { v: 1 } })
    const saved = await a.put('/me/life-space', { data: journal })
    assert.equal(saved.success, true, saved.error)
    assert.equal((await a.put('/me/life-space', { data: journal })).success, true)
    assert.equal((await a.get('/me/life-space')).data, journal)
    assert.equal((await b.get('/me/life-space')).data, null)

    assert.equal((await a.put('/me/life-space', { data: '{"profiles":' })).status, 400)
    assert.equal((await a.put('/me/life-space', { data: '{}' })).status, 400)
    assert.equal((await a.put('/me/life-space', { data: JSON.stringify({ profiles: [], pad: 'x'.repeat(2 * 1024 * 1024) }) })).status, 400)

    assert.equal((await a.post('/me/life-space/delete')).success, true)
    assert.equal((await a.get('/me/life-space')).data, null)
    assert.equal((await client().get('/me/life-space')).status, 401)
  })
})

describe('window archive (super admin)', () => {
  it('removes a window into the archive, frees it, and restores it onto another empty window', async () => {
    const { c, user } = await verifiedUser()
    await topUpByCard(c, 500)
    assert.equal((await c.post('/windows/central/50/claim', { content: { ...content, title: 'บานที่จะย้าย' }, payment: wallet(500) })).success, true)
    assert.equal((await c.put('/windows/central/50/profile', { gallery: [PNG] })).success, true)

    const { c: other, user: otherUser } = await verifiedUser()
    const admin = await adminClient()
    await admin.post(`/admin/users/${otherUser.id}/role`, { role: 'admin' })
    assert.equal((await other.post('/admin/windows/central/50/archive', { reason: 'x' })).status, 403, 'super admin only')
    assert.equal((await other.get('/admin/window-archives')).status, 403)
    assert.equal((await admin.post('/admin/windows/central/50/archive', {})).status, 400, 'needs a reason')

    const archived = await admin.post('/admin/windows/central/50/archive', { reason: 'ย้ายตามคำขอ' })
    assert.equal(archived.success, true, archived.error)
    assert.equal(archived.window.status, 'available')
    const entry = archived.archives.find((a: any) => a.code === 'KAP-C-TH-050')
    assert.equal(entry.title, 'บานที่จะย้าย')
    assert.equal(entry.ownerId, user.id)
    assert.equal((await admin.post('/admin/windows/central/50/archive', { reason: 'x' })).status, 400, 'already empty')

    // The freed window can be claimed as usual.
    const { c: buyer } = await verifiedUser()
    await topUpByCard(buyer, 500)
    assert.equal((await buyer.post('/windows/central/50/claim', { content, payment: wallet(500) })).success, true)

    assert.equal((await admin.post(`/admin/window-archives/${entry.id}/restore`, { region: 'central', num: 50 })).status, 409, 'target must be empty')
    const restored = await admin.post(`/admin/window-archives/${entry.id}/restore`, { region: 'central', num: 51 })
    assert.equal(restored.success, true, restored.error)
    const w = (await c.get('/windows/central/51')).window
    assert.equal(w.ownerId, user.id)
    assert.equal(w.title, 'บานที่จะย้าย')
    assert.equal(w.profile.gallery.length, 1)
    assert.equal(restored.archives.find((a: any) => a.id === entry.id).restoredTo, 'KAP-C-TH-051')
    assert.equal((await admin.post(`/admin/window-archives/${entry.id}/restore`, { region: 'central', num: 52 })).status, 409, 'only once')
  })
})

describe('central page', () => {
  it('lists published announcements, at most 4 at once, and the user\'s own windows', async () => {
    assert.equal((await client().get('/central/me')).me, null, 'signed out')
    const admin = await adminClient()
    assert.equal((await client().post('/admin/central-news', {})).status, 401)
    const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
    const add = (title: string, publishAt = at(-1), endAt = '') => admin.post('/admin/central-news', { type: 'system', title, body: 'ทดสอบ', publishAt, endAt })
    assert.equal((await add('')).status, 400)
    assert.equal((await add('ลิงก์ไม่ดี', at(-1), at(-2))).status, 400, 'end before start')
    const created = await add('ประกาศ 1')
    assert.equal(created.success, true, created.error)
    const first = created.news.find((n: any) => n.title === 'ประกาศ 1')
    assert.equal(first.status, 'draft')
    assert.ok(!(await client().get('/central')).news.some((n: any) => n.id === first.id), 'drafts stay hidden')

    // The author can't publish their own announcement; another admin reviews it.
    assert.equal((await admin.post(`/admin/central-news/${first.id}/publish`, { publish: true })).status, 403)
    assert.equal((await admin.post('/admin/users', { name: 'ผู้ตรวจประกาศ', email: 'news-reviewer@test.th', password: 'review-pass-1', role: 'admin' })).success, true)
    const reviewer = client()
    assert.equal((await reviewer.post('/auth/login', { identifier: 'news-reviewer@test.th', password: 'review-pass-1' })).success, true)
    assert.equal((await reviewer.post(`/admin/central-news/${first.id}/publish`, { publish: true })).success, true)
    assert.ok((await client().get('/central')).news.some((n: any) => n.id === first.id))
    for (const title of ['ประกาศ 2', 'ประกาศ 3', 'ประกาศ 4', 'ประกาศ 5']) {
      const list = (await add(title)).news
      const id = list.find((n: any) => n.title === title).id
      const published = await reviewer.post(`/admin/central-news/${id}/publish`, { publish: true })
      assert.equal(published.success, title !== 'ประกาศ 5', title)
    }
    // Later, after the others ended, a fifth fits.
    const later = (await add('ประกาศ 6', at(400))).news.find((n: any) => n.title === 'ประกาศ 6')
    assert.equal((await reviewer.post(`/admin/central-news/${later.id}/publish`, { publish: true })).status, 409, 'the others have no end')

    // Editing a published one makes it a draft again.
    const edited = await admin.post(`/admin/central-news/${first.id}`, { type: 'news', title: 'ประกาศ 1 แก้', publishAt: at(-1) })
    assert.equal(edited.news.find((n: any) => n.id === first.id).status, 'draft')
    assert.equal((await admin.post(`/admin/central-news/${first.id}/delete`)).success, true)

    const { c } = await verifiedUser('เจ้าของบาน')
    await topUpByCard(c, 500)
    assert.equal((await c.post('/windows/thailand/170/claim', { content, payment: wallet(500) })).success, true)
    const mine = (await c.get('/central/me')).me
    assert.match(mine.user.name, /^เจ้าของบาน/)
    assert.equal(mine.windows.length, 1)
    assert.equal(mine.windows[0].group, 'central')
    assert.equal(mine.windows[0].url, '/w/thailand/170')
    assert.equal(mine.windows[0].plan.type, 'paid')
    assert.ok(mine.create.region && !mine.create.central)
    assert.equal(mine.windows[0].upgradeUrl, '/kap/upgrade.html?w=thailand-170')
    const paid = await c.get('/upgrade?w=thailand-170')
    assert.equal(paid.plan.type, 'paid')
    assert.equal(paid.payUrl, '/w/thailand/170')
    assert.equal((await c.get('/upgrade?w=thailand-171')).status, 404, 'not their window')
    assert.equal((await c.get('/upgrade?w=nowhere-1')).status, 404)
    assert.equal((await client().get('/upgrade?w=thailand-170')).status, 401)
    const tryer = await verifiedUser('ผู้ทดลอง')
    assert.equal((await tryer.c.post('/windows/north/160/trial', { content })).success, true)
    const trial = await tryer.c.get('/upgrade?w=north-160')
    assert.equal(trial.plan.type, 'trial')
    assert.equal(trial.plan.status, 'active')
    assert.equal(trial.plan.daysLeft, 60)
    assert.equal(trial.plan.price, '500 บาท')
    assert.equal(trial.rules.refundDays, 15)
    const data = await client().get('/central')
    assert.ok(Array.isArray(data.apps) && data.serverTime)
  })

  it('lists the how-to windows KAP-TH-001, 002, 003 and 009 once they are open to visitors', async () => {
    const before = (await client().get('/central')).guide
    assert.ok(Array.isArray(before))
    assert.ok(!before.some((w: any) => w.id === 'KAP-TH-009'))
    const { c } = await verifiedUser()
    await topUpByCard(c, 500)
    const claimed = await c.post('/windows/thailand/9/claim', { content, payment: wallet(500) })
    assert.equal(claimed.success, true, claimed.error)
    const guide = (await client().get('/central')).guide
    const nine = guide.find((w: any) => w.id === 'KAP-TH-009')
    assert.ok(nine, 'listed once claimed')
    assert.equal(nine.url, '/w/thailand/9')
    assert.ok(guide.every((w: any) => ['KAP-TH-001', 'KAP-TH-002', 'KAP-TH-003', 'KAP-TH-009'].includes(w.id)))
  })
})
