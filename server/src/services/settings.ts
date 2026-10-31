// Platform settings (price caps, payment channels, top-up limits, edit policy, rules, signup bonus, contact), stored as one JSON row.
// Cached briefly because several server processes may run behind Passenger.
import type { PlatformSettings } from '@shared/types'
import { DEFAULT_SETTINGS, validateSettings } from '@shared/settings'
import { badRequest } from '../lib/errors'
import { nowIso, type AppContext } from '../context'

const CACHE_MS = 10_000
const caches = new WeakMap<object, { at: number; value: PlatformSettings }>()

/** Stored settings over the defaults; rules saved before a new rule existed keep their values. */
const withDefaults = (stored: Partial<PlatformSettings>, updatedAt: string): PlatformSettings => ({
  ...DEFAULT_SETTINGS,
  ...stored,
  rules: { ...DEFAULT_SETTINGS.rules, ...stored.rules },
  contact: { ...DEFAULT_SETTINGS.contact, ...stored.contact },
  coStore: { ...DEFAULT_SETTINGS.coStore, ...stored.coStore },
  updatedAt,
})

export async function getSettings(ctx: AppContext): Promise<PlatformSettings> {
  const cached = caches.get(ctx.db)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  const row = await ctx.db.selectFrom('settings').select(['value_json', 'updated_at']).where('id', '=', 'platform').executeTakeFirst()
  const value: PlatformSettings = row
    ? withDefaults(JSON.parse(row.value_json), row.updated_at)
    : DEFAULT_SETTINGS
  caches.set(ctx.db, { at: Date.now(), value })
  return value
}

export async function saveSettings(ctx: AppContext, settings: PlatformSettings): Promise<PlatformSettings> {
  const error = validateSettings(settings)
  if (error) throw badRequest(error)
  const { priceCaps, paymentChannels, topUp, editPolicy, rules, signupBonus, contact, coStore } = settings
  const value_json = JSON.stringify({ priceCaps, paymentChannels, topUp, editPolicy, rules, signupBonus, contact, coStore })
  const updated_at = nowIso()
  const updated = await ctx.db.updateTable('settings').set({ value_json, updated_at }).where('id', '=', 'platform').executeTakeFirst()
  if (Number(updated.numUpdatedRows) === 0) {
    await ctx.db.insertInto('settings').values({ id: 'platform', value_json, updated_at }).execute()
  }
  caches.delete(ctx.db)
  return getSettings(ctx)
}
