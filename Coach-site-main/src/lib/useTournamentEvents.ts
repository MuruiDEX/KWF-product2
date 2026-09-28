"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api, apiBaseUrl } from "@/lib/api"
import type { TournamentEvent, TournamentEventsResponse } from "@/lib/tournamentEvents"
import {
  buildStreamUrl,
  normalizeSSEFrame,
  parseSSEBlocks,
  sseBackoffMs,
  SSE_FAILURES_BEFORE_FALLBACK,
  SSE_REPROBE_MS,
  type EventsTransport,
} from "@/lib/liveTransport"

export type EventsSyncStatus = "live" | "reconnecting" | "offline"

const POLL_BASE_MS = 2000
const POLL_MAX_MS = 30000
const SEEN_CAP = 2000
/** Если пришло ровно столько — возможна обрезка, нужен полный resync. */
export const EVENTS_PAGE_CAP = 200
/** SSE без единого чанка дольше — считаем мёртвым. */
const SSE_STALL_MS = 45000

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

/** Подписка на ленту событий турнира: SSE-first, polling-fallback.
 *
 * Транспорт скрыт от компонентов: оба пути нормализуются к TournamentEvent
 * и идут через единый ingest (decideSync → onEvents). Одновременно активен
 * только один транспорт. SSE обрывается heartbeat-паузами сервера и
 * Last-Event-ID replay — пропущенное не теряется, дубли отсекаются по id.
 *
 * M10/Phase 6 — контракт realtime (push/WS нет):
 * - SSE: поток events/stream/, reconnect 1s→30s, после 3 провалов —
 *   polling-fallback с репробой SSE каждые 30s;
 * - порядок гарантируется якорем lastId, а не временем прихода;
 * - таймеры боёв считаются локально из server-side remaining
 *   (см. FightTimer в LiveQueue).
 */
