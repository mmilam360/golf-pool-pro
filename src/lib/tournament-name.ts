const SPONSOR_CONNECTOR_PATTERN = [
  'pres\\.?\\s+by',
  'presented\\s+by',
  'sponsored\\s+by',
  'hosted\\s+by',
  'powered\\s+by',
  'driven\\s+by',
  'supported\\s+by',
  'in\\s+partnership\\s+with',
  'in\\s+association\\s+with',
  'brought\\s+to\\s+you\\s+by',
].join('|')

const SPONSOR_PREFIX_PATTERN = [
  'presented\\s+by',
  'sponsored\\s+by',
  'hosted\\s+by',
  'powered\\s+by',
  'driven\\s+by',
].join('|')

export function displayTournamentName(name?: string | null) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ')
  if (!clean) return ''

  const display = clean
    .replace(new RegExp(`\\s*(?:[,:;|/]|[-–—])?\\s*(?:${SPONSOR_CONNECTOR_PATTERN})\\b.*$`, 'i'), '')
    .replace(new RegExp(`^\\s*(?:${SPONSOR_PREFIX_PATTERN})\\b.+?(?:[,:;|/]|[-–—])\\s*`, 'i'), '')
    .replace(/\s+(?:championship|classic|invitational|open|tournament)\s+(?:at|from)\s+.+$/i, match => {
      // Keep location/course suffixes out only when they follow a full event-type noun.
      // Example: "The Memorial Tournament at Muirfield Village" -> "The Memorial Tournament".
      return match.replace(/\s+(?:at|from)\s+.+$/i, '')
    })
    .replace(/[\s:;|/–—-]+$/g, '')
    .trim()

  return display.replace(/^the\b/i, 'The')
}
