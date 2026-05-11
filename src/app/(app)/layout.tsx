import Image from 'next/image'
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <nav className="border-b border-[#d8cab0] bg-[#fbf7ed]/95 px-4 py-4 shadow-sm backdrop-blur-sm md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3" aria-label="Golf Pool Pro dashboard">
            <Image src="/brand/golf-pool-pro-wordmark.png" alt="Golf Pool Pro" width={328} height={101} className="h-8 w-auto object-contain sm:h-10 md:h-11" />
          </Link>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-xs font-semibold sm:gap-2 sm:text-sm md:gap-4">
            <Link href="/dashboard" className="rounded-md px-2 py-2 text-[#4f5b52] transition-colors hover:bg-white hover:text-[#123c2f] sm:px-3">
              Dashboard
            </Link>
            <Link href="/pool/create" className="rounded-md px-2 py-2 text-[#4f5b52] transition-colors hover:bg-white hover:text-[#123c2f] sm:px-3">
              Create
            </Link>
            <Link href="/pool/join" className="rounded-md px-2 py-2 text-[#4f5b52] transition-colors hover:bg-white hover:text-[#123c2f] sm:px-3">
              Join
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="rounded-md px-2 py-2 text-[#657168] transition-colors hover:bg-white hover:text-[#123c2f] sm:px-3">
                <span className="sm:hidden">Out</span>
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
    </div>
  )
}
