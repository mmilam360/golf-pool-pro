type GolferStatusFields = {
  teeTime?: string | null
  startTee?: number | null
  roundScore?: string | null
  thru?: string | null
  status?: string | null
  scoreToPar?: number | null
  isObStandIn?: boolean | null
}

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : ''
}

function sameLocalDate(a: Date, b: Date, timeZone: string) {
  const aKey = localDateKey(a, timeZone)
  return Boolean(aKey && aKey === localDateKey(b, timeZone))
}

function parsedTeeTime(player: GolferStatusFields) {
  if (!player.teeTime) return null
  const parsed = new Date(player.teeTime)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function hasRoundScoreToday(player: GolferStatusFields) {
  return Boolean(String(player.roundScore ?? '').trim())
}

function hasStartedCurrentRound(player: GolferStatusFields) {
  if (hasRoundScoreToday(player)) return true
  const thru = String(player.thru ?? '').trim().toUpperCase()
  return Boolean(thru && thru !== 'F')
}

export function thruLabel(thru?: string | null, withPrefix = true) {
  if (!thru) return '—'
  const value = String(thru).toUpperCase()
  if (value === 'F') return 'F'
  return withPrefix ? `THRU ${value}` : value
}

export function shouldHoldFinishedStatus(player: GolferStatusFields, timeZone: string, now = new Date()) {
  if (player.thru || player.status !== 'active' || !hasRoundScoreToday(player)) return false
  const teeTime = parsedTeeTime(player)
  if (!teeTime || teeTime.getTime() > now.getTime()) return false
  return sameLocalDate(teeTime, now, timeZone)
}

export function teeTimeLabel(player: GolferStatusFields, timeZone: string) {
  const teeTime = parsedTeeTime(player)
  if (!teeTime || hasStartedCurrentRound(player)) return ''
  const time = teeTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone })
  return `${time}${player.startTee === 10 ? '*' : ''}`
}

export function pickStatusLabel(player: GolferStatusFields, timeZone: string, now = new Date()) {
  if (player.isObStandIn) return 'OB'
  return teeTimeLabel(player, timeZone) || (shouldHoldFinishedStatus(player, timeZone, now) ? 'F' : thruLabel(player.thru))
}

export function leaderboardBackedPickStatusLabel(pick: GolferStatusFields, leaderboardPlayer: GolferStatusFields | undefined, timeZone: string, now = new Date()) {
  if (pick.isObStandIn) return 'OB'
  return (leaderboardPlayer ? teeTimeLabel(leaderboardPlayer, timeZone) : '') || pickStatusLabel(leaderboardPlayer ?? pick, timeZone, now)
}

export function tournamentThruLabel(player: GolferStatusFields, timeZone: string, now = new Date()) {
  if (player.status === 'cut') return 'CUT'
  if (player.status === 'wd') return 'WD'
  if (player.status === 'dnq') return 'DNQ'
  if (teeTimeLabel(player, timeZone)) return '—'
  if (shouldHoldFinishedStatus(player, timeZone, now)) return 'F'
  return thruLabel(player.thru, false)
}
