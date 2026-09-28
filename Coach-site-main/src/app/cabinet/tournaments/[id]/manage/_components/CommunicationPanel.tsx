"use client"

import { useCallback, useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import { AnnounceBar } from "@/components/AnnounceBar"
import {
  isAnnouncementEvent,
  type TournamentEvent,
  type TournamentEventsResponse,
} from "@/lib/tournamentEvents"

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/** Phase 2B: связь — композитор (существующий AnnounceBar) + история
 * объявлений из events API. Без новых endpoints. */
export function CommunicationPanel({ tournamentId }: { tournamentId: string | number }) {
  const [items, setItems] = useState<TournamentEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Длинная история — за «Показать все»: вложенный скролл max-h-96
  // не должен быть единственным способом добраться до хвоста.
  const [showAll, setShowAll] = useState(false)
  const visibleItems = showAll || !items ? items : items.slice(0, 20)

  const load = useCallback(async () => {
    try {
      const data = await api<TournamentEventsResponse>(
        `/api/tournament/tournaments/${tournamentId}/events/?after=0`
      )
      setItems(data.events.filter(isAnnouncementEvent).reverse())
      setError(null)
    } catch (e) {
      console.error(e)
      setError(apiErrorMessage(e))
    }
  }, [tournamentId])

  useEffect(() => {
    // Первичная загрузка объявлений (прецедент: ActivityFeed).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <div className="space-y-3">
      <AnnounceBar tournamentId={tournamentId} inputId="announce-input-comm" onSent={() => void load()} />
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <h2 className="mb-2 text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
          Объявления · {items?.length ?? "…"}
        </h2>
        {items === null ? (
          error ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm font-semibold text-error">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="h-9 cursor-pointer rounded-lg border border-border px-4 text-xs font-bold text-dark-text hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10"
              >
                Повторить
              </button>
            </div>
          ) : (
            <div className="space-y-2" role="status" aria-label="Загрузка объявлений">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-light-gray dark:bg-white/[0.06]" />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-secondary-text">
            Объявлений пока нет — напишите первое выше, его увидят все участники и зрители.
          </p>
        ) : (
          <>
          <ul className={showAll ? "space-y-1.5 pr-1" : "max-h-96 space-y-1.5 overflow-y-auto pr-1"}>
            {(visibleItems ?? []).map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2.5 rounded-xl bg-light-gray px-3 py-2 dark:bg-white/[0.04]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-deep dark:bg-gold/15 dark:text-gold-pale">
                  <Megaphone size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug break-words text-dark-text dark:text-slate-100">
                    {e.detail || "Объявление организатора"}
                  </p>
                  {fmtDateTime(e.created_at) && (
                    <time dateTime={e.created_at} className="text-[11px] font-semibold text-secondary-text tabular-nums">
                      {fmtDateTime(e.created_at)}
                    </time>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {items.length > 20 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-2 inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              {showAll ? "Свернуть" : `Показать все (${items.length})`}
            </button>
          )}
          </>
        )}
      </div>
    </div>
  )
}
