"use client"

import { useMemo } from "react"
import { LayoutDashboard, Plus, Radio, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EtaBadge } from "@/components/EtaBadge"
import StatusPill from "@/components/ui/StatusPill"
import LiveQueue, { type QueueMatch, type TatamiQueueItem } from "@/components/LiveQueue"
import { useTatamiQueue } from "@/lib/useTatamiQueue"
import { cn } from "@/lib/utils"
import type { Tatami, TournamentCategory } from "@/lib/types"

export type ScheduleView = "planner" | "live"

interface SchedulePanelProps {
  tournamentId: string | number
  view: ScheduleView
  onViewChange: (v: ScheduleView) => void
  tatamis: Tatami[]
  sortedCats: TournamentCategory[]
  tatamiLiveCount: (tatamiId: number) => number
  onAddTatami: () => void
  onDeleteTatami: (t: Tatami) => void
  /** Время последнего успешного fetchData (ms) — тихий индикатор свежести. */
  dataUpdatedAt?: number | null
}

function tatamiStatus(q: TatamiQueueItem | undefined): {
  label: string
  live: boolean
} {
  if (!q) return { label: "Нет данных", live: false }
  if (q.current) return { label: "LIVE", live: true }
  if (q.next || q.waiting.length > 0) return { label: "Ожидание", live: false }
  return { label: "Простаивает", live: false }
}

type LaneRow =
  | { kind: "current" | "next" | "waiting"; fight: QueueMatch }
  | { kind: "unscheduled"; matchNumber: number; category: string; a1: string | null; a2: string | null; status: string }

function fightStatusPill(row: LaneRow) {
  if (row.kind === "current") return <StatusPill status="live" />
  if (row.kind === "next") return <StatusPill status="next" />
  if (row.kind === "unscheduled") return <StatusPill status={row.status} />
  return <StatusPill status={row.fight.status} />
}

/** Phase 2B: расписание = планировщик (татами + очередь) и LIVE.
 * Данные очереди — один лёгкий запрос + SSE (useTatamiQueue у родителя),
 * LIVE-режим переиспользует существующий LiveQueue без второго polling.
 *
 * Wave 1.5: диспетчерская таблица — лейны татами с рядами
 * current → next → waiting (+ группа «Без татами» из тех же данных).
 * Та же модель, те же запросы, те же actions. */
