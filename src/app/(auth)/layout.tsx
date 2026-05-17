import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 text-stone-900 scorecard-paper">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 block w-fit" aria-label="Golf Pools Pro home">
          <Image unoptimized src="/brand/golf-pools-pro-wordmark.png" alt="Golf Pools Pro" width={1660} height={695} priority className="h-20 w-auto object-contain" />
        </Link>
        {children}
        <p className="mt-6 text-center text-xs text-stone-500">
          <Link href="/rules" className="font-semibold text-[#123c2f] hover:underline">Rules</Link>
          <span className="mx-2">/</span>
          <Link href="/privacy" className="font-semibold text-[#123c2f] hover:underline">Privacy Policy</Link>
          <span className="mx-2">/</span>
          <Link href="/terms" className="font-semibold text-[#123c2f] hover:underline">Terms</Link>
        </p>
        <p className="mt-3 text-center text-xs text-stone-500">© {new Date().getFullYear()} Golf Pools Pro. All rights reserved.</p>
      </div>
    </div>
  )
}
