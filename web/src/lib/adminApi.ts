// Admin-only API calls (server/src/services/admin.ts). Every change is audit-logged on the server.
import type { AuditEntry, PaymentOrder, PlatformSettings, RegionId, Result, Transaction, User, WindowItem } from '@shared/types'
import type { PromoRequest } from '@shared/promo'
import { get, post, put } from './api'
import { refreshBoards, refreshConfig } from './store'

export interface AdminOverview {
  users: User[]
  /** Windows that differ from their empty default, on all boards. */
  windows: WindowItem[]
  transactions: Transaction[]
  promoRequests: PromoRequest[]
  orders: PaymentOrder[]
  auditLog: AuditEntry[]
}

export const loadAdminOverview = () => get<AdminOverview>('/admin/overview')

export async function updateSettings(settings: PlatformSettings, what: string): Promise<Result> {
  const result = await put<{ settings: PlatformSettings }>('/admin/settings', { settings, what })
  if (result.success) await refreshConfig()
  return result
}

/** Content moderation: removes the image and text but keeps the owner. */
export async function takeDownContent(region: RegionId, windowId: number, reason: string): Promise<Result> {
  const result = await post(`/admin/windows/${region}/${windowId}/takedown`, { reason })
  if (result.success) await refreshBoards()
  return result
}

/** Returns a window to the pool as an empty, available window (ownership is removed). */
export async function releaseWindow(region: RegionId, windowId: number, reason: string): Promise<Result> {
  const result = await post(`/admin/windows/${region}/${windowId}/release`, { reason })
  if (result.success) await refreshBoards()
  return result
}

export const setUserSuspended = (userId: string, suspended: boolean) => post<{ user: User }>(`/admin/users/${userId}/suspend`, { suspended })

export const revokeKyc = (userId: string) => post<{ user: User }>(`/admin/users/${userId}/revoke-kyc`)

/** Approving needs the transfer slip checked first; rejecting refunds the full amount to the wallet. */
export const decidePromoRequest = (requestId: string, decision: 'approved' | 'rejected', note = '') =>
  post<{ refunded?: number }>(`/admin/promo/${requestId}/decide`, { decision, note })

/** Approving a slip completes the purchase or top-up; rejecting returns the wallet part. */
export async function decideOrder(orderId: string, decision: 'approved' | 'rejected', note = ''): Promise<Result> {
  const result = await post(`/admin/orders/${orderId}/decide`, { decision, note })
  if (result.success) await refreshBoards()
  return result
}
