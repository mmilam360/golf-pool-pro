import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export function createGuestEntryToken() {
  return randomBytes(32).toString('base64url')
}

export function hashGuestEntryToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function safeCompareGuestEntryToken(token: string, tokenHash: string | null | undefined) {
  if (!tokenHash) return false
  const nextHash = hashGuestEntryToken(token)
  const a = Buffer.from(nextHash, 'hex')
  const b = Buffer.from(tokenHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function normalizeGuestEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function normalizeEntryDisplayName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, 60)
}
