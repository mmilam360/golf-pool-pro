import Image from 'next/image'
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f3ea] text-stone-900">
      <nav className="bg-white/90 border-b border-stone-200 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 text-xl font-bold text-emerald-800">
            <Image src="/brand/golf-pool-pro-logo.png" alt="Golf Pool Pro" width={180} height={180} className="h-12 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-stone-600 hover:text-emerald-800 transition-colors text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/pool/create" className="text-stone-600 hover:text-emerald-800 transition-colors text-sm font-medium">
              Create Pool
            </Link>
            <Link href="/pool/join" className="text-stone-600 hover:text-emerald-800 transition-colors text-sm font-medium">
              Join Pool
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-stone-500 hover:text-emerald-800 transition-colors text-sm font-medium">
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
