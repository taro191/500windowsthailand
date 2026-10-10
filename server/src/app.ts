// HTTP API (Hono). Every response is JSON: `{ success: true, ... }` or `{ success: false, error }`.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { secureHeaders } from 'hono/secure-headers'
import type { PlatformSettings } from '@shared/types'
import type { AppContext } from './context'
import type { UserRow } from './db/schema'
import { newToken } from './lib/crypto'
import { ApiError, forbidden } from './lib/errors'
import { uploadFilePath } from './lib/files'
import { createRateLimiter } from './lib/rateLimit'
import { getSettings } from './services/settings'
import * as users from './services/users'
import * as windows from './services/windows'
import * as purchases from './services/purchases'
import * as promo from './services/promo'
import * as admin from './services/admin'
import { userTransactions } from './services/ledger'

type Env = { Variables: { user: UserRow | null } }

const SESSION_COOKIE = 'sid'
const VISITOR_COOKIE = 'vid'

export function createApp(ctx: AppContext) {
  const app = new Hono<Env>()
  const authLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 20 })
  const otpLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5 })

  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin', contentSecurityPolicy: undefined }))
  app.use('/api/*', compress())
  app.use('/api/*', bodyLimit({ maxSize: 15 * 1024 * 1024, onError: (c) => c.json({ success: false, error: 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป' }, 413) }))

  // Mutations must be JSON: browsers can't send that cross-site without CORS, which blocks CSRF.
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !c.req.header('content-type')?.includes('application/json')) {
      return c.json({ success: false, error: 'Content-Type ต้องเป็น application/json' }, 415)
    }
    await next()
  })

  // Signed-in user (or null) from the session cookie.
  app.use('*', async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    c.set('user', token ? await users.userForSession(ctx, token) : null)
    await next()
  })

  app.onError((error, c) => {
    if (error instanceof ApiError) return c.json({ success: false, error: error.message, ...error.extra }, error.status)
    if (error instanceof SyntaxError) return c.json({ success: false, error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }, 400)
    console.error(error)
    return c.json({ success: false, error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' }, 500)
  })

  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    if (!c.get('user')) throw new ApiError(401, 'กรุณาเข้าสู่ระบบก่อนทำรายการ')
    await next()
  }
  const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
    if (c.get('user')?.role !== 'admin') throw forbidden('เฉพาะผู้ดูแลระบบ')
    await next()
  }
  const requireDemo: MiddlewareHandler<Env> = async (_c, next) => {
    if (!ctx.config.demoTools) throw new ApiError(404, 'ไม่พบ')
    await next()
  }
  const me = (c: Context<Env>) => c.get('user')!
  const ok = (c: Context, data: object = {}) => c.json({ success: true, ...data })
  const body = async <T>(c: Context): Promise<T> => (await c.req.json()) as T
  const ip = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'local'

  const startSession = async (c: Context, user: UserRow) => {
    const { token, expiresAt } = await users.createSession(ctx, user.id)
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: ctx.config.isProduction,
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    })
  }

  /** Anonymous visitor id for one-like-per-day. */
  const visitorId = (c: Context<Env>) => {
    const user = c.get('user')
    if (user) return user.id
    let id = getCookie(c, VISITOR_COOKIE)
    if (!id || !/^[A-Za-z0-9_-]{20,64}$/.test(id)) {
      id = newToken()
      setCookie(c, VISITOR_COOKIE, id, { httpOnly: true, secure: ctx.config.isProduction, sameSite: 'Lax', path: '/', maxAge: 400 * 86_400 })
    }
    return id
  }

  const sessionPayload = async (user: UserRow | null) =>
    user
      ? {
          user: users.selfDto(ctx, user),
          transactions: await userTransactions(ctx.db, user.id),
          orders: await purchases.userOrders(ctx, user.id),
          promoRequests: await promo.myPromoRequests(ctx, user.id),
        }
      : { user: null, transactions: [], orders: [], promoRequests: [] }

  const api = new Hono<Env>()

  // ------------------------------------------------------------ public

  api.get('/health', (c) => ok(c, { time: new Date().toISOString() }))

  api.get('/config', async (c) =>
    ok(c, {
      settings: await getSettings(ctx),
      cardPayments: ctx.config.cardPayments,
      otpMode: ctx.config.otpMode,
      demoTools: ctx.config.demoTools,
      minPasswordLength: users.MIN_PASSWORD_LENGTH,
    }),
  )

  api.get('/boards', async (c) => ok(c, { windows: await windows.loadBoards(ctx, c.get('user')?.id ?? null) }))

  api.get('/windows/:region/:num', async (c) => {
    const { region, num } = windows.parseWindowRef(c.req.param('region'), c.req.param('num'))
    if (c.req.query('view') === '1') await windows.recordView(ctx, region, num)
    return ok(c, { window: await windows.loadWindow(ctx, region, num, c.get('user')?.id ?? null) })
  })

  api.post('/windows/:region/:num/like', async (c) => {
    const { region, num } = windows.parseWindowRef(c.req.param('region'), c.req.param('num'))
    const { counted } = await windows.likeWindow(ctx, region, num, visitorId(c))
    return ok(c, { counted, window: await windows.loadWindow(ctx, region, num, c.get('user')?.id ?? null) })
  })

  api.get('/promo', async (c) => ok(c, { ads: await promo.activeAds(ctx), reservedRounds: await promo.reservedRounds(ctx) }))

  // ------------------------------------------------------------ account

  api.get('/session', async (c) => ok(c, await sessionPayload(c.get('user'))))

  api.post('/auth/signup', async (c) => {
    authLimiter.hit(`signup:${ip(c)}`)
    const user = await users.signup(ctx, await body(c))
    await startSession(c, user)
    return ok(c, await sessionPayload(user))
  })

  api.post('/auth/login', async (c) => {
    const { identifier, password } = await body<{ identifier: string; password: string }>(c)
    authLimiter.hit(`login:${ip(c)}`)
    const user = await users.login(ctx, identifier, password)
    await startSession(c, user)
    return ok(c, await sessionPayload(user))
  })

  api.post('/auth/password/forgot', async (c) => {
    const { email } = await body<{ email: string }>(c)
    authLimiter.hit(`forgot:${ip(c)}`)
    // Each request sends an email: also cap per address, so one inbox can't be flooded.
    otpLimiter.hit(`forgot-email:${String(email ?? '').trim().toLowerCase()}`)
    return ok(c, await users.requestPasswordReset(ctx, email))
  })

  api.post('/auth/password/reset', async (c) => {
    authLimiter.hit(`reset:${ip(c)}`)
    await users.resetPassword(ctx, await body(c))
    return ok(c)
  })

  api.post('/auth/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await users.deleteSession(ctx, token)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return ok(c)
  })

  api.use('/me/*', requireUser)
  api.use('/me', requireUser)
  api.use('/kyc/*', requireUser)
  api.use('/wallet/*', requireUser)

  api.patch('/me', async (c) => ok(c, { user: users.selfDto(ctx, await users.updateProfile(ctx, me(c), await body(c))) }))

  api.post('/me/password', async (c) => {
    const { currentPassword, newPassword } = await body<{ currentPassword: string; newPassword: string }>(c)
    await users.changePassword(ctx, me(c), currentPassword, newPassword)
    return ok(c)
  })

  api.post('/kyc/otp', async (c) => {
    otpLimiter.hit(`otp:${me(c).id}`)
    const { phone } = await body<{ phone: string }>(c)
    // Each OTP is a paid SMS: also cap per number, so many accounts can't flood one phone.
    otpLimiter.hit(`otp-phone:${String(phone ?? '').replace(/\D/g, '')}`)
    return ok(c, await users.requestOtp(ctx, me(c), phone))
  })

  api.post('/kyc/verify', async (c) => {
    const user = await users.verifyKyc(ctx, me(c), await body(c))
    return ok(c, { user: users.selfDto(ctx, user) })
  })

  // ------------------------------------------------------------ windows (signed in)

  const windowRoute = (c: Context) => windows.parseWindowRef(c.req.param('region')!, c.req.param('num')!)
  const withWindow = async (c: Context<Env>, result: purchases.PurchaseResult) => {
    const { region, num } = windowRoute(c)
    return ok(c, { ...result, window: await windows.loadWindow(ctx, region, num, me(c).id) })
  }

  api.use('/windows/:region/:num/*', async (c, next) => {
    if (c.req.path.endsWith('/like')) return next()
    return requireUser(c, next)
  })

  api.post('/windows/:region/:num/claim', async (c) => {
    const { region, num } = windowRoute(c)
    const { content, payment } = await body<{ content: windows.WindowContentInput; payment: purchases.PaymentInput }>(c)
    return withWindow(c, await purchases.claimWindow(ctx, me(c), region, num, content, payment))
  })

  api.post('/windows/:region/:num/buy', async (c) => {
    const { region, num } = windowRoute(c)
    const { expectedPrice, payment } = await body<{ expectedPrice: number; payment: purchases.PaymentInput }>(c)
    return withWindow(c, await purchases.buyResale(ctx, me(c), region, num, expectedPrice, payment))
  })

  api.patch('/windows/:region/:num/content', async (c) => {
    const { region, num } = windowRoute(c)
    return ok(c, await windows.editWindow(ctx, me(c), region, num, await body(c)))
  })

  api.post('/windows/:region/:num/listing', async (c) => {
    const { region, num } = windowRoute(c)
    const { price } = await body<{ price: number }>(c)
    return ok(c, { window: await windows.listForResale(ctx, me(c), region, num, price) })
  })

  api.post('/windows/:region/:num/listing/cancel', async (c) => {
    const { region, num } = windowRoute(c)
    return ok(c, { window: await windows.cancelResale(ctx, me(c), region, num) })
  })

  api.post('/windows/:region/:num/follow', async (c) => {
    const { region, num } = windowRoute(c)
    const { following } = await windows.toggleFollow(ctx, me(c), region, num)
    return ok(c, { following, window: await windows.loadWindow(ctx, region, num, me(c).id) })
  })

  // ------------------------------------------------------------ wallet & promo

  api.post('/wallet/topup', async (c) => {
    const { amount, channelId, slip } = await body<{ amount: number; channelId: string; slip?: purchases.PaymentInput['slip'] }>(c)
    return ok(c, { ...(await purchases.topUp(ctx, me(c), amount, { channelId, slip })) })
  })

  api.post('/promo/requests', requireUser, async (c) => {
    const { request, payment } = await body<{ request: promo.PromoInput; payment: purchases.PaymentInput }>(c)
    return ok(c, await promo.submitPromoRequest(ctx, me(c), request, payment))
  })

  // ------------------------------------------------------------ demo helpers

  api.post('/demo/windows/:region/:num/skip-cooldown', requireUser, requireDemo, async (c) => {
    const { region, num } = windowRoute(c)
    return ok(c, { window: await windows.demoSkipEditCooldown(ctx, me(c), region, num) })
  })

  api.post('/demo/windows/:region/:num/backdate', requireUser, requireDemo, async (c) => {
    const { region, num } = windowRoute(c)
    const { days } = await body<{ days: number }>(c)
    return ok(c, { window: await windows.demoBackdateOwnership(ctx, me(c), region, num, Number(days) || 0) })
  })

  // ------------------------------------------------------------ admin

  const adminApi = new Hono<Env>()
  adminApi.use('*', requireUser, requireAdmin)

  adminApi.get('/overview', async (c) => ok(c, await admin.adminOverview(ctx)))

  adminApi.get('/sms-status', async (c) => ok(c, await admin.smsDiagnostics(ctx, me(c))))

  adminApi.put('/settings', async (c) => {
    const { settings, what } = await body<{ settings: PlatformSettings; what: string }>(c)
    return ok(c, { settings: await admin.updateSettings(ctx, me(c), settings, what) })
  })

  adminApi.post('/windows/:region/:num/takedown', async (c) => {
    const { region, num } = windowRoute(c)
    const { reason } = await body<{ reason: string }>(c)
    return ok(c, { window: await admin.takeDownContent(ctx, me(c), region, num, reason) })
  })

  adminApi.post('/windows/:region/:num/release', async (c) => {
    const { region, num } = windowRoute(c)
    const { reason } = await body<{ reason: string }>(c)
    return ok(c, { window: await admin.releaseWindow(ctx, me(c), region, num, reason) })
  })

  adminApi.post('/users', async (c) => ok(c, { user: await admin.createUser(ctx, me(c), await body<admin.NewUserInput>(c)) }))

  adminApi.post('/users/:id/suspend', async (c) => {
    const { suspended } = await body<{ suspended: boolean }>(c)
    return ok(c, { user: await admin.setUserSuspended(ctx, me(c), c.req.param('id'), !!suspended) })
  })

  adminApi.post('/users/:id/disable', async (c) => {
    const { disabled } = await body<{ disabled: boolean }>(c)
    return ok(c, { user: await admin.setUserDisabled(ctx, me(c), c.req.param('id'), !!disabled) })
  })

  adminApi.post('/users/:id/role', async (c) => {
    const { role } = await body<{ role: 'admin' | 'user' }>(c)
    return ok(c, { user: await admin.setUserRole(ctx, me(c), c.req.param('id'), role) })
  })

  adminApi.post('/users/:id/revoke-kyc', async (c) => ok(c, { user: await admin.revokeKyc(ctx, me(c), c.req.param('id')) }))

  adminApi.post('/users/:id/verify-kyc', async (c) => ok(c, { user: await admin.verifyUserKyc(ctx, me(c), c.req.param('id')) }))

  adminApi.put('/users/:id', async (c) =>
    ok(c, { user: await admin.updateUserInfo(ctx, me(c), c.req.param('id'), await body<admin.UserInfoInput>(c)) }),
  )

  adminApi.post('/orders/:id/decide', async (c) => {
    const { decision, note } = await body<{ decision: 'approved' | 'rejected'; note?: string }>(c)
    await purchases.decideOrder(ctx, me(c), c.req.param('id'), decision === 'approved' ? 'approved' : 'rejected', note)
    return ok(c)
  })

  adminApi.post('/promo/:id/decide', async (c) => {
    const { decision, note } = await body<{ decision: 'approved' | 'rejected'; note?: string }>(c)
    return ok(c, await promo.decidePromoRequest(ctx, me(c), c.req.param('id'), decision === 'approved' ? 'approved' : 'rejected', note))
  })

  api.route('/admin', adminApi)
  api.all('*', (c) => c.json({ success: false, error: 'ไม่พบ API นี้' }, 404))
  app.route('/api', api)

  // ------------------------------------------------------------ uploaded files

  app.get('/uploads/:folder/:file', async (c) => {
    const publicPath = `/uploads/${c.req.param('folder')}/${c.req.param('file')}`
    const file = uploadFilePath(ctx.config.uploadDir, publicPath)
    if (!file) return c.notFound()
    if (c.req.param('folder') === 'slips') {
      const user = c.get('user')
      const owns =
        user &&
        (user.role === 'admin' ||
          (await ctx.db.selectFrom('payment_orders').select('id').where('slip_url', '=', publicPath).where('user_id', '=', user.id).executeTakeFirst()))
      if (!owns) return c.json({ success: false, error: 'ไม่มีสิทธิ์ดูไฟล์นี้' }, 403)
    }
    try {
      const data = await readFile(file)
      const ext = path.extname(file).slice(1)
      c.header('Content-Type', ext === 'jpg' ? 'image/jpeg' : `image/${ext}`)
      c.header('Cache-Control', c.req.param('folder') === 'slips' ? 'private, max-age=3600' : 'public, max-age=31536000, immutable')
      c.header('X-Content-Type-Options', 'nosniff')
      return c.body(data)
    } catch {
      return c.notFound()
    }
  })

  return app
}
