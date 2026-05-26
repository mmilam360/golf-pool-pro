const OWGR_API_BASE = 'https://apiweb.owgr.com/api/owgr/rankings/getRankings'
const OWGR_PAGE_SIZE = 100
const FETCH_TIMEOUT_MS = 30000

export type OwgrPlayer = {
  rank: number
  fullName: string
  firstName: string
  lastName: string
}

// Simple in-memory cache for the current process
let cachedRankings: Map<string, number> | null = null
let cachedAt = 0
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

function rankCacheKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function fetchOwgrRankings(options: {
  maxPages?: number
  pageSize?: number
} = {}): Promise<Map<string, number>> {
  const now = Date.now()
  if (cachedRankings && now - cachedAt < CACHE_TTL_MS) {
    return cachedRankings
  }

  const pageSize = Math.min(options.pageSize || OWGR_PAGE_SIZE, 100)
  const maxPages = options.maxPages || 20 // ~2,000 players covers any PGA Tour field
  const rankings = new Map<string, number>()

  for (let page = 1; page <= maxPages; page++) {
    const url = `${OWGR_API_BASE}?regionId=0&pageSize=${pageSize}&pageNumber=${page}&countryId=0&sortString=Rank+ASC`

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 GolfPoolsPro/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        console.warn(`OWGR API page ${page} returned ${response.status}`)
        break
      }

      const data = await response.json().catch(() => null)
      if (!data || !Array.isArray(data.rankingsList)) {
        console.warn('OWGR API returned unexpected structure')
        break
      }

      for (const entry of data.rankingsList) {
        const player = entry?.player
        if (!player?.fullName) continue
        const rank = typeof entry.rank === 'number' ? entry.rank : Number(entry.rank)
        if (!Number.isFinite(rank) || rank <= 0) continue

        const key = rankCacheKey(player.fullName)
        rankings.set(key, rank)

        // Also cache by "First Last" alternate form
        if (player.firstName && player.lastName) {
          const altKey = rankCacheKey(`${player.firstName} ${player.lastName}`)
          rankings.set(altKey, rank)
        }
      }

      // Stop if we've fetched all pages
      if (data.rankingsList.length < pageSize) break
      if (data.totalNumberOfPages && page >= data.totalNumberOfPages) break
    } catch (error) {
      console.warn(`OWGR API page ${page} failed:`, error)
      break
    }
  }

  cachedRankings = rankings
  cachedAt = now
  console.log(`[OWGR] Cached ${rankings.size} rankings`)
  return rankings
}

export function lookupOwgr(rankings: Map<string, number>, name: string): number | null {
  const key = rankCacheKey(name)
  const rank = rankings.get(key)
  if (rank !== undefined) return rank

  // Try reverse order (Last, First)
  const reversed = name.split(/,\s*/).reverse().join(' ').trim()
  if (reversed !== name) {
    return rankings.get(rankCacheKey(reversed)) ?? null
  }

  return null
}

/**
 * Hydrate an array of GolfPlayer objects with OWGR rankings.
 * Mutates in place for performance (the field arrays can be large).
 */
export async function hydrateFieldWithOwgr<T extends { name: string; owgr?: number | null }>(
  players: T[],
  options?: { maxPages?: number }
): Promise<T[]> {
  const rankings = await fetchOwgrRankings(options)
  for (const player of players) {
    const rank = lookupOwgr(rankings, player.name)
    if (rank !== null) {
      player.owgr = rank
    }
  }
  return players
}
