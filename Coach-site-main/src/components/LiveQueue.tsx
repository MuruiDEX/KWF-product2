"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Play, RotateCcw, LayoutDashboard, Pause, Timer, Swords } from "lucide-react"
import EmptyState from "@/components/ui/EmptyState"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import { isQueueEvent } from "@/lib/tournamentEvents"

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function FightTimer({ matchId, remaining, running, serverExpired }: { matchId: number; remaining: number; running: boolean; serverExpired?: boolean }) {
  const [base, setBase] = useState({ remaining, running, serverExpired: !!serverExpired, at: Date.now(), matchId })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setBase({ remaining, running, serverExpired: !!serverExpired, at: Date.now(), matchId })
    setNow(Date.now())
  }, [matchId, remaining, running, serverExpired])

  useEffect(() => {
    if (!base.running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [base.running, base.matchId])

  const left = base.running ? Math.max(0, base.remaining - Math.floor((now - base.at) / 1000)) : base.remaining
  const expired = left === 0 || base.serverExpired
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <div className={`text-4xl font-extrabold tabular-nums tracking-tight ${expired ? "text-error" : "text-dark-text"}`}>
        {fmtClock(left)}
      </div>
      {expired ? (
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-error">
          Время вышло — решение за судьёй
        </span>
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-text inline-flex items-center gap-1">
          <Timer size={12} />
          {base.running ? "таймер идёт" : "пауза"}
        </span>
      )}
    </div>
  )
}

export interface QueueMatch {
  id: number
  match_number: number
  round_name: string
  category_name: string
  athlete1: string
  athlete1_id: number | null
  athlete2: string
  athlete2_id: number | null
  status: string
  remaining_seconds?: number | null
  duration_seconds?: number | null
  timer_running?: boolean
  timer_expired?: boolean
}

export interface TatamiQueueItem {
  tatami: { id: number; name: string; order: number }
  current: QueueMatch | null
  next: QueueMatch | null
  waiting: QueueMatch[]
}

export interface FinishedFight {
  id: number
  match_number: number
  round_name: string
  category_name: string
  athlete1: string
  athlete2: string
}

/** Живая очередь татами: опрос каждые 3с, старт/пауза/финиш, распределение.
 * Используется и на отдельной LIVE-странице, и табом в Control Center. */
