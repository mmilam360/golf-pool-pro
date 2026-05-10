export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen scorecard-paper flex items-center justify-center px-4 py-10 text-stone-900">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
