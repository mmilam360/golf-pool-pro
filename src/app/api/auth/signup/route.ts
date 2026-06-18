import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

type SignupBody = {
  email?: unknown
  password?: unknown
  displayName?: unknown
  fullName?: unknown
  marketingOptIn?: unknown
}

function cleanEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 160) : ''
}

function cleanName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 80) : ''
}

export async function POST(request: Request) {
  let body: SignupBody = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const email = cleanEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  const displayName = cleanName(body.displayName)
  const fullName = cleanName(body.fullName) || displayName

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }
  if (!displayName) {
    return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
  }

  const supabase = createServiceClient() as any
  const confirmedAt = new Date().toISOString()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      full_name: fullName,
      full_name_confirmed_at: confirmedAt,
      marketing_emails: Boolean(body.marketingOptIn),
    },
  })

  if (error) {
    const message = String(error.message || '')
    if (message.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'An account already exists for that email. Sign in instead.' }, { status: 409 })
    }
    return NextResponse.json({ error: message || 'Could not create account.' }, { status: 500 })
  }

  if (!data?.user?.id) {
    return NextResponse.json({ error: 'Could not create account profile.' }, { status: 500 })
  }

  const { error: profileError } = await supabase
    .from('gpp_profiles')
    .upsert({
      id: data.user.id,
      email,
      display_name: displayName,
      full_name: fullName,
      full_name_confirmed_at: confirmedAt,
    })

  if (profileError) {
    return NextResponse.json({ error: profileError.message || 'Could not create account profile.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
