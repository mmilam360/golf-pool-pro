import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type PushSubscriptionPayload = {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

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

export async function GET() {
  return NextResponse.json({ publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '' })
}

export async function POST(request: Request) {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const subscription = body.subscription as PushSubscriptionPayload | undefined
  const prefs = cleanPrefs(body.prefs)

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Missing push subscription.' }, { status: 400 })
  }

  const { error: subscriptionError } = await supabase
    .from('gpp_push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: request.headers.get('user-agent') || null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (subscriptionError) return NextResponse.json({ error: subscriptionError.message }, { status: 500 })

  const { error: prefsError } = await supabase
    .from('gpp_notification_preferences')
    .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() })

  if (prefsError) return NextResponse.json({ error: prefsError.message }, { status: 500 })

  return NextResponse.json({ ok: true, prefs })
}
