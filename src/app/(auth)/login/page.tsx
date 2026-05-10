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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
      router.push(redirectTo)
    }
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800">
      <h1 className="text-2xl font-bold text-white mb-6">Sign In</h1>
      {error && (
        <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-zinc-400 text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-sm mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 pr-10 text-white focus:outline-none focus:border-emerald-500"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
              <EyeIcon visible={showPassword} />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="text-zinc-500 text-sm mt-4 text-center">
        No account?{' '}
        <Link href="/signup" className="text-emerald-400 hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
