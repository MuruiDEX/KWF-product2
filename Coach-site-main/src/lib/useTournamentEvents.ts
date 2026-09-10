"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import type { TournamentEvent, TournamentEventsResponse } from "@/lib/tournamentEvents"

export type EventsSyncStatus = "live" | "reconnecting" | "offline"

const POLL_BASE_MS = 2000
const POLL_MAX_MS = 30000
const SEEN_CAP = 2000
/** Если пришло ровно столько — возможна обрезка, нужен полный resync. */
export const EVENTS_PAGE_CAP = 200

export interface SyncDecision {
  /** Новые, не виденные ранее события (уже после prevLastId). */
  batch: TournamentEvent[]
  /** Новый якорь. */
  lastId: number
  /** true, если лента могла обрезаться — вызывающей стороне сделать полный refetch. */
  fullResync: boolean
}

/** Чистая функция: дедупликация + якорь + детект обрезки. Покрыта vitest. */
export function decideSync(
  prevLastId: number,
  seen: ReadonlySet<number>,
  events: TournamentEvent[],
  latestId: number
): SyncDecision {
  const batch = events.filter((e) => e.id > prevLastId && !seen.has(e.id))
  const maxBatch = batch.reduce((m, e) => Math.max(m, e.id), prevLastId)
  const lastId = Math.max(prevLastId, latestId, maxBatch)
  return {
    batch,
    lastId,
    fullResync: events.length >= EVENTS_PAGE_CAP,
  }
}

interface UseTournamentEventsOptions {
  /** Вызывается дедуплицированным батчем (и при fullResync тоже — батч может быть пуст). */
  onEvents?: TournamentEventsHandler
  /** false — подписка приостановлена (по умолчанию true). */
  enabled?: boolean
  intervalMs?: number
}

/** Сигнатура колбэка событий (для явной аннотации useCallback на вызывающей стороне). */
export type TournamentEventsHandler = (
  events: TournamentEvent[],
  resync: boolean
) => void

/** Подписка на ленту событий турнира.
 *
 * Стратегия: лёгкий опрос `events/?after=` только когда вкладка видима
 * и есть сеть; backoff при ошибках; reconnect → полный resync через
 * колбэк. Дубли/перестановки безвредны: вызывающая сторона делает
 * идемпотентный refetch, а не merge.
 */
export function useTournamentEvents(
  tournamentId: string | number | string[] | null | undefined,
  { onEvents, enabled = true, intervalMs = POLL_BASE_MS }: UseTournamentEventsOptions = {}
): { status: EventsSyncStatus; lastId: number } {
  const tid = Array.isArray(tournamentId) ? tournamentId[0] : tournamentId
  const [status, setStatus] = useState<EventsSyncStatus>(() =>
    typeof navigator === "undefined" || navigator.onLine ? "live" : "offline"
  )
  const [lastId, setLastId] = useState(0)
  const lastIdRef = useRef(0)
  const seenRef = useRef<Set<number>>(new Set())
  const errorsRef = useRef(0)
  const onEventsRef = useRef(onEvents)

  useEffect(() => {
    onEventsRef.current = onEvents
  }, [onEvents])

  // Смена турнира — сбрасываем якорь и дедупликацию, иначе мусор прошлого турнира
  // отсечёт события нового как «старые/виденные».
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    lastIdRef.current = 0
    seenRef.current = new Set()
    errorsRef.current = 0
    setLastId(0)
  }, [tid])

  const poll = useCallback(async () => {
    if (!tid) return
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline")
      return
    }
    let data: TournamentEventsResponse
    try {
      data = await api<TournamentEventsResponse>(
        `/api/tournament/tournaments/${tid}/events/?after=${lastIdRef.current}`
      )
    } catch {
      errorsRef.current += 1
      setStatus("reconnecting")
      return
    }
    errorsRef.current = 0
    setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "live")
    // Первый опрос после монтирования — только якорь: полные данные
    // родитель уже загрузил обычным REST, историю гнать не нужно.
    const initial = lastIdRef.current === 0 && seenRef.current.size === 0
    const decision = decideSync(lastIdRef.current, seenRef.current, data.events, data.latest_id)
    for (const e of decision.batch) {
      seenRef.current.add(e.id)
      if (seenRef.current.size > SEEN_CAP) {
        const overflow = seenRef.current.size - SEEN_CAP
        const it = seenRef.current.values()
        for (let i = 0; i < overflow; i++) {
          const v = it.next()
          if (!v.done) seenRef.current.delete(v.value)
        }
      }
    }
    lastIdRef.current = decision.lastId
    setLastId(decision.lastId)
    if (!initial && (decision.batch.length > 0 || decision.fullResync)) {
      onEventsRef.current?.(decision.batch, decision.fullResync)
    }
  }, [tid])

  useEffect(() => {
    if (!enabled || !tid) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const loop = async () => {
      if (stopped) return
      await poll()
      if (stopped) return
      const base = Math.max(500, intervalMs || POLL_BASE_MS)
      const delay = base * 2 ** Math.min(errorsRef.current, 4)
      const capped = Math.min(delay, POLL_MAX_MS)
      timer = setTimeout(loop, capped)
    }
    void loop()
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll()
    }
    const onOnline = () => {
      errorsRef.current = 0
      setStatus("live")
      void poll()
    }
    const onOffline = () => setStatus("offline")
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [enabled, tid, poll, intervalMs])

  return { status, lastId }
}
