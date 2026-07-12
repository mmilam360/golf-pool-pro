import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import SignupPage from '@/app/(auth)/signup/page'
import { FirstPoolCampaignLink, FirstPoolCampaignTracker } from '@/components/FirstPoolCampaignTracker'
import { FirstPoolValueSection } from '@/components/FirstPoolValueSection'

export const metadata: Metadata = {
  title: 'First pool capped at $9 | Golf Pools Pro',
  description: 'A newer mobile golf pool app for pool runners. First pool capped at $9 with live leaderboards, invite links, PGA scoring, and clear pool rules.',
  alternates: {
    canonical: 'https://www.golfpoolspro.com/first-pool-9',
  },
  robots: {
    index: false,
    follow: true,
  },
}

const boardRows: Array<[string, string, string, string[]]> = [
  ['1', 'Lonnie', '-26', ['Scheffler -8', 'McIlroy -7', 'Schauffele -6']],
  ['2', 'Jeff', '-25', ['McIlroy -7', 'Scheffler -8', 'Cantlay -5']],
  ['3', 'Dan M', '-21', ['Schauffele -6', 'Morikawa -5', 'Åberg -2']],
]

function MiniLeaderboard() {
  return (
    <div className="gpp-3d mx-auto max-w-xl [--gpp-depth-x:14px] [--gpp-depth-y:10px]">
      <div className="gpp-board-depth-right" />
      <div className="gpp-board-depth-bottom" />
      <div className="gpp-3d-face gpp-board-frame p-3 text-white sm:p-4">
        <div className="border-4 border-[#d8b45d] bg-[#fbf7ed] p-2 text-[#1f2a24] shadow-[inset_0_0_0_2px_rgba(18,60,47,0.12)] sm:p-3">
          <div className="mb-2 flex items-end justify-between border-b-2 border-[#123c2f] pb-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Live pool board</p>
              <p className="font-display text-2xl text-[#123c2f] sm:text-3xl">Tiger&apos;s Tribe</p>
            </div>
            <span className="border-2 border-[#b21e23] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#b21e23]">Live</span>
          </div>
          <div className="space-y-2">
            {boardRows.map(row => (
              <div key={row[0]} className="grid grid-cols-[34px_1fr_56px] items-center gap-2 border-2 border-[#123c2f] bg-white px-2 py-2 text-sm sm:grid-cols-[42px_1fr_64px]">
                <div className="text-center font-black text-[#8a6724]">#{row[0]}</div>
                <div className="min-w-0">
                  <p className="truncate font-black uppercase text-[#123c2f]">{row[1]}</p>
                  <p className="truncate text-[11px] font-semibold text-stone-600">{row[3].join(' · ')}</p>
                </div>
                <div className="text-right font-display text-xl text-[#b21e23]">{row[2]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DiscountTicket() {
  return (
    <div className="relative overflow-hidden border-2 border-[#123c2f] bg-[#fbf7ed] shadow-[4px_4px_0_#d8cab0]">
      <div className="absolute left-[118px] top-[-10px] hidden h-5 w-5 rounded-full border-2 border-[#123c2f] bg-white sm:block" aria-hidden="true" />
      <div className="absolute bottom-[-10px] left-[118px] hidden h-5 w-5 rounded-full border-2 border-[#123c2f] bg-white sm:block" aria-hidden="true" />
      <div className="grid sm:grid-cols-[128px_1fr]">
        <div className="flex items-center justify-center border-b-2 border-[#123c2f] bg-white px-4 py-5 text-center sm:border-b-0 sm:border-r-2 sm:border-dashed">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">First pool</p>
            <p className="mt-1 text-5xl font-black leading-none text-[#123c2f]">$9</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">cap</p>
          </div>
        </div>
        <div className="px-4 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6724]">Facebook pool runner offer</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#0f2f25] sm:text-4xl">Try it for one tournament.</h2>
          <p className="mt-2 text-sm font-semibold leading-5 text-stone-700">Your first pool is capped at $9. The offer saves to your account and applies at checkout.</p>
        </div>
      </div>
    </div>
  )
}

export default function FirstPoolNinePage() {
  return (
    <main className="min-h-screen scorecard-paper text-[#1f2a24]">
      <FirstPoolCampaignTracker />
      <header className="border-b border-[#d8cab0] bg-[#fbf7ed]/95">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link href="/" aria-label="Golf Pools Pro home" className="flex items-center gap-3">
            <Image unoptimized src="/brand/golf-pools-pro-wordmark.d3f016dcc364.webp" alt="Golf Pools Pro" width={640} height={268} preload className="h-14 w-auto object-contain sm:h-16" />
          </Link>
          <Link href="/login" className="border border-[#123c2f] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#123c2f] hover:bg-[#f7f0df]">
            Sign in
          </Link>
        </nav>
      </header>

      <section data-campaign-section="hero" className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-14">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#8a6724]">For golf pool runners</p>
          <h1 className="font-display text-5xl leading-[0.92] text-[#123c2f] sm:text-6xl lg:text-7xl">
            Make your golf pool feel live.
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-7 text-stone-700">
            Run your next major or weekend PGA pool from one clean mobile leaderboard. Players make picks, you share the link, and scoring updates as the tournament moves.
          </p>
          <div className="mt-6 max-w-xl">
            <DiscountTicket />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <FirstPoolCampaignLink href="#signup" location="hero" className="border-2 border-[#123c2f] bg-[#123c2f] px-5 py-3 text-center font-black uppercase tracking-[0.08em] text-white hover:bg-[#0f2f25]">
              Start with the $9 offer
            </FirstPoolCampaignLink>
          </div>
        </div>
        <div className="flex items-center" data-campaign-section="leaderboard-preview">
          <MiniLeaderboard />
        </div>
      </section>

      <FirstPoolValueSection offerCapDollars={9} />

      <section data-campaign-section="signup" id="signup" className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-14">
        <div className="flex flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6724]">Claim the offer</p>
          <h2 className="mt-2 font-display text-4xl leading-none text-[#123c2f] sm:text-5xl">First pool capped at $9.</h2>
          <p className="mt-4 text-base font-semibold leading-7 text-stone-700">
            Create the account here. The offer follows you into the dashboard and applies when your first pool checks out.
          </p>
          <ul className="mt-5 space-y-2 text-sm font-semibold text-stone-700">
            <li className="border-l-4 border-[#d8b45d] pl-3">No code to remember.</li>
            <li className="border-l-4 border-[#d8b45d] pl-3">Players join free.</li>
            <li className="border-l-4 border-[#d8b45d] pl-3">You only pay after entries lock.</li>
          </ul>
        </div>
        <div>
          <SignupPage defaultPromoCode="FIRSTPOOL9" promoSource="first-pool-9" />
        </div>
      </section>
    </main>
  )
}
