'use client'

import { useEffect } from 'react'

export default function GuestEntryLocalResume({ poolId }: { poolId: string }) {
  useEffect(() => {
    let nextPath = '/pool/join'
    try {
      const stored = window.localStorage.getItem(`gpp_guest_entry:${poolId}`)
      const parsed = stored ? JSON.parse(stored) : null
      const token = typeof parsed?.token === 'string' ? parsed.token : ''
      if (token) nextPath = `/pool/${poolId}?guest=${encodeURIComponent(token)}`
    } catch {
      nextPath = '/pool/join'
    }
    window.location.replace(nextPath)
  }, [poolId])

  return (
    <div className="mx-auto max-w-md border-2 border-[#123c2f] bg-white p-5 text-center shadow-[6px_6px_0_#d8cab0]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Checking this browser</p>
      <h1 className="mt-1 text-2xl font-black text-[#123c2f]">Opening your entry</h1>
      <p className="mt-2 text-sm font-semibold text-[#657168]">If this browser saved your guest entry, we’ll take you back to it.</p>
    </div>
  )
}
