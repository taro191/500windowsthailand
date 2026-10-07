// Table types for Kysely. Times are ISO strings, money is whole baht, flags are 0/1
// (portable between SQLite in development and MySQL in production).
import type { Insertable, Selectable, Updateable } from 'kysely'

export interface UsersTable {
  id: string
  name: string
  email: string
  phone: string | null
  /** HMAC of the 13 digits: lets us enforce one account per citizen ID without storing it in clear. */
  citizen_hash: string | null
  /** AES-GCM encrypted citizen ID (PDPA). */
  citizen_enc: string | null
  password_hash: string
  balance: number
  avatar_url: string
  bio: string | null
  is_verified: number
  verified_at: string | null
  role: 'user' | 'admin'
  suspended: number
  /** PayoutAccount as JSON. */
  payout_json: string | null
  created_at: string
  updated_at: string
}

export interface SessionsTable {
  /** SHA-256 of the cookie token. */
  id: string
  user_id: string
  created_at: string
  expires_at: string
}

export interface OtpCodesTable {
  user_id: string
  phone: string
  code_hash: string
  expires_at: string
  attempts: number
}

export interface WindowsTable {
  region: string
  num: number
  code: string
  status: 'available' | 'occupied' | 'for_resale'
  title: string
  description: string
  image_url: string
  category: string
  province: string
  claim_price: number
  resale_price: number | null
  owner_id: string | null
  owner_contact: string | null
  external_link: string | null
  claimed_at: string | null
  owner_changed_at: string | null
  owner_change_kind: 'new' | 'owner' | null
  last_purchase_price: number | null
  last_image_updated_at: string | null
  edit_day: string | null
  edit_count: number
  views_count: number
  likes_count: number
  likes_day: string | null
  likes_day_count: number
  followers_base: number
  note_day: string | null
  note_text: string | null
  note_at: string | null
  previous_owner_id: string | null
  /** Pending payment order holding this window (claim or resale waiting for slip check). */
  reserved_order_id: string | null
  updated_at: string
}

export interface WindowImagesTable {
  id: string
  region: string
  num: number
  date: string
  image_url: string
  caption: string
}

export interface WindowOwnersTable {
  id: string
  region: string
  num: number
  owner_id: string
  transferred_at: string
  type: 'resale' | 'transfer' | 'released'
}

export interface WindowFollowsTable {
  region: string
  num: number
  user_id: string
  created_at: string
}

export interface WindowLikesTable {
  region: string
  num: number
  day: string
  visitor_id: string
}

export interface TransactionsTable {
  id: string
  date: string
  type: 'claim' | 'resale' | 'transfer' | 'topup' | 'promo' | 'refund' | 'edit_fee'
  region: string
  window_num: number
  window_code: string
  window_title: string
  from_owner: string
  from_owner_id: string | null
  to_owner: string
  to_owner_id: string
  amount: number
  commission_rate: number | null
  commission_amount: number | null
  net_seller_amount: number | null
  wallet_amount: number | null
  external_amount: number | null
  channel_name: string | null
  slip_ref: string | null
  order_id: string | null
}

export interface PaymentOrdersTable {
  id: string
  user_id: string
  kind: 'topup' | 'claim' | 'resale' | 'promo'
  label: string
  amount: number
  wallet_amount: number
  external_amount: number
  channel_id: string | null
  channel_name: string | null
  slip_url: string | null
  slip_ref: string | null
  status: 'pending' | 'approved' | 'rejected'
  /** What to do once approved (e.g. claim content) as JSON. */
  payload_json: string | null
  region: string | null
  window_num: number | null
  promo_request_id: string | null
  created_at: string
  decided_at: string | null
  decided_by: string | null
  note: string | null
}

export interface PromoRequestsTable {
  id: string
  user_id: string
  brand: string
  tagline: string
  link: string
  contact: string
  images_json: string
  size: number
  price: number
  rounds: number
  duration_hours: number
  schedule_mode: 'today' | 'calendar'
  start_date: string
  terms_accepted_at: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected'
  payment_json: string | null
  refund_json: string | null
  order_id: string | null
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
}

export interface SettingsTable {
  id: string
  value_json: string
  updated_at: string
}

export interface AuditLogTable {
  id: string
  at: string
  admin_id: string
  admin_name: string
  action: string
  detail: string
}

export interface Database {
  users: UsersTable
  sessions: SessionsTable
  otp_codes: OtpCodesTable
  windows: WindowsTable
  window_images: WindowImagesTable
  window_owners: WindowOwnersTable
  window_follows: WindowFollowsTable
  window_likes: WindowLikesTable
  transactions: TransactionsTable
  payment_orders: PaymentOrdersTable
  promo_requests: PromoRequestsTable
  settings: SettingsTable
  audit_log: AuditLogTable
}

export type UserRow = Selectable<UsersTable>
export type NewUser = Insertable<UsersTable>
export type UserUpdate = Updateable<UsersTable>
export type WindowRow = Selectable<WindowsTable>
export type WindowUpdate = Updateable<WindowsTable>
export type TransactionRow = Selectable<TransactionsTable>
export type OrderRow = Selectable<PaymentOrdersTable>
export type PromoRow = Selectable<PromoRequestsTable>
