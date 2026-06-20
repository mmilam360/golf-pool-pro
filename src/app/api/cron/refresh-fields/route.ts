export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { refreshPgaTourFields } from '@/lib/tournament-sync'
import { autoFinalizeGroupedPools } from '@/lib/grouped-pool-auto-lock'
import { autoLockPools } from '@/lib/pool-auto-lock'
import { runCronRoute } from '@/lib/cron-run-log'

export async function GET(request: Request) {
  return runCronRoute(request, async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }
    const supabase = createClient(supabaseUrl, supabaseKey)
    const season = new Date().getFullYear()
    const fieldRefresh = await refreshPgaTourFields(supabase, season)
    const groupFinalization = await autoFinalizeGroupedPools(supabase)
    const poolLocks = await autoLockPools(supabase)
    return {
      ...fieldRefresh,
      groupedPoolsAutoFinalized: groupFinalization.finalized,
      groupedPoolsChecked: groupFinalization.checked,
      poolsAutoLocked: poolLocks.locked,
      emptyEntriesAutoRemoved: poolLocks.emptyEntriesAutoRemoved,
      poolsCheckedForLock: poolLocks.checked,
      poolsSkippedGroupsPending: poolLocks.skippedGroupsPending,
    }
  })
}
