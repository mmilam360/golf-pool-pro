'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-none border border-stone-300 bg-white px-4 py-3 pr-12 text-stone-900 focus:border-[#123c2f] focus:outline-none focus:ring-2 focus:ring-[#d8cab0]"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-500 hover:text-[#123c2f]">
          <EyeIcon visible={show} />
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="rounded-none border-2 border-[#123c2f] bg-white p-8 text-center shadow-[6px_6px_0_#d8cab0]">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Password recovery</p>
        <h1 className="mb-4 text-2xl font-bold text-[#0f2f25]">Password updated</h1>
        <p className="mb-5 text-sm text-stone-600">You can now sign in with your new password.</p>
        <Link href="/login" className="font-semibold text-[#123c2f] hover:underline">Go to sign in</Link>
      </div>
    )
  }

  return (
    <div className="rounded-none border-2 border-[#123c2f] bg-white p-8 shadow-[6px_6px_0_#d8cab0]">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Password recovery</p>
      <h1 className="mb-6 text-2xl font-bold text-[#0f2f25]">Choose a new password</h1>

      {error && <div className="mb-4 rounded-none border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput label="New password" value={password} onChange={setPassword} />
        <PasswordInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
        <button type="submit" disabled={loading} className="w-full rounded-none bg-[#123c2f] py-3 font-semibold text-white transition-colors hover:bg-[#0f2f25] disabled:opacity-50">
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
