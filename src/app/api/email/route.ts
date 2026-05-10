export const runtime = 'edge';
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { poolId, subject, body, recipients } = await request.json()

    if (typeof poolId !== 'string' || typeof subject !== 'string' || typeof body !== 'string' || !Array.isArray(recipients)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cleanSubject = subject.trim()
    const cleanBody = body.trim()
    const cleanRecipients = Array.from(new Set(recipients.filter(isEmail).map(email => email.trim().toLowerCase())))

    if (!cleanSubject || !cleanBody || cleanRecipients.length === 0 || cleanRecipients.length > 50) {
      return NextResponse.json({ error: 'Invalid email request' }, { status: 400 })
    }

    const { data: pool } = await supabase
      .from('gpp_pools')
      .select('owner_id')
      .eq('id', poolId)
      .single()

    if (!pool || pool.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const safeSubject = escapeHtml(cleanSubject)
    const safeBody = escapeHtml(cleanBody).replace(/\n/g, '<br />')

    const { data, error } = await resend.emails.send({
      from: 'Golf Pool Pro <noreply@golfpoolpro.com>',
      to: cleanRecipients,
      subject: cleanSubject,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;">
          <div style="background:#18181b;padding:20px;border-radius:8px 8px 0 0;">
            <h1 style="color:#34d399;margin:0;font-size:20px;">Golf Pool Pro</h1>
          </div>
          <div style="background:#27272a;padding:20px;border-radius:0 0 8px 8px;">
            <h2 style="color:white;margin:0 0 16px;">${safeSubject}</h2>
            <div style="color:#a1a1aa;line-height:1.6;">${safeBody}</div>
          </div>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }

    const { error: logError } = await supabase.from('gpp_email_log').insert({
      pool_id: poolId,
      sender_id: user.id,
      subject: cleanSubject,
      body: cleanBody,
      recipient_count: cleanRecipients.length,
    })

    if (logError) {
      return NextResponse.json({ error: 'Email log failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch {
    return NextResponse.json({ error: 'Email request failed' }, { status: 500 })
  }
}
