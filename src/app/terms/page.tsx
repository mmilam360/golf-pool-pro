import { BackButton } from '@/components/BackButton'

export default function TermsPage() {
  return (
    <main className="min-h-screen scorecard-paper px-4 py-10 text-[#1f2a24] sm:px-6">
      <div className="mx-auto max-w-3xl rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0] sm:p-8">
        <BackButton fallbackHref="/dashboard" label="Back" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-[#0f2f25]">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated May 11, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-stone-700">
          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Use of the service</h2>
            <p className="mt-2">Golf Pools Pro lets users create golf pools, invite entrants, collect golfer picks, and follow leaderboard scoring. You are responsible for the information you enter and for keeping your account secure.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Golf pool management only</h2>
            <p className="mt-2">Golf Pools Pro is for pool setup, entries, picks, and leaderboard scoring. Any private group arrangements outside those features are the responsibility of the people running that pool.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Pool data and scoring</h2>
            <p className="mt-2">We work to keep tournament fields and scoring accurate, but live sports data can change, lag, or be corrected later. Pool runners should review standings before treating results as final.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Account rules</h2>
            <p className="mt-2">Do not misuse the service, attempt to access other users' accounts, interfere with the site, or enter content that violates the rights of others.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Availability</h2>
            <p className="mt-2">The service may be updated, interrupted, or changed. We are not liable for losses tied to downtime, delayed sports data, user mistakes, or third party services.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Changes</h2>
            <p className="mt-2">We may update these terms. Continued use of Golf Pools Pro after an update means you accept the new terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Contact</h2>
            <p className="mt-2">Questions about these terms can be sent through the support channel listed in the app or on the site.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
