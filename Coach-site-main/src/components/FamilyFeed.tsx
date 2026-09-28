"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Swords } from "lucide-react"
import EmptyState from "@/components/ui/EmptyState"
import StatusPill from "@/components/ui/StatusPill"
import type { Match } from "@/lib/types"
import { formatTatamiName } from "@/lib/display"

export interface FeedAthlete {
  id: number
  first_name: string
  last_name: string
}

export type FeedOutcome = "win" | "loss" | null

const STATUS_RANK: Record<string, number> = {
  in_progress: 0,
  paused: 1,
  ready: 2,
  waiting: 3,
  pending: 3,
  finished: 4,
  bye: 5,
}

function kidIdsOf(m: Match, kids: ReadonlySet<number>): number[] {
  const ids: number[] = []
  const a1 = m.athlete1 ?? m.athlete1_id ?? null
  const a2 = m.athlete2 ?? m.athlete2_id ?? null
  if (a1 !== null && kids.has(a1)) ids.push(a1)
  if (a2 !== null && kids.has(a2) && a2 !== a1) ids.push(a2)
  return ids
}

/** Исход боя для конкретного ребёнка (только завершённые). */
export function matchOutcome(m: Match, kidId: number): FeedOutcome {
  if (m.status !== "finished") return null
  const winner = m.winner ?? m.winner_id ?? null
  if (winner === null) return null
  return winner === kidId ? "win" : "loss"
}

/** Сортировка ленты: живые → готовые → ожидающие → завершённые (новые сверху). */
export function sortFeed(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 3
    const rb = STATUS_RANK[b.status] ?? 3
    if (ra !== rb) return ra - rb
    return ra >= 4 ? b.id - a.id : a.id - b.id
  })
}

function readSeenIds(key: string): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is number => typeof v === "number")
  } catch {
    return []
  }
}

interface FamilyFeedProps {
  matches: Match[]
  athletes: FeedAthlete[]
  loading: boolean
  emptyHint: string
  storageKey: string
  slugOfCategory: (categoryId: number) => string | undefined
}

/** Лента семьи: фильтр по ребёнку, исходы W/L, бейджи NEW для
 * незавершённых просмотром результатов. Данные — из кабинета, без
 * дополнительных запросов. */
export function FamilyFeed({
  matches,
  athletes,
  loading,
  emptyHint,
  storageKey,
  slugOfCategory,
}: FamilyFeedProps) {
  const [kidFilter, setKidFilter] = useState<number | null>(null)
  // Снепшот просмотренного на момент монтирования: бейдж NEW живёт всю
  // сессию и гаснет к следующему визиту. В storage пишем без setState,
  // поэтому циклов рендера нет.
  const [seenAtMount] = useState<number[]>(() => readSeenIds(storageKey))

  const kidSet = useMemo(() => new Set(athletes.map((a) => a.id)), [athletes])
  const kidById = useMemo(() => {
    const map = new Map<number, FeedAthlete>()
    for (const a of athletes) map.set(a.id, a)
    return map
  }, [athletes])

  useEffect(() => {
    const current = new Set(readSeenIds(storageKey))
    let changed = false
    for (const m of matches) {
      if (m.status === "finished" && !current.has(m.id)) {
        current.add(m.id)
        changed = true
      }
    }
    if (!changed) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...current]))
    } catch {
      /* ignore */
    }
  }, [matches, storageKey])

  const seenSet = useMemo(() => new Set(seenAtMount), [seenAtMount])

  const visible = useMemo(() => {
    const list =
      kidFilter === null
        ? matches
        : matches.filter((m) => kidIdsOf(m, kidSet).includes(kidFilter))
    return sortFeed(list)
  }, [matches, kidFilter, kidSet])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        icon={<Swords size={26} />}
        title="Матчей пока нет"
        hint={emptyHint}
      />
    )
  }

  return (
    <div>
      {athletes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Фильтр по ребёнку">
          <button
            type="button"
            onClick={() => setKidFilter(null)}
            aria-pressed={kidFilter === null}
            className={`h-8 px-3.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              kidFilter === null
                ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue"
                : "bg-light-gray text-secondary-text hover:text-dark-text"
            }`}
          >
            Все
          </button>
          {athletes.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setKidFilter(kidFilter === a.id ? null : a.id)}
              aria-pressed={kidFilter === a.id}
              className={`h-8 px-3.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                kidFilter === a.id
                  ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue"
                  : "bg-light-gray text-secondary-text hover:text-dark-text"
              }`}
            >
              {a.first_name}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Swords size={26} />}
          title="Нет боёв"
          hint="У этого спортсмена пока нет боёв"
        />
      ) : (
        <div className="space-y-3">
          {visible.map((m) => {
            const slug = slugOfCategory(m.category as number)
            const involved = kidIdsOf(m, kidSet)
            const primaryKid = kidFilter ?? involved[0] ?? null
            const outcome =
              primaryKid !== null ? matchOutcome(m, primaryKid) : null
            const isNew =
              m.status === "finished" && !seenSet.has(m.id)
            return (
              <Link
                key={m.id}
                href={slug ? `/tournaments/${slug}#match-${m.id}` : "/tournaments"}
                className="block"
              >
                <div className="flex items-center justify-between gap-3 p-3.5 bg-light-gray rounded-xl border border-transparent hover:bg-white hover:border-primary-blue/20 hover:shadow-md transition-all">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dark-text truncate">
                      {m.athlete1_name || "TBD"} vs{" "}
                      {m.athlete2_name || "TBD"}
                    </p>
                    <p className="text-xs text-secondary-text mt-0.5">
                      {m.category_name} — {m.round_name} — Матч{" "}
                      {m.match_number}
                      {m.status !== "finished" && m.status !== "bye" && m.tatami_name && (
                        <> · {formatTatamiName(m.tatami_name)}</>
                      )}
                    </p>
                    {athletes.length > 1 && involved.length > 0 && (
                      <p className="text-xs font-semibold text-primary-blue mt-0.5 truncate">
                        {involved
                          .map((id) => {
                            const a = kidById.get(id)
                            return a ? `${a.first_name} ${a.last_name}` : null
                          })
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <p className="text-sm font-bold text-dark-text tabular-nums">
                      {m.score1} : {m.score2}
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      {isNew && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gold text-dark-blue">
                          New
                        </span>
                      )}
                      {outcome === "win" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-success/10 text-success">
                          Победа
                        </span>
                      )}
                      {outcome === "loss" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-error/10 text-error">
                          Поражение
                        </span>
                      )}
                      <StatusPill status={m.status} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
