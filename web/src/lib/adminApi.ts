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

/** Super admin only: verify KYC without OTP, using the citizen ID and phone on file. */
export const verifyUserKyc = (userId: string) => post<{ user: User }>(`/admin/users/${userId}/verify-kyc`)

/** Disabled accounts cannot log in (suspended ones only cannot trade). */
export const setUserDisabled = (userId: string, disabled: boolean) => post<{ user: User }>(`/admin/users/${userId}/disable`, { disabled })

/** Super admin only (as is createUser). */
export const setUserRole = (userId: string, role: 'admin' | 'user') => post<{ user: User }>(`/admin/users/${userId}/role`, { role })

export const createUser = (user: { name: string; email: string; password: string; role: 'admin' | 'user' }) =>
  post<{ user: User }>('/admin/users', user)

/** Approving needs the transfer slip checked first; rejecting refunds the full amount to the wallet. */
export const decidePromoRequest = (requestId: string, decision: 'approved' | 'rejected', note = '') =>
  post<{ refunded?: number }>(`/admin/promo/${requestId}/decide`, { decision, note })

/** Approving a slip completes the purchase or top-up; rejecting returns the wallet part. */
export async function decideOrder(orderId: string, decision: 'approved' | 'rejected', note = ''): Promise<Result> {
  const result = await post(`/admin/orders/${orderId}/decide`, { decision, note })
  if (result.success) await refreshBoards()
  return result
}

/** Super admin only. Empty citizenId or password keeps the current one. */
export const updateUserInfo = (
  userId: string,
  info: { name: string; email: string; phone: string; citizenId: string; bio: string; password: string },
) => put<{ user: User }>(`/admin/users/${userId}`, info)
