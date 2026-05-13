import Image from 'next/image'
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <nav className="border-b border-[#d8cab0] bg-[#fbf7ed]/95 px-4 py-4 shadow-sm backdrop-blur-sm md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3" aria-label="Golf Pools Pro dashboard">
            <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} className="h-14 w-auto object-contain sm:h-16 md:h-20" />
          </Link>
          <div className="grid min-w-0 grid-cols-2 gap-2 text-center text-xs font-black uppercase tracking-[0.08em] sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:text-sm sm:normal-case sm:tracking-normal">
            <Link href="/dashboard" className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-white transition-colors hover:bg-[#0f2f25]">
              Dashboard
            </Link>
            <Link href="/pool/create" className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-white transition-colors hover:bg-[#0f2f25]">
              Create
            </Link>
            <Link href="/pool/join" className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-white transition-colors hover:bg-[#0f2f25]">
              Join
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="w-full border-2 border-[#123c2f] bg-[#123c2f] px-3 py-2 text-white transition-colors hover:bg-[#0f2f25]">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-[#d8cab0] bg-[#fbf7ed] px-5 py-5 text-center text-sm text-[#657168]">
        <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
        <span className="mx-3">/</span>
        <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
      </footer>
    </div>
  )
}
