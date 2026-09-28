// Контекстные действия обзора: только то, чего нет в шапке и табах
// (LIVE — в primaryAction шапки, участники — отдельный таб).
// Остальное: объявить (фокус на AnnounceBar) и табло зала.

import Link from "next/link"
import {
  Megaphone,
  MonitorPlay,
} from "lucide-react"

interface QuickActionsProps {
  slug: string | null
  onAnnounce: () => void
}

export default function QuickActions({
  slug,
  onAnnounce,
}: QuickActionsProps) {
  const btn =
    "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-xs font-bold text-dark-text hover:border-primary-blue/40 hover:shadow-sm transition-all cursor-pointer dark:bg-[#0E2035] dark:text-slate-100 dark:hover:border-gold/40"

  return (
    <section
      aria-label="Быстрые действия"
      className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:bg-[#0E2035]"
    >
      <h2 className="mb-2.5 text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
        Быстрые действия
      </h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAnnounce} className={btn}>
          <Megaphone size={15} aria-hidden="true" />
          Объявить
        </button>
        {slug && (
          <Link
            href={`/tournaments/${slug}/board`}
            className={btn}
          >
            <MonitorPlay size={15} aria-hidden="true" />
            Табло
          </Link>
        )}
      </div>
    </section>
  )
}
