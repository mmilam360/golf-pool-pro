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
    body: 'Use the passcode or invite link from your pool runner. If the code does not work, check that the pool is still open.',
  },
  {
    title: 'Making picks',
    body: 'Open the pool, go to My Team, choose your golfers, and save before the pool locks or the tournament starts.',
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
                  If the issue is tied to one pool, include the pool name, passcode, or tournament. That makes it much easier to find the right spot.
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
