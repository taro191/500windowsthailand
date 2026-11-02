// Free trial window: one per user, held without paying for TRIAL_DAYS while the owner builds it
// (not shown to visitors, can't be published), then TRIAL_GRACE_DAYS "รอชำระเงิน", then it goes back
// to the pool and the content is kept so the user can restore it into another empty window.

export const TRIAL_DAYS = 60
export const TRIAL_GRACE_DAYS = 30

const DAY_MS = 86_400_000

export const trialEndsAt = (startedAt: Date) => new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS)

/** Last moment the owner can still pay before the window is released. */
export const trialPayBy = (endsAt: string | Date) => new Date(new Date(endsAt).getTime() + TRIAL_GRACE_DAYS * DAY_MS)

/** `trial` while building for free, `unpaid` in the grace period, `expired` once it should be released. */
export function trialPhase(endsAt: string, now = new Date()): 'trial' | 'unpaid' | 'expired' {
  if (now.getTime() < new Date(endsAt).getTime()) return 'trial'
  return now.getTime() < trialPayBy(endsAt).getTime() ? 'unpaid' : 'expired'
}

/** Whole days left until `until` (at least 0, rounded up). */
export const daysLeft = (until: string | Date, now = new Date()) => Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / DAY_MS))

// ---------------------------------------------------------------- refund

/** Days after paying for a window from the system during which the owner can get a full refund. */
export const REFUND_DAYS = 15

/** End of the refund period for a window paid at `paidAt`. */
export const refundUntil = (paidAt: string | Date) => new Date(new Date(paidAt).getTime() + REFUND_DAYS * DAY_MS)
