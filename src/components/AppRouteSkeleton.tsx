function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#eadfca] ${className}`} />
}

function SkeletonCard() {
  return (
    <div className="border-2 border-[#123c2f] bg-white p-5 shadow-[6px_6px_0_#d8cab0]">
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="mt-3 h-6 w-3/5" />
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <SkeletonLine className="h-12" />
        <SkeletonLine className="h-12" />
        <SkeletonLine className="h-12" />
      </div>
    </div>
  )
}

export function AppRouteSkeleton({ title = 'Loading' }: { title?: string }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label={title}>
      <section className="border-2 border-[#123c2f] bg-[#fbf7ed] p-5 shadow-[7px_7px_0_#d8cab0]">
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="mt-4 h-9 w-64 max-w-full" />
      </section>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}
