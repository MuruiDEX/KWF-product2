export default function TournamentsLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="h-3 w-32 rounded bg-light-gray animate-pulse" />
        <div className="h-10 w-64 rounded-lg bg-light-gray animate-pulse mt-3" />
        <div className="h-4 w-80 rounded bg-light-gray animate-pulse mt-3 mb-10" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border p-6 space-y-3"
              aria-hidden="true"
            >
              <div className="h-5 w-24 rounded-full bg-light-gray animate-pulse" />
              <div className="h-6 w-3/4 rounded bg-light-gray animate-pulse" />
              <div className="h-4 w-full rounded bg-light-gray animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-light-gray animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
