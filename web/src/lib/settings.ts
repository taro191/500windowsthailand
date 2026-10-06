// Platform settings (price caps, payment channels, top-up limits) as loaded from the API.
// Defaults, labels and validation are shared with the server (shared/settings.ts);
// components read the settings through useSettings() so admin changes apply immediately.
import { useSyncExternalStore } from 'react'
import type { PaymentChannel, PlatformSettings } from '@shared/types'
import { DEFAULT_SETTINGS, enabledChannels as sharedEnabledChannels } from '@shared/settings'

export {
  CHANNEL_TYPE_LABELS,
  DEFAULT_SETTINGS,
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
