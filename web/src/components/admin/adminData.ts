import type { AuditEntry, PaymentOrder, Transaction, User, WindowItem } from '@shared/types'
import type { PromoRequest } from '@/lib/promo'

/** Everything the admin pages read, loaded from the API on each refresh. */
export interface AdminData {
  users: User[]
  /** All 3,500 windows (untouched ones are the empty defaults). */
  windows: WindowItem[]
  transactions: Transaction[]
  promoRequests: PromoRequest[]
  orders: PaymentOrder[]
  auditLog: AuditEntry[]
}

export interface AdminPageProps {
  admin: User
  data: AdminData
  /** Reload data after a change. */
  refresh: () => Promise<void>
  notify: (message: string, tone?: 'success' | 'error') => void
}

export const isOwned = (w: WindowItem) => w.status !== 'available'
