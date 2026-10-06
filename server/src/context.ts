import type { AppConfig } from './config'
import type { DB } from './db'
import type { Secrets } from './lib/crypto'

/** Everything a service needs; created once in app.ts (tests create their own). */
export interface AppContext {
  db: DB
  config: AppConfig
  secrets: Secrets
}

export const nowIso = () => new Date().toISOString()
