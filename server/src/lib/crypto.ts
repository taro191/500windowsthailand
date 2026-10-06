// Passwords (scrypt), citizen ID protection (HMAC for lookups, AES-GCM for storage),
// random IDs and session tokens.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64, SCRYPT)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, expected] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !expected) return false
  const hash = await scryptAsync(password, Buffer.from(salt, 'base64url'), 64, SCRYPT)
  const want = Buffer.from(expected, 'base64url')
  return want.length === hash.length && timingSafeEqual(want, hash)
}

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/** `prefix_` + 16 random URL-safe characters. */
export const newId = (prefix: string) => `${prefix}_${randomBytes(12).toString('base64url')}`

/** Secret for a session cookie; only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString('base64url')

export function createSecrets(appSecret: string) {
  const key = createHash('sha256').update(`${appSecret}:citizen-enc`).digest()

  return {
    /** Stable lookup key for a citizen ID (unique index), not reversible without the secret. */
    citizenHash: (digits: string) => createHmac('sha256', `${appSecret}:citizen-hash`).update(digits).digest('hex'),

    encrypt(text: string): string {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
      return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
    },

    decrypt(value: string): string | null {
      try {
        const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
        const decipher = createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
      } catch {
        return null
      }
    },
  }
}

export type Secrets = ReturnType<typeof createSecrets>
