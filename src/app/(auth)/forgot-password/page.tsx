'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="rounded-lg border border-[#d8cab0] bg-white p-8 shadow-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Password recovery</p>
      <h1 className="mb-3 text-2xl font-bold text-[#0f2f25]">Reset your password</h1>
      <p className="mb-6 text-sm leading-6 text-stone-600">Enter your account email and we’ll send a reset link.</p>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">If that email exists, a reset link has been sent.</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-700 py-3 font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50">
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-600">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-emerald-800 hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
