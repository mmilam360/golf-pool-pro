export type FullNameSubject = {
  full_name?: unknown
  full_name_confirmed_at?: unknown
} | null | undefined

export function hasConfirmedFullName(subject: FullNameSubject) {
  return Boolean(
    subject?.full_name_confirmed_at
    && typeof subject.full_name === 'string'
    && subject.full_name.trim().length > 0,
  )
}

export function entryNeedsConfirmedFullName(entry: FullNameSubject, accountProfile?: FullNameSubject) {
  return !hasConfirmedFullName(entry) && !hasConfirmedFullName(accountProfile)
}
