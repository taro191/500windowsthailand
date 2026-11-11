// Admin-only API calls (server/src/services/admin.ts). Every change is audit-logged on the server.
import type { AuditEntry, CentralNews, RefundPayout, ContactMessageEntry, ExtraWindows, PaymentOrder, PlatformSettings, RegionId, Result, Transaction, User, WindowArchive, WindowItem } from '@shared/types'
import type { LineAlertTopics } from '@shared/lineAlerts'
import type { PromoRequest } from '@shared/promo'
import { download, get, post, put } from './api'
import type { ThemeAssignments, ThemeInfo } from '@shared/themes'
import type { AdminFile } from '@shared/adminFiles'
import { refreshBoards, refreshConfig } from './store'

export interface AdminOverview {
  users: User[]
  /** Windows that differ from their empty default, on all boards. */
  windows: WindowItem[]
  transactions: Transaction[]
  promoRequests: PromoRequest[]
  orders: PaymentOrder[]
  auditLog: AuditEntry[]
  contactMessages: ContactMessageEntry[]
  pendingRefundPayouts: number
}

export const loadAdminOverview = () => get<AdminOverview>('/admin/overview')

export async function updateSettings(settings: PlatformSettings, what: string): Promise<Result> {
  const result = await put<{ settings: PlatformSettings }>('/admin/settings', { settings, what })
  if (result.success) await refreshConfig()
  return result
}

/** Content moderation: hides the content from visitors (kept for the owner and admins); `hidden` false lifts it. */
export async function takeDownContent(region: RegionId, windowId: number, reason: string, hidden = true): Promise<Result> {
  const result = await post(`/admin/windows/${region}/${windowId}/takedown`, { reason, hidden })
  if (result.success) await refreshBoards()
  return result
}

/** Returns a window to the pool as an empty, available window (ownership is removed). */
export async function releaseWindow(region: RegionId, windowId: number, reason: string): Promise<Result> {
  const result = await post(`/admin/windows/${region}/${windowId}/release`, { reason })
  if (result.success) await refreshBoards()
  return result
}

/** Window refunds to transfer to the owner's bank account; `paid` needs the transfer reference as note. */
export const loadRefundPayouts = () => get<{ payouts: RefundPayout[] }>('/admin/refund-payouts')
export const decideRefundPayout = (id: string, decision: 'paid' | 'returned', note: string) =>
  post<{ payouts: RefundPayout[] }>(`/admin/refund-payouts/${id}/decide`, { decision, note })

/** '500WinTH & Co' announcements on the central page (drafts and published). */
export const loadCentralNews = () => get<{ news: CentralNews[] }>('/admin/central-news')
export type CentralNewsInput = Pick<CentralNews, 'type' | 'title' | 'body' | 'by' | 'url' | 'img' | 'pin' | 'publishAt'> & { endAt: string }
/** Saves as a draft; `id` edits an existing one (published ones need publishing again). */
export const saveCentralNews = (input: CentralNewsInput, id?: string) => post<{ news: CentralNews[] }>(id ? `/admin/central-news/${id}` : '/admin/central-news', input)
export const publishCentralNews = (id: string, publish: boolean) => post<{ news: CentralNews[] }>(`/admin/central-news/${id}/publish`, { publish })
export const deleteCentralNews = (id: string) => post<{ news: CentralNews[] }>(`/admin/central-news/${id}/delete`)

export const loadWindowArchives = () => get<{ archives: WindowArchive[] }>('/admin/window-archives')

/** Super admin: keeps the window's content and owner in the archive and empties the window. */
export async function archiveWindow(region: RegionId, windowId: number, reason: string) {
  const result = await post<{ archives: WindowArchive[] }>(`/admin/windows/${region}/${windowId}/archive`, { reason })
  if (result.success) await refreshBoards()
  return result
}

/** Super admin: puts archived content and its owner on an empty window. */
export async function restoreWindowArchive(id: string, region: RegionId, num: number) {
  const result = await post<{ archives: WindowArchive[] }>(`/admin/window-archives/${id}/restore`, { region, num })
  if (result.success) await refreshBoards()
  return result
}

/** Holds a window for review (visitors see only its status) or releases it. */
export async function setWindowSuspended(region: RegionId, windowId: number, suspended: boolean, reason: string): Promise<Result> {
  const result = await post(`/admin/windows/${region}/${windowId}/suspend`, { suspended, reason })
  if (result.success) await refreshBoards()
  return result
}

export const setUserSuspended = (userId: string, suspended: boolean) => post<{ user: User }>(`/admin/users/${userId}/suspend`, { suspended })

export const revokeKyc = (userId: string) => post<{ user: User }>(`/admin/users/${userId}/revoke-kyc`)

/** Verify KYC without OTP, using the citizen ID and phone on file (any admin, not for their own account). */
export const verifyUserKyc = (userId: string) => post<{ user: User }>(`/admin/users/${userId}/verify-kyc`)

