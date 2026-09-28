// Phase 1: агрегатор live-турниров.
// Только существующие endpoints: GET tournaments/ + tatami_queue/ на турнир.
// Polling 15s; SSE — только в Phase 6.

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, MapPin, MonitorPlay, Radio, WifiOff } from "lucide-react"
import { api, apiErrorMessage, unwrapList, type ListResponse } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import type { TatamiQueueItem } from "@/components/LiveQueue"
import { partitionTournaments, type TournamentPartition } from "@/lib/nav"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { Button } from "@/components/ui/button"

interface QueueResponse {
  queue: TatamiQueueItem[]
}

const REFRESH_MS = 15000

function formatDateRange(t: Tournament): string {
  const s = new Date(`${t.start_date}T00:00:00`)
  const e = new Date(`${t.end_date}T00:00:00`)
  if (Number.isNaN(s.getTime())) return ""
  const opts = { day: "numeric", month: "long" } as const
  if (!Number.isNaN(e.getTime()) && t.end_date !== t.start_date) {
    return `${s.toLocaleDateString("ru-RU", opts)} — ${e.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}`
  }
  return s.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

export default function LivePage() {
  const [partition, setPartition] = useState<TournamentPartition | null>(null)
  const [queues, setQueues] = useState<Record<number, TatamiQueueItem[]>>({})
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  )

  useEffect(() => {
    const on = () => setOffline(!navigator.onLine)
    window.addEventListener("online", on)
    window.addEventListener("offline", on)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", on)
    }
  }, [])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const data = await api<ListResponse<Tournament>>(
        "/api/tournament/tournaments/"
      )
      const part = partitionTournaments(unwrapList(data))
      setPartition(part)
      // Очереди татами — только для идущих турниров, ошибки очередей не роняют страницу.
      const entries = await Promise.all(
        part.running.map(async (t) => {
          try {
            const q = await api<QueueResponse>(
              `/api/tournament/tournaments/${t.slug}/tatami_queue/`
            )
            return [t.id, q.queue ?? []] as const
          } catch {
            return [t.id, []] as const
          }
        })
      )
      setQueues(Object.fromEntries(entries))
      setUpdatedAt(new Date())
    } catch (e) {
      setLoadError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, reloadKey])

  useEffect(() => {
    if (loading) return
    const id = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(id)
  }, [load, loading])

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Live" }]} />
        <PageHeader
          eyebrow="Прямой эфир"
          title="Live турниров"
          description="Текущие бои, татами и очереди — обновление автоматическое"
          meta={
            updatedAt ? (
              <span className="text-sm text-secondary-text">
                Обновлено в{" "}
                <time className="tabular-nums font-semibold">
                  {updatedAt.toLocaleTimeString("ru-RU")}
                </time>
              </span>
            ) : undefined
          }
          actions={
            <Link href="/live/tv">
              <Button variant="outline" className="gap-2">
                <MonitorPlay size={16} />
                Режим ТВ
              </Button>
            </Link>
          }
          className="mt-4"
        />

        {offline && (
          <div role="alert" className="mb-6 rounded-2xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
            Нет соединения с интернетом — показаны последние загруженные данные
          </div>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : loadError && !partition ? (
          <ErrorRetry
            icon={<WifiOff size={26} />}
            title={offline ? "Нет соединения" : "Не удалось загрузить live"}
            hint={offline ? "Проверьте соединение и попробуйте ещё раз" : loadError}
            onRetry={() => {
              setLoading(true)
              setReloadKey((k) => k + 1)
            }}
          />
        ) : partition && partition.running.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white dark:bg-[#0E2035]">
            <EmptyState
              icon={<Radio size={26} />}
              title="Сейчас нет live-турниров"
              hint="Как только турнир начнётся, здесь появятся татами, текущие бои и очереди"
              action={
                <Link href="/tournaments">
                  <Button>Ко всем турнирам</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-6">
            {(partition?.running ?? []).map((t) => {
              const queue = queues[t.id] ?? []
              const liveCount = queue.filter((q) => q.current).length
              return (
                <section
                  key={t.id}
                  aria-label={`Live: ${t.name}`}
                  className="rounded-2xl border border-gold/40 bg-white overflow-hidden dark:bg-[#0E2035]"
                >
                  <div className="px-4 sm:px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill status="live" pulse />
                        {liveCount > 0 && (
                          <span className="text-xs font-bold text-secondary-text">
                            активных татами: {liveCount}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg md:text-xl font-extrabold text-dark-text mt-1 truncate dark:text-slate-100">
                        <Link href={`/tournaments/${t.slug}`} className="hover:text-primary-blue transition-colors">
                          {t.name}
                        </Link>
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-text mt-1">
                        {t.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={14} aria-hidden="true" />
                            {t.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={14} aria-hidden="true" />
                          {formatDateRange(t)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/tournaments/${t.slug}`}>
                        <Button variant="outline" size="sm">К турниру</Button>
                      </Link>
                      <Link href={`/tournaments/${t.slug}/board`}>
                        <Button size="sm">Табло</Button>
                      </Link>
                    </div>
                  </div>
                  <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {queue.length === 0 ? (
                      <p className="text-sm font-semibold text-secondary-text md:col-span-2 xl:col-span-3">
                        Очередь татами загружается или пока пуста
                      </p>
                    ) : (
                      queue.map((item) => (
                        <div
                          key={item.tatami.id}
                          className="rounded-2xl border border-border bg-light-gray p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-extrabold text-dark-text">{item.tatami.name}</span>
                            {item.current ? (
                              <StatusPill status="in_progress" />
                            ) : (
                              <StatusPill status="waiting" label="Пауза" />
                            )}
                          </div>
                          {item.current ? (
                            <>
                              <p className="text-sm font-bold text-dark-text leading-snug">
                                {item.current.athlete1}
                                <span className="text-secondary-text font-semibold"> vs </span>
                                {item.current.athlete2}
                              </p>
                              <p className="text-xs text-secondary-text mt-1">
                                {item.current.category_name} · {item.current.round_name}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-semibold text-secondary-text">
                              Пауза между боями
                            </p>
                          )}
                          {item.next && (
                            <p className="text-xs text-secondary-text mt-2">
                              Далее: {item.next.athlete1} vs {item.next.athlete2}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {!loading && partition && partition.upcoming.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-extrabold text-dark-text mb-3 dark:text-slate-100">Ближайшие турниры</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {partition.upcoming.slice(0, 6).map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.slug}`}
                  className="rounded-2xl border border-border bg-white p-4 hover:border-primary-blue/40 transition-colors dark:bg-[#0E2035]"
                >
                  <StatusPill status={t.status === "published" ? "upcoming" : "draft"} />
                  <div className="font-bold text-dark-text mt-2 truncate">{t.name}</div>
                  <div className="text-sm text-secondary-text mt-1">{formatDateRange(t)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
