import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-emerald-400">
            Golf Pool Pro
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors text-sm">
              Dashboard
            </Link>
            <Link href="/pool/create" className="text-zinc-400 hover:text-white transition-colors text-sm">
              Create Pool
            </Link>
            <Link href="/pool/join" className="text-zinc-400 hover:text-white transition-colors text-sm">
              Join Pool
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-zinc-500 hover:text-white transition-colors text-sm">
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
