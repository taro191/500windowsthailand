import type { AuditEntry } from '@shared/types'
import type { DB } from '../db'
import type { UserRow } from '../db/schema'
import { newId } from '../lib/crypto'
import { nowIso } from '../context'

/** Records an admin action (shown on the admin audit page). */
export async function audit(db: DB, admin: Pick<UserRow, 'id' | 'name'>, action: string, detail: string) {
  await db
    .insertInto('audit_log')
    .values({ id: newId('au'), at: nowIso(), admin_id: admin.id, admin_name: admin.name, action, detail: detail.slice(0, 1000) })
    .execute()
}

export async function loadAuditLog(db: DB, limit = 500): Promise<AuditEntry[]> {
  const rows = await db.selectFrom('audit_log').selectAll().orderBy('at', 'desc').limit(limit).execute()
  return rows.map((r) => ({ id: r.id, at: r.at, adminId: r.admin_id, adminName: r.admin_name, action: r.action, detail: r.detail }))
}
