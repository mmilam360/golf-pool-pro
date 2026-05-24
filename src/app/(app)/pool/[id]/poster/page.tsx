export const runtime = 'edge'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PoolPosterClient from './PoolPosterClient'

type Params = { id: string }

type PoolPosterRecord = {
  id: string
  owner_id: string
  name: string
  passcode: string
  pick_count: number
  count_scores: number
  ob_rule_enabled: boolean | null
  ob_penalty_strokes: number | null
  game_format: 'standard' | 'ranked_groups' | 'random_groups' | null
  group_count: number | null
  picks_per_group: number | null
  gpp_tournaments?: unknown
}

function getTournament(value: unknown) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function siteOrigin(host?: string | null, proto?: string | null) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (host) return `${proto || 'https'}://${host}`
  return 'https://www.golfpoolspro.com'
}

export default async function PoolPosterPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/pool/${id}/poster`)}`)

  const { data: poolData } = await supabase
    .from('gpp_pools')
    .select('id, owner_id, name, passcode, pick_count, count_scores, ob_rule_enabled, ob_penalty_strokes, game_format, group_count, picks_per_group, gpp_tournaments(name, course, start_date, end_date)')
    .eq('id', id)
    .single()

  const pool = poolData as PoolPosterRecord | null

  if (!pool || pool.owner_id !== user.id) redirect('/manage-pools')

  const requestHeaders = await headers()
  const origin = siteOrigin(requestHeaders.get('host'), requestHeaders.get('x-forwarded-proto'))
  const joinUrl = `${origin}/pool/join?code=${encodeURIComponent(pool.passcode)}`
  const hostName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : user.email?.split('@')[0] || 'Pool runner'

  return (
    <PoolPosterClient
      pool={{
        id: pool.id,
        name: pool.name,
        passcode: pool.passcode,
        pick_count: pool.pick_count,
        count_scores: pool.count_scores,
        ob_rule_enabled: Boolean(pool.ob_rule_enabled),
        ob_penalty_strokes: pool.ob_penalty_strokes,
        game_format: pool.game_format || 'standard',
        group_count: pool.group_count,
        picks_per_group: pool.picks_per_group,
      }}
      tournament={getTournament(pool.gpp_tournaments)}
      joinUrl={joinUrl}
      hostName={hostName}
    />
  )
}
