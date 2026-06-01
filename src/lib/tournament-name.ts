export function displayTournamentName(name?: string | null) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ')
  if (!clean) return ''

  const display = clean
    .replace(/\s+(?:pres\.?|presented)\s+by\s+.+$/i, '')
    .replace(/\s+presented\s+.+$/i, '')
    .replace(/[\s:–—-]+$/g, '')
    .trim()

  return display.replace(/^the\b/, 'The')
}
