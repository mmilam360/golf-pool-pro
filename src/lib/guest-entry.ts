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

export async function createGuestEntryEmailToken(supabase: any, entryId: string, purpose = 'email_link') {
  const token = createGuestEntryToken()
  const { error } = await supabase
    .from('gpp_guest_entry_tokens')
    .insert({ entry_id: entryId, token_hash: hashGuestEntryToken(token), purpose })
  if (error) throw error
  return token
}

export async function guestEntryTokenMatches(supabase: any, entry: { id?: string; guest_entry_token_hash?: string | null }, token: string) {
  if (!entry?.id || !token) return false
  const tokenHash = hashGuestEntryToken(token)
  if (tokenHash === entry.guest_entry_token_hash) return true

  const { data } = await supabase
    .from('gpp_guest_entry_tokens')
    .select('id')
    .eq('entry_id', entry.id)
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!data?.id) return false

  await supabase
    .from('gpp_guest_entry_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
  return true
}

export async function findGuestEntryIdByToken(supabase: any, token: string) {
  if (!token) return null
  const tokenHash = hashGuestEntryToken(token)
  const { data } = await supabase
    .from('gpp_guest_entry_tokens')
    .select('entry_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  return data?.entry_id || null
}
