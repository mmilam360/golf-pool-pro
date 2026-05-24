'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', match: ['/dashboard'] },
  { href: '/manage-pools', label: 'Manage Pools', match: ['/manage-pools'] },
  { href: '/account', label: 'Account', match: ['/account'] },
  { href: '/blog?from=dashboard', label: 'Pick Guides', match: ['/blog'], secondary: true },
]

type NavLink = typeof navLinks[number]

function isActive(pathname: string, matches: string[]) {
  return matches.some(match => pathname === match || pathname.startsWith(`${match}/`))
}

function activeClasses(active: boolean, link?: NavLink) {
  if (link?.secondary) {
    if (active) {
      return 'border-[#d8cab0] text-[#4f6258]'
    }

    return 'border-transparent text-[#7b857d] hover:border-[#d8cab0] hover:text-[#4f6258]'
  }

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
                className={`whitespace-nowrap border-b-2 px-2 py-2 transition-colors ${link.secondary ? 'text-sm font-normal' : ''} ${activeClasses(active, link)}`}
              >
                {link.label}
              </Link>
            )
          })}
          <SignOutButton className="whitespace-nowrap border-b-2 border-transparent px-2 py-2 text-sm font-normal text-[#7b857d] transition-colors hover:border-[#d8cab0] hover:text-[#4f6258]" />
        </div>

        <details className="group md:hidden" open={menuOpen} onToggle={event => setMenuOpen(event.currentTarget.open)}>
          <summary className="list-none border-2 border-[#123c2f] bg-[#123c2f] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white marker:hidden [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-[200] border-2 border-[#123c2f] bg-[#fffdf8] p-3 shadow-[5px_5px_0_#d8cab0]">
            <div className="grid text-sm font-black text-[#123c2f]">
              {navLinks.map(link => {
                const active = isActive(pathname, link.match)

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={closeMenu}
                    className={`${link.secondary ? 'px-6 py-3 text-sm font-normal text-[#7b857d]' : 'border-b border-[#d8cab0] px-6 py-4'} ${active ? link.secondary ? 'text-[#4f6258] shadow-[inset_4px_0_0_#d8cab0]' : 'bg-[#fbf7ed] text-[#123c2f] shadow-[inset_4px_0_0_#b58a3a]' : ''}`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <SignOutButton className="w-full px-6 py-3 text-left text-sm font-normal text-[#7b857d]" />
            </div>
          </div>
        </details>
      </div>
    </nav>
  )
}
