export type GolferNameParts = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
}

const NAME_SUFFIXES = new Set(['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'])

export function golferFullName(player: GolferNameParts) {
  return player.name || `${player.firstName || ''} ${player.lastName || ''}`.trim()
}

export function golferListNameFromParts(player: GolferNameParts) {
  const firstName = player.firstName?.trim()
  const lastName = player.lastName?.trim()
  if (lastName && firstName) return `${lastName}, ${firstName}`
  return golferListName(golferFullName(player))
}

export function golferListName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return name
  const suffix = NAME_SUFFIXES.has(parts[parts.length - 1]) ? parts.pop() : null
  const lastName = parts.pop()
  const firstNames = parts.join(' ')
  return `${lastName}, ${firstNames}${suffix ? ` ${suffix}` : ''}`
}

export function compareGolfersByListName(a: GolferNameParts, b: GolferNameParts) {
  return golferListNameFromParts(a).localeCompare(golferListNameFromParts(b), undefined, { sensitivity: 'base' })
}
