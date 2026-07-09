type OpenChampionshipPoolRunnerEmailInput = {
  origin?: string
  unsubscribeUrl: string
  recipientName?: string | null
  tournamentStartLabel?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalizeOrigin(value?: string) {
  return (value || 'https://www.golfpoolspro.com').replace(/\/$/, '')
}

function emailShell({ preheader, title, bodyHtml, footerHtml }: {
  preheader: string
  title: string
  bodyHtml: string
  footerHtml: string
}) {
  return `
    <div style="margin:0;padding:0;background:#f6f0e3;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;line-height:1.5;">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f0e3;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#fffdf8;border:2px solid #123c2f;">
              <tr>
                <td style="background:#123c2f;border-bottom:2px solid #b58a3a;padding:22px 24px;color:#ffffff;">
                  <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#f3df9c;font-weight:800;">Golf Pools Pro</div>
                  <h1 style="margin:6px 0 0;font-family:Arial Black,Impact,Arial,Helvetica,sans-serif;font-size:30px;line-height:1.02;letter-spacing:-0.04em;text-transform:uppercase;color:#ffffff;">${escapeHtml(title)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;background:#fffdf8;">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px 22px;border-top:1px solid #d8cab0;background:#fbf7ed;color:#657168;font-size:13px;">
                  ${footerHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

function benefitRow(number: string, title: string, body: string) {
  return `
    <tr>
      <td width="44" valign="top" style="padding:14px 0 14px 14px;border-bottom:1px solid #d8cab0;">
        <div style="width:28px;height:28px;line-height:28px;text-align:center;background:#123c2f;color:#f3df9c;font-weight:900;font-size:14px;">${escapeHtml(number)}</div>
      </td>
      <td valign="top" style="padding:13px 14px 14px 0;border-bottom:1px solid #d8cab0;">
        <div style="font-size:16px;font-weight:900;color:#123c2f;">${escapeHtml(title)}</div>
        <div style="margin-top:3px;font-size:14px;color:#4b574f;line-height:1.45;">${escapeHtml(body)}</div>
      </td>
    </tr>
  `
}

export function buildOpenChampionshipPoolRunnerEmail(input: OpenChampionshipPoolRunnerEmailInput) {
  const origin = normalizeOrigin(input.origin)
  const ctaUrl = `${origin}/pool/create?tournament=The%20Open&start=2026-07-16&utm_source=email&utm_medium=owned&utm_campaign=open_runner_reminder`
  const openPageUrl = `${origin}/open-championship-pool?utm_source=email&utm_medium=owned&utm_campaign=open_runner_reminder`
  const tournamentStartLabel = input.tournamentStartLabel || 'July 16'
  const greeting = input.recipientName?.trim() ? `${input.recipientName.trim()}, quick heads up:` : 'Quick heads up:'
  const subject = 'Run an Open pool for your group'
  const preheader = 'This is about starting your own Open Championship pool, not joining someone else\'s.'

  const text = [
    subject,
    '',
    `${greeting} this is about running a new Open Championship pool for your group. It is not an invite to join someone else's pool.`,
    '',
    `The Open starts ${tournamentStartLabel}. If your group wants a board people will actually check, Golf Pools Pro can handle the pool from setup through Sunday.`,
    '',
    'Top reasons to use it:',
    '1. Players pick on their phones. You create the pool, share one link, and they enter their own picks.',
    '2. The leaderboard updates during the tournament. Everyone can follow the board without waiting on a spreadsheet update.',
    '3. Rooting interests are clear. Players can see who helps them, who hurts them, and what needs to happen next.',
    '',
    'First 5 active entries are free. If your group is bigger, the app shows the host price before checkout.',
    '',
    `Create your Open pool: ${ctaUrl}`,
    `See the Open pool page: ${openPageUrl}`,
    '',
    `You are getting this because you opted into Golf Pools Pro product updates and tournament reminders. Unsubscribe: ${input.unsubscribeUrl}`,
  ].join('\n')

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:16px;color:#1f2a24;"><strong>${escapeHtml(greeting)}</strong> this is about running a new <strong>Open Championship pool</strong> for your group. It is not an invite to join someone else&apos;s pool.</p>
    <p style="margin:0 0 18px;font-size:16px;color:#1f2a24;">The Open starts ${escapeHtml(tournamentStartLabel)}. If your group wants a board people will actually check, Golf Pools Pro can handle the pool from setup through Sunday.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;border:2px solid #123c2f;background:#fbf7ed;">
      <tr>
        <td colspan="2" style="background:#123c2f;color:#f3df9c;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;font-weight:900;padding:9px 12px;">Why run it here</td>
      </tr>
      ${benefitRow('1', 'Players pick on their phones', 'You create the pool, share one link, and players enter their own picks.')}
      ${benefitRow('2', 'A live board all week', 'The leaderboard updates during the tournament, so nobody waits on a spreadsheet update.')}
      ${benefitRow('3', 'Rooting interests are obvious', 'Players can see who helps them, who hurts them, and what needs to happen next.')}
    </table>

    <div style="margin:0 0 20px;border-left:4px solid #b58a3a;background:#fbf7ed;padding:12px 14px;color:#4b574f;font-size:14px;line-height:1.45;">
      First 5 active entries are free. If your group is bigger, the app shows the host price before checkout.
    </div>

    <p style="margin:0 0 12px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#123c2f;border:2px solid #123c2f;color:#ffffff;text-decoration:none;font-weight:900;padding:12px 16px;">Create your Open pool</a></p>
    <p style="margin:0;color:#657168;font-size:13px;">Want the details first? <a href="${escapeHtml(openPageUrl)}" style="color:#123c2f;font-weight:800;text-decoration:underline;">See the Open pool page</a>.</p>
  `

  const footerHtml = `
    <div style="margin:0 0 8px;">You are getting this because you opted into Golf Pools Pro product updates and tournament reminders.</div>
    <div><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#123c2f;font-weight:800;text-decoration:underline;">Unsubscribe</a> from these emails.</div>
  `

  const html = emailShell({
    preheader,
    title: 'Run a new Open pool',
    bodyHtml,
    footerHtml,
  })

  return { subject, preheader, text, html, ctaUrl, openPageUrl, unsubscribeUrl: input.unsubscribeUrl }
}
