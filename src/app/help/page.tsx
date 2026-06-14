import type { Metadata } from 'next'
import Link from 'next/link'
import { BackButton } from '@/components/BackButton'
import { HelpRequestForm } from '@/components/HelpRequestForm'

export const metadata: Metadata = {
  title: 'Help and Support | Golf Pools Pro',
  description: 'Get help with Golf Pools Pro, send a support question, or request a feature for your golf pool.',
  alternates: { canonical: 'https://www.golfpoolspro.com/help' },
}

const helpTopics = [
  {
    title: 'Joining a pool',
    body: 'Use the invite link from your host, or enter the 6-character passcode on Join a pool. If you need to sign in first, Golf Pools Pro brings you back to the pool after login.',
  },
  {
    title: 'Making picks',
    body: 'Open the pool, go to My Entry, choose your golfers, and save before picks lock. Open Picks uses the full field. Tiered Picks and Clubhouse Chaos open after groups lock.',
  },
  {
    title: 'When picks lock',
    body: 'Entries and picks lock automatically before the first tee time. Grouped pools lock groups earlier, usually Tuesday morning ET once the official field is ready.',
  },
  {
    title: 'Open Picks',
    body: 'Players pick from the full tournament field. The default setup is 12 picks with the best 8 scores counting. If the official field changes before lock, removed golfers drop off open entries so players can replace them.',
  },
  {
    title: 'Tiered Picks',
    body: 'The field is sorted by World Golf Ranking, then divided into the number of tiers the pool runner sets. Players pick the same number from each tier.',
  },
  {
    title: 'Clubhouse Chaos',
    body: 'The field is shuffled once with a fixed seed, then divided into groups. Everyone gets the same shuffled groups and picks the same number from each group.',
  },
  {
    title: 'Cuts, withdrawals, and OB',
    body: 'CUT, WD, DNQ, DNF, and DQ picks can become OB stand-ins when they are needed for counted scores. The app uses the worst active counted score in the pool plus the pool OB penalty.',
  },
  {
    title: 'Leaderboard updates',
    body: 'Live boards refresh during tournament play from PGA scoring data. If a board looks quiet before Thursday, that usually means scoring has not started yet.',
  },
  {
    title: 'Poster and invites',
    body: 'Pool runners can copy an invite link, share a passcode, invite previous players, or make a signup poster with a QR code from Pool Settings.',
  },
  {
    title: 'App install',
    body: 'Golf Pools Pro is a Progressive Web App. Install it from your browser if you want it on your phone like an app.',
  },
]

export default function HelpPage() {
  return (
    <main className="min-h-screen scorecard-paper px-4 py-10 text-[#1f2a24] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <BackButton fallbackHref="/dashboard" label="Back" />

        <section className="mt-2 border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
          <div className="border-b border-[#d8cab0] bg-[#123c2f] px-6 py-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f3df9c]">Help</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Need help with a pool?</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#f5ead0]">
              Send the question here. Include the email where you want a reply, and I will follow up manually.
            </p>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.95fr_1.25fr] lg:items-start">
            <div className="space-y-4">
              <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4">
                <h2 className="text-lg font-black text-[#123c2f]">Before you send it</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">
                  Include the pool name, passcode, or tournament.
                </p>
              </div>

              <div className="grid gap-3">
                {helpTopics.map(topic => (
                  <section key={topic.title} className="border border-[#d8cab0] bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#8a6724]">{topic.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">{topic.body}</p>
                  </section>
                ))}
              </div>

              <div className="border border-[#d8cab0] bg-[#fbf7ed] p-4 text-sm font-semibold leading-6 text-stone-700">
                <p className="font-black text-[#123c2f]">Useful links</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  <Link href="/rules" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Rules</Link>
                  <Link href="/account" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Account</Link>
                  <Link href="/pool/join" className="font-black text-[#123c2f] underline decoration-[#b58a3a] underline-offset-4">Join a pool</Link>
                </div>
              </div>
            </div>

            <HelpRequestForm />
          </div>
        </section>
      </div>
    </main>
  )
}
