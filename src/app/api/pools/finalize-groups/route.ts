export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { findPgaTourTournament, getPgaTourFieldWithMeta, getPgaTourSchedule } from '@/lib/pga-tour-field'
import type { PoolGameFormat } from '@/lib/pool-formats'
import { buildGroupedPickGroupsForLock } from '@/lib/grouped-pool-group-builder'
import { isFieldAcceptableForLock, fieldFingerprint } from '@/lib/field-quality'

export async function POST(request: Request) {
  try {
    const { poolId } = await request.json()

    if (!poolId || typeof poolId !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing poolId' }, { status: 400 })
    }

    const authSupabase = await createAuthClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
    }

    const supabase = createSupabaseServiceClient(supabaseUrl, supabaseKey)

    // Fetch pool + tournament
    const { data: pool, error: poolError } = await supabase
      .from('gpp_pools')
      .select('id, passcode, owner_id, tournament_id, game_format, group_count, is_locked, is_completed, groups_finalized_at, gpp_tournaments(id, name, start_date, status, field_json, leaderboard_json, external_id, field_source, last_field_fetch, odds_snapshot_json)')
      .eq('id', poolId)
      .maybeSingle()

    if (poolError || !pool) {
      return NextResponse.json({ ok: false, error: poolError?.message || 'Pool not found' }, { status: 404 })
    }

    const tournament = Array.isArray(pool.gpp_tournaments)
      ? pool.gpp_tournaments[0]
      : pool.gpp_tournaments

    if (pool.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 })
    }

    if (pool.is_locked || pool.is_completed || tournament?.status === 'live' || tournament?.status === 'completed') {
      return NextResponse.json({ ok: false, error: 'Groups cannot be locked after picks close.' }, { status: 409 })
    }

    if (!tournament) {
      return NextResponse.json({ ok: false, error: 'Tournament not linked' }, { status: 400 })
    }

    if (pool.groups_finalized_at) {
      return NextResponse.json({ ok: false, error: 'Groups already finalized' }, { status: 409 })
    }

    const gameFormat = pool.game_format as PoolGameFormat
    if (!['ranked_groups', 'random_groups'].includes(gameFormat)) {
      return NextResponse.json({ ok: false, error: 'Not a grouped format' }, { status: 400 })
    }

    // ALWAYS re-fetch fresh field from PGA Tour before locking.
    let fieldSnapshot: any[] = []
    let fieldSource: 'pga_tour' | 'stored' = 'pga_tour'
    let lastUpdated: string | null = null

    const season = Number((tournament.start_date || '').slice(0, 4)) || new Date().getFullYear()
    const pgaSchedule = await getPgaTourSchedule(season).catch(() => [])
    const pgaMatch = findPgaTourTournament({
      pgaSchedule,
      eventName: tournament.name,
      startDate: tournament.start_date,
    })

    if (pgaMatch?.tournamentId) {
      const fresh = await getPgaTourFieldWithMeta(pgaMatch.tournamentId).catch(() => ({ players: [], lastUpdated: null }))
      if (fresh.players.length > 0) {
        fieldSnapshot = fresh.players
        lastUpdated = fresh.lastUpdated

        // Persist the fresh field to the tournament record
        await supabase.from('gpp_tournaments').update({
          field_json: fieldSnapshot,
          field_fingerprint: fieldFingerprint(fieldSnapshot),
          field_source: 'pga_tour',
          last_field_fetch: lastUpdated || new Date().toISOString(),
        }).eq('id', tournament.id)
      }
    }

    // Fallback to stored field only if PGA Tour API returned nothing
    if (fieldSnapshot.length === 0) {
      const stored = Array.isArray(tournament?.field_json) && tournament.field_json.length > 0
        ? tournament.field_json
        : Array.isArray(tournament?.leaderboard_json) && tournament.leaderboard_json.length > 0
          ? tournament.leaderboard_json
          : []
      fieldSnapshot = stored
      fieldSource = 'stored'
      lastUpdated = tournament.last_field_fetch || null
    }

    if (fieldSnapshot.length === 0) {
      return NextResponse.json({ ok: false, error: 'Field not available' }, { status: 400 })
    }

    // Quality gate
    const quality = isFieldAcceptableForLock(fieldSnapshot, {
      source: fieldSource,
      lastUpdated,
      tournamentName: tournament.name,
    })
    if (!quality.ok) {
      return NextResponse.json({ ok: false, error: `Field failed quality check: ${quality.reason}` }, { status: 400 })
    }

    const { groups } = await buildGroupedPickGroupsForLock({
      supabase,
      tournament,
      pool: { ...pool, game_format: gameFormat },
      field: fieldSnapshot,
    })

    if (groups.length === 0) {
      return NextResponse.json({ ok: false, error: 'Could not build groups from this field' }, { status: 400 })
    }

    const { data: updatedPool, error: updateError } = await supabase
      .from('gpp_pools')
      .update({
        pick_groups_json: groups,
        field_snapshot_json: fieldSnapshot,
        groups_finalized_at: new Date().toISOString(),
      })
      .eq('id', poolId)
      .is('groups_finalized_at', null)
      .select('id')
      .maybeSingle()

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
    }
    if (!updatedPool) {
      return NextResponse.json({ ok: false, error: 'Groups already finalized' }, { status: 409 })
    }

    return NextResponse.json({
      ok: true,
      groups,
      fieldSource,
      fieldSize: fieldSnapshot.length,
      qualityReason: quality.reason,
    })

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Unexpected error' }, { status: 500 })
  }
}
