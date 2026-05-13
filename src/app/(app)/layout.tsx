import Image from 'next/image'
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <nav className="border-b border-[#d8cab0] bg-[#fbf7ed]/95 px-4 py-4 shadow-sm backdrop-blur-sm md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3" aria-label="Golf Pools Pro dashboard">
            <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} className="h-14 w-auto object-contain sm:h-16 md:h-20" />
          </Link>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-xs font-semibold sm:gap-2 sm:text-sm md:gap-4">
            <Link href="/dashboard" className="border border-transparent px-2 py-2 text-[#4f5b52] transition-colors hover:border-[#d8cab0] hover:bg-white hover:text-[#123c2f] sm:px-3">
              Dashboard
            </Link>
            <Link href="/pool/create" className="border border-transparent px-2 py-2 text-[#4f5b52] transition-colors hover:border-[#d8cab0] hover:bg-white hover:text-[#123c2f] sm:px-3">
              Create
            </Link>
            <Link href="/pool/join" className="border border-transparent px-2 py-2 text-[#4f5b52] transition-colors hover:border-[#d8cab0] hover:bg-white hover:text-[#123c2f] sm:px-3">
              Join
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="border border-transparent px-2 py-2 text-[#657168] transition-colors hover:border-[#d8cab0] hover:bg-white hover:text-[#123c2f] sm:px-3">
                <span className="sm:hidden">Out</span>
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-[#d8cab0] px-5 py-5 text-center text-sm text-[#657168]">
        <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
        <span className="mx-3">/</span>
        <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
      </footer>
    </div>
  )
}
