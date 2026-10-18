// Schema migrations, kept in code so the bundled server can run them on start.
// Column types are chosen to work on both SQLite and MySQL.
import { sql, type Kysely } from 'kysely'
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'
import type { DB } from './index'

const varchar = (length: number) => sql`varchar(${sql.raw(String(length))})`
const id = varchar(40)
const time = varchar(32)

const migrations: Record<string, Migration> = {
  '001_initial': {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('users')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('name', varchar(120), (c) => c.notNull())
        .addColumn('email', varchar(190), (c) => c.notNull().unique())
        .addColumn('phone', varchar(20), (c) => c.unique())
        .addColumn('citizen_hash', varchar(64), (c) => c.unique())
        .addColumn('citizen_enc', varchar(200))
        .addColumn('password_hash', varchar(200), (c) => c.notNull())
        .addColumn('balance', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('avatar_url', varchar(500), (c) => c.notNull())
        .addColumn('bio', 'text')
        .addColumn('is_verified', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('verified_at', time)
        .addColumn('role', varchar(10), (c) => c.notNull().defaultTo('user'))
        .addColumn('suspended', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('payout_json', 'text')
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('updated_at', time, (c) => c.notNull())
        .execute()

      await db.schema
        .createTable('sessions')
        .addColumn('id', varchar(64), (c) => c.primaryKey())
        .addColumn('user_id', id, (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('expires_at', time, (c) => c.notNull())
        .execute()
      await db.schema.createIndex('sessions_user').on('sessions').column('user_id').execute()

      await db.schema
        .createTable('otp_codes')
        .addColumn('user_id', id, (c) => c.primaryKey())
        .addColumn('phone', varchar(20), (c) => c.notNull())
        .addColumn('code_hash', varchar(64), (c) => c.notNull())
        .addColumn('expires_at', time, (c) => c.notNull())
        .addColumn('attempts', 'integer', (c) => c.notNull().defaultTo(0))
        .execute()

      await db.schema
        .createTable('windows')
        .addColumn('region', varchar(16), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('code', varchar(20), (c) => c.notNull())
        .addColumn('status', varchar(12), (c) => c.notNull())
        .addColumn('title', varchar(200), (c) => c.notNull())
        .addColumn('description', 'text', (c) => c.notNull())
        .addColumn('image_url', varchar(500), (c) => c.notNull())
        .addColumn('category', varchar(32), (c) => c.notNull())
        .addColumn('province', varchar(64), (c) => c.notNull())
        .addColumn('claim_price', 'integer', (c) => c.notNull())
        .addColumn('resale_price', 'integer')
        .addColumn('owner_id', id)
        .addColumn('owner_contact', varchar(200))
        .addColumn('external_link', varchar(500))
        .addColumn('claimed_at', time)
        .addColumn('owner_changed_at', time)
        .addColumn('owner_change_kind', varchar(8))
        .addColumn('last_purchase_price', 'integer')
        .addColumn('last_image_updated_at', time)
        .addColumn('views_count', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('likes_count', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('likes_day', varchar(10))
        .addColumn('likes_day_count', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('followers_base', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('note_day', varchar(10))
        .addColumn('note_text', varchar(200))
        .addColumn('note_at', time)
        .addColumn('previous_owner_id', id)
        .addColumn('reserved_order_id', id)
        .addColumn('updated_at', time, (c) => c.notNull())
        .addPrimaryKeyConstraint('windows_pk', ['region', 'num'])
        .execute()
      await db.schema.createIndex('windows_owner').on('windows').column('owner_id').execute()

      await db.schema
        .createTable('window_images')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('region', varchar(16), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('date', time, (c) => c.notNull())
        .addColumn('image_url', varchar(500), (c) => c.notNull())
        .addColumn('caption', varchar(200), (c) => c.notNull())
        .execute()
      await db.schema.createIndex('window_images_window').on('window_images').columns(['region', 'num']).execute()

      await db.schema
        .createTable('window_owners')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('region', varchar(16), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('owner_id', id, (c) => c.notNull())
        .addColumn('transferred_at', time, (c) => c.notNull())
        .addColumn('type', varchar(10), (c) => c.notNull())
        .execute()
      await db.schema.createIndex('window_owners_window').on('window_owners').columns(['region', 'num']).execute()

      await db.schema
        .createTable('window_follows')
        .addColumn('region', varchar(16), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('user_id', id, (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addPrimaryKeyConstraint('window_follows_pk', ['region', 'num', 'user_id'])
        .execute()

      await db.schema
        .createTable('window_likes')
        .addColumn('region', varchar(16), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('day', varchar(10), (c) => c.notNull())
        .addColumn('visitor_id', varchar(64), (c) => c.notNull())
        .addPrimaryKeyConstraint('window_likes_pk', ['region', 'num', 'day', 'visitor_id'])
        .execute()

      await db.schema
        .createTable('transactions')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('date', time, (c) => c.notNull())
        .addColumn('type', varchar(10), (c) => c.notNull())
        .addColumn('region', varchar(16), (c) => c.notNull())
        .addColumn('window_num', 'integer', (c) => c.notNull())
        .addColumn('window_code', varchar(20), (c) => c.notNull())
        .addColumn('window_title', varchar(255), (c) => c.notNull())
        .addColumn('from_owner', varchar(200), (c) => c.notNull())
        .addColumn('from_owner_id', id)
        .addColumn('to_owner', varchar(200), (c) => c.notNull())
        .addColumn('to_owner_id', id, (c) => c.notNull())
        .addColumn('amount', 'integer', (c) => c.notNull())
        .addColumn('commission_rate', 'real')
        .addColumn('commission_amount', 'integer')
        .addColumn('net_seller_amount', 'integer')
        .addColumn('wallet_amount', 'integer')
        .addColumn('external_amount', 'integer')
        .addColumn('channel_name', varchar(120))
        .addColumn('slip_ref', varchar(80))
        .addColumn('order_id', id)
        .execute()
      await db.schema.createIndex('transactions_date').on('transactions').column('date').execute()
      await db.schema.createIndex('transactions_to').on('transactions').column('to_owner_id').execute()
      await db.schema.createIndex('transactions_from').on('transactions').column('from_owner_id').execute()

      await db.schema
        .createTable('payment_orders')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('user_id', id, (c) => c.notNull())
        .addColumn('kind', varchar(10), (c) => c.notNull())
        .addColumn('label', varchar(255), (c) => c.notNull())
        .addColumn('amount', 'integer', (c) => c.notNull())
        .addColumn('wallet_amount', 'integer', (c) => c.notNull())
        .addColumn('external_amount', 'integer', (c) => c.notNull())
        .addColumn('channel_id', id)
        .addColumn('channel_name', varchar(120))
        .addColumn('slip_url', varchar(500))
        .addColumn('slip_ref', varchar(80))
        .addColumn('status', varchar(10), (c) => c.notNull())
        .addColumn('payload_json', 'text')
        .addColumn('region', varchar(16))
        .addColumn('window_num', 'integer')
        .addColumn('promo_request_id', id)
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('decided_at', time)
        .addColumn('decided_by', id)
        .addColumn('note', varchar(500))
        .execute()
      await db.schema.createIndex('payment_orders_status').on('payment_orders').columns(['status', 'created_at']).execute()
      await db.schema.createIndex('payment_orders_user').on('payment_orders').column('user_id').execute()

      await db.schema
        .createTable('promo_requests')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('user_id', id, (c) => c.notNull())
        .addColumn('brand', varchar(120), (c) => c.notNull())
        .addColumn('tagline', varchar(255), (c) => c.notNull())
        .addColumn('link', varchar(500), (c) => c.notNull())
        .addColumn('contact', varchar(255), (c) => c.notNull())
        .addColumn('images_json', 'text', (c) => c.notNull())
        .addColumn('size', 'integer', (c) => c.notNull())
        .addColumn('price', 'integer', (c) => c.notNull())
        .addColumn('rounds', 'integer', (c) => c.notNull())
        .addColumn('duration_hours', 'integer', (c) => c.notNull())
        .addColumn('schedule_mode', varchar(10), (c) => c.notNull())
        .addColumn('start_date', varchar(10), (c) => c.notNull())
        .addColumn('terms_accepted_at', time, (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('status', varchar(10), (c) => c.notNull())
        .addColumn('payment_json', 'text')
        .addColumn('refund_json', 'text')
        .addColumn('order_id', id)
        .addColumn('decided_at', time)
        .addColumn('decided_by', id)
        .addColumn('decision_note', varchar(500))
        .execute()
      await db.schema.createIndex('promo_requests_user').on('promo_requests').column('user_id').execute()
      await db.schema.createIndex('promo_requests_date').on('promo_requests').columns(['start_date', 'status']).execute()

      await db.schema
        .createTable('settings')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('value_json', 'text', (c) => c.notNull())
        .addColumn('updated_at', time, (c) => c.notNull())
        .execute()

      await db.schema
        .createTable('audit_log')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('at', time, (c) => c.notNull())
        .addColumn('admin_id', id, (c) => c.notNull())
        .addColumn('admin_name', varchar(120), (c) => c.notNull())
        .addColumn('action', varchar(120), (c) => c.notNull())
        .addColumn('detail', varchar(1000), (c) => c.notNull())
        .execute()
      await db.schema.createIndex('audit_log_at').on('audit_log').column('at').execute()
    },
  },
  '002_edit_allowance': {
    // Daily edit allowance: edits counted per Thai calendar day instead of a 24-hour lock.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema.alterTable('windows').addColumn('edit_day', varchar(10)).execute()
      await db.schema.alterTable('windows').addColumn('edit_count', 'integer', (c) => c.notNull().defaultTo(0)).execute()
    },
  },
  '003_user_disabled': {
    // Admins can disable an account (no login); `suspended` keeps meaning "no trading".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema.alterTable('users').addColumn('disabled', 'integer', (c) => c.notNull().defaultTo(0)).execute()
    },
  },
  '004_password_resets': {
    // Forgot password: one emailed code per user at a time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('password_resets')
        .addColumn('user_id', id, (c) => c.primaryKey())
        .addColumn('code_hash', varchar(64), (c) => c.notNull())
        .addColumn('expires_at', time, (c) => c.notNull())
        .addColumn('attempts', 'integer', (c) => c.notNull().defaultTo(0))
        .execute()
    },
  },
  '005_contact_messages': {
    // Messages from the "contact us" form, kept so admins can follow them up (LINE only alerts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('contact_messages')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('name', varchar(100), (c) => c.notNull())
        .addColumn('email', varchar(200))
        .addColumn('phone', varchar(30))
        .addColumn('subject', varchar(100), (c) => c.notNull())
        .addColumn('message', 'text', (c) => c.notNull())
        .addColumn('user_id', id)
        .addColumn('status', varchar(10), (c) => c.notNull().defaultTo('new'))
        .addColumn('admin_note', varchar(500))
        .addColumn('handled_by', varchar(120))
        .addColumn('handled_at', time)
        .execute()
      await db.schema.createIndex('contact_messages_created').on('contact_messages').column('created_at').execute()
    },
  },
  '006_default_avatar': {
    // The shared stock photo becomes an empty avatar, which the web shows as the name's initial.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db
        .updateTable('users')
        .set({ avatar_url: '' })
        .where('avatar_url', '=', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80')
        .execute()
    },
  },
  '007_window_profiles': {
    // The owner's public page for a window, and reviews from visitors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema.alterTable('windows').addColumn('profile_json', 'text').execute()
      await db.schema
        .createTable('window_reviews')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('region', varchar(20), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('owner_id', id, (c) => c.notNull())
        .addColumn('user_id', id, (c) => c.notNull())
        .addColumn('rating', 'integer', (c) => c.notNull())
        .addColumn('text', varchar(500), (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('updated_at', time, (c) => c.notNull())
        .addUniqueConstraint('window_reviews_one_per_user', ['region', 'num', 'owner_id', 'user_id'])
        .execute()
    },
  },
  '008_window_updates_links': {
    // The owner's daily updates, and links between windows ("Friend and Co") that the owner approves.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('window_updates')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('region', varchar(20), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('owner_id', id, (c) => c.notNull())
        .addColumn('text', varchar(500), (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('edited_at', time)
        .execute()
      await db.schema.createIndex('window_updates_window').on('window_updates').columns(['region', 'num']).execute()
      await db.schema
        .createTable('window_links')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('region', varchar(20), (c) => c.notNull())
        .addColumn('num', 'integer', (c) => c.notNull())
        .addColumn('owner_id', id, (c) => c.notNull())
        .addColumn('from_region', varchar(20), (c) => c.notNull())
        .addColumn('from_num', 'integer', (c) => c.notNull())
        .addColumn('from_owner_id', id, (c) => c.notNull())
        .addColumn('message', varchar(200), (c) => c.notNull())
        .addColumn('status', varchar(20), (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('decided_at', time)
        .execute()
      await db.schema.createIndex('window_links_window').on('window_links').columns(['region', 'num']).execute()
    },
  },
  '009_promo_details': {
    // Optional extras for the promo page (offer, price, hours, LINE, terms…) as JSON.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema.alterTable('promo_requests').addColumn('details_json', 'text').execute()
    },
  },
  '010_promo_layout': {
    // The layout the promoter chose (horizontal / vertical / cluster / scatter); null = random each round.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema.alterTable('promo_requests').addColumn('layout', varchar(12)).execute()
    },
  },
  '011_themes': {
    // Uploaded site themes; the files live under UPLOAD_DIR/themes/<id>/ and the assignments in settings row 'themes'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('themes')
        .addColumn('id', id, (c) => c.primaryKey())
        .addColumn('name', varchar(60), (c) => c.notNull())
        .addColumn('description', varchar(300), (c) => c.notNull())
        .addColumn('version', varchar(20), (c) => c.notNull())
        .addColumn('author', varchar(60), (c) => c.notNull())
        .addColumn('variables_json', 'text', (c) => c.notNull())
        .addColumn('stylesheet', varchar(200), (c) => c.notNull())
        .addColumn('files_json', 'text', (c) => c.notNull())
        .addColumn('size', 'integer', (c) => c.notNull())
        .addColumn('created_at', time, (c) => c.notNull())
        .addColumn('created_by', varchar(120), (c) => c.notNull())
        .execute()
    },
  },
}

const provider: MigrationProvider = { getMigrations: async () => migrations }

/** Applies pending migrations; throws if one fails. */
export async function migrate(db: DB, log = true) {
  const { error, results } = await new Migrator({ db, provider }).migrateToLatest()
  for (const result of results ?? []) {
    if (result.status === 'Error') console.error(`migration ${result.migrationName} failed`)
    else if (result.status === 'Success' && log) console.log(`migration ${result.migrationName} applied`)
  }
  if (error) throw error
}
