import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'

export const runtime = 'nodejs'

const sql = `
alter table public.gpp_entries
  add column if not exists notification_email text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpp_entries_notification_email_format'
      and conrelid = 'public.gpp_entries'::regclass
  ) then
    alter table public.gpp_entries
      add constraint gpp_entries_notification_email_format
      check (
        notification_email is null
        or notification_email = ''
        or notification_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
      );
  end if;
end $$;
`

export async function POST(request: Request) {
  const authError = requireCronAuth(request)
  if (authError) return authError

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 })

  const attempts = ['/pg/query', '/pg/meta/query']
  const results = []
  for (const path of attempts) {
    const response = await fetch(`${supabaseUrl}${path}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    })
    const text = await response.text().catch(() => '')
    results.push({ path, status: response.status, body: text.slice(0, 500) })
    if (response.ok) return NextResponse.json({ ok: true, path, result: text.slice(0, 500) })
  }

  return NextResponse.json({ ok: false, results }, { status: 500 })
}
