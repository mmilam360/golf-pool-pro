export const MISSING_PICKS_REMINDER_GRACE_HOURS = 12

const MISSING_PICKS_REMINDER_GRACE_MS = MISSING_PICKS_REMINDER_GRACE_HOURS * 60 * 60 * 1000

export function poolIsPastMissingPicksReminderGracePeriod(createdAt: string | null | undefined, now = new Date()) {
  const createdTime = new Date(createdAt || '').getTime()
  if (!Number.isFinite(createdTime)) return true
  return now.getTime() - createdTime >= MISSING_PICKS_REMINDER_GRACE_MS
}
