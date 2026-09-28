/** D1: скелетон карточки списка (турниры/новости) вместо спиннера. */
export function SkeletonCard({ withImage = false }: { withImage?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-border bg-white overflow-hidden dark:bg-[#0E2035]"
    >
      {withImage && <div className="aspect-video bg-light-gray animate-pulse dark:bg-white/[0.06]" />}
      <div className="p-6 space-y-3">
        <div className="h-3 w-24 rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
        <div className="h-5 w-3/4 rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
        <div className="h-4 w-full rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
        <div className="h-4 w-1/2 rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
      </div>
    </div>
  )
}

/** D1: сетка скелетонов (a11y: один role=status на контейнер). */
export function SkeletonGrid({
  count = 6,
  withImage = false,
  label = "Загрузка…",
}: {
  count?: number
  withImage?: boolean
  label?: string
}) {
  return (
    <div role="status" aria-label={label}>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} withImage={withImage} />
        ))}
      </div>
    </div>
  )
}
