type PickLockBadgeInput = {
  lockAt?: string | null
  groupsFinalizedAt?: string | null
  tournamentStartDate?: string | null
}

export function getPickLockBadgeText({ lockAt, tournamentStartDate }: PickLockBadgeInput) {
  if (lockAt) return formatPickLockTime(lockAt)
  return formatPickLockDate(tournamentStartDate)
}

function formatPickLockTime(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).toLowerCase().replace(',', '').replace(/\s([ap]m)$/, '$1')
}

function formatPickLockDate(value?: string | null) {
  if (!value) return null
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (!dateOnly) return formatPickLockTime(value)
  const [, month, day] = dateOnly.split('-')
  return `${month}/${day}`
}
