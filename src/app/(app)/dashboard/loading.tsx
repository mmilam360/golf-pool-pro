export default function DashboardLoading() {
  return (
    <div className="space-y-4 sm:space-y-8" aria-label="Loading dashboard">
      <section className="hidden border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0] sm:block">
        <div className="border-b border-[#d8cab0] bg-[#fbf7ed] p-5 md:p-7">
          <div className="h-10 w-72 max-w-full bg-[#eadfca]" />
        </div>
      </section>

      <section className="border-2 border-[#123c2f] bg-white shadow-[7px_7px_0_#d8cab0]">
        <div className="border-b border-[#d8cab0] bg-[#123c2f] px-3 py-2 sm:px-5 sm:py-3">
          <div className="h-4 w-28 bg-[#d7c99f]" />
        </div>
        <div className="divide-y divide-[#eadfca]">
          {[0, 1, 2].map(item => (
            <div key={item} className="px-3 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 border border-[#123c2f] bg-[#fbf7ed]" />
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-2/3 bg-[#eadfca]" />
                  <div className="mt-2 h-3 w-40 bg-[#f0e6d4]" />
                </div>
                <div className="h-8 w-20 border border-[#d8cab0] bg-[#fbf7ed]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
