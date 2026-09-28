import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { TatamiQueueItem, QueueMatch } from "@/components/LiveQueue"

export type MyFightState = "live" | "next" | "waiting"

export interface MyNextFight {
  match: QueueMatch
  tatamiName: string
  tournamentId: number
  state: MyFightState
}

interface QueueResponse {
  queue: TatamiQueueItem[]
  recent_finished?: unknown[]
}

const STATE_RANK: Record<MyFightState, number> = {
  live: 0,
  next: 1,
  waiting: 2,
}

function involves(match: QueueMatch, kids: ReadonlySet<number>): boolean {
  return (
    (match.athlete1_id !== null && kids.has(match.athlete1_id)) ||
    (match.athlete2_id !== null && kids.has(match.athlete2_id))
  )
}

/** Чистая функция: лучший бой моих детей по очередям турниров.
 * Приоритет: сейчас на татами > следующий > ожидание с минимальным ETA. */
export function findMyNextFight(
  kidIds: number[],
  queues: { tournamentId: number; queue: TatamiQueueItem[] }[]
): MyNextFight | null {
  const kids = new Set(kidIds)
  let best: MyNextFight | null = null
  const consider = (cand: MyNextFight) => {
    if (!best) {
      best = cand
      return
    }
    const rankDiff = STATE_RANK[cand.state] - STATE_RANK[best.state]
    if (rankDiff < 0) {
      best = cand
      return
    }
    if (rankDiff === 0) {
      const candEta = cand.match.eta_seconds ?? Number.MAX_SAFE_INTEGER
      const bestEta = best.match.eta_seconds ?? Number.MAX_SAFE_INTEGER
      if (candEta < bestEta) best = cand
    }
  }
  for (const { tournamentId, queue } of queues) {
    for (const item of queue) {
      if (item.current && involves(item.current, kids)) {
        consider({
          match: item.current,
          tatamiName: item.tatami.name,
          tournamentId,
          state: "live",
        })
      }
      if (item.next && involves(item.next, kids)) {
        consider({
          match: item.next,
          tatamiName: item.tatami.name,
          tournamentId,
          state: "next",
        })
      }
      for (const w of item.waiting) {
        if (involves(w, kids)) {
          consider({
            match: w,
            tatamiName: item.tatami.name,
            tournamentId,
            state: "waiting",
          })
        }
      }
    }
  }
  return best
}

/** Хук: тянет очереди турниров моих детей и считает лучший бой. */
export function useMyNextFight(
  kidIds: number[],
  tournamentIds: number[],
  options: { pollMs?: number } = {}
): { fight: MyNextFight | null; loading: boolean } {
  const { pollMs = 0 } = options
  const [fight, setFight] = useState<MyNextFight | null>(null)
  const [loading, setLoading] = useState(false)
  const kidsKey = [...kidIds].sort((a, b) => a - b).join(",")
  const tournamentsKey = [...new Set(tournamentIds)]
    .sort((a, b) => a - b)
    .join(",")

  useEffect(() => {
    if (kidIds.length === 0 || tournamentIds.length === 0) {
      // Сброс при пустых входах — setState в effect здесь оправдан
      // (тот же паттерн, что в useTournamentEvents при смене турнира).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFight(null)
      setLoading(false)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    setLoading(true)
    const uniqueTids = [...new Set(tournamentIds)]
    // F1: опрос очереди для живых уведомлений (по умолчанию выключен —
    // старый одноразовый режим сохраняется). Гонки закрыты seq-номером,
    // на скрытой вкладке — пропуск тика без потери таймера.
    let seq = 0
    const schedule = () => {
      if (pollMs <= 0 || cancelled) return
      timer = setTimeout(() => {
        if (cancelled) return
        if (
          typeof document !== "undefined" &&
          document.visibilityState !== "visible"
        ) {
          schedule()
          return
        }
        fetchAll()
      }, pollMs)
    }
    const fetchAll = () => {
      const mySeq = ++seq
      Promise.all(
        uniqueTids.map(async (tid) => {
          try {
            const data = await api<QueueResponse>(
              `/api/tournament/tournaments/${tid}/tatami_queue/`
            )
            return { tournamentId: tid, queue: data.queue ?? [] }
          } catch {
            return { tournamentId: tid, queue: [] as TatamiQueueItem[] }
          }
        })
      ).then((queues) => {
        if (cancelled || mySeq !== seq) return
        setFight(findMyNextFight(kidIds, queues))
        setLoading(false)
        schedule()
      })
    }
    fetchAll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidsKey, tournamentsKey, pollMs])

  return { fight, loading }
}
