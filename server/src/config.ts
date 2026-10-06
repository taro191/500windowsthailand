// Settings from environment variables (see .env.example). Read once at start-up.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Loads KEY=value lines from .env into process.env (existing variables win). */
function loadDotEnv(file = path.resolve(process.cwd(), '.env')) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || line.trim().startsWith('#')) continue
    const [, key, raw] = match
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^(['"])(.*)\1$/, '$2')
  }
}
loadDotEnv()

const env = (key: string, fallback = '') => process.env[key] ?? fallback
const flag = (key: string, fallback = false) => {
  const value = process.env[key]
  return value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const isProduction = env('NODE_ENV') === 'production'
const appSecret = env('APP_SECRET')
if (isProduction && appSecret.length < 32) {
  throw new Error('APP_SECRET must be set to a random string of at least 32 characters in production')
}

export const config = {
  isProduction,
  port: Number(env('PORT', '3001')),
  appSecret: appSecret || 'dev-only-secret-do-not-use-in-production',
  db: {
    client: env('DB_CLIENT', 'sqlite') as 'sqlite' | 'mysql',
    sqliteFile: env('SQLITE_FILE', './data/dev.sqlite'),
    url: env('DATABASE_URL'),
  },
  uploadDir: path.resolve(env('UPLOAD_DIR', './data/uploads')),
  publicDir: env('PUBLIC_DIR') ? path.resolve(env('PUBLIC_DIR')) : '',
  admin: { email: env('ADMIN_EMAIL').toLowerCase(), password: env('ADMIN_PASSWORD') },
  signupBonus: Math.max(0, Math.floor(Number(env('SIGNUP_BONUS', '0')) || 0)),
  cardPayments: env('CARD_PAYMENTS', 'simulated') as 'simulated' | 'disabled',
  otpMode: env('OTP_MODE', 'dev') as 'dev',
  demoTools: flag('DEMO_TOOLS'),
  sessionDays: 30,
}

export type AppConfig = typeof config
