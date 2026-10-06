import type { Transaction, User, WindowItem } from '@/types'
import type { PromoRequest } from '@/lib/promo'
import type { AuditEntry } from '@/lib/adminStore'

/** Everything the admin pages read, loaded once per refresh. */
export interface AdminData {
  users: User[]
  windows: WindowItem[]
  transactions: Transaction[]
  promoRequests: PromoRequest[]
  auditLog: AuditEntry[]
}

export interface AdminPageProps {
  admin: User
  data: AdminData
  /** Reload data after a change. */
  refresh: () => void
  notify: (message: string) => void
}

export const isOwned = (w: WindowItem) => w.status !== 'available'
