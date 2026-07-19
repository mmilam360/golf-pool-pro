import { sendEmail } from '@/lib/email'
import { entryEditUrl, publicLeaderboardUrl } from '@/lib/pool-email-recipients'

type EntryLike = {
  id: string
  user_id?: string | null
  display_name?: string | null
  notification_email?: string | null
  rank?: number | null
  total_score?: number | null
}

type PoolLike = {
  id: string
  name?: string | null
  lock_at?: string | null
}

type TournamentLike = {
  name?: string | null
  start_date?: string | null
}

type TopEntry = {
  display_name?: string | null
  rank?: number | null
  total_score?: number | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function scoreLabel(value: unknown) {
  const score = Number(value)
  if (!Number.isFinite(score)) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : String(score)
}

function rankLabel(value: unknown) {
  const rank = Number(value)
  if (!Number.isFinite(rank) || rank <= 0) return '—'
  return `#${rank}`
}

function pickDeadlineLabel(pool: PoolLike, tournament: TournamentLike) {
  const deadline = pool.lock_at ? new Date(pool.lock_at) : null
  if (deadline && Number.isFinite(deadline.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: 'America/New_York',
    }).format(deadline)
  }

  if (tournament.start_date) {
    const [year, month, day] = tournament.start_date.split('-').map(Number)
    if (year && month && day) {
      const startDate = new Date(Date.UTC(year, month - 1, day, 12))
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York',
      }).format(startDate)
    }
  }

  return 'the first tee time'
}

