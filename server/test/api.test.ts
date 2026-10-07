// End-to-end API tests against an in-memory SQLite database: npm test
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { before, describe, it } from 'node:test'
import { config } from '../src/config'
import { createDb } from '../src/db'
import { migrate } from '../src/db/migrations'
import { seed } from '../src/db/seed'
import { createSecrets } from '../src/lib/crypto'
import { createApp } from '../src/app'
import type { AppContext } from '../src/context'

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

/** A browser-like client that keeps its cookies. */
function client() {
  let cookies: Record<string, string> = {}
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(`/api${url}`, {
      method,
      headers: {
        ...(body !== undefined || method !== 'GET' ? { 'content-type': 'application/json' } : {}),
        cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
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
      signupBonus: 0,
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
