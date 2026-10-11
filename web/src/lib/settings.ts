// Platform settings (price caps, payment channels, top-up limits) as loaded from the API.
// Defaults, labels and validation are shared with the server (shared/settings.ts);
// components read the settings through useSettings() so admin changes apply immediately.
import { useSyncExternalStore } from 'react'
import type { PaymentChannel, PlatformSettings, WindowItem } from '@shared/types'
import { DEFAULT_SETTINGS, enabledChannels as sharedEnabledChannels, sellerPercent } from '@shared/settings'

export {
  CHANNEL_TYPE_LABELS,
  DEFAULT_SETTINGS,
  activeSignupBonus,
  editPolicyLabel,
  multiplierLabel,
  SLIP_CHANNEL_TYPES,
  sortTiers,
  tierAgeLabel,
  validateSettings,
  validateTiers,
} from '@shared/settings'

let current: PlatformSettings = DEFAULT_SETTINGS
const listeners = new Set<() => void>()

export const loadSettings = (): PlatformSettings => current

/** Called by store.ts after loading or saving settings on the server. */
export function setSettings(settings: PlatformSettings) {
  current = settings
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current settings; re-renders when they change. */
export function useSettings(): PlatformSettings {
  return useSyncExternalStore(subscribe, loadSettings, loadSettings)
}

export const enabledChannels = (settings: PlatformSettings = current): PaymentChannel[] => sharedEnabledChannels(settings)

/** The general rules (admin rules page) with ready-made labels for UI text. */
export function rulesView(rules: PlatformSettings['rules']) {
  const percent = (n: number) => `${Number(n.toFixed(2))}%`
  return {
    ...rules,
    commissionRate: rules.commissionPercent / 100,
    sellerPercent: sellerPercent(rules),
    /** e.g. "5%" */
    commissionLabel: percent(rules.commissionPercent),
    /** e.g. "95%" */
    sellerLabel: percent(sellerPercent(rules)),
    /** e.g. "500 ฿" */
    claimPriceLabel: `${rules.claimPrice.toLocaleString()} ฿`,
  }
}

/** Current rules; re-renders when an admin changes them. */
export function useRules() {
  return rulesView(useSettings().rules)
}

/** What claiming this window costs: empty windows follow the current claim price, owned ones keep theirs. */
export const claimPriceOf = (window: WindowItem) => (window.status === 'available' ? current.rules.claimPrice : window.claimPrice || current.rules.claimPrice)