export default function LiveQueue({ tournamentId }: { tournamentId: string | number }) {
  const [queue, setQueue] = useState<TatamiQueueItem[]>([])
  const [finished, setFinished] = useState<FinishedFight[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncStale, setSyncStale] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  )

  const fetchQueue = useCallback(async () => {
    try {
      const data = await api<{ queue: TatamiQueueItem[]; recent_finished: FinishedFight[] }>(
        `/api/tournament/tournaments/${tournamentId}/tatami_queue/`
      )
      setQueue(data.queue)
      setFinished(data.recent_finished ?? [])
      setSyncStale(false)
    } catch (e) {
      console.error("Failed to fetch queue", e)
      // Очередь оставляем как есть, но честно показываем, что данные устарели.
      setSyncStale(true)
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  const runOp = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key)
    try {
      await fn()
    } finally {
      setBusyKey((prev) => (prev === key ? null : prev))
    }
  }, [])

  // Realtime: событие очереди → тихий refetch (debounce против пачки).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      void fetchQueue()
    }, 400)
  }, [fetchQueue])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(() => {
      // Основной драйвер свежести — события (см. useTournamentEvents ниже).
      // Это страховочная сетка на случай пропущенной ленты.
      if (document.visibilityState !== "visible" || !navigator.onLine) return
      fetchQueue()
    }, 15000)
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchQueue()
    }
    const onOnline = () => {
      setOnline(true)
      fetchQueue()
    }
    const onOffline = () => setOnline(false)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      clearInterval(interval)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [fetchQueue])

  // Realtime: событие очереди → тихий refetch (debounce против пачки).
  const { status: eventsStatus } = useTournamentEvents(tournamentId, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch, resync) => {
        if (resync || batch.some(isQueueEvent)) scheduleRefresh()
      },
      [scheduleRefresh]
    ),
  })

  const handleStartMatch = async (matchId: number | null | undefined) => {
    if (!matchId) return
    await runOp(`start-${matchId}`, async () => {
      try {
        await api(`/api/tournament/tournaments/${tournamentId}/start_match/`, {
          method: "POST",
          body: JSON.stringify({ match_id: matchId }),
        })
        await fetchQueue()
      } catch (e) {
        alert(apiErrorMessage(e))
      }
    })
  }

  const handlePauseMatch = async (matchId: number | null | undefined) => {
    if (!matchId) return
    await runOp(`pause-${matchId}`, async () => {
      try {
        const res = await api<{ success: boolean; error?: string }>(`/api/tournament/matches/${matchId}/pause_match/`, {
          method: "POST",
        })
        if (!res.success) {
          alert(res.error || "Не удалось поставить на паузу")
          return
        }
        await fetchQueue()
      } catch (e) {
        alert(apiErrorMessage(e))
      }
    })
  }

  const handleResumeMatch = async (matchId: number | null | undefined) => {
    if (!matchId) return
    await runOp(`resume-${matchId}`, async () => {
      try {
        const res = await api<{ success: boolean; error?: string }>(`/api/tournament/matches/${matchId}/resume_match/`, {
          method: "POST",
        })
        if (!res.success) {
          alert(res.error || "Не удалось продолжить бой")
          return
        }
        await fetchQueue()
      } catch (e) {
        alert(apiErrorMessage(e))
      }
    })
  }

  const handleFinishMatch = async (match: QueueMatch | null, winnerId: number | null) => {
    if (!match || !winnerId) return
    await runOp(`finish-${match.id}`, async () => {
      try {
        await api(`/api/tournament/tournaments/${tournamentId}/finish_match/`, {
          method: "POST",
          body: JSON.stringify({
            match_id: match.id,
            winner_id: winnerId,
          }),
        })
        await fetchQueue()
      } catch (e) {
        alert(apiErrorMessage(e))
      }
    })
  }

  const handleDistributeTatamis = async () => {
    await runOp("distribute", async () => {
      setNotice(null)
      try {
        const res = await api<{ distributed: number; waiting: number; hint?: string | null }>(
          `/api/tournament/tournaments/${tournamentId}/distribute_tatamis/`,
          { method: "POST" }
        )
        if (res.distributed > 0) {
          setNotice({ ok: true, text: `Распределено боёв: ${res.distributed}.` })
        } else if (res.hint) {
          setNotice({ ok: true, text: res.hint })
        }
        await fetchQueue()
      } catch (e) {
        setNotice({ ok: false, text: apiErrorMessage(e) })
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ${
            eventsStatus === "live" ? "text-green-600" : "text-yellow-600"
          }`}
          title={
            eventsStatus === "live"
              ? "Лента событий подключена — обновления приходят автоматически"
              : "Переподключение к ленте событий..."
          }
        >
          <span className={`w-2 h-2 rounded-full ${eventsStatus === "live" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
          {eventsStatus === "live" ? "LIVE" : "Переподключение..."}
        </span>
        <Button
          onClick={handleDistributeTatamis}
          disabled={busyKey !== null}
          className="gap-2 bg-dark-blue text-white hover:bg-primary-blue transition-colors"
        >
          <RotateCcw size={20} />
          {busyKey === "distribute" ? "Распределение..." : "Перераспределить татами"}
        </Button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-sm font-medium ${
            notice.ok
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}
      {!online && (
        <div className="p-3 rounded-xl border text-sm font-medium bg-red-50 border-red-200 text-red-700">
          Нет соединения — показаны последние полученные данные. Управление боями недоступно до восстановления связи.
        </div>
      )}
      {online && syncStale && (
        <div className="p-3 rounded-xl border text-sm font-medium bg-yellow-50 border-yellow-200 text-yellow-700">
          Не удалось обновить очередь — показаны последние данные. Проверьте соединение.
        </div>
      )}

      <QueueDashboard queue={queue} finished={finished} />

      {queue.length === 0 && finished.length === 0 ? (
        <EmptyState
          icon={<Swords size={26} />}
          title="Очередь пуста"
          hint="Сгенерируйте сетку категории и распределите бои по татами — они появятся здесь"
        />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {queue.map((item) => (
          <motion.div
            key={item.tatami.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden"
          >
            <div className="bg-dark-blue p-4 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <LayoutDashboard size={20} className="shrink-0" />
                <span className="font-bold text-lg truncate">{item.tatami.name}</span>
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full shrink-0">
                Татами #{item.tatami.order}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Current Match */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">Сейчас в бою</h3>
                {item.current ? (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-yellow-700">
                        Бой #{item.current.match_number} · {item.current.round_name}
                      </span>
                      <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase">
                        {item.current.status === "paused" ? "Пауза" : "Идёт бой"}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-secondary-text -mt-2">
                      {item.current.category_name}
                    </div>
                    <FightTimer
                      matchId={item.current.id}
                      remaining={item.current.remaining_seconds ?? item.current.duration_seconds ?? 120}
                      running={item.current.status === "in_progress" && item.current.timer_running !== false}
                      serverExpired={item.current.timer_expired}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-bold text-dark-text text-center">{item.current.athlete1}</span>
                        <Button
                          size="sm"
                          disabled={busyKey === `finish-${item.current.id}` || !item.current.athlete1_id}
                          className="w-full bg-primary-blue hover:bg-primary-blue-light text-white text-xs h-8"
                            onClick={() => handleFinishMatch(item.current, item.current?.athlete1_id ?? null)}
                        >
                          Победил
                        </Button>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-bold text-dark-text text-center">{item.current.athlete2}</span>
                        <Button
                          size="sm"
                          disabled={busyKey === `finish-${item.current.id}` || !item.current.athlete2_id}
                          className="w-full bg-primary-blue hover:bg-primary-blue-light text-white text-xs h-8"
                            onClick={() => handleFinishMatch(item.current, item.current?.athlete2_id ?? null)}
                        >
                          Победил
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.current.status === "paused" ? (
                        <Button
                          size="sm"
                            disabled={busyKey === `resume-${item.current?.id}`}
                            onClick={() => handleResumeMatch(item.current?.id)}
                          className="flex-1 gap-2 bg-dark-blue text-white hover:bg-primary-blue text-xs h-9 dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                        >
                          <Play size={14} />
                          Продолжить
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                            disabled={busyKey === `pause-${item.current?.id}`}
                            onClick={() => handlePauseMatch(item.current?.id)}
                          className="flex-1 gap-2 text-xs h-9"
                        >
                          <Pause size={14} />
                          Тех. пауза
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-center text-sm text-gray-400">
                    Бой не назначен
                  </div>
                )}
              </div>

              {/* Next Match */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">Следующий бой</h3>
                {item.next ? (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700">Бой #{item.next.match_number}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">
                        Готов
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center font-bold text-dark-text text-sm">
                        {item.next.athlete1}
                      </div>
                      <div className="text-xs font-bold text-blue-300">VS</div>
                      <div className="flex-1 text-center font-bold text-dark-text text-sm">
                        {item.next.athlete2}
                      </div>
                    </div>
                      <Button
                        onClick={() => handleStartMatch(item.next?.id)}
                        disabled={busyKey === `start-${item.next?.id}`}
                      className="w-full bg-dark-blue text-white hover:bg-primary-blue py-2 rounded-xl font-bold flex items-center justify-center gap-2 dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                    >
                      <Play size={16} />
                      {busyKey === `start-${item.next.id}` ? "Запуск..." : "Начать бой"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-center text-sm text-gray-400">
                    Очередь пуста
                  </div>
                )}
              </div>

              {/* Waiting List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">Ожидают</h3>
                  <span className="text-xs font-medium text-gray-400">{item.waiting.length} боёв</span>
                </div>
                <div className="space-y-2">
                  {item.waiting.map((m, idx) => (
                    <div key={m.id} className="p-3 bg-white border border-border rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-dark-text">
                          {m.athlete1} vs {m.athlete2}
                        </span>
                      </div>
                      <span className="text-gray-400">Бой #{m.match_number}</span>
                    </div>
                  ))}
                  {item.waiting.length === 0 && (
                    <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-center text-sm text-gray-400">
                      Нет ожидающих боёв
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      )}
    </div>
  )
}

function QueueDashboard({ queue, finished }: { queue: TatamiQueueItem[]; finished: FinishedFight[] }) {
  const nowFights = queue.flatMap((q) =>
    q.current ? [{ tatami: q.tatami.name, m: q.current }] : []
  )
  const nextFights = queue.flatMap((q) =>
    q.next ? [{ tatami: q.tatami.name, m: q.next }] : []
  )
  const waitingCount = queue.reduce((n, q) => n + q.waiting.length, 0)
  const stats = [
    { label: "Сейчас", value: nowFights.length },
    { label: "Следующие", value: nextFights.length },
    { label: "Ожидают", value: waitingCount },
    { label: "Завершено", value: finished.length },
  ]
  return (
    <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-light-gray border border-border px-4 py-3">
            <div className="text-2xl font-extrabold text-dark-text tabular-nums">{s.value}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-text mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">
            Сейчас на татами
          </h3>
          {nowFights.length === 0 && (
            <p className="text-sm text-secondary-text">Бои не идут. Запустите следующий бой.</p>
          )}
          {nowFights.map(({ tatami, m }) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-yellow-700 uppercase tracking-wide">{tatami}</div>
                <div className="text-sm font-bold text-dark-text truncate">
                  #{m.match_number}: {m.athlete1} vs {m.athlete2}
                </div>
              </div>
              <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                {m.status === "paused" ? "Пауза" : "LIVE"}
              </span>
            </div>
          ))}
          {nextFights.length > 0 && (
            <div className="pt-1 space-y-2">
              <h4 className="text-[11px] font-bold text-secondary-text uppercase tracking-wider">
                Следующие
              </h4>
              {nextFights.map(({ tatami, m }) => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-light-gray border border-border">
                  <span className="text-sm font-semibold text-dark-text truncate">
                    #{m.match_number}: {m.athlete1} vs {m.athlete2}
                  </span>
                  <span className="text-[11px] font-semibold text-secondary-text shrink-0">{tatami}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-secondary-text uppercase tracking-wider">
            Завершены
          </h3>
          {finished.length === 0 && (
            <p className="text-sm text-secondary-text">Пока ни один бой не завершён.</p>
          )}
          {finished.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-light-gray border border-border">
              <span className="text-sm font-semibold text-dark-text truncate">
                ✓ #{m.match_number}: {m.athlete1} vs {m.athlete2}
              </span>
              <span className="text-[11px] font-semibold text-secondary-text shrink-0">{m.round_name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
