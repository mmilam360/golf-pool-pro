import { lockedOrScoring, type PoolStateInput, type TournamentStateInput } from './pool-state'

export function entryProcessIsClosed(pool?: PoolStateInput | null, tournament?: TournamentStateInput | null, now = new Date()) {
  return lockedOrScoring(pool, tournament, now)
}
