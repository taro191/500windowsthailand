// How many windows one user may hold: 1 on the Thailand board + 1 regional, plus any extra an admin grants.
// Used by the API (purchase check) and the web app (quota display).
import type { ExtraWindows, Quota } from './types'

export const BASE_THAILAND_WINDOWS = 1
export const BASE_REGIONAL_WINDOWS = 1
/** Upper bound for an admin grant, per board type. */
export const MAX_EXTRA_WINDOWS = 50

export function quotaLimits(extra?: ExtraWindows) {
  const thailand = BASE_THAILAND_WINDOWS + (extra?.thailand ?? 0)
  const regional = BASE_REGIONAL_WINDOWS + (extra?.regional ?? 0)
  return { thailand, regional, total: thailand + regional }
}

/** `held` = windows owned plus those in pending orders. */
export function buildQuota<T extends { region: string | null }>(
  held: T[],
  extra?: ExtraWindows,
): Omit<Quota, 'thailandWindow' | 'regionalWindow'> & { thailandWindow?: T; regionalWindow?: T } {
  const limits = quotaLimits(extra)
  const thailand = held.filter((w) => w.region === 'thailand')
  const regional = held.filter((w) => w.region !== 'thailand')
  return {
    thailandCount: thailand.length,
    regionalCount: regional.length,
    totalCount: held.length,
    thailandLimit: limits.thailand,
    regionalLimit: limits.regional,
    totalLimit: limits.total,
    canAcquireThailand: thailand.length < limits.thailand,
    canAcquireRegional: regional.length < limits.regional,
    canAcquireTotal: held.length < limits.total,
    thailandWindow: thailand[0],
    regionalWindow: regional[0],
  }
}

/** Why the user can't get another window of this board type, e.g. "คุณมีหน้าต่างบานภูมิภาคครบ 1 บานแล้ว (N-0012)". */
export function quotaFullMessage(quota: Quota, thailand: boolean): string {
  const limit = thailand ? quota.thailandLimit : quota.regionalLimit
  const first = thailand ? quota.thailandWindow : quota.regionalWindow
  return `คุณมีหน้าต่าง${thailand ? 'บานประเทศไทย' : 'บานภูมิภาค'}ครบ ${limit} บานแล้ว${limit === 1 && first ? ` (${first.code})` : ''}`
}

/** Accepts whole numbers 0..MAX_EXTRA_WINDOWS; null when the input is invalid. */
export function parseExtraWindows(input: unknown): ExtraWindows | null {
  const value = input as Partial<Record<keyof ExtraWindows, unknown>> | null
  const ok = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_EXTRA_WINDOWS
  if (!value || !ok(value.thailand) || !ok(value.regional)) return null
  return { thailand: value.thailand, regional: value.regional }
}
