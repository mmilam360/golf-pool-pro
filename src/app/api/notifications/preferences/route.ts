import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type NotificationPrefs = {
  pick_deadline?: boolean
  leaderboard_live?: boolean
  took_lead?: boolean
}

function cleanPrefs(prefs: NotificationPrefs | undefined) {
  return {
    pick_deadline: prefs?.pick_deadline !== false,
    leaderboard_live: prefs?.leaderboard_live !== false,
    took_lead: Boolean(prefs?.took_lead),
  }
}

export async function POST(request: Request) {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const prefs = cleanPrefs(body.prefs)

  const { error } = await supabase
    .from('gpp_notification_preferences')
    .upsert({
      user_id: user.id,
      ...prefs,
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, prefs })
}
