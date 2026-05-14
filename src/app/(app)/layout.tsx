import Image from 'next/image'
import Link from 'next/link'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pool/join', label: 'Join Pool' },
  { href: '/blog?from=dashboard', label: 'Pick Guides' },
  { href: '/account', label: 'Account' },
]

function SignOutButton({ className = '' }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className={className}>Sign Out</button>
    </form>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <nav className="border-b border-[#d8cab0] bg-[#fbf7ed]/95 px-4 py-3 shadow-sm backdrop-blur-sm md:px-6">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="Golf Pools Pro dashboard">
            <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} className="h-12 w-auto object-contain sm:h-14 md:h-16" />
          </Link>

          <div className="hidden min-w-0 items-center justify-end gap-5 text-sm font-black text-[#123c2f] md:flex">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className="whitespace-nowrap border-b-2 border-transparent py-2 transition-colors hover:border-[#b58a3a] hover:text-[#0f2f25]">
                {link.label}
              </Link>
            ))}
            <Link href="/pool/create" className="whitespace-nowrap border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 font-extrabold text-white transition-colors hover:bg-[#0f2f25]">
              Create Pool
            </Link>
            <SignOutButton className="whitespace-nowrap border-b-2 border-transparent py-2 text-sm font-black text-[#657168] transition-colors hover:border-[#b58a3a] hover:text-[#123c2f]" />
          </div>

          <details className="group md:hidden">
            <summary className="list-none border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white marker:hidden [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-50 border-2 border-[#123c2f] bg-[#fffdf8] p-3 shadow-[5px_5px_0_#d8cab0]">
              <div className="grid gap-1 text-sm font-black text-[#123c2f]">
                <Link href="/dashboard" className="border-b border-[#d8cab0] px-3 py-3">Dashboard</Link>
                <Link href="/pool/create" className="border-2 border-[#123c2f] bg-[#123c2f] px-3 py-3 text-center text-white">Create Pool</Link>
                <Link href="/pool/join" className="border-b border-[#d8cab0] px-3 py-3">Join Pool</Link>
                <Link href="/blog?from=dashboard" className="border-b border-[#d8cab0] px-3 py-3">Pick Guides</Link>
                <Link href="/account" className="border-b border-[#d8cab0] px-3 py-3">Account</Link>
                <SignOutButton className="w-full px-3 py-3 text-left text-sm font-black text-[#657168]" />
              </div>
            </div>
          </details>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-[#d8cab0] bg-[#fbf7ed] px-5 py-5 text-center text-sm text-[#657168]">
        <Link href="/rules" className="font-semibold hover:text-[#123c2f]">Rules</Link>
        <span className="mx-3">/</span>
        <Link href="/blog?from=dashboard" className="font-semibold hover:text-[#123c2f]">Pick Guides</Link>
        <span className="mx-3">/</span>
        <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
        <span className="mx-3">/</span>
        <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
      </footer>
    </div>
  )
}