function emailShell({ preheader, title, bodyHtml, ctaHref, ctaLabel, secondaryHref, secondaryLabel }: {
  preheader: string
  title: string
  bodyHtml: string
  ctaHref?: string
  ctaLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return `
    <div style="margin:0;padding:0;background:#f6f0e3;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;line-height:1.5;">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f0e3;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#fbf7ed;border:2px solid #123c2f;">
              <tr>
                <td style="background:#123c2f;border-bottom:2px solid #b58a3a;padding:22px 24px;color:#ffffff;">
                  <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f3df9c;font-weight:800;">Golf Pools Pro</div>
                  <h1 style="margin:6px 0 0;font-family:Arial Black,Impact,Arial,Helvetica,sans-serif;font-size:28px;line-height:1.05;letter-spacing:-0.04em;text-transform:uppercase;color:#ffffff;">${escapeHtml(title)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 24px;background:#fffdf8;">
                  ${bodyHtml}
                  ${ctaHref && ctaLabel ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#123c2f;border:2px solid #123c2f;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 16px;">${escapeHtml(ctaLabel)}</a></p>` : ''}
                  ${secondaryHref && secondaryLabel ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(secondaryHref)}" style="display:inline-block;background:#ffffff;border:2px solid #123c2f;color:#123c2f;text-decoration:none;font-weight:800;padding:10px 14px;">${escapeHtml(secondaryLabel)}</a></p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 22px;border-top:1px solid #d8cab0;background:#fbf7ed;color:#657168;font-size:13px;">
                  Need help? <a href="https://www.golfpoolspro.com/help" style="color:#123c2f;font-weight:700;">Send a note here</a>.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

export async function sendMissingPicksReminderEmail(params: {
  supabase: any
  origin: string
  recipient: string
  pool: PoolLike
  tournament: TournamentLike
  entry: EntryLike
  pickCount: number
  requiredPickCount: number
}) {
  const poolName = params.pool.name || 'your pool'
  const tournamentName = params.tournament.name || 'the tournament'
  const deadline = pickDeadlineLabel(params.pool, params.tournament)
  const editUrl = await entryEditUrl(params.supabase, params.origin, params.pool.id, params.entry, 'missing_picks_reminder')
  const subject = `Get your picks in for ${poolName}`
  const text = [
    `${params.entry.display_name || 'Your entry'}, your picks are not finished yet for ${poolName}.`,
    '',
    `Tournament: ${tournamentName}`,
    `Picks made: ${params.pickCount}/${params.requiredPickCount}`,
    `Picks are due before the first tee time: ${deadline}.`,
    '',
    `Make picks here: ${editUrl}`,
    '',
    'Golf Pools Pro',
  ].join('\n')
  const html = emailShell({
    preheader: `Your ${poolName} picks are not finished yet.`,
    title: 'Picks needed',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;"><strong>${escapeHtml(params.entry.display_name || 'Your entry')}</strong>, your picks are not finished yet for <strong>${escapeHtml(poolName)}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #d8cab0;background:#fbf7ed;">
        <tr><td style="padding:12px 14px;border-bottom:1px solid #d8cab0;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Tournament</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(tournamentName)}</div></td></tr>
        <tr><td style="padding:12px 14px;border-bottom:1px solid #d8cab0;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Picks made</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${params.pickCount}/${params.requiredPickCount}</div></td></tr>
        <tr><td style="padding:12px 14px;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Due</div><div style="font-size:16px;font-weight:800;color:#123c2f;">Before the first tee time: ${escapeHtml(deadline)}</div></td></tr>
      </table>
      <p style="margin:0;color:#657168;font-size:14px;">Make the rest of your picks before entries lock.</p>
    `,
    ctaHref: editUrl,
    ctaLabel: 'Make picks here',
  })
  return sendEmail({ to: params.recipient, subject, text, html })
}


export async function sendGuestFullNameReminderEmail(params: {
  supabase: any
  origin: string
  recipient: string
  pool: PoolLike
  tournament: TournamentLike
  entry: EntryLike
}) {
  const poolName = params.pool.name || 'your pool'
  const tournamentName = params.tournament.name || 'the tournament'
  const editUrl = await entryEditUrl(params.supabase, params.origin, params.pool.id, params.entry, 'full_name_reminder')
  const subject = `Quick ask for ${poolName}`
  const text = [
    `${params.entry.display_name || 'Your entry'}, your picks are saved for ${poolName}.`,
    '',
    `Tournament: ${tournamentName}`,
    '',
    'Quick ask: add your full name so the pool runner knows who joined. Only the runner sees it.',
    '',
    `Add full name: ${editUrl}`,
    '',
    'Golf Pools Pro',
  ].join('\n')
  const html = emailShell({
    preheader: `Quick ask for ${poolName}.`,
    title: 'Quick ask',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;"><strong>${escapeHtml(params.entry.display_name || 'Your entry')}</strong>, your picks are saved for <strong>${escapeHtml(poolName)}</strong>.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #d8cab0;background:#fbf7ed;">
        <tr><td style="padding:12px 14px;border-bottom:1px solid #d8cab0;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Tournament</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(tournamentName)}</div></td></tr>
        <tr><td style="padding:12px 14px;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Full name</div><div style="font-size:14px;font-weight:700;color:#1f2a24;">Only the pool runner sees this.</div></td></tr>
      </table>
      <p style="margin:0;color:#657168;font-size:14px;">When you have a second, add your full name so the pool runner knows who joined.</p>
    `,
    ctaHref: editUrl,
    ctaLabel: 'Add full name',
  })
  return sendEmail({ to: params.recipient, subject, text, html })
}

export async function sendWdPickAlertEmail(params: {
  supabase: any
  origin: string
  recipient: string
  pool: PoolLike
  tournament: TournamentLike
  entry: EntryLike
  withdrawnPicks: string[]
}) {
  const poolName = params.pool.name || 'your pool'
  const tournamentName = params.tournament.name || 'the tournament'
  const editUrl = await entryEditUrl(params.supabase, params.origin, params.pool.id, params.entry, 'wd_pick_alert')
  const names = params.withdrawnPicks.join(', ')
  const subject = `A golfer in your ${poolName} entry withdrew`
  const text = [
    `${params.entry.display_name || 'Your entry'} has ${names} marked WD for ${tournamentName}.`,
    '',
    'You can swap that pick before entries lock.',
    '',
    `Edit picks: ${editUrl}`,
    '',
    'Golf Pools Pro',
  ].join('\n')
  const listItems = params.withdrawnPicks.map(name => `<li style="margin:0 0 6px;"><strong>${escapeHtml(name)}</strong></li>`).join('')
  const html = emailShell({
    preheader: `${names} is marked WD in ${tournamentName}.`,
    title: 'WD pick alert',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;"><strong>${escapeHtml(params.entry.display_name || 'Your entry')}</strong>, one of your picks is marked withdrawn for <strong>${escapeHtml(tournamentName)}</strong>.</p>
      <div style="border:2px solid #123c2f;background:#fbf7ed;margin:0 0 18px;">
        <div style="background:#123c2f;color:#f3df9c;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;padding:8px 12px;">Needs replacement</div>
        <ul style="margin:12px 18px 12px 28px;padding:0;color:#1f2a24;">${listItems}</ul>
      </div>
      <p style="margin:0;color:#657168;font-size:14px;">Swap the pick before entries lock.</p>
    `,
    ctaHref: editUrl,
    ctaLabel: 'Edit picks',
  })
  return sendEmail({ to: params.recipient, subject, text, html })
}

export function buildPaymentDueReminderEmail(params: {
  origin: string
  poolId: string
  poolName: string
  tournamentName: string
  runnerName?: string | null
  activeEntryCount: number
  amountDueLabel: string
  dueDateLabel: string
}) {
  const poolName = params.poolName || 'your pool'
  const tournamentName = params.tournamentName || 'the tournament'
  const settingsUrl = `${params.origin}/pool/${params.poolId}?tab=pool-settings`
  const runnerPrefix = params.runnerName ? `${params.runnerName}, ` : ''
  const subject = `Quick reminder: pool fee due today for ${poolName}`
  const text = [
    `${runnerPrefix}your pool fee is due today.`,
    '',
    `Tournament: ${tournamentName}`,
    `Active entries: ${params.activeEntryCount}`,
    `Amount due: ${params.amountDueLabel}`,
    `Due date: ${params.dueDateLabel}`,
    '',
    'Please pay today so the host side stays current. Entries, picks, and leaderboards stay visible.',
    '',
    `Pay pool fee: ${settingsUrl}`,
    '',
    'Golf Pools Pro',
  ].join('\n')
  const html = emailShell({
    preheader: `${params.amountDueLabel} is due today for ${poolName}.`,
    title: 'Quick reminder',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;">${escapeHtml(runnerPrefix)}your pool fee is due today.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #d8cab0;background:#fbf7ed;">
        <tr><td style="padding:12px 14px;border-bottom:1px solid #d8cab0;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Tournament</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(tournamentName)}</div></td></tr>
        <tr><td style="padding:12px 14px;border-bottom:1px solid #d8cab0;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Active entries</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${params.activeEntryCount}</div></td></tr>
        <tr><td style="padding:12px 14px;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Amount due</div><div style="font-size:18px;font-weight:900;color:#123c2f;">${escapeHtml(params.amountDueLabel)}</div></td></tr>
      </table>
      <p style="margin:0;color:#657168;font-size:14px;">Please pay today so the host side stays current. Entries, picks, and leaderboards stay visible.</p>
    `,
    ctaHref: settingsUrl,
    ctaLabel: 'Pay pool fee',
  })

  return { subject, text, html, settingsUrl }
}

export async function sendPaymentDueReminderEmail(params: {
  origin: string
  recipient: string
  poolId: string
  poolName: string
  tournamentName: string
  runnerName?: string | null
  activeEntryCount: number
  amountDueLabel: string
  dueDateLabel: string
}) {
  const content = buildPaymentDueReminderEmail(params)
  const result = await sendEmail({ to: params.recipient, subject: content.subject, text: content.text, html: content.html })
  return { ...result, subject: content.subject }
}

export async function sendFinalResultsEmail(params: {
  origin: string
  recipient: string
  pool: PoolLike
  tournament: TournamentLike
  entry: EntryLike
  topEntries: TopEntry[]
}) {
  const poolName = params.pool.name || 'your pool'
  const tournamentName = params.tournament.name || 'the tournament'
  const leaderboardUrl = publicLeaderboardUrl(params.origin, params.pool.id, params.entry.id)
  const topRows = params.topEntries.map(entry => `
    <tr>
      <td style="border-bottom:1px solid #d8cab0;padding:9px 10px;color:#8a6724;font-weight:800;text-align:center;">${escapeHtml(rankLabel(entry.rank))}</td>
      <td style="border-bottom:1px solid #d8cab0;padding:9px 0;color:#1f2a24;font-weight:700;">${escapeHtml(entry.display_name || 'Entry')}</td>
      <td style="border-bottom:1px solid #d8cab0;padding:9px 10px;color:#123c2f;font-weight:900;text-align:right;">${escapeHtml(scoreLabel(entry.total_score))}</td>
    </tr>
  `).join('')
  const subject = `Final results for ${poolName}`
  const text = [
    `${poolName} is final.`,
    '',
    `Tournament: ${tournamentName}`,
    `Your finish: ${rankLabel(params.entry.rank)} (${scoreLabel(params.entry.total_score)})`,
    '',
    params.topEntries.length ? `Top entries: ${params.topEntries.map(entry => `${rankLabel(entry.rank)} ${entry.display_name || 'Entry'} ${scoreLabel(entry.total_score)}`).join('; ')}` : null,
    '',
    `View final leaderboard: ${leaderboardUrl}`,
    '',
    'Golf Pools Pro',
  ].filter(Boolean).join('\n')
  const html = emailShell({
    preheader: `${poolName} is final.`,
    title: 'Final results',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;"><strong>${escapeHtml(poolName)}</strong> is final.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;border:1px solid #d8cab0;background:#fbf7ed;">
        <tr><td style="padding:12px 14px;border-bottom:1px solid #d8cab0;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Tournament</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(tournamentName)}</div></td></tr>
        <tr><td style="padding:12px 14px;"><div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6724;font-weight:800;">Your finish</div><div style="font-size:16px;font-weight:800;color:#123c2f;">${escapeHtml(rankLabel(params.entry.rank))} · ${escapeHtml(scoreLabel(params.entry.total_score))}</div></td></tr>
      </table>
      ${topRows ? `<div style="border:2px solid #123c2f;background:#fbf7ed;margin:0 0 18px;"><div style="background:#123c2f;color:#f3df9c;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;padding:8px 12px;">Top of the board</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fffdf8;">${topRows}</table></div>` : ''}
    `,
    ctaHref: leaderboardUrl,
    ctaLabel: 'View final leaderboard',
  })
  return sendEmail({ to: params.recipient, subject, text, html })
}

export async function sendFinalResultsDigestEmail(params: {
  origin: string
  recipient: string
  tournament: TournamentLike
  results: { pool: PoolLike; entry: EntryLike; topEntries: TopEntry[] }[]
}) {
  const results = params.results.filter(item => item.pool?.id && item.entry?.id)
  if (results.length === 0) return { skipped: true, reason: 'no_final_results' }
  if (results.length === 1) {
    const only = results[0]
    return sendFinalResultsEmail({
      origin: params.origin,
      recipient: params.recipient,
      tournament: params.tournament,
      pool: only.pool,
      entry: only.entry,
      topEntries: only.topEntries,
    })
  }

  const tournamentName = params.tournament.name || 'the tournament'
  const resultRows = results.map(item => {
    const leaderboardUrl = publicLeaderboardUrl(params.origin, item.pool.id, item.entry.id)
    return `
      <tr>
        <td style="border-bottom:1px solid #d8cab0;padding:10px 10px 10px 0;color:#1f2a24;font-weight:800;">${escapeHtml(item.pool.name || 'Pool')}</td>
        <td style="border-bottom:1px solid #d8cab0;padding:10px;color:#1f2a24;font-weight:700;">${escapeHtml(item.entry.display_name || 'Entry')}</td>
        <td style="border-bottom:1px solid #d8cab0;padding:10px;color:#123c2f;font-weight:900;text-align:right;white-space:nowrap;">${escapeHtml(rankLabel(item.entry.rank))} · ${escapeHtml(scoreLabel(item.entry.total_score))}</td>
        <td style="border-bottom:1px solid #d8cab0;padding:10px 0 10px 10px;text-align:right;white-space:nowrap;"><a href="${escapeHtml(leaderboardUrl)}" style="color:#123c2f;font-weight:800;text-decoration:underline;">Leaderboard</a></td>
      </tr>
    `
  }).join('')
  const textRows = results.map(item => {
    const leaderboardUrl = publicLeaderboardUrl(params.origin, item.pool.id, item.entry.id)
    return `${item.pool.name || 'Pool'}: ${item.entry.display_name || 'Entry'} finished ${rankLabel(item.entry.rank)} (${scoreLabel(item.entry.total_score)}). ${leaderboardUrl}`
  })
  const subject = `Final results for ${tournamentName}`
  const text = [
    `${tournamentName} is final.`,
    '',
    'Your results:',
    ...textRows,
    '',
    'Golf Pools Pro',
  ].join('\n')
  const html = emailShell({
    preheader: `${results.length} results from ${tournamentName}.`,
    title: 'Final results',
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;"><strong>${escapeHtml(tournamentName)}</strong> is final.</p>
      <div style="border:2px solid #123c2f;background:#fbf7ed;margin:0 0 18px;">
        <div style="background:#123c2f;color:#f3df9c;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;padding:8px 12px;">Your results</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fffdf8;">
          ${resultRows}
        </table>
      </div>
    `,
  })
  return sendEmail({ to: params.recipient, subject, text, html })
}
