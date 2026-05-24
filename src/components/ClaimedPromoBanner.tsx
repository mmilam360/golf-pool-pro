'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type ClaimedPromo = {
  code: string
  label: string
}

export default function ClaimedPromoBanner() {
  const [promo, setPromo] = useState<ClaimedPromo | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const promoCode = params.get('promo')
    const request = promoCode
      ? fetch('/api/promos/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode, source: 'signup-link' }),
      })
      : fetch('/api/promos/claim')

    request
      .then(async res => {
        if (!res.ok) return null
        return res.json()
      })
      .then(data => {
        if (data?.claimedPromo) setPromo(data.claimedPromo)
      })
      .catch(() => {})
  }, [])

  if (!promo) return null

  return (
    <section className="border-2 border-[#b58a3a] bg-[#fff4cf] p-5 shadow-[7px_7px_0_#d8cab0] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a5a19]">Early pool runner offer</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#0f2f25]">{promo.label}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#4d5a51]">No code to remember. We will apply it automatically at checkout on your first pool.</p>
        </div>
        <Link href="/pool/create" className="inline-flex shrink-0 justify-center border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white hover:bg-[#0f2f25]">
          Start a pool
        </Link>
      </div>
    </section>
  )
}
