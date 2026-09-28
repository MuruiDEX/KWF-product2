"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CalendarClock, ChevronRight } from "lucide-react"
import { api } from "@/lib/api"
import { useTournamentEvents } from "@/lib/useTournamentEvents"
import StatusPill from "@/components/ui/StatusPill"

interface ScheduleCategory {
  id: number
  name: string
  order: number
  status: "waiting" | "active" | "finished"
  total_matches: number
  finished_matches: number
}

interface QueueFight {
  id: number
  match_number: number
  round_name: string
  category_name: string
  athlete1: string
  athlete2: string
  status: string
}

interface QueueTatami {
  tatami: { id: number; name: string; order: number }
  current: QueueFight | null
  next: QueueFight | null
  waiting: QueueFight[]
}

interface ScheduleData {
  tournament_id: number
  name: string
  status: string
  categories: ScheduleCategory[]
  current: ScheduleCategory | null
  next: ScheduleCategory | null
  tatamis: QueueTatami[]
}

function catStatusLabel(s: string) {
  if (s === "active") return "active"
  if (s === "finished") return "finished"
  return "waiting"
}

export default function TournamentSchedule({ tournamentId }: { tournamentId: string | number }) {
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api<ScheduleData>(`/api/tournament/tournaments/${tournamentId}/schedule/`)
      setData(res)
    } catch {
      /* расписание недоступно — блок скрывается, сетка ниже остаётся */
    }
  }, [tournamentId])

  useEffect(() => {
    let cancelled = false
    // Сброс скелетона перед запросом намеренный (fetch-effect, прецедент: tournament detail).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    void load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId, load])

  // Realtime: расписание дешёвое — обновляем по любому событию (debounce).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])
  useTournamentEvents(tournamentId, {
    onEvents: useCallback(() => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null
        void load()
      }, 500)
    }, [load]),
  })

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 animate-pulse mb-10">
        <div className="h-5 w-48 rounded bg-dark-blue/10 mb-4" />
        <div className="h-8 w-full max-w-md rounded bg-dark-blue/10" />
      </div>
    )
  }

  if (!data || data.categories.length === 0) return null

  return (
    <section aria-label="Расписание турнира" className="rounded-2xl border border-border bg-white p-5 sm:p-6 mb-10 shadow-sm dark:bg-[#0E2035]">
      <div className="flex items-center gap-2 mb-5">
        <CalendarClock size={17} className="text-primary-blue dark:text-gold" aria-hidden="true" />
        <h2 className="text-base font-extrabold text-dark-text uppercase tracking-wide dark:text-slate-100">
          Расписание
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl bg-light-gray border border-border p-4 dark:bg-white/[0.04]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-text mb-2">
            Сейчас
          </div>
          {data.current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-dark-text dark:text-slate-100">{data.current.name}</span>
                <StatusPill status={catStatusLabel(data.current.status)} pulse />
              </div>
              <div className="text-xs text-secondary-text mt-1 tabular-nums">
                Боёв завершено: {data.current.finished_matches} из {data.current.total_matches}
              </div>
              <div className="h-1.5 rounded-full bg-border mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-blue transition-all"
                  style={{
                    width: data.current.total_matches
                      ? `${Math.round((data.current.finished_matches / data.current.total_matches) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-secondary-text">
              {data.categories.every((c) => c.status === "finished")
                ? "Турнир завершён. Спасибо участникам!"
                : "Выступления скоро начнутся."}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-light-gray border border-border p-4 dark:bg-white/[0.04]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-text mb-2">
            Далее
          </div>
          {data.next ? (
            <div className="flex items-center gap-2">
              <ChevronRight size={16} className="text-gold shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-base font-extrabold text-dark-text truncate dark:text-slate-100">{data.next.name}</div>
                <div className="text-xs text-secondary-text mt-0.5">начнётся после текущей категории</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-secondary-text">Это последняя категория турнира.</p>
          )}
        </div>
      </div>

      {data.tatamis.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-4">
          {data.tatamis.map((t) => {
            const lane: { fight: QueueFight; kind: "current" | "next" | "waiting" }[] = [
              ...(t.current ? [{ fight: t.current, kind: "current" as const }] : []),
              ...(t.next ? [{ fight: t.next, kind: "next" as const }] : []),
              ...t.waiting.slice(0, 3).map((fight) => ({ fight, kind: "waiting" as const })),
            ]
            const restWaiting = Math.max(0, t.waiting.length - 3)
            return (
            <div key={t.tatami.id} className="rounded-xl border border-border p-3.5 bg-white dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-dark-blue text-white dark:bg-gold dark:text-dark-blue">
                  {t.tatami.name}
                </span>
                {t.current ? (
                  <StatusPill status={t.current.status} />
                ) : (
                  <span className="text-[11px] font-semibold text-secondary-text">свободно</span>
                )}
              </div>
              {lane.length === 0 ? (
                <p className="text-sm text-secondary-text py-1">Очередь пуста</p>
              ) : (
                <ul className="divide-y divide-border/60 dark:divide-white/10">
                  {lane.map(({ fight, kind }) => (
                    <li
                      key={`${kind}-${fight.id}`}
                      className={
                        kind === "current"
                          ? "py-2 -mx-1 px-1 rounded-lg bg-gold-soft/40 dark:bg-gold/10"
                          : "py-2"
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-dark-text tabular-nums whitespace-nowrap dark:text-slate-100">
                          Бой #{fight.match_number}
                          {kind === "current" && <span className="sr-only">, текущий</span>}
                          {kind === "next" && <span className="sr-only">, следующий</span>}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-secondary-text" title={fight.category_name}>
                          {fight.category_name}
                        </span>
                        {kind === "current" ? (
                          <StatusPill status="live" />
                        ) : kind === "next" ? (
                          <StatusPill status="next" />
                        ) : (
                          <StatusPill status={fight.status} />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-dark-text dark:text-slate-100" title={`${fight.athlete1} vs ${fight.athlete2}`}>
                        {fight.athlete1} vs {fight.athlete2}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {restWaiting > 0 && (
                <p className="pt-1 text-[11px] font-semibold text-secondary-text tabular-nums">
                  Ещё {restWaiting} в очереди
                </p>
              )}
            </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
