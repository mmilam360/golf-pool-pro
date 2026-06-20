import { syncTournaments } from '@/lib/tournament-sync'
import { runCronRoute } from '@/lib/cron-run-log'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runCronRoute(request, async () => {
    const { searchParams } = new URL(request.url)
    const season = Number(searchParams.get('season')) || new Date().getFullYear()
    const doLive = searchParams.get('live') === '1' || searchParams.get('live') === 'true'
    return syncTournaments({ season, doLive })
  })
}
