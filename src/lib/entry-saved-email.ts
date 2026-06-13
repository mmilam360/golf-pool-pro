import { createServiceClient } from '@/lib/supabase/service'
import { hashGuestEntryToken } from '@/lib/guest-entry'
import { sendEmail } from '@/lib/email'

type EntrySavedEmailInput = {
  entryId: string
  poolId: string
  token?: string | null
  userId?: string | null
  origin: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function pickListText(picks: unknown) {
  if (!Array.isArray(picks)) return ''
  return picks.filter(pick => typeof pick === 'string' && pick.trim()).join(', ')
}

export async function sendEntrySavedEmail({ entryId, poolId, token, userId, origin }: EntrySavedEmailInput) {
  const supabase = createServiceClient() as any
  const { data: entry, error: entryError } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, user_id, display_name, notification_email, golfer_picks, guest_entry_token_hash')
    .eq('id', entryId)
    .eq('pool_id', poolId)
    .or('is_removed.is.null,is_removed.eq.false')
    .maybeSingle()

  if (entryError || !entry) throw new Error('Entry not found')

  if (token) {
    if (hashGuestEntryToken(token) !== entry.guest_entry_token_hash) throw new Error('Invalid entry token')
  } else if (!userId || entry.user_id !== userId) {
    throw new Error('Unauthorized')
  }

  const { data: pool, error: poolError } = await supabase
    .from('gpp_pools')
    .select('id, name, passcode, is_locked, gpp_tournaments(name, start_date)')
    .eq('id', poolId)
    .maybeSingle()
  if (poolError || !pool) throw new Error('Pool not found')

  let recipient = entry.notification_email || ''
  if (!recipient && entry.user_id) {
    const { data: userResult } = await supabase.auth.admin.getUserById(entry.user_id)
    recipient = userResult?.user?.email || ''
  }
  if (!recipient) return { skipped: true, reason: 'no_recipient' }

  const tournament = Array.isArray(pool.gpp_tournaments) ? pool.gpp_tournaments[0] : pool.gpp_tournaments
  const leaderboardUrl = `${origin}/leaderboard/${pool.id}?entry=${entry.id}`
  const editUrl = `${origin}/pool/${pool.id}`
  const picks = pickListText(entry.golfer_picks)
  const entryName = entry.display_name || 'Your entry'
  const poolName = pool.name || 'Golf pool'
  const tournamentName = tournament?.name || 'Tournament'

  const subject = `Your ${poolName} entry is saved`
  const text = [
    `${entryName}, your picks are saved for ${poolName}.`,
    '',
    `Tournament: ${tournamentName}`,
    picks ? `Picks: ${picks}` : null,
    '',
    `Leaderboard: ${leaderboardUrl}`,
    pool.is_locked ? null : `Edit picks before lock: ${editUrl}`,
    `Passcode: ${pool.passcode}`,
    '',
    'Need help? Just reply to this email.',
    '',
    'Golf Pools Pro',
  ].filter(Boolean).join('\n')

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2a24;line-height:1.5;max-width:620px">
      <h1 style="color:#123c2f;font-size:24px;margin:0 0 12px">Your picks are saved</h1>
      <p>${escapeHtml(entryName)}, your entry is saved for <strong>${escapeHtml(poolName)}</strong>.</p>
      <p><strong>Tournament:</strong> ${escapeHtml(tournamentName)}</p>
      ${picks ? `<p><strong>Picks:</strong> ${escapeHtml(picks)}</p>` : ''}
      <p><a href="${leaderboardUrl}" style="color:#123c2f;font-weight:bold">View the leaderboard</a></p>
      ${pool.is_locked ? '' : `<p><a href="${editUrl}" style="color:#123c2f">Edit picks before lock</a></p>`}
      <p><strong>Passcode:</strong> ${escapeHtml(pool.passcode || '')}</p>
      <p style="color:#657168;font-size:14px">Need help? Just reply to this email.</p>
      <p style="color:#657168;font-size:14px">Golf Pools Pro</p>
    </div>
  `

  return sendEmail({ to: recipient, subject, text, html })
}
