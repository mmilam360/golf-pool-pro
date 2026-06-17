import { createGuestEntryEmailToken } from '@/lib/guest-entry'

type EntryLike = {
  id: string
  user_id?: string | null
  notification_email?: string | null
}

export async function entryRecipientEmail(supabase: any, entry: EntryLike) {
  if (entry.user_id) {
    const { data: userResult } = await supabase.auth.admin.getUserById(entry.user_id)
    const authEmail = userResult?.user?.email || ''
    if (authEmail) return authEmail

    const { data: profile } = await supabase
      .from('gpp_profiles')
      .select('email')
      .eq('id', entry.user_id)
      .maybeSingle()
    return profile?.email || ''
  }

  return entry.notification_email || ''
}

export async function entryEditUrl(supabase: any, origin: string, poolId: string, entry: EntryLike, purpose: string) {
  const editPath = `/pool/${poolId}#make-picks`
  if (entry.user_id) {
    const redirect = encodeURIComponent(editPath)
    return `${origin}/login?redirect=${redirect}`
  }
  const token = await createGuestEntryEmailToken(supabase, entry.id, purpose)
  return `${origin}/pool/${poolId}?guest=${encodeURIComponent(token)}#make-picks`
}

export function publicLeaderboardUrl(origin: string, poolId: string, entryId?: string | null) {
  const suffix = entryId ? `?entry=${encodeURIComponent(entryId)}` : ''
  return `${origin}/leaderboard/${poolId}${suffix}`
}

export function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://www.golfpoolspro.com'
}
