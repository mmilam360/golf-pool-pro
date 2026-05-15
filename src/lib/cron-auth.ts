import { NextResponse } from 'next/server'

export function requireCronAuth(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!expectedSecret) {
    return process.env.NODE_ENV === 'production'
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : null
  }

  if (token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
