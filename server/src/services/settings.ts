// Platform settings (price caps, payment channels, top-up limits, edit policy, signup bonus), stored as one JSON row.
// Cached briefly because several server processes may run behind Passenger.
import type { PlatformSettings } from '@shared/types'
import { DEFAULT_SETTINGS, validateSettings } from '@shared/settings'
import { badRequest } from '../lib/errors'
import { nowIso, type AppContext } from '../context'

const CACHE_MS = 10_000
const caches = new WeakMap<object, { at: number; value: PlatformSettings }>()

export async function getSettings(ctx: AppContext): Promise<PlatformSettings> {
  const cached = caches.get(ctx.db)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  const row = await ctx.db.selectFrom('settings').select(['value_json', 'updated_at']).where('id', '=', 'platform').executeTakeFirst()
  const value: PlatformSettings = row
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.value_json), updatedAt: row.updated_at }
    : DEFAULT_SETTINGS
  caches.set(ctx.db, { at: Date.now(), value })
  return value
}

export async function saveSettings(ctx: AppContext, settings: PlatformSettings): Promise<PlatformSettings> {
  const error = validateSettings(settings)
  if (error) throw badRequest(error)
  const { priceCaps, paymentChannels, topUp, editPolicy, signupBonus } = settings
  const value_json = JSON.stringify({ priceCaps, paymentChannels, topUp, editPolicy, signupBonus })
  const updated_at = nowIso()
  const updated = await ctx.db.updateTable('settings').set({ value_json, updated_at }).where('id', '=', 'platform').executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) {
    await ctx.db.insertInto('settings').values({ id: 'platform', value_json, updated_at }).execute()
  }
  caches.delete(ctx.db)
  return getSettings(ctx)
}
