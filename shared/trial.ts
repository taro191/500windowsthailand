// Free trial window: one per user, held without paying for TRIAL_DAYS while the owner builds it
// (not shown to visitors, can't be published). Unpaid at the end, it goes straight back to the pool and
// its content is kept for TRIAL_RESTORE_DAYS: paying for that same window (if still free) restores it.
// Buying any other window ends the trial at once.

export const TRIAL_DAYS = 60
export const TRIAL_RESTORE_DAYS = 30

const DAY_MS = 86_400_000

export const trialEndsAt = (startedAt: Date) => new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS)

/** `trial` while building for free, `expired` once it should go back to the pool. */
export function trialPhase(endsAt: string, now = new Date()): 'trial' | 'expired' {
  return now.getTime() < new Date(endsAt).getTime() ? 'trial' : 'expired'
}

/** Last moment a released trial's content can be restored into its window. */
export const trialRestoreUntil = (releasedAt: string | Date) => new Date(new Date(releasedAt).getTime() + TRIAL_RESTORE_DAYS * DAY_MS)

/** Whole days left until `until` (at least 0, rounded up). */
export const daysLeft = (until: string | Date, now = new Date()) => Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY_MS))

// ---------------------------------------------------------------- refund

/** Days after paying for a window from the system during which the owner can get a full refund. */
export const REFUND_DAYS = 15

/** End of the refund period for a window paid at `paidAt`. */
export const refundUntil = (paidAt: string | Date) => new Date(new Date(paidAt).getTime() + REFUND_DAYS * DAY_MS)

// ---------------------------------------------------------------- feature locks

/** Promo booking is for paying owners: refused while the user's only windows are free trials. */
export const trialOnly = (windows: { trial: boolean }[]) => windows.length > 0 && windows.every((w) => w.trial)

export const TRIAL_PROMO_LOCKED = 'บานทดลองใช้ฟรียังจองพื้นที่โปรโมทไม่ได้ ชำระเงินบานของคุณก่อน แล้วจึงจองโปรโมท'
