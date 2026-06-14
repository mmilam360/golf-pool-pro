'use client'

import { FormEvent, useState } from 'react'

type RequestType = 'support' | 'feature'
type FormState = 'idle' | 'sending' | 'sent' | 'error'

const typeOptions: { value: RequestType; label: string; help: string }[] = [
  { value: 'support', label: 'Support question', help: 'Something is broken or confusing.' },
  { value: 'feature', label: 'Feature idea', help: 'Something that would make the pool better.' },
]

export function HelpRequestForm() {
  const [requestType, setRequestType] = useState<RequestType>('support')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [poolInfo, setPoolInfo] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('sending')
    setStatusMessage('')

    try {
      const response = await fetch('/api/support/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: requestType, email, message, poolInfo, website }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Request did not send')
      }

      setState('sent')
      setStatusMessage(requestType === 'feature' ? 'Feature request sent. Thanks.' : 'Support request sent. I will reply by email.')
      setMessage('')
      setPoolInfo('')
      setWebsite('')
    } catch (error) {
      setState('error')
      setStatusMessage(error instanceof Error ? error.message : 'Request did not send')
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
      <div className="border-b border-[#d8cab0] bg-[#123c2f] px-5 py-4 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f3df9c]">Contact Golf Pools Pro</p>
        <h2 className="mt-1 text-2xl font-black">Send a note</h2>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {typeOptions.map(option => {
            const selected = requestType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setRequestType(option.value)}
                className={`border-2 px-4 py-3 text-left transition-colors ${selected ? 'border-[#123c2f] bg-[#eef7ef] text-[#123c2f]' : 'border-[#d8cab0] bg-[#fbf7ed] text-stone-700 hover:border-[#b58a3a]'}`}
                aria-pressed={selected}
              >
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-1 block text-sm font-semibold leading-5">{option.help}</span>
              </button>
            )
          })}
        </div>

        <div>
          <label htmlFor="support-email" className="mb-1 block text-sm font-semibold text-[#123c2f]">Your email</label>
          <input
            id="support-email"
            type="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-none border-2 border-[#d8cab0] bg-white px-3 py-3 text-base text-stone-900 focus:border-[#123c2f] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="support-pool" className="mb-1 block text-sm font-semibold text-[#123c2f]">Pool or tournament, if it matters</label>
          <input
            id="support-pool"
            type="text"
            value={poolInfo}
            onChange={event => setPoolInfo(event.target.value)}
            placeholder="Pool name, passcode, or tournament"
            className="w-full rounded-none border-2 border-[#d8cab0] bg-white px-3 py-3 text-base text-stone-900 focus:border-[#123c2f] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="support-message" className="mb-1 block text-sm font-semibold text-[#123c2f]">What do you need?</label>
          <textarea
            id="support-message"
            required
            minLength={8}
            rows={7}
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder={requestType === 'feature' ? 'What would make Golf Pools Pro better?' : 'Tell me what happened and what you were trying to do.'}
            className="w-full resize-y rounded-none border-2 border-[#d8cab0] bg-white px-3 py-3 text-base leading-6 text-stone-900 focus:border-[#123c2f] focus:outline-none"
          />
        </div>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="support-website">Website</label>
          <input id="support-website" value={website} onChange={event => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
        </div>

        <button
          type="submit"
          disabled={state === 'sending'}
          className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0f2f25] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {state === 'sending' ? 'Sending...' : requestType === 'feature' ? 'Send feature request' : 'Send support request'}
        </button>

        {statusMessage && (
          <p className={`border px-3 py-2 text-sm font-bold ${state === 'error' ? 'border-[#b21e23] bg-[#fff1ef] text-[#7a171a]' : 'border-[#1f6b4a] bg-[#eef7ef] text-[#123c2f]'}`} role="status">
            {statusMessage}
          </p>
        )}
      </div>
    </form>
  )
}
