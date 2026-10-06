// Ownership rules from shared/, with price caps defaulting to the settings loaded from the API.
import type { PlatformSettings, WindowItem } from '@shared/types'
import { getPriceCap as sharedPriceCap } from '@shared/ownershipRules'
import { loadSettings } from './settings'

export * from '@shared/ownershipRules'

export const getPriceCap = (window: WindowItem, settings: PlatformSettings = loadSettings()) =>
  sharedPriceCap(window, settings)
