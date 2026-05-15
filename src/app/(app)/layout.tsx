import Link from 'next/link'
import AppHeader from '@/components/AppHeader'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scorecard-paper text-[#1f2a24]">
      <AppHeader />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-5 md:px-8 md:py-10">{children}</main>
      <footer className="border-t border-[#d8cab0] bg-[#fbf7ed] px-5 py-5 text-center text-sm text-[#657168]">
        <Link href="/rules" className="font-semibold hover:text-[#123c2f]">Rules</Link>
        <span className="mx-3">/</span>
        <Link href="/blog?from=dashboard" className="font-semibold hover:text-[#123c2f]">Pick Guides</Link>
        <span className="mx-3">/</span>
        <Link href="/help" className="font-semibold hover:text-[#123c2f]">Help</Link>
        <span className="mx-3">/</span>
        <Link href="/privacy" className="font-semibold hover:text-[#123c2f]">Privacy Policy</Link>
        <span className="mx-3">/</span>
        <Link href="/terms" className="font-semibold hover:text-[#123c2f]">Terms</Link>
      </footer>
    </div>
  )
}
