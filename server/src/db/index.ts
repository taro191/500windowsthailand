// Database connection: SQLite (node:sqlite, development and tests) or MySQL (production).
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Kysely, MysqlDialect, SqliteDialect, type Dialect } from 'kysely'
import { createPool } from 'mysql2'
import type { Database } from './schema'

export type DB = Kysely<Database>

/** Adapts node:sqlite to the better-sqlite3 interface Kysely's SqliteDialect expects. */
function sqliteDialect(file: string): Dialect {
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  const sqlite = new DatabaseSync(file)
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  return new SqliteDialect({
    database: {
      close: () => sqlite.close(),
      prepare(sql: string) {
        const statement = sqlite.prepare(sql)
        type Params = ReadonlyArray<unknown>
        const args = (params: Params) => params as Parameters<typeof statement.all>
        return {
          reader: statement.columns().length > 0,
          all: (params: Params) => statement.all(...args(params)),
          run: (params: Params) => statement.run(...args(params)),
          iterate: (params: Params) => statement.iterate(...args(params)),
        }
      },
    },
  })
}

export function createDb(options: { client: 'sqlite' | 'mysql'; sqliteFile?: string; url?: string }): DB {
  if (options.client === 'mysql') {
    if (!options.url) throw new Error('DATABASE_URL is required when DB_CLIENT=mysql')
    const pool = createPool({ uri: options.url, connectionLimit: 5, timezone: 'Z', charset: 'utf8mb4' })
    return new Kysely<Database>({ dialect: new MysqlDialect({ pool }) })
  }
  return new Kysely<Database>({ dialect: sqliteDialect(options.sqliteFile || ':memory:') })
}
