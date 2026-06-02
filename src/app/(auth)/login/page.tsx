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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signupHref, setSignupHref] = useState('/signup')
  const [joiningPool, setJoiningPool] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const redirectParam = new URLSearchParams(window.location.search).get('redirect')
    setSignupHref(redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : '/signup')
    setJoiningPool(Boolean(redirectParam?.startsWith('/pool/join')))
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
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
      router.replace(redirectTo)
    }
  }

  return (
    <div className="rounded-none border-2 border-[#123c2f] bg-white p-8 shadow-[6px_6px_0_#d8cab0]">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Account login</p>
      <h1 className="mb-6 text-2xl font-bold text-[#0f2f25]">Sign in</h1>
      {joiningPool && (
        <div className="mb-5 border-2 border-[#b58a3a] bg-[#fff4cf] px-4 py-3 text-sm font-semibold leading-6 text-[#1f2a24]">
          You are joining a pool. Sign in here and we will bring you back to finish joining.
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-none mb-4 text-sm border border-red-200">{error}</div>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
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
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-stone-700 text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs font-semibold text-[#123c2f] hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-white border border-stone-300 rounded-none px-4 py-3 pr-12 text-stone-900 focus:outline-none focus:border-[#123c2f] focus:ring-2 focus:ring-[#d8cab0]"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-[#123c2f] p-2">
              <EyeIcon visible={showPassword} />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#123c2f] hover:bg-[#0f2f25] text-white font-semibold py-3 rounded-none transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="text-stone-600 text-sm mt-5 text-center">
        No account?{' '}
        <Link href={signupHref} className="text-[#123c2f] font-semibold hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
