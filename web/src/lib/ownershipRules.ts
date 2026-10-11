// Ownership rules from shared/, with price caps, holding period and commission taken from the settings loaded from the API.
import type { PlatformSettings, WindowItem } from '@shared/types'
import { getHoldingPeriod as sharedHoldingPeriod, getPriceCap as sharedPriceCap } from '@shared/ownershipRules'
import { resaleCommission } from '@shared/settings'
import { loadSettings } from './settings'

export * from '@shared/ownershipRules'

export const getPriceCap = (window: WindowItem, settings: PlatformSettings = loadSettings()) =>
  sharedPriceCap(window, settings)

export const getHoldingPeriod = (window: WindowItem, minHoldingDays = loadSettings().rules.minHoldingDays) =>
  sharedHoldingPeriod(window, minHoldingDays)

/** Commission the platform keeps from a resale at `price` (current settings). */
export const commissionOf = (price: number) => resaleCommission(price, loadSettings().rules)
