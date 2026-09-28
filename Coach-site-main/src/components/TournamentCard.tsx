// Phase 3: общая карточка турнира для публичных лент (home: upcoming/results).
// Только поля list-сериализатора: name/slug/dates/location/status/mats/categories_count.

import Link from "next/link"
import { CalendarDays, MapPin } from "lucide-react"
import type { Tournament } from "@/lib/types"
import StatusPill from "@/components/ui/StatusPill"

export function formatTournamentRange(t: Tournament): string {
  const s = new Date(`${t.start_date}T00:00:00`)
  const e = new Date(`${t.end_date}T00:00:00`)
  if (Number.isNaN(s.getTime())) return ""
  const opts = { day: "numeric", month: "long" } as const
  if (!Number.isNaN(e.getTime()) && t.end_date !== t.start_date) {
    return `${s.toLocaleDateString("ru-RU", opts)} — ${e.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}`
  }
  return s.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

export default function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link
      href={`/tournaments/${tournament.slug}`}
      aria-label={`Турнир: ${tournament.name}`}
      className="rounded-2xl border border-border bg-white p-6 hover:shadow-lg hover:-translate-y-1 hover:border-primary-blue/25 transition-all duration-300 h-full flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/60"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <StatusPill status={tournament.status} />
        {typeof tournament.categories_count === "number" && tournament.categories_count > 0 && (
          <span className="text-xs font-semibold text-secondary-text">
            Категорий: {tournament.categories_count}
          </span>
        )}
      </div>
      <h3 className="text-xl font-bold text-dark-text mb-2 text-balance">
        {tournament.name}
      </h3>
      {tournament.description && (
        <p className="text-sm text-secondary-text line-clamp-2 mb-4">
          {tournament.description}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-1.5 text-xs text-secondary-text pt-2">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden="true" />
          {formatTournamentRange(tournament)}
        </span>
        {tournament.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} aria-hidden="true" />
            {tournament.location}
          </span>
        )}
      </div>
    </Link>
  )
}
