import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 text-stone-900 scorecard-paper">
      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 block w-fit" aria-label="Golf Pool Pro home">
          <Image src="/brand/golf-pool-pro-wordmark.png" alt="Golf Pool Pro" width={328} height={101} priority className="h-11 w-auto object-contain" />
        </Link>
        {children}
        <p className="mt-6 text-center text-xs text-stone-500">
          <Link href="/privacy" className="font-semibold text-emerald-800 hover:underline">Privacy Policy</Link>
          <span className="mx-2">/</span>
          <Link href="/terms" className="font-semibold text-emerald-800 hover:underline">Terms</Link>
        </p>
      </div>
    </div>
  )
}
