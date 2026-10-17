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

  it('follows the rules the admin sets: claim price, holding days, minimum price and commission', async () => {
    const admin = await adminClient()
    const { settings } = await client().get('/config')
    const rules = { claimPrice: 700, commissionPercent: 10, minHoldingDays: 7, minResalePrice: 300, promoPricePerWindowRound: 40 }
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

  it('keeps the optional promo page details, checked, and shows them on the live ad', async () => {
    const { c } = await verifiedUser()
    await topUpByCard(c, 200)
    const day = new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 10)
    const bad = (details: object) => c.post('/promo/requests', { request: { ...request(day), details }, payment: wallet(60) })
    assert.equal((await bad({ mapUrl: 'javascript:alert(1)' })).status, 400)
    assert.equal((await bad({ validFrom: '2026-12-10', validTo: '2026-12-01' })).status, 400)
    assert.equal((await bad({ line: 'not a line id!' })).status, 400)

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
    const res = await c.post('/promo/requests', { request: { ...request(day), brand: 'คาเฟ่รายละเอียด', details }, payment: wallet(60) })
    assert.equal(res.success, true, res.error)
    assert.equal(res.request.details.offer, 'ซื้อ 1 แถม 1')
    assert.deepEqual(res.request.details.links, [{ label: 'เมนู', url: 'https://example.com/menu' }])
    assert.deepEqual(res.request.details.points, ['เปิดทุกวัน'])
    assert.equal(res.request.details.address, '')

    const admin = await adminClient()
    assert.equal((await admin.post(`/admin/promo/${res.request.id}/decide`, { decision: 'approved' })).success, true)
    const ad = (await client().get('/promo')).ads.find((a: any) => a.id === res.request.id)
    assert.equal(ad.details.line, '@cafe')
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

  it('lets the owner fill in a public page with photos, offerings and contacts, only in the detail', async () => {
    const { c } = await owner('/windows/east/40')
    const empty = await client().get('/windows/east/40')
    assert.equal(empty.window.profile.logoUrl, '')
    assert.deepEqual(empty.window.reviews, [])

    const profile = {
      logoUrl: PNG,
      tags: ['#สินค้าเกษตร', 'ของฝาก', 'ของฝาก'],
      gallery: [PNG, PNG],
      offerings: [{ imageUrl: PNG, name: 'ผักออร์แกนิก', note: 'สด สะอาด' }, { imageUrl: '', name: '', note: '' }],
      phone: '081-234-5678',
      lineId: '@baansuan',
      email: 'Shop@Test.th',
      website: 'https://baansuan.example.com',
      facebook: 'https://www.facebook.com/baansuan',
      about: 'ร้านของครอบครัว',
      highlights: ['ปลอดสาร', ''],
      serviceArea: 'ทั่วประเทศ',
      shipping: '2-5 วัน',
    }
    assert.equal((await client().put('/windows/east/40/profile', profile)).status, 401)
    const other = await verifiedUser()
    assert.equal((await other.c.put('/windows/east/40/profile', profile)).status, 403)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, facebook: 'https://evil.example.com/fb' })).status, 400)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, website: 'javascript:alert(1)' })).status, 400)
    assert.equal((await c.put('/windows/east/40/profile', { ...profile, gallery: ['https://example.com/x.jpg'] })).status, 400)

    const saved = await c.put('/windows/east/40/profile', profile)
    assert.equal(saved.success, true, saved.error)
    const p = saved.window.profile
    assert.match(p.logoUrl, /^\/uploads\/windows\//)
    assert.equal(p.gallery.length, 2)
    assert.deepEqual(p.tags, ['สินค้าเกษตร', 'ของฝาก'])
    assert.equal(p.offerings.length, 1)
    assert.equal(p.email, 'shop@test.th')
    assert.deepEqual(p.highlights, ['ปลอดสาร'])
    // Profile edits are free and don't use the daily content edits.
    assert.equal(saved.window.editsToday, undefined)

    // Keeping one gallery photo deletes the other file.
    const kept = await c.put('/windows/east/40/profile', { ...p, gallery: [p.gallery[0]] })
    assert.equal(kept.success, true, kept.error)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, p.gallery[1].replace('/uploads/', ''))), false)
    assert.equal(existsSync(path.join(ctx.config.uploadDir, p.gallery[0].replace('/uploads/', ''))), true)

    const boards = await client().get('/boards')
    const onBoard = boards.windows.find((w: { region: string; id: number }) => w.region === 'east' && w.id === 40)
    assert.equal(onBoard.profile, undefined)
    assert.equal((await client().get('/windows/east/40')).window.profile.phone, '081-234-5678')
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
