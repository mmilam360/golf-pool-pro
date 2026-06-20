export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { runCronRoute } from '@/lib/cron-run-log'
import { finalizeCompletedPoolResults } from '@/lib/finalize-pool-results'

export async function GET(request: Request) {
  return runCronRoute(request, async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    return finalizeCompletedPoolResults(supabase)
  })
}