export function useTournamentEvents(
  tournamentId: string | number | string[] | null | undefined,
  { onEvents, enabled = true, intervalMs = POLL_BASE_MS }: UseTournamentEventsOptions = {}
): { status: EventsSyncStatus; lastId: number; transport: EventsTransport } {
  const tid = Array.isArray(tournamentId) ? tournamentId[0] : tournamentId
  const [status, setStatus] = useState<EventsSyncStatus>(() =>
    typeof navigator === "undefined" || navigator.onLine ? "live" : "offline"
  )
  const [lastId, setLastId] = useState(0)
  const [transport, setTransport] = useState<EventsTransport>(() =>
    typeof navigator === "undefined" || navigator.onLine ? "sse" : "offline"
  )
  const lastIdRef = useRef(0)
  const seenRef = useRef<Set<number>>(new Set())
  const errorsRef = useRef(0)
  const anchoredRef = useRef(false)
  const sseFailsRef = useRef(0)
  const modeRef = useRef<"idle" | "sse" | "polling">("idle")
  const genRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEventsRef = useRef(onEvents)

  useEffect(() => {
    onEventsRef.current = onEvents
  }, [onEvents])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Остановка транспортов без инвалидации поколения (для стартеров ниже). */
  const teardown = useCallback(() => {
    clearTimer()
    abortRef.current?.abort()
    abortRef.current = null
    modeRef.current = "idle"
  }, [clearTimer])

  /** Полная остановка (cleanup/unmount/hidden/offline): старое поколение мёртво. */
  const stopTransports = useCallback(() => {
    genRef.current += 1
    teardown()
  }, [teardown])

  /** Единый процессор событий обоих транспортов. */
  const ingest = useCallback(
    (events: TournamentEvent[], latestId: number, truncated: boolean) => {
      const decision = decideSync(lastIdRef.current, seenRef.current, events, latestId)
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
      if (!anchoredRef.current) {
        // Первый батч после монтирования — только якорь: полные данные
        // родитель уже загрузил обычным REST, историю гнать не нужно.
        anchoredRef.current = true
        return
      }
      if (decision.batch.length > 0 || decision.fullResync || truncated) {
        onEventsRef.current?.(decision.batch, decision.fullResync || truncated)
      }
    },
    []
  )

  const pollOnce = useCallback(async () => {
    if (!tid) return
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
    ingest(data.events, data.latest_id, !!data.truncated)
  }, [tid, ingest])

  const startPolling = useCallback(() => {
    teardown()
    const gen = genRef.current + 1
    genRef.current = gen
    modeRef.current = "polling"
    setTransport("polling")
    const loop = async () => {
      if (gen !== genRef.current) return
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        timerRef.current = setTimeout(loop, POLL_BASE_MS)
        return
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("offline")
        setTransport("offline")
        timerRef.current = setTimeout(loop, POLL_BASE_MS)
        return
      }
      await pollOnce()
      if (gen !== genRef.current) return
      const base = Math.max(500, intervalMs || POLL_BASE_MS)
      const delay = base * 2 ** Math.min(errorsRef.current, 4)
      timerRef.current = setTimeout(loop, Math.min(delay, POLL_MAX_MS))
    }
    void loop()
  }, [pollOnce, intervalMs, teardown])

  const reprobeSSE = useCallback(() => {
    // Репроба SSE из fallback — только если fallback ещё активен.
    if (modeRef.current === "polling") startSSE()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startSSE = useCallback(() => {
    teardown()
    const gen = genRef.current + 1
    genRef.current = gen
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline")
      setTransport("offline")
      modeRef.current = "idle"
      return
    }
    modeRef.current = "sse"
    setTransport("sse")
    const attempt = sseFailsRef.current
    if (attempt > 0) setStatus("reconnecting")
      const connect = async () => {
        if (gen !== genRef.current) return
        const controller = new AbortController()
        abortRef.current = controller
        let lastChunk = Date.now()
        const watchdog = setInterval(() => {
          if (Date.now() - lastChunk > SSE_STALL_MS) controller.abort()
        }, 5000)
        try {
          // Без кастомных заголовков: Accept: text/event-stream отвергается
          // DRF content negotiation (406), а Last-Event-ID дублирует ?after=
          // из URL. Простой GET = без preflight, куки уходят credentials:include.
          const res = await fetch(
            buildStreamUrl(apiBaseUrl(), String(tid), lastIdRef.current),
            {
              credentials: "include",
              signal: controller.signal,
            }
          )
          if (!res.ok || !res.body) throw new Error(`sse ${res.status}`)
          sseFailsRef.current = 0
          setStatus("live")
          setTransport("sse")
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ""
          for (;;) {
            const { done, value } = await reader.read()
            if (gen !== genRef.current) {
              try {
                await reader.cancel()
              } catch {
                /* ignore */
              }
              break
            }
            if (done) break
            lastChunk = Date.now()
            buffer += decoder.decode(value, { stream: true })
            const blocks = buffer.split("\n\n")
            buffer = blocks.pop() ?? ""
            const events: TournamentEvent[] = []
            let maxId = lastIdRef.current
            for (const frame of parseSSEBlocks(blocks.join("\n\n"))) {
              const ev = normalizeSSEFrame(frame)
              if (!ev) continue
              events.push(ev)
              if (ev.id > maxId) maxId = ev.id
            }
            if (events.length > 0) ingest(events, maxId, events.length >= EVENTS_PAGE_CAP)
          }
          throw new Error("sse closed")
        } catch (e) {
          if (gen !== genRef.current) return
          if ((e as Error)?.name === "AbortError" && modeRef.current !== "sse") return
          sseFailsRef.current += 1
          setStatus("reconnecting")
          if (sseFailsRef.current >= SSE_FAILURES_BEFORE_FALLBACK) {
            startPolling()
            // Репроба SSE из fallback — чиним основной транспорт без reload.
            timerRef.current = setTimeout(reprobeSSE, SSE_REPROBE_MS)
            return
          }
          timerRef.current = setTimeout(() => {
            if (gen === genRef.current) startSSE()
          }, sseBackoffMs(sseFailsRef.current))
        } finally {
          clearInterval(watchdog)
          if (abortRef.current === controller) abortRef.current = null
        }
      }
      void connect()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tid, ingest, startPolling, reprobeSSE]
  )

  // Смена турнира — сбрасываем якорь и дедупликацию, иначе мусор прошлого турнира
  // отсечёт события нового как «старые/виденные».
  useEffect(() => {
    lastIdRef.current = 0
    seenRef.current = new Set()
    errorsRef.current = 0
    anchoredRef.current = false
    sseFailsRef.current = 0
    // Однократный сброс якоря при смене id — намеренный setState в effect,
    // не каскад: срабатывает только на смену tid.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastId(0)
  }, [tid])

  useEffect(() => {
    if (!enabled || !tid) {
      stopTransports()
      return
    }
    sseFailsRef.current = 0
    anchoredRef.current = false
    startSSE()
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        sseFailsRef.current = 0
        startSSE()
      } else {
        // Скрытая вкладка: соединение не держим, якорь цел —
        // пропущенное догрузится replay при возврате.
        stopTransports()
      }
    }
    const onOnline = () => {
      errorsRef.current = 0
      sseFailsRef.current = 0
      startSSE()
    }
    const onOffline = () => {
      stopTransports()
      setStatus("offline")
      setTransport("offline")
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      stopTransports()
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [enabled, tid, startSSE, stopTransports])

  return { status, lastId, transport }
}
