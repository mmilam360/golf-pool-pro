import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CreatePoolClient from './CreatePoolClient'

type SearchParams = Record<string, string | string[] | undefined>

function createRedirectPath(searchParams: SearchParams) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else if (typeof value === 'string') {
      params.set(key, value)
    }
  }

  const query = params.toString()
  return `/pool/create${query ? `?${query}` : ''}`
}

export default async function CreatePoolPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = searchParams ? await searchParams : {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(createRedirectPath(query))}`)
  }

  return <CreatePoolClient />
}
