// Табло турнира как переиспользуемый компонент (board, /live/tv, /live-маршрут).
// Очередь — tatami_queue/ + единый useTournamentEvents (SSE-first);
// фильтр ?tatami=, авторотация. Второй реализации live-логики нет.

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Swords, ArrowLeft, Play, Pause, WifiOff } from "lucide-react"
import { api, apiErrorStatus } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import type { TatamiQueueItem } from "@/components/LiveQueue"
import {
  useTournamentEvents,
  type EventsSyncStatus,
  type TournamentEventsHandler,
} from "@/lib/useTournamentEvents"
import type { EventsTransport } from "@/lib/liveTransport"
import {
  isAnnouncementEvent,
  isQueueEvent,
  type TournamentEvent,
  type TournamentEventsResponse,
} from "@/lib/tournamentEvents"
import { AnnouncementBanner } from "@/components/AnnouncementBanner"

interface QueueResponse {
  queue: TatamiQueueItem[]
  recent_finished: { id: number; athlete1: string; athlete2: string }[]
}

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function etaLabel(eta: number | null | undefined) {
  if (eta === null || eta === undefined) return ""
  if (eta <= 0) return "следующий"
  if (eta < 60) return "меньше минуты"
  return `~${Math.max(1, Math.round(eta / 60))} мин`
}