/** Takes down a user's profile photo; they go back to the default avatar. */
export const removeUserAvatar = (userId: string) => post<{ user: User }>(`/admin/users/${userId}/remove-avatar`)

/** Disabled accounts cannot log in (suspended ones only cannot trade). */
export const setUserDisabled = (userId: string, disabled: boolean) => post<{ user: User }>(`/admin/users/${userId}/disable`, { disabled })

/** Windows on top of the normal quota (1 Thailand + 1 regional); 0/0 removes the grant. */
export const setUserExtraWindows = (userId: string, extra: ExtraWindows) => post<{ user: User }>(`/admin/users/${userId}/extra-windows`, extra)

/** Super admin only (as is createUser). */
export const setUserRole = (userId: string, role: 'admin' | 'user') => post<{ user: User }>(`/admin/users/${userId}/role`, { role })

/** Super admin only: deletes the account and its data; its windows become empty again. */
export const deleteUser = (userId: string, reason: string, confirmName: string) =>
  post<{ windows: string[] }>(`/admin/users/${userId}/delete`, { reason, confirmName })

export const createUser = (user: { name: string; email: string; password: string; role: 'admin' | 'user' }) =>
  post<{ user: User }>('/admin/users', user)

/** Approving needs the transfer slip checked first; rejecting refunds the full amount to the wallet. */
export const decidePromoRequest = (requestId: string, decision: 'approved' | 'rejected', note = '') =>
  post<{ refunded?: number }>(`/admin/promo/${requestId}/decide`, { decision, note })

/** Approving a slip completes the purchase or top-up; rejecting returns the wallet part. */
/** Marks a contact form message done (with a note) or back to new. */
export const updateContactMessage = (id: string, status: ContactMessageEntry['status'], note: string) =>
  post(`/admin/contact-messages/${id}`, { status, note })

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

export interface LineStatus {
  configured: boolean
  hasToken: boolean
  hasSecret: boolean
  recipients: number
  /** IDs from LINE_ADMIN_TO (env) and saved from this page. */
  fromEnv: number
  saved: string[]
  /** Which kinds of alert are sent (super admin switches). */
  topics: LineAlertTopics
  lastFailure: { at: string; error: string } | null
}

/** Super admin only: LINE alerts to the finance admin. */
export const loadLineStatus = () => get<LineStatus>('/admin/line-status')
export const sendLineTest = () => post<{ sent: number }>('/admin/line-test')
export const saveLineRecipients = (ids: string[]) => put<LineStatus>('/admin/line-recipients', { ids })
export const saveLineTopics = (topics: Partial<LineAlertTopics>) => put<LineStatus>('/admin/line-topics', topics)

/** Moderation: removes an unsuitable review from a window. */
export const deleteReviewAsAdmin = (reviewId: string) => post<{ window: WindowItem }>(`/admin/reviews/${reviewId}/delete`)
export const deleteUpdateAsAdmin = (updateId: string) => post<{ window: WindowItem }>(`/admin/updates/${updateId}/delete`)

// ---------------------------------------------------------------- site themes

export const loadThemes = () => get<{ themes: ThemeInfo[]; assignments: ThemeAssignments }>('/admin/themes')

/** Uploads a theme zip; the file is sent as base64 inside JSON like other uploads. */
export async function uploadTheme(file: File) {
  const zip = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return post<{ theme: ThemeInfo }>('/admin/themes', { zip })
}

export const deleteTheme = (id: string) => post(`/admin/themes/${encodeURIComponent(id)}/delete`)

export async function saveThemeAssignments(assignments: ThemeAssignments) {
  const result = await put<{ assignments: ThemeAssignments }>('/admin/themes/assignments', { assignments })
  if (result.success) await refreshConfig()
  return result
}

/** Downloads a theme as a zip ('default' = the built-in design). */
export const downloadTheme = (id: string) => download(`/admin/themes/${encodeURIComponent(id)}/download`, 'theme.zip')

// ---------------------------------------------------------------- document library

export const loadFiles = () => get<{ files: AdminFile[] }>('/admin/files')

/** Uploads one file as base64 inside JSON like other uploads. */
export async function uploadFile(file: File, note = '') {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  return post<{ file: AdminFile }>('/admin/files', { name: file.name, data, note })
}

export const updateFileNote = (id: string, note: string) => post<{ file: AdminFile }>(`/admin/files/${encodeURIComponent(id)}/note`, { note })
export const deleteFile = (id: string) => post(`/admin/files/${encodeURIComponent(id)}/delete`)
export const downloadFile = (file: AdminFile) => download(`/admin/files/${encodeURIComponent(file.id)}/download`, file.name)
/** Inline URL for image thumbnails (admins only; the cookie authorises it). */
export const filePreviewUrl = (id: string) => `/api/admin/files/${encodeURIComponent(id)}/download?inline=1`
