import { redirect } from 'next/navigation'
import AccountClient from '@/components/AccountClient'
import { createClient } from '@/lib/supabase/server'

const defaultNotificationPrefs = { pick_deadline: false, leaderboard_live: false, took_lead: false }

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account')

  const { data: profile } = await supabase
    .from('gpp_profiles')
    .select('display_name, full_name, full_name_confirmed_at, email')
    .eq('id', user.id)
    .maybeSingle()

  const fallbackName = user.user_metadata?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || ''
  const fallbackFullName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : ''

  return (
    <AccountClient
      initialEmail={profile?.email || user.email || ''}
      initialName={profile?.display_name || fallbackName}
      initialFullName={profile?.full_name_confirmed_at ? profile?.full_name || fallbackFullName : ''}
      initialMarketingOptIn={Boolean(user.user_metadata?.marketing_emails)}
      initialNotificationPrefs={user.user_metadata?.notification_prefs || defaultNotificationPrefs}
    />
  )
}
