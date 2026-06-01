'use client'
import { useEffect, useState } from 'react'
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
          className="w-full bg-white border border-stone-300 rounded-none px-4 py-3 pr-12 text-stone-900 focus:outline-none focus:border-[#123c2f] focus:ring-2 focus:ring-[#d8cab0]"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-[#123c2f] p-2">
          <EyeIcon visible={show} />
        </button>
      </div>
    </div>
  )
}

export default function SignupPage({ defaultPromoCode = '' }: { defaultPromoCode?: string } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [signupPromoCode, setSignupPromoCode] = useState(defaultPromoCode)
  const [joiningPool, setJoiningPool] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSignupPromoCode(params.get('promo') || defaultPromoCode)
    const redirectParam = params.get('redirect') || ''
    setJoiningPool(redirectParam.startsWith('/pool/join'))
  }, [defaultPromoCode])

  function getLoginHref() {
    if (typeof window === 'undefined') return '/login'
    const params = new URLSearchParams(window.location.search)
    const redirectParam = params.get('redirect')
    const promoParam = params.get('promo') || signupPromoCode
    const redirectWithPromo = redirectParam || (promoParam ? `/dashboard?promo=${encodeURIComponent(promoParam)}` : '')
    return redirectWithPromo ? `/login?redirect=${encodeURIComponent(redirectWithPromo)}` : '/login'
  }

  function getSafeRedirect() {
    const params = new URLSearchParams(window.location.search)
    const redirectParam = params.get('redirect')
    const promoParam = params.get('promo') || signupPromoCode
    if (redirectParam && !redirectParam.includes('\\')) {
      try {
        const url = new URL(redirectParam, window.location.origin)
        if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
          return `${url.pathname}${url.search}${url.hash}`
        }
      } catch {}
    }
    if (promoParam) return `/dashboard?promo=${encodeURIComponent(promoParam)}`
    return '/dashboard'
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedName = displayName.trim()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const redirectTo = getSafeRedirect()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: trimmedName, full_name: trimmedName, marketing_emails: marketingOptIn },
        emailRedirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      router.push(redirectTo)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-none border-2 border-[#123c2f] bg-white p-8 text-center shadow-[6px_6px_0_#d8cab0]">
        <h1 className="mb-4 text-2xl font-bold text-[#0f2f25]">Account created</h1>
        <p className="text-stone-600 mb-4">Check your email to confirm your account, then sign in.</p>
        <Link href={getLoginHref()} className="font-semibold text-[#123c2f] hover:underline">Go to sign in</Link>
      </div>
    )
  }

  return (
    <div className="rounded-none border-2 border-[#123c2f] bg-white p-8 shadow-[6px_6px_0_#d8cab0]">
      {signupPromoCode ? (
        <div className="relative mb-6 overflow-hidden border-2 border-[#123c2f] bg-[#fbf7ed] shadow-[4px_4px_0_#d8cab0]">
          <div className="absolute left-[108px] top-[-10px] hidden h-5 w-5 rounded-full border-2 border-[#123c2f] bg-white sm:block" aria-hidden="true" />
          <div className="absolute bottom-[-10px] left-[108px] hidden h-5 w-5 rounded-full border-2 border-[#123c2f] bg-white sm:block" aria-hidden="true" />
          <div className="grid sm:grid-cols-[118px_1fr]">
            <div className="flex items-center justify-center border-b-2 border-[#123c2f] bg-white px-4 py-4 text-center sm:border-b-0 sm:border-r-2 sm:border-dashed">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">First pool</p>
                <p className="mt-1 text-4xl font-black leading-none text-[#123c2f]">$9</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">cap</p>
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Early pool runner ticket</p>
              <h1 className="mt-1 text-xl font-black uppercase leading-tight tracking-[-0.03em] text-[#0f2f25]">
                Run your first pool for $9.
              </h1>
              <p className="mt-2 text-sm font-semibold leading-5 text-stone-700">
                Saved to your account. Applies at checkout.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">New account</p>
          <h1 className="mb-6 text-2xl font-bold text-[#0f2f25]">Create account</h1>
        </>
      )}
      {joiningPool && (
        <div className="mb-5 border-2 border-[#b58a3a] bg-[#fff4cf] px-4 py-3 text-sm font-semibold leading-6 text-[#1f2a24]">
          You are joining a pool. Create your account here and we will bring you back to finish joining.
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-none mb-4 text-sm border border-red-200">{error}</div>
      )}
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            required
            className="w-full bg-white border border-stone-300 rounded-none px-4 py-3 text-stone-900 focus:outline-none focus:border-[#123c2f] focus:ring-2 focus:ring-[#d8cab0]"
          />
        </div>
        <div>
          <label className="block text-stone-700 text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-stone-300 rounded-none px-4 py-3 text-stone-900 focus:outline-none focus:border-[#123c2f] focus:ring-2 focus:ring-[#d8cab0]"
          />
        </div>
        <PasswordInput label="Password" value={password} onChange={setPassword} />
        <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} />
        <label className="flex items-start gap-3 rounded-none border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={e => setMarketingOptIn(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-[#123c2f] focus:ring-[#123c2f]"
          />
          <span>Send me Golf Pools Pro product updates and tournament reminders. I can unsubscribe later.</span>
        </label>
        <p className="text-xs leading-5 text-stone-500">
          By creating an account, you agree to the <Link href="/terms" className="font-semibold text-[#123c2f] hover:underline">Terms</Link> and <Link href="/privacy" className="font-semibold text-[#123c2f] hover:underline">Privacy Policy</Link>.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#123c2f] hover:bg-[#0f2f25] text-white font-semibold py-3 rounded-none transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p className="text-stone-600 text-sm mt-5 text-center">
        Already have an account?{' '}
        <Link href={getLoginHref()} className="text-[#123c2f] font-semibold hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
