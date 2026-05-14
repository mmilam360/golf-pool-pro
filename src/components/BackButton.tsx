'use client'

import { useRouter } from 'next/navigation'

type BackButtonProps = {
  fallbackHref?: string
  label?: string
  className?: string
}

export function BackButton({ fallbackHref = '/dashboard', label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter()

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`mb-4 inline-flex items-center gap-2 border-2 border-[#123c2f] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#123c2f] transition-colors hover:bg-[#fbf7ed] ${className}`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
      {label}
    </button>
  )
}
