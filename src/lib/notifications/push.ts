import * as webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

type NotificationType = 'pick_deadline' | 'leaderboard_live' | 'took_lead' | 'field_update'

type NotificationPrefs = {
  pick_deadline?: boolean | null
  leaderboard_live?: boolean | null
  took_lead?: boolean | null
  field_update?: boolean | null
}

type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

let configured = false

function configureWebPush() {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails('mailto:support@golfpoolspro.com', publicKey, privateKey)
  configured = true
  return true
}

export function notificationPrefsAllow(prefs: NotificationPrefs | null | undefined, type: NotificationType) {
  if (!prefs) return type !== 'took_lead'
  if (type === 'took_lead') return Boolean(prefs.took_lead)
  return prefs[type] !== false
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: true }
  }

  const supabase = createServiceClient() as any
  const { data: subscriptions, error } = await supabase
    .from('gpp_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subscriptions?.length) {
    return { sent: 0, failed: 0, skipped: false }
  }

  let sent = 0
  let failed = 0

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload)
      )
      sent += 1
      await supabase
        .from('gpp_push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', subscription.id)
    } catch (error: any) {
      failed += 1
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabase.from('gpp_push_subscriptions').delete().eq('id', subscription.id)
      }
    }
  }

  return { sent, failed, skipped: false }
}

export async function recordNotificationEvent(params: {
  userId: string
  poolId?: string | null
  type: NotificationType
  dedupeKey: string
  payload: Record<string, unknown>
}) {
  const supabase = createServiceClient() as any
  const { error } = await supabase.from('gpp_notification_events').insert({
    user_id: params.userId,
    pool_id: params.poolId ?? null,
    type: params.type,
    dedupe_key: params.dedupeKey,
    payload: params.payload,
  })

  if (error) {
    const message = String(error.message || '')
    if (message.toLowerCase().includes('duplicate') || error.code === '23505') return false
    throw error
  }

  return true
}