export function SchedulePanel({
  tournamentId,
  view,
  onViewChange,
  tatamis,
  sortedCats,
  tatamiLiveCount,
  onAddTatami,
  onDeleteTatami,
  dataUpdatedAt,
}: SchedulePanelProps) {
  // Очередь живёт только пока открыта вкладка (монтирование панели):
  // лёгкий запрос + SSE, без собственного polling.
  const { queue, finished, loading: queueLoading, error: queueError, refresh: onQueueRefresh } =
    useTatamiQueue(tournamentId)
  const finishedCount = finished.length
  const queueByTatami = useMemo(
    () => new Map(queue.map((q) => [q.tatami.id, q])),
    [queue]
  )

  // Бои без татами — из уже загруженных категорий (без новых запросов).
  // Только waiting/ready: та же семантика, что readiness fightsWithoutTatami.
  const unscheduled = useMemo(
    () =>
      sortedCats.flatMap((c) =>
        (c.rounds || []).flatMap((r) =>
          (r.matches || [])
            .filter(
              (m) =>
                (m.status === "waiting" || m.status === "ready") &&
                (m.tatami === null || m.tatami === undefined)
            )
            .map((m) => ({
              kind: "unscheduled" as const,
              matchNumber: m.match_number,
              category: c.name,
              a1: m.athlete1_name,
              a2: m.athlete2_name,
              status: m.status,
            }))
        )
      ),
    [sortedCats]
  )

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Режим расписания"
        className="inline-flex gap-1 rounded-xl border border-border bg-white p-1 dark:bg-[#0E2035]"
      >
        {(
          [
            { id: "planner", label: "Планировщик", icon: LayoutDashboard },
            { id: "live", label: "LIVE", icon: Radio },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => onViewChange(v.id)}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition-colors ${
              view === v.id
                ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue"
                : "text-secondary-text hover:bg-light-gray dark:hover:bg-white/10"
            }`}
          >
            <v.icon size={15} aria-hidden="true" />
            {v.label}
          </button>
        ))}
      </div>

      {view === "live" ? (
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
          <LiveQueue tournamentId={tournamentId} />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="kwf-h3">
                  Татами · {tatamis.length}
                </h2>
                <p className="mt-0.5 text-xs text-secondary-text">
                  {queueLoading
                    ? "Загрузка очереди…"
                    : `Завершено боёв: ${finishedCount}`}
                  {dataUpdatedAt != null && (
                    <span className="tabular-nums">
                      {" · Обновлено "}
                      {new Date(dataUpdatedAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={onQueueRefresh}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  title="Обновить очередь"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Обновить
                </Button>
                <Button onClick={onAddTatami} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <Plus size={14} aria-hidden="true" />
                  Татами
                </Button>
              </div>
            </div>
            {queueError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-error">
                {queueError}
              </p>
            )}
          </div>

          {tatamis.length === 0 && unscheduled.length === 0 ? (
            <p className="py-2 text-sm text-secondary-text">
              Татами пока нет — добавьте хотя бы один, иначе распределение боёв невозможно.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm dark:bg-[#0E2035]">
              <table aria-label="Расписание боёв по татами" className="w-full min-w-[680px] text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-light-gray text-left text-[11px] font-bold tracking-[0.12em] text-secondary-text uppercase dark:bg-white/[0.06]">
                    <th scope="col" className="px-3 py-2">Бой</th>
                    <th scope="col" className="px-3 py-2">Категория</th>
                    <th scope="col" className="px-3 py-2">Участники</th>
                    <th scope="col" className="px-3 py-2">Статус</th>
                  </tr>
                </thead>
                {tatamis.map((t) => {
                  const q = queueByTatami.get(t.id)
                  const live = tatamiLiveCount(t.id)
                  const st = tatamiStatus(q)
                  const rows: LaneRow[] = [
                    ...(q?.current ? [{ kind: "current" as const, fight: q.current }] : []),
                    ...(q?.next ? [{ kind: "next" as const, fight: q.next }] : []),
                    ...(q?.waiting ?? []).map((fight) => ({ kind: "waiting" as const, fight })),
                  ]
                  const cats = sortedCats.filter((c) => c.tatami === t.id)
                  return (
                    <tbody key={t.id} className="border-t border-border first:border-t-0">
                      <tr className="bg-light-gray/60 dark:bg-white/[0.03]">
                        <th scope="colgroup" colSpan={4} className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-dark-text dark:text-slate-100">
                              {t.name}
                            </span>
                            {st.live ? (
                              <StatusPill status="live" />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-secondary-text">
                                {st.label}
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-secondary-text tabular-nums">
                              {rows.length} боёв{live > 0 ? ` · ${live} live` : ""} · {cats.length} кат.
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteTatami(t)}
                              aria-label={`Удалить ${t.name}`}
                              className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-secondary-text transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50 dark:hover:bg-red-500/15"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </span>
                        </th>
                      </tr>
                      {queueLoading && rows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-2">
                            <div className="h-9 animate-pulse rounded-lg bg-light-gray dark:bg-white/[0.06]" aria-hidden="true" />
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-xs text-secondary-text">
                            Очередь пуста
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, i) => {
                          const fight = row.kind === "unscheduled" ? null : row.fight
                          const num = fight ? fight.match_number : row.kind === "unscheduled" ? row.matchNumber : 0
                          const category = fight ? fight.category_name : row.kind === "unscheduled" ? row.category : ""
                          const a1 = fight ? fight.athlete1 : row.kind === "unscheduled" ? row.a1 : null
                          const a2 = fight ? fight.athlete2 : row.kind === "unscheduled" ? row.a2 : null
                          const fighters =
                            a1 || a2 ? `${a1 ?? "—"} vs ${a2 ?? "—"}` : "—"
                          return (
                            <tr
                              key={`${row.kind}-${fight ? fight.id : `${row.kind}-${i}`}`}
                              className={cn(
                                "border-t border-border/60 dark:border-white/10",
                                row.kind === "current" && "bg-gold-soft/40 dark:bg-gold/10"
                              )}
                            >
                              <td className="px-3 py-2 font-bold text-dark-text tabular-nums whitespace-nowrap dark:text-slate-100">
                                Бой #{num}
                                {row.kind === "current" && (
                                  <span className="sr-only">, текущий</span>
                                )}
                              </td>
                              <td className="max-w-44 truncate px-3 py-2 text-secondary-text" title={category}>
                                {category}
                              </td>
                              <td className="min-w-0 max-w-56 truncate px-3 py-2 font-semibold text-dark-text dark:text-slate-100" title={fighters}>
                                {fighters}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5">
                                  {fightStatusPill(row)}
                                  {row.kind === "next" && fight && (
                                    <EtaBadge etaSeconds={fight.eta_seconds} />
                                  )}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  )
                })}
                {unscheduled.length > 0 && (
                  <tbody className="border-t border-border">
                    <tr className="bg-light-gray/60 dark:bg-white/[0.03]">
                      <th scope="colgroup" colSpan={4} className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-dark-text dark:text-slate-100">
                            Без татами
                          </span>
                          <span className="text-[11px] font-semibold text-secondary-text tabular-nums">
                            {unscheduled.length} боёв — распределите из шапки турнира
                          </span>
                        </span>
                      </th>
                    </tr>
                    {unscheduled.map((row, i) => (
                      <tr
                        key={`unscheduled-${i}`}
                        className="border-t border-border/60 dark:border-white/10"
                      >
                        <td className="px-3 py-2 font-bold text-dark-text tabular-nums whitespace-nowrap dark:text-slate-100">
                          Бой #{row.matchNumber}
                        </td>
                        <td className="max-w-44 truncate px-3 py-2 text-secondary-text" title={row.category}>
                          {row.category}
                        </td>
                        <td className="min-w-0 max-w-56 truncate px-3 py-2 font-semibold text-dark-text dark:text-slate-100" title={`${row.a1 ?? "—"} vs ${row.a2 ?? "—"}`}>
                          {row.a1 ?? "—"} vs {row.a2 ?? "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fightStatusPill(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          )}
          {queue.length === 0 && !queueLoading && tatamis.length > 0 && unscheduled.length === 0 && (
            <p className="text-sm text-secondary-text">
              Очередь пуста — сгенерируйте сетки и распределите бои по татами.
            </p>
          )}
        </>
      )}
    </div>
  )
}