export function TournamentBoard({
  slug,
  backHref,
  renderConnection,
}: {
  slug: string
  backHref?: string
  /** Слот состояния подключения (тот же hook — второго соединения нет). */
  renderConnection?: (state: { status: EventsSyncStatus; transport: EventsTransport }) => React.ReactNode
}) {
  const search = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tatamiFilter = search.get("tatami")

  const [name, setName] = useState("")
  const [queue, setQueue] = useState<TatamiQueueItem[]>([])
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [announcements, setAnnouncements] = useState<TournamentEvent[]>([])
  // Phase 2: ошибка первичной загрузки (404/офлайн) — вместо вечной «Загрузки…».
  // Повторные poll-ошибки состояние не роняют: показываем последние данные.
  const [bootError, setBootError] = useState<{ status: number | null } | null>(null)
  const hasDataRef = useRef(false)
  // N8: автораotation табло по татами (для зала без оператора).
  const [auto, setAuto] = useState(false)
  const [autoIdx, setAutoIdx] = useState(0)

  // Локальный выбор татами: UI реагирует мгновенно даже там, где
  // router-навигация по тому же пути не применяется; URL при этом
  // синхронизируем best-effort (прямые ссылки ?tatami= работают всегда).
  const [localTatami, setLocalTatami] = useState<string | null>(null)
  const setTatamiFilter = (id: string | null) => {
    setLocalTatami(id)
    try {
      const qs = new URLSearchParams(search.toString())
      if (id) qs.set("tatami", id)
      else qs.delete("tatami")
      const q = qs.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    } catch {
      // URL останется без фильтра — выбор уже применён локально.
    }
  }

  useEffect(() => {
    if (!auto || queue.length < 2) return
    const t = setInterval(() => setAutoIdx((i) => (i + 1) % queue.length), 10000)
    return () => clearInterval(t)
  }, [auto, queue.length])

  const fetchAll = useCallback(async () => {
    try {
      const [t, q] = await Promise.all([
        api<Tournament>(`/api/tournament/tournaments/${slug}/`),
        api<QueueResponse>(`/api/tournament/tournaments/${slug}/tatami_queue/`),
      ])
      hasDataRef.current = true
      setBootError(null)
      setName(t.name)
      setQueue(q.queue ?? [])
      setFetchedAt(Date.now())
    } catch (e) {
      // Табло не шумит ошибками: покажет последние данные.
      // Но если данных не было вообще — честный error-state с повтором.
      if (!hasDataRef.current) setBootError({ status: apiErrorStatus(e) })
    }
  }, [slug])

  useEffect(() => {
    // Первичная загрузка табло — setState в effect здесь оправдан
    // (синхронизация с внешним API, колбэки интервалов правило не нарушают).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll()
    const timer = setInterval(fetchAll, 5000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(timer)
      clearInterval(tick)
    }
  }, [fetchAll])

  useEffect(() => {
    let cancelled = false
    api<TournamentEventsResponse>(
      `/api/tournament/tournaments/${slug}/events/?after=0`
    )
      .then((data) => {
        if (cancelled) return
        setAnnouncements(
          data.events.filter(isAnnouncementEvent).slice(-1)
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])
  const { status: syncStatus, transport: syncTransport } = useTournamentEvents(slug, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch: TournamentEvent[], resync: boolean) => {
        const fresh = batch.filter(isAnnouncementEvent)
        if (fresh.length > 0) {
          setAnnouncements((prev) => [...prev, ...fresh].slice(-1))
        }
        if (!resync && !batch.some(isQueueEvent)) return
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null
          void fetchAll()
        }, 500)
      },
      [fetchAll]
    ),
  })

  const elapsed = Math.floor((now - fetchedAt) / 1000)
  // Локальный выбор приоритетнее URL (URL — для прямых ссылок и шаринга).
  const effectiveTatami = localTatami ?? tatamiFilter
  const visible =
    auto && queue.length > 0
      ? [queue[autoIdx % queue.length]]
      : effectiveTatami
        ? queue.filter((q) => String(q.tatami.id) === effectiveTatami)
        : queue
  const liveCount = queue.filter((q) => q.current).length

  return (
    <div className="min-h-screen bg-dark-blue text-white">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-gold">
              Табло турнира
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight truncate">
              {name || "Загрузка…"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {renderConnection?.({ status: syncStatus, transport: syncTransport })}
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full bg-error/20 border border-error/40 px-4 py-1.5 text-sm font-extrabold uppercase tracking-widest text-red-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-400" />
                </span>
                Live · {liveCount}
              </span>
            )}
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 hover:text-white transition-colors"
              >
                <ArrowLeft size={15} />
                {backHref === "/live/tv" ? "К выбору табло" : "К турниру"}
              </Link>
            )}
          </div>
        </div>

        <AnnouncementBanner items={announcements} />

        {bootError && queue.length === 0 ? (
          <ErrorRetry
            icon={<WifiOff size={26} />}
            title={bootError.status === 404 ? "Турнир не найден" : "Не удалось загрузить табло"}
            hint={
              bootError.status === 404
                ? "Проверьте ссылку — возможно, турнир удалён или ещё не опубликован"
                : "Проверьте соединение с интернетом и попробуйте ещё раз"
            }
            onRetry={() => void fetchAll()}
          />
        ) : (
        <>
        {queue.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label="Фильтр татами">
            <button
              type="button"
              onClick={() => { setAuto(false); setTatamiFilter(null) }}
              aria-pressed={!auto && !effectiveTatami}
              className={`h-10 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                !auto && !effectiveTatami
                  ? "bg-gold text-dark-blue"
                  : "border border-white/15 text-white/70 hover:text-white hover:border-white/30"
              }`}
            >
              Все
            </button>
            {queue.map((q) => {
              const active = !auto && effectiveTatami === String(q.tatami.id)
              return (
                <button
                  key={q.tatami.id}
                  type="button"
                  onClick={() => { setAuto(false); setTatamiFilter(String(q.tatami.id)) }}
                  aria-pressed={active}
                  className={`h-10 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    active
                      ? "bg-gold text-dark-blue"
                      : "border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                  }`}
                >
                  {q.tatami.name}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setAuto((v) => !v)}
              aria-pressed={auto}
              title="Автопереключение татами каждые 10 секунд"
              className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                auto
                  ? "bg-gold text-dark-blue"
                  : "border border-white/15 text-white/70 hover:text-white hover:border-white/30"
              }`}
            >
              {auto ? <Pause size={15} /> : <Play size={15} />}
              Авто
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-16 text-center">
            <Swords size={36} className="mx-auto text-gold/60 mb-4" />
            <p className="text-xl font-bold text-white/80">Очередь пуста</p>
            <p className="text-sm text-white/50 mt-2">Бои скоро начнутся</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => {
              const cur = item.current
              const left = cur
                ? Math.max(0, (cur.remaining_seconds ?? cur.duration_seconds ?? 120) - (cur.timer_running ? elapsed : 0))
                : 0
              return (
                <section
                  key={item.tatami.id}
                  aria-label={item.tatami.name}
                  className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden"
                >
                  <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-gold">
                      {item.tatami.name}
                    </h2>
                    {cur ? (
                      <span className="text-xs font-extrabold uppercase tracking-widest text-red-300">
                        Бой идёт
                      </span>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                        Свободно
                      </span>
                    )}
                  </header>
                  <div className="p-6">
                    {cur ? (
                      <>
                        <div className="text-center text-2xl font-extrabold leading-snug">
                          {cur.athlete1}
                          <span className="block text-sm font-bold text-white/40 my-1">vs</span>
                          {cur.athlete2}
                        </div>
                        <div className="text-center text-6xl font-black tabular-nums text-gold mt-4">
                          {fmtClock(left)}
                        </div>
                        <div className="text-center text-sm text-white/50 mt-2">
                          {cur.category_name} · {cur.round_name}
                        </div>
                      </>
                    ) : (
                        <p className="text-center text-white/60 font-semibold py-6">
                          Пауза между боями
                        </p>
                    )}
                    {item.next && (
                      <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70 mb-1">
                          Далее{etaLabel(item.next.eta_seconds) ? ` · ${etaLabel(item.next.eta_seconds)}` : ""}
                        </div>
                        <div className="font-bold">
                            {item.next.athlete1} <span className="text-white/60">vs</span> {item.next.athlete2}
                        </div>
                      </div>
                    )}
                    {item.waiting.length > 0 && (
                      <div className="mt-2 text-sm text-white/45 font-semibold">
                        Ещё в очереди: {item.waiting.length}
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
