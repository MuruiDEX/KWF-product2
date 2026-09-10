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
    <section aria-label="Расписание турнира" className="rounded-2xl border border-border bg-white p-5 sm:p-6 mb-10 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <CalendarClock size={17} className="text-primary-blue" />
        <h2 className="text-base font-extrabold text-dark-text uppercase tracking-wide">
          Расписание
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl bg-light-gray border border-border p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-text mb-2">
            Сейчас
          </div>
          {data.current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-dark-text">{data.current.name}</span>
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

        <div className="rounded-xl bg-light-gray border border-border p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-text mb-2">
            Далее
          </div>
          {data.next ? (
            <div className="flex items-center gap-2">
              <ChevronRight size={16} className="text-gold shrink-0" />
              <div className="min-w-0">
                <div className="text-base font-extrabold text-dark-text truncate">{data.next.name}</div>
                <div className="text-xs text-secondary-text mt-0.5">начнётся после текущей категории</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-secondary-text">Это последняя категория турнира.</p>
          )}
        </div>
      </div>

      {data.tatamis.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mt-4">
          {data.tatamis.map((t) => (
            <div key={t.tatami.id} className="rounded-xl border border-border p-3.5 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-dark-blue text-white dark:bg-gold dark:text-dark-blue">
                  {t.tatami.name}
                </span>
                {t.current ? (
                  <StatusPill status={t.current.status} />
                ) : (
                  <span className="text-[11px] font-semibold text-secondary-text">свободно</span>
                )}
              </div>
              {t.current ? (
                <p className="text-sm font-bold text-dark-text truncate">
                  Бой #{t.current.match_number}: {t.current.athlete1} vs {t.current.athlete2}
                </p>
              ) : t.next ? (
                <p className="text-sm text-secondary-text truncate">
                  Следующий: Бой #{t.next.match_number}
                </p>
              ) : (
                <p className="text-sm text-secondary-text">Очередь пуста</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
