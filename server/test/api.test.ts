// End-to-end API tests against an in-memory SQLite database: npm test
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
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

  it('lets only the super admin verify KYC for a user, without OTP', async () => {
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

    // Other admins can't.
    const { c: other, user: otherUser } = await verifiedUser()
    await admin.post(`/admin/users/${otherUser.id}/role`, { role: 'admin' })
    await admin.post(`/admin/users/${kycUser.id}/revoke-kyc`)
    assert.equal((await other.post(`/admin/users/${kycUser.id}/verify-kyc`, {})).status, 403)
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

  it('changes the password with the current one', async () => {
    const { c, user } = await verifiedUser()
    assert.equal((await c.post('/me/password', { currentPassword: 'nope', newPassword: 'next-pass-123' })).status, 400)
    assert.equal((await c.post('/me/password', { currentPassword: 'secret-pass', newPassword: 'next-pass-123' })).success, true)
    assert.equal((await client().post('/auth/login', { identifier: user.email, password: 'next-pass-123' })).success, true)
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
