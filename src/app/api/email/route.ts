export const runtime = 'edge';
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  try {
    const { poolId, senderId, subject, body, recipients } = await request.json()

    if (!poolId || !senderId || !subject || !recipients?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data, error } = await resend.emails.send({
      from: 'Golf Pool Pro <noreply@golfpoolpro.com>',
      to: recipients,
      subject,
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;">
          <div style="background:#18181b;padding:20px;border-radius:8px 8px 0 0;">
            <h1 style="color:#34d399;margin:0;font-size:20px;">Golf Pool Pro</h1>
          </div>
          <div style="background:#27272a;padding:20px;border-radius:0 0 8px 8px;">
            <h2 style="color:white;margin:0 0 16px;">${subject}</h2>
            <div style="color:#a1a1aa;line-height:1.6;">${body}</div>
          </div>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
