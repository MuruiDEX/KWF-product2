// Phase 4: лента активности из существующего TournamentEvent (новой модели нет).
// История — GET events/?after=0, новые — useTournamentEvents (тот же polling,
// отдельного опроса виджета нет). Подписи — describeEvent, без сырого JSON.

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Megaphone, Swords } from "lucide-react"
import { api } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import {
  isAnnouncementEvent,
  type TournamentEvent,
  type TournamentEventsResponse,
} from "@/lib/tournamentEvents"
import { useTournamentEvents } from "@/lib/useTournamentEvents"
import { describeEvent, type EventContext } from "@/lib/controlCenter"
import EmptyState from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

const HISTORY_LIMIT = 30
const FEED_CAP = 50

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

function buildContext(t: Tournament | null): EventContext {
  const matchMap = new Map<number, string>()
  const catMap = new Map<number, string>()
  for (const c of t?.categories ?? []) {
    catMap.set(c.id, c.name)
    for (const r of c.rounds ?? []) {
      for (const m of r.matches ?? []) {
        const label = `${m.athlete1_name ?? "?"} vs ${m.athlete2_name ?? "?"}`
        matchMap.set(m.id, `#${m.fight_number || m.match_number} · ${label}`)
      }
    }
  }
  return {
    matchLabel: (id) => matchMap.get(id) ?? null,
    categoryName: (id) => catMap.get(id) ?? null,
  }
}

function eventIcon(e: TournamentEvent) {
  if (isAnnouncementEvent(e)) return Megaphone
  if (e.type.startsWith("match.")) return Swords
  return Activity
}

export default function ActivityFeed({
  tournamentId,
  tournament,
}: {
  tournamentId: string | number
  tournament: Tournament | null
}) {
  const [events, setEvents] = useState<TournamentEvent[] | null>(null)
  // Сброс ленты при смене турнира — adjust during render (не effect).
  const [feedTid, setFeedTid] = useState(tournamentId)
  if (feedTid !== tournamentId) {
    setFeedTid(tournamentId)
    setEvents(null)
  }

  const loadHistory = useCallback(async () => {
    try {
      const data = await api<TournamentEventsResponse>(
        `/api/tournament/tournaments/${tournamentId}/events/?after=0`
      )
      setEvents(data.events.slice(-HISTORY_LIMIT).reverse())
    } catch {
      // Лента вторична: молчим, покажем пустое состояние.
      setEvents((prev) => prev ?? [])
    }
  }, [tournamentId])

  useEffect(() => {
    // Первичная загрузка истории — setState в effect здесь оправдан
    // (синхронизация с внешним API при монтировании/смене турнира).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory()
  }, [loadHistory])

  useTournamentEvents(tournamentId, {
    onEvents: useCallback(
      (batch: TournamentEvent[], resync: boolean) => {
        if (resync) {
          void loadHistory()
          return
        }
        if (batch.length === 0) return
        setEvents((prev) => {
          const seen = new Set((prev ?? []).map((e) => e.id))
          const fresh = batch.filter((e) => !seen.has(e.id)).reverse()
          return [...fresh, ...(prev ?? [])].slice(0, FEED_CAP)
        })
      },
      [loadHistory]
    ),
  })

  const ctx = useMemo(() => buildContext(tournament), [tournament])

  return (
    <section
      aria-label="Активность турнира"
      className="rounded-2xl border border-border bg-white p-5 shadow-sm dark:bg-[#0E2035]"
    >
      <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-secondary-text mb-3">
        Активность
      </h2>
      {events === null ? (
        <div className="space-y-2" role="status" aria-label="Загрузка активности">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-xl bg-light-gray animate-pulse dark:bg-white/[0.06]" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="Пока нет событий"
          hint="Начало боёв, явка и объявления появятся здесь"
          className="py-8"
        />
      ) : (
        <ol className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {events.map((e) => {
            const Icon = eventIcon(e)
            return (
              <li
                key={e.id}
                className="flex items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-light-gray transition-colors dark:hover:bg-white/10"
              >
                <span
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    isAnnouncementEvent(e)
                      ? "bg-gold-soft text-gold-deep dark:bg-gold/15 dark:text-gold-pale"
                      : "bg-light-gray text-secondary-text dark:bg-white/[0.06]"
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-dark-text leading-snug break-words">
                    {describeEvent(e, ctx)}
                  </p>
                  {fmtTime(e.created_at) && (
                    <time dateTime={e.created_at} className="text-[11px] font-semibold text-secondary-text tabular-nums">
                      {fmtTime(e.created_at)}
                    </time>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
