'use client'

import { useState } from 'react'

type Props = {
  poolId: string
  disabled?: boolean
  className?: string
  label?: string
}

export default function RunnerMissingPicksEmailButton({ poolId, disabled = false, className = '', label = 'Send reminders' }: Props) {
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info')

  async function sendReminders() {
    if (sending || disabled) return
    setSending(true)
    setFeedback('')
    setTone('info')

    try {
      const res = await fetch('/api/pools/missing-picks-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send reminders.')

      const parts = [`Sent ${data.sent || 0}`]
      if (data.duplicate) parts.push(`${data.duplicate} already got one today`)
      if (data.noEmail) parts.push(`${data.noEmail} need text`)
      if (data.skipped) parts.push(`${data.skipped} skipped`)
      setFeedback(`${parts.join(' · ')}.`)
      setTone('success')
    } catch (error: any) {
      setFeedback(error?.message || 'Could not send reminders.')
      setTone('error')
    } finally {
      setSending(false)
    }
  }

  const feedbackClass = tone === 'error'
    ? 'border-[#b21e23] bg-[#fff1ef] text-[#b21e23]'
    : 'border-[#d8cab0] bg-[#fbf7ed] text-[#123c2f]'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={sendReminders}
        disabled={disabled || sending}
        className={className || 'w-full border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-50'}
      >
        {sending ? 'Sending...' : label}
      </button>
      {feedback ? (
        <p className={`border px-2.5 py-2 text-xs font-bold leading-5 ${feedbackClass}`}>{feedback}</p>
      ) : null}
    </div>
  )
}
