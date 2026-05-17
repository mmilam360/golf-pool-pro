'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function dismissFinalResultAnnouncement(formData: FormData) {
  const poolId = String(formData.get('poolId') || '')
  const entryId = String(formData.get('entryId') || '')
  const { supabase, user } = await requireUser()

  if (!poolId || !entryId) {
    revalidatePath('/dashboard')
    return
  }

  const { data: entry } = await supabase
    .from('gpp_entries')
    .select('id, pool_id, user_id')
    .eq('id', entryId)
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!entry) {
    revalidatePath('/dashboard')
    return
  }

  await supabase
    .from('gpp_final_result_dismissals')
    .upsert({
      user_id: user.id,
      pool_id: poolId,
      entry_id: entryId,
      dismissed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,pool_id' })

  revalidatePath('/dashboard')
}
