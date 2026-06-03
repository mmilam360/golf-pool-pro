const PICK_LOCK_BEFORE_FIRST_TEE_MS = 5 * 60 * 1000

type FieldPlayerWithTeeTime = {
  teeTime?: string | null
}

type PickLockBadgeInput = {
  lockAt?: string | null
  groupsFinalizedAt?: string | null
  tournamentStartDate?: string | null
  fieldJson?: FieldPlayerWithTeeTime[] | null
}

export function getPickLockBadgeText({ lockAt, tournamentStartDate, fieldJson }: PickLockBadgeInput) {
  if (lockAt) return formatPickLockTime(lockAt)

  const firstTee = firstTeeTimeFromField(fieldJson)
  if (firstTee) {
    return formatPickLockTime(new Date(firstTee.getTime() - PICK_LOCK_BEFORE_FIRST_TEE_MS).toISOString())
  }

  return formatPickLockDate(tournamentStartDate)
}

function firstTeeTimeFromField(fieldJson?: FieldPlayerWithTeeTime[] | null) {
  if (!Array.isArray(fieldJson)) return null
  let firstTee: Date | null = null
  for (const player of fieldJson) {
    if (!player?.teeTime) continue
    const teeTime = new Date(player.teeTime)
    if (!Number.isFinite(teeTime.getTime())) continue
    if (!firstTee || teeTime.getTime() < firstTee.getTime()) firstTee = teeTime
  }
  return firstTee
}

function formatPickLockTime(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).toLowerCase().replace(',', '').replace(/\s([ap]m)$/, '$1')
}

function formatPickLockDate(value?: string | null) {
  if (!value) return null
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (!dateOnly) return formatPickLockTime(value)
  const [, month, day] = dateOnly.split('-').map(Number)
  if (!month || !day) return null
  return `${month}/${day}`
}
