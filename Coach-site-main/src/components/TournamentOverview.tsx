// Phase 3: публичный overview турнира из уже загруженного payload.
// Никаких новых запросов: участники/бои/чемпионы считаются из categories.
// Клубы показываем только если поле club реально пришло (анонимно backend
// отдаёт PublicAthleteSerializer без клуба — цифру не выдумываем).

import { Medal } from "lucide-react"
import type { Tournament } from "@/lib/types"
import { championOf } from "@/lib/bracketUtils"
import { TournamentProgress } from "@/components/TournamentProgress"

interface Tile {
  value: string
  label: string
}

export function tournamentStats(t: Tournament): {
  participants: number
  clubs: number | null
  categories: number
  fights: number
  finished: number
} {
  const ids = new Set<number>()
  const clubs = new Set<string>()
  let hasClubField = false
  let fights = 0
  let finished = 0
  for (const cat of t.categories ?? []) {
    for (const a of cat.athletes ?? []) {
      ids.add(a.id)
      if (typeof a.club === "string" && a.club.trim()) {
        hasClubField = true
        clubs.add(a.club.trim())
      }
    }
    for (const r of cat.rounds ?? []) {
      for (const m of r.matches ?? []) {
        if (m.status === "bye") continue
        fights += 1
        if (m.status === "finished") finished += 1
      }
    }
  }
  return {
    participants: ids.size,
    clubs: hasClubField ? clubs.size : null,
    categories: (t.categories ?? []).length,
    fights,
    finished,
  }
}

export default function TournamentOverview({ tournament }: { tournament: Tournament }) {
  const stats = tournamentStats(tournament)
  const tiles: Tile[] = [
    { value: String(stats.participants), label: "Участников" },
    ...(stats.clubs !== null
      ? [{ value: String(stats.clubs), label: "Клубов" }]
      : []),
    { value: String(stats.categories), label: "Категорий" },
    { value: String(stats.fights), label: "Боёв" },
  ]
  if (typeof tournament.mats_count === "number" && tournament.mats_count > 0) {
    tiles.push({ value: String(tournament.mats_count), label: "Татами" })
  }

  const champions = (tournament.categories ?? []).flatMap((cat) => {
    const name = championOf(
      [...(cat.rounds ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((r) => ({
          matches: [...(r.matches ?? [])]
            .sort((a, b) => a.match_number - b.match_number)
            .map((m) => ({
              winnerId: m.winner,
              winnerName: m.winner_name,
              athlete1: { id: m.athlete1, name: m.athlete1_name },
              athlete2: { id: m.athlete2, name: m.athlete2_name },
            })),
        }))
    )
    return name ? [{ category: cat.name, name }] : []
  })

  return (
    <section aria-label="Обзор турнира" className="mb-8">
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-border bg-light-gray px-4 py-4 text-center"
          >
            <dd className="text-2xl font-extrabold text-dark-text tabular-nums">
              {tile.value}
            </dd>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary-text mt-1">
              {tile.label}
            </dt>
          </div>
        ))}
      </dl>
      {stats.fights > 0 && (
        <div className="max-w-md mt-4">
          <TournamentProgress total={stats.fights} finished={stats.finished} />
        </div>
      )}
      {champions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gold/40 bg-gold-soft/40 dark:bg-gold/10 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-secondary-text mb-3 inline-flex items-center gap-2">
            <Medal size={15} className="text-gold-deep" aria-hidden="true" />
            Победители
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {champions.map((c) => (
              <li key={c.category} className="text-sm min-w-0">
                <span className="font-bold text-dark-text">{c.name}</span>
                <span className="text-secondary-text"> · {c.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
