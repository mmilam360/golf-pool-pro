'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', match: ['/dashboard'] },
  { href: '/pool/join', label: 'Join Pool', match: ['/pool/join'] },
  { href: '/blog?from=dashboard', label: 'Pick Guides', match: ['/blog'] },
  { href: '/pool/create', label: 'Create Pool', match: ['/pool/create'] },
  { href: '/manage-pools', label: 'Manage Pools', match: ['/manage-pools'] },
  { href: '/account', label: 'Account', match: ['/account'] },
]

function isActive(pathname: string, matches: string[]) {
  return matches.some(match => pathname === match || pathname.startsWith(`${match}/`))
}

function activeClasses(active: boolean) {
  if (active) {
    return 'border-[#b58a3a] text-[#123c2f]'
  }

  return 'border-transparent text-[#123c2f] hover:border-[#b58a3a] hover:text-[#0f2f25]'
}

function SignOutButton({ className = '' }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit" className={className}>Sign Out</button>
    </form>
  )
}

export default function AppHeader() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="relative z-[100] border-b border-[#d8cab0] bg-[#fbf7ed]/95 px-4 py-3 shadow-sm backdrop-blur-sm md:px-6">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="Golf Pools Pro dashboard">
          <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} className="h-12 w-auto object-contain sm:h-14 md:h-16" />
        </Link>

        <div className="hidden min-w-0 items-center justify-end gap-2 text-sm font-black text-[#123c2f] md:flex">
          {navLinks.map(link => {
            const active = isActive(pathname, link.match)

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 px-2 py-2 transition-colors ${activeClasses(active)}`}
              >
                {link.label}
              </Link>
            )
          })}
          <SignOutButton className="whitespace-nowrap border-b-2 border-transparent px-2 py-2 text-sm font-black text-[#657168] transition-colors hover:border-[#b58a3a] hover:text-[#123c2f]" />
        </div>

        <details className="group md:hidden" open={menuOpen} onToggle={event => setMenuOpen(event.currentTarget.open)}>
          <summary className="list-none border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white marker:hidden [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-[200] border-2 border-[#123c2f] bg-[#fffdf8] p-3 shadow-[5px_5px_0_#d8cab0]">
            <div className="grid gap-1 text-sm font-black text-[#123c2f]">
              {navLinks.map(link => {
                const active = isActive(pathname, link.match)

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={closeMenu}
                    className={`flex items-center justify-between border px-3 py-3 ${active ? 'border-[#b58a3a] bg-[#fbf7ed] text-[#123c2f]' : 'border-transparent border-b-[#d8cab0]'}`}
                  >
                    <span>{link.label}</span>
                    <span className={`h-3 w-3 border border-[#123c2f] ${active ? 'bg-[#b93a32]' : 'bg-transparent'}`} aria-hidden="true" />
                  </Link>
                )
              })}
              <SignOutButton className="w-full border border-transparent px-3 py-3 text-left text-sm font-black text-[#657168]" />
            </div>
          </div>
        </details>
      </div>
    </nav>
  )
}
