import { totalPicksRequired } from './pick-counts'
import { groupForPick, validateGroupedPicks, type PickGroup } from './pool-formats'

function isGroupedFormat(format: unknown) {
  return format === 'ranked_groups' || format === 'random_groups' || format === 'grouped'
}

function tournamentForPool(pool: any) {
  return Array.isArray(pool?.gpp_tournaments) ? pool.gpp_tournaments[0] : pool?.gpp_tournaments
}

function normalizedName(value: string) {
  return value.trim().toLowerCase()
}

function playerNames(players: unknown) {
  const rows = Array.isArray(players) ? players : []
  return new Set(rows
    .filter((player: any) => player?.name && String(player?.status || '').toLowerCase() !== 'wd')
    .flatMap((player: any) => [
      player.name,
      [player.firstName, player.lastName].filter(Boolean).join(' '),
    ])
    .filter(Boolean)
    .map((name: string) => normalizedName(name)))
}

function pickCountMessage(count: number) {
  return `Pick ${count} golfers to save.`
}

export function validatePickSubmission(pool: any, picks: unknown) {
  if (!Array.isArray(picks) || picks.some(pick => typeof pick !== 'string')) {
    return 'Invalid picks.'
  }

  const cleanedPicks = picks.map(pick => pick.trim()).filter(Boolean)
  if (cleanedPicks.length !== picks.length) return 'Invalid picks.'

  const normalizedPicks = cleanedPicks.map(normalizedName)
  if (new Set(normalizedPicks).size !== normalizedPicks.length) {
    return 'Pick each golfer only once.'
  }

  const requiredPickCount = totalPicksRequired(pool)
  if (requiredPickCount > 0 && cleanedPicks.length !== requiredPickCount) {
    return pickCountMessage(requiredPickCount)
  }

  if (isGroupedFormat(pool?.game_format)) {
    const groups = Array.isArray(pool?.pick_groups_json) ? pool.pick_groups_json as PickGroup[] : []
    const picksPerGroup = Number(pool?.picks_per_group || 1)
    if (!pool?.groups_finalized_at || groups.length === 0) {
      return 'Picks are not open yet. Groups need to lock first.'
    }
    if (cleanedPicks.some(pick => !groupForPick(groups, pick))) {
      return 'Pick golfers from the locked groups.'
    }
    const groupedValidation = validateGroupedPicks(groups, cleanedPicks, picksPerGroup)
    if (!groupedValidation.valid) {
      return `Pick ${picksPerGroup} ${picksPerGroup === 1 ? 'golfer' : 'golfers'} from each group.`
    }
    return null
  }

  const tournament = tournamentForPool(pool)
  const fieldNames = playerNames(tournament?.field_json)
  const leaderboardNames = fieldNames.size > 0 ? fieldNames : playerNames(tournament?.leaderboard_json)
  if (leaderboardNames.size === 0) return 'Tournament field is not ready yet.'
  if (cleanedPicks.some(pick => !leaderboardNames.has(normalizedName(pick)))) {
    return 'Pick golfers from the tournament field.'
  }

  return null
}
