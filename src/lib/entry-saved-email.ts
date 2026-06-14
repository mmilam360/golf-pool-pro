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

function pickListItems(picks: unknown) {
  if (!Array.isArray(picks)) return []
  return picks.filter((pick): pick is string => typeof pick === 'string' && Boolean(pick.trim()))
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
    .select('id, name, is_locked, gpp_tournaments(name, start_date)')
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
  const editUrl = token
    ? `${origin}/pool/${pool.id}?guest=${encodeURIComponent(token)}`
    : `${origin}/pool/${pool.id}`
  const helpUrl = `${origin}/help`
  const pickItems = pickListItems(entry.golfer_picks)
  const picks = pickItems.join(', ')
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
    pool.is_locked ? null : `Edit picks before lock: ${editUrl}`,
    `Leaderboard: ${leaderboardUrl}`,
    '',
    `Need help? ${helpUrl}`,
    '',
    'Golf Pools Pro',
  ].filter(Boolean).join('\n')

  const pickRows = pickItems.map((pick, index) => `
    <tr>
      <td style="width:44px;border-bottom:1px solid #d8cab0;padding:10px 10px 10px 0;color:#8a6724;font-weight:800;font-size:12px;text-align:center;">${index + 1}</td>
      <td style="border-bottom:1px solid #d8cab0;padding:10px 0;color:#1f2a24;font-weight:700;">${escapeHtml(pick)}</td>
    </tr>
  `).join('')

  const html = `
    <div style="margin:0;padding:0;background:#f6f0e3;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;line-height:1.5;">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">Your Golf Pools Pro picks are saved.</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f0e3;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#fbf7ed;border:2px solid #123c2f;">
              <tr>
                <td style="background:#123c2f;border-bottom:2px solid #b58a3a;padding:22px 24px;color:#ffffff;">
                  <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f3df9c;font-weight:800;">Golf Pools Pro</div>
                  <h1 style="margin:6px 0 0;font-family:Arial Black,Impact,Arial,Helvetica,sans-serif;font-size:28px;line-height:1.05;letter-spacing:-0.04em;text-transform:uppercase;color:#ffffff;">Picks saved</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 24px 8px;background:#fffdf8;">
                  <p style="margin:0 0 14px;font-size:16px;"><strong>${escapeHtml(entryName)}</strong>, your entry is saved for <strong>${escapeHtml(poolName)}</strong>.</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #d8cab0;background:#fbf7ed;">
                    <tr>
                      <td style="padding:12px 14px;border-bottom:1px solid #d8cab0;">
                        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Tournament</div>
                        <div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(tournamentName)}</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 14px;">
                        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Entry</div>
                        <div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(entryName)}</div>
                      </td>
                    </tr>
                  </table>
                  ${pool.is_locked ? '' : `<p style="margin:0 0 18px;"><a href="${escapeHtml(editUrl)}" style="display:inline-block;background:#123c2f;border:2px solid #123c2f;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 16px;">Edit picks before lock</a></p>`}
                  <p style="margin:0 0 18px;"><a href="${escapeHtml(leaderboardUrl)}" style="display:inline-block;background:#ffffff;border:2px solid #123c2f;color:#123c2f;text-decoration:none;font-weight:800;padding:10px 14px;">View leaderboard</a></p>
                </td>
              </tr>
              ${pickRows ? `
              <tr>
                <td style="padding:8px 24px 22px;background:#fffdf8;">
                  <div style="border:2px solid #123c2f;background:#fbf7ed;">
                    <div style="background:#123c2f;color:#f3df9c;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;padding:8px 12px;">Final picks</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fffdf8;">
                      ${pickRows}
                    </table>
                  </div>
                </td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding:16px 24px 22px;border-top:1px solid #d8cab0;background:#fbf7ed;color:#657168;font-size:13px;">
                  Need help? <a href="${escapeHtml(helpUrl)}" style="color:#123c2f;font-weight:700;">Send a note here</a>.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `

  return sendEmail({ to: recipient, subject, text, html })
}
