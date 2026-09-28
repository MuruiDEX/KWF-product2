"use client"

import { useCallback, useEffect, useState } from "react"
import { api, apiErrorMessage } from "@/lib/api"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import { isBracketEvent, isQueueEvent, type TournamentEvent } from "@/lib/tournamentEvents"
import type {
  FinishedFight,
  TatamiQueueItem,
} from "@/components/LiveQueue"

interface TatamiQueueState {
  queue: TatamiQueueItem[]
  finished: FinishedFight[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/** Лёгкий доступ к tatami_queue для вкладки «Расписание».
 * Без собственного polling: загрузка при монтировании + обновление по SSE
 * (LiveQueue при этом не смонтирован — дублирующих опросов нет). */
export function useTatamiQueue(tournamentId: string | number): TatamiQueueState {
  const [queue, setQueue] = useState<TatamiQueueItem[]>([])
  const [finished, setFinished] = useState<FinishedFight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ queue: TatamiQueueItem[]; recent_finished: FinishedFight[] }>(
        `/api/tournament/tournaments/${tournamentId}/tatami_queue/`
      )
      setQueue(data.queue)
      setFinished(data.recent_finished)
      setError(null)
    } catch (e) {
      console.error(e)
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => {
    // Первичная загрузка очереди (прецедент: ActivityFeed).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  useTournamentEvents(tournamentId, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch: TournamentEvent[], resync: boolean) => {
        if (!resync && !batch.some((e) => isBracketEvent(e) || isQueueEvent(e))) return
        void load()
      },
      [load]
    ),
  })

  return { queue, finished, loading, error, refresh: () => void load() }
}
