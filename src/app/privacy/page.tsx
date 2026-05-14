import { BackButton } from '@/components/BackButton'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen scorecard-paper px-4 py-10 text-[#1f2a24] sm:px-6">
      <div className="mx-auto max-w-3xl rounded-none border-2 border-[#123c2f] bg-white p-6 shadow-[6px_6px_0_#d8cab0] sm:p-8">
        <BackButton fallbackHref="/dashboard" label="Back" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6724]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-[#0f2f25]">Privacy Policy</h1>
        <p className="mt-2 text-sm text-stone-500">Last updated May 11, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-6 text-stone-700">
          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">What we collect</h2>
            <p className="mt-2">We collect the account details you provide, including your name, email address, password credentials handled by Supabase Auth, pool entries, golfer picks, and pool settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">How we use it</h2>
            <p className="mt-2">We use your information to create accounts, run golf pools, save picks, show leaderboards, send pool invitations when requested, handle password recovery, and maintain the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Email</h2>
            <p className="mt-2">Pool runners may send invitations to email addresses they provide. If you opt in to product updates or tournament reminders, we may email you about Golf Pools Pro. You can unsubscribe from marketing emails at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Vendors</h2>
            <p className="mt-2">We use service providers such as Supabase for authentication and data storage, Vercel for hosting, and email providers when email sending is enabled. They process data only as needed to provide those services.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Pool arrangements stay outside the app</h2>
            <p className="mt-2">Golf Pools Pro only stores the pool setup, entries, picks, and leaderboard data needed to run the board. Private group arrangements stay outside the product.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Data choices</h2>
            <p className="mt-2">You can ask us to update or delete account data when the request is allowed by law and does not interfere with security, fraud prevention, or required records.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#0f2f25]">Contact</h2>
            <p className="mt-2">For privacy requests, contact the Golf Pools Pro operator through the support channel listed in the app or on the site.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
