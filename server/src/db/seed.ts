// First-run data: the 3,500 empty windows, the first admin, and (DEMO_TOOLS=true only)
// demo accounts and showcase windows.
import type { RegionId } from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { createDemoWindows } from '@shared/seedWindows'
import { REGIONS_BY_ID } from '@shared/regions'
import { hashPassword, newId } from '../lib/crypto'
import { nowIso, type AppContext } from '../context'
import { emptyWindowRow } from '../services/windows'
import { DEFAULT_AVATAR_URL } from '../services/users'
import type { NewUser } from './schema'

async function seedWindows(ctx: AppContext) {
  const existing = await ctx.db.selectFrom('windows').select((eb) => eb.fn.countAll().as('n')).executeTakeFirst()
  if (Number(existing?.n ?? 0) > 0) return
  const now = nowIso()
  for (const region of REGION_IDS) {
    const count = REGIONS_BY_ID[region].windowCount || 500
    const rows = Array.from({ length: count }, (_, i) => emptyWindowRow(region, i + 1, now))
    for (let i = 0; i < rows.length; i += 100) await ctx.db.insertInto('windows').values(rows.slice(i, i + 100)).execute()
  }
  console.log('seeded 3,500 empty windows')
}

async function createUser(
  ctx: AppContext,
  user: Omit<NewUser, 'password_hash' | 'created_at' | 'updated_at' | 'is_verified' | 'suspended' | 'disabled'> & { is_verified?: number; password: string; citizen?: string },
) {
  const { password, citizen, ...rest } = user
  const now = nowIso()
  await ctx.db
    .insertInto('users')
    .values({
      is_verified: 0,
      suspended: 0,
      disabled: 0,
      ...rest,
      citizen_hash: citizen ? ctx.secrets.citizenHash(citizen) : null,
      citizen_enc: citizen ? ctx.secrets.encrypt(citizen) : null,
      password_hash: await hashPassword(password),
      created_at: now,
      updated_at: now,
    })
    .execute()
}

async function seedAdmin(ctx: AppContext) {
  const { email, password } = ctx.config.admin
  if (!email || !password) return
  const admin = await ctx.db.selectFrom('users').select('id').where('role', '=', 'admin').executeTakeFirst()
  if (admin) return
  const taken = await ctx.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst()
  if (taken) {
    await ctx.db.updateTable('users').set({ role: 'admin' }).where('id', '=', taken.id).execute()
  } else {
    await createUser(ctx, { id: newId('u'), name: 'ผู้ดูแลระบบ', email, password, balance: 0, avatar_url: DEFAULT_AVATAR_URL, role: 'admin' })
  }
  console.log(`admin account ready: ${email}`)
}

/** Demo accounts (password "password123") and the three showcase windows on the Thailand board. */
async function seedDemo(ctx: AppContext) {
  const any = await ctx.db.selectFrom('users').select('id').where('id', '=', 'user_theera').executeTakeFirst()
  if (any) return
  const avatar = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&q=80`
  const verified = '2026-01-05T10:00:00.000Z'
  const demo = [
    { id: 'user_theera', name: 'อาจารย์ธีระ วงศ์ศิลป์ (ช่างภาพอิสระ)', email: 'theera@photo.th', phone: '0812223344', citizen: '3500100234567', balance: 18000, avatar_url: avatar('1570295999919-56ceb5ecca61'), is_verified: 1, verified_at: verified },
    { id: 'user_jeenee', name: 'เจ๊ณี ผัดไทยเยาวราช', email: 'jeenee@padthai.th', phone: '0819925566', citizen: '1100498765432', balance: 35000, avatar_url: avatar('1580489944761-15a19d654956'), is_verified: 1, verified_at: verified },
    { id: 'user_panu', name: 'คุณภานุ โลกใบใหญ่ (นักเดินทาง)', email: 'panu@backpack.th', phone: '0867778899', citizen: '1700388991234', balance: 14000, avatar_url: avatar('1527980965255-d3b416303d12'), is_verified: 0, verified_at: null },
    { id: 'user_admin', name: 'ผู้ดูแลระบบ (Admin)', email: 'admin@kapsulep.com', phone: null, balance: 0, avatar_url: avatar('1507003211169-0a1dd7228f2d'), is_verified: 0, verified_at: null, role: 'admin' as const },
  ]
  for (const user of demo) {
    const exists = await ctx.db.selectFrom('users').select('id').where('email', '=', user.email).executeTakeFirst()
    if (!exists) await createUser(ctx, { ...user, password: 'password123', role: user.role ?? 'user' })
  }

  for (const w of createDemoWindows()) {
    const region = w.region as RegionId
    await ctx.db
      .updateTable('windows')
      .set({
        title: w.title,
        description: w.description,
        image_url: w.imageUrl,
        category: w.category,
        province: w.province,
        status: w.status,
        resale_price: w.resalePrice ?? null,
        owner_id: w.ownerId,
        owner_contact: w.ownerContact ?? null,
        external_link: w.externalLink ?? null,
        claimed_at: w.claimedAt ?? null,
        owner_changed_at: w.ownerChangedAt ?? w.claimedAt ?? null,
        owner_change_kind: w.ownerChangeKind ?? 'new',
        last_purchase_price: w.claimPrice,
        last_image_updated_at: w.lastImageUpdatedAt ?? null,
        views_count: w.viewsCount,
        likes_count: w.likesCount,
        likes_day: w.dailyLikes?.day ?? null,
        likes_day_count: w.dailyLikes?.count ?? 0,
        followers_base: w.followersBase ?? 0,
        note_day: w.dailyNote?.day ?? null,
        note_text: w.dailyNote?.text ?? null,
        note_at: w.dailyNote?.at ?? null,
        previous_owner_id: w.previousOwnerId ?? null,
        updated_at: nowIso(),
      })
      .where('region', '=', region)
      .where('num', '=', w.id)
      .execute()
    for (const image of w.imageUpdateHistory) {
      await ctx.db.insertInto('window_images').values({ id: newId('wi'), region, num: w.id, date: image.date, image_url: image.imageUrl, caption: image.caption }).execute()
    }
  }
  console.log('seeded demo accounts (password123) and showcase windows')
}

export async function seed(ctx: AppContext) {
  await seedWindows(ctx)
  await seedAdmin(ctx)
  if (ctx.config.demoTools) await seedDemo(ctx)
}
