'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PasswordInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-stone-700 text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          minLength={6}
          className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 pr-12 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-emerald-800 p-2">
          <EyeIcon visible={show} />
        </button>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedName = displayName.trim()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: trimmedName, marketing_emails: marketingOptIn } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      const redirectParam = new URLSearchParams(window.location.search).get('redirect')
      let redirectTo = '/dashboard'
      if (redirectParam && !redirectParam.includes('\\')) {
        try {
          const url = new URL(redirectParam, window.location.origin)
          if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
            redirectTo = `${url.pathname}${url.search}${url.hash}`
          }
        } catch {
          redirectTo = '/dashboard'
        }
      }
      router.push(redirectTo)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-[#d8cab0] bg-white p-8 text-center shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-[#0f2f25]">Account created</h1>
        <p className="text-stone-600 mb-4">Check your email to confirm your account, then sign in.</p>
        <Link href="/login" className="font-semibold text-[#123c2f] hover:underline">Go to sign in</Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#d8cab0] bg-white p-8 shadow-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">New account</p>
      <h1 className="mb-6 text-2xl font-bold text-[#0f2f25]">Create account</h1>
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm border border-red-200">{error}</div>
      )}
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            required
            className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-stone-300 rounded-lg px-4 py-3 text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <PasswordInput label="Password" value={password} onChange={setPassword} />
        <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} />
        <label className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={e => setMarketingOptIn(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
          />
          <span>Send me Golf Pool Pro product updates and tournament reminders. I can unsubscribe later.</span>
        </label>
        <p className="text-xs leading-5 text-stone-500">
          By creating an account, you agree to the <Link href="/terms" className="font-semibold text-emerald-800 hover:underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-emerald-800 hover:underline">Privacy Policy</Link>.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p className="text-stone-600 text-sm mt-5 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-800 font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
