const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/

export const APP_DATE_TIME_ZONE = 'America/New_York'

export function getDateOnly(value?: string | null) {
  return value?.match(DATE_ONLY_RE)?.[0] || null
}

export function dateOnlyToUtcDate(value?: string | null) {
  const dateOnly = getDateOnly(value)
  if (!dateOnly) return null
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatDateOnly(value?: string | null, options: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit', year: '2-digit' }) {
  const date = dateOnlyToUtcDate(value)
  if (!date) return 'Date TBA'
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date)
}

export function formatDateOnlyWeekday(value?: string | null) {
  const date = dateOnlyToUtcDate(value)
  if (!date) return null
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date)
}

export function todayDateOnly(timeZone = APP_DATE_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(now)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10)
}

export function hasDateOnlyStarted(value?: string | null, now = new Date()) {
  const dateOnly = getDateOnly(value)
  if (!dateOnly) return false
  return dateOnly <= todayDateOnly(APP_DATE_TIME_ZONE, now)
}

export function dateOnlyEndMs(value?: string | null) {
  const date = dateOnlyToUtcDate(value)
  if (!date) return null
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - 1
}
