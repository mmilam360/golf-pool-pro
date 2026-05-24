const EASTERN_TIME_ZONE = 'America/New_York'
const AUTO_LOCK_HOUR_EASTERN = 8

export type EasternNow = {
  date: string
  hour: number
}

function addDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return date.toISOString().slice(0, 10)
}

export function easternNowParts(date = new Date()): EasternNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour') || 0),
  }
}

export function autoLockDateForTournament(startDate: string | null | undefined) {
  return startDate ? addDays(startDate, -2) : ''
}

export function shouldAutoFinalizeGroups(startDate: string | null | undefined, now = easternNowParts()) {
  const lockDate = autoLockDateForTournament(startDate)
  if (!lockDate) return false
  if (now.date < lockDate) return false
  if (now.date === lockDate && now.hour < AUTO_LOCK_HOUR_EASTERN) return false
  return true
}
