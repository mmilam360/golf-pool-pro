export const runtime = 'edge';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PoolView from './PoolView'

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get pool with tournament
  const { data: pool } = await supabase
    .from('gpp_pools')
    .select('*, gpp_tournaments(*)')
    .eq('id', id)
    .single()

  if (!pool) redirect('/dashboard')

  // Get all entries for this pool
  const { data: entries } = await supabase
    .from('gpp_entries')
    .select('*')
    .eq('pool_id', id)
    .order('created_at', { ascending: true })

  // Get current user's entry
  const myEntry = entries?.find(e => e.user_id === user.id && !e.is_removed) || null
  const isOwner = pool.owner_id === user.id

  return (
    <PoolView
      pool={pool}
      tournament={pool.gpp_tournaments as any}
      entries={entries || []}
      myEntry={myEntry}
      isOwner={isOwner}
      userId={user.id}
    />
  )
}
