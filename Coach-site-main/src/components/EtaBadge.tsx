"use client"

import { Clock } from "lucide-react"

/** Бейдж «через сколько начнётся бой». eta_seconds — оценка backend. */
export function EtaBadge({ etaSeconds }: { etaSeconds: number | null | undefined }) {
  if (etaSeconds === null || etaSeconds === undefined) return null
  const label =
    etaSeconds <= 0
      ? "следующий"
      : etaSeconds < 60
        ? "меньше минуты"
        : `~${Math.max(1, Math.round(etaSeconds / 60))} мин`
  return (
    <span
      title="Ориентировочное время до начала боя"
      className="inline-flex items-center gap-1 rounded-full bg-primary-blue/10 text-primary-blue text-[11px] font-bold px-2 py-0.5 tabular-nums whitespace-nowrap dark:bg-blue-400/15 dark:text-blue-300"
    >
      <Clock size={11} className="shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}
