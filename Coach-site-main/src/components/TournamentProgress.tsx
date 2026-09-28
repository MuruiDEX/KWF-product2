"use client"

interface TournamentProgressProps {
  total: number
  finished: number
}

/** Тонкий gold-индикатор завершённости турнира. */
export function TournamentProgress({ total, finished }: TournamentProgressProps) {
  if (total <= 0) return null
  const pct = Math.min(100, Math.round((finished / total) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Завершено ${finished} из ${total} боёв`}
      title={`Завершено ${finished} из ${total} боёв`}
    >
      <div className="flex items-center justify-between text-xs font-semibold text-secondary-text mb-1.5">
        <span>Прогресс турнира</span>
        <span className="tabular-nums">
          {finished}/{total} · {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-light-gray border border-border overflow-hidden">
        <div
          className="h-full rounded-full bg-gold transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
