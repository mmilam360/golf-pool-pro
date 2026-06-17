'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function GuestEntryLocalResume({ poolId }: { poolId: string }) {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`gpp_guest_entry:${poolId}`)
      const parsed = stored ? JSON.parse(stored) : null
      const token = typeof parsed?.token === 'string' ? parsed.token : ''
      if (token) {
        window.location.replace(`/pool/${poolId}?guest=${encodeURIComponent(token)}`)
        return
      }
    } catch {
      // Same-browser recovery is best effort.
    }
    setChecked(true)
  }, [poolId])

  return (
    <div className="mx-auto max-w-md border-2 border-[#123c2f] bg-white p-5 text-center shadow-[6px_6px_0_#d8cab0]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6724]">Checking this browser</p>
      <h1 className="mt-1 text-2xl font-black text-[#123c2f]">Opening your entry</h1>
      {checked ? (
        <>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#657168]">
            I couldn’t find a saved guest entry on this browser. Use your saved email link, or enter the pool code again.
          </p>
          <Link href="/pool/join" className="mt-4 inline-block border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black text-white hover:bg-[#0f2f25]">
            Join pool
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[#657168]">If this browser saved your guest entry, we’ll take you back to it.</p>
      )}
    </div>
  )
}
