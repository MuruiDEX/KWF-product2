"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import { isBracketEvent } from "@/lib/tournamentEvents"
import TournamentBracket, {
  ChampionBanner,
  type BracketMatchData,
  type BracketRoundData,
  type FinishPayload,
} from "@/components/Bracket"

interface BracketApiMatch {
  id: number
  match_number: number
  athlete1_id?: number | null
  athlete1?: { id: number; name?: string } | number | null
  athlete1_name?: string | null
  athlete2_id?: number | null
  athlete2?: { id: number; name?: string } | number | null
  athlete2_name?: string | null
  winner_id?: number | null
  winner?: { id: number; name?: string } | number | null
  winner_name?: string | null
  score1?: number
  score2?: number
  status: string
  tatami_name?: string | null
  tatami?: { name: string } | null
  start_time?: string | null
  previous_match1?: { id: number } | number | null
  previous_match2?: { id: number } | number | null
}

interface BracketApiRound {
  id: number | string
  name: string
  order: number
  status?: string
  matches?: BracketApiMatch[]
}

interface BracketApiCategory {
  id: number
  name: string
  gender?: string
  age_min?: number
  age_max?: number
  weight_max?: string | number
  rounds?: BracketApiRound[]
}

function idOf(v: { id: number } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  return typeof v === "number" ? v : v.id
}

function nameOf(v: { name?: string } | number | null | undefined): string | null {
  if (v === null || v === undefined || typeof v === "number") return null
  return v.name ?? null
}

function normalizeMatch(m: BracketApiMatch, roundName: string, categoryName: string): BracketMatchData {
  const a1id = m.athlete1_id ?? idOf(m.athlete1)
  const a2id = m.athlete2_id ?? idOf(m.athlete2)
  const wid = m.winner_id ?? idOf(m.winner)
  return {
    id: m.id,
    matchNumber: m.match_number,
    roundName,
    athlete1: { id: a1id ?? null, name: m.athlete1_name ?? nameOf(m.athlete1) },
    athlete2: { id: a2id ?? null, name: m.athlete2_name ?? nameOf(m.athlete2) },
    winnerId: wid ?? null,
    winnerName: m.winner_name ?? nameOf(m.winner),
    score1: m.score1 ?? 0,
    score2: m.score2 ?? 0,
    status: m.status,
    tatamiName: m.tatami_name ?? m.tatami?.name ?? null,
    startTime: m.start_time ?? null,
    categoryName,
    prevIds: [idOf(m.previous_match1), idOf(m.previous_match2)],
    isBye: m.status === "bye",
  }
}

function normalizeRounds(cat: BracketApiCategory): BracketRoundData[] {
  return [...(cat.rounds || [])]
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      id: r.id,
      name: r.name,
      order: r.order,
      status: r.status,
      matches: [...(r.matches || [])]
        .sort((a, b) => a.match_number - b.match_number)
        .map((m) => normalizeMatch(m, r.name, cat.name)),
    }))
}

function nextIds(rounds: BracketRoundData[]): number[] {
  const open = rounds.find((r) =>
    r.matches.some((m) => m.status !== "finished" && !m.isBye)
  )
  if (!open) return []
  return open.matches.filter((m) => m.status === "ready").map((m) => m.id)
}

function championOf(rounds: BracketRoundData[]): string | null {
  const last = rounds[rounds.length - 1]
  const champ = last?.matches.find((m) => m.winnerId !== null)
  if (!champ) return null
  return (
    champ.winnerName ??
    (champ.winnerId === champ.athlete1.id ? champ.athlete1.name : champ.athlete2.name)
  )
}

function TatamiGroups({ rounds }: { rounds: BracketRoundData[] }) {
  const groups = new Map<string, { round: string; m: BracketMatchData }[]>()
  rounds.forEach((r) =>
    r.matches.forEach((m) => {
      const key = m.tatamiName ?? "Без татами"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push({ round: r.name, m })
    })
  )
  if (groups.size === 0) return null
  return (
    <div className="mt-6">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-text mb-3">
        Матчи по татами
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...groups.entries()].map(([tatami, items]) => (
          <div key={tatami} className="rounded-xl border border-border bg-white p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-dark-blue text-white">
                {tatami === "Без татами" ? tatami : `Татами ${tatami}`}
              </span>
              <span className="text-[11px] font-semibold text-secondary-text tabular-nums">
                {items.length} б.
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map(({ round, m }) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-secondary-text truncate">
                    {round} · #{m.matchNumber}
                  </span>
                  <span className="font-semibold text-dark-text truncate">
                    {m.athlete1.name ?? "TBD"} – {m.athlete2.name ?? "TBD"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategorySection({
  cat,
  onFinish,
  onStartRound,
  startingRoundId,
  finishingId,
  flashId,
  onReopen,
  reopeningId,
}: {
  cat: BracketApiCategory
  onFinish: (matchId: number, payload: FinishPayload) => Promise<void>
  onStartRound: (roundId: number | string) => Promise<void>
  startingRoundId: number | string | null
  finishingId: number | null
  flashId: number | null
  onReopen: (matchId: number) => Promise<void>
  reopeningId: number | null
}) {
  const rounds = normalizeRounds(cat)
  const champion = championOf(rounds)
  return (
    <div key={cat.id} className="mb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-light-gray rounded-2xl border border-border p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-dark-text">{cat.name}</h2>
            <div className="text-sm text-secondary-text mt-1">
              {cat.gender === "male" ? "Мальчики" : cat.gender === "female" ? "Девочки" : "Смешанная"} · {cat.age_min}–{cat.age_max} лет · до {cat.weight_max} кг
            </div>
          </div>
        </div>
        {champion && <ChampionBanner name={champion} />}
        {rounds.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-secondary-text mb-4">Сетка ещё не создана</p>
          </div>
        ) : (
          <>
            <TournamentBracket
              rounds={rounds}
              interactive
              finishingId={finishingId}
              nextMatchIds={nextIds(rounds)}
              flashMatchId={flashId}
              onFinish={onFinish}
              onStartRound={onStartRound}
              startingRoundId={startingRoundId}
              canManageRounds
              reopeningId={reopeningId}
              onReopen={onReopen}
            />
            <TatamiGroups rounds={rounds} />
          </>
        )}
      </motion.div>
    </div>
  )
}

/** Интерактивные сетки всех категорий турнира: финиш, переоткрытие, старт раунда.
 * Используется и на отдельной странице сетки, и табом в Control Center. */
export default function TournamentBrackets({ tournamentId }: { tournamentId: string | number }) {
  const [tournament, setTournament] = useState<{ categories?: BracketApiCategory[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [startingRoundId, setStartingRoundId] = useState<number | string | null>(null)
  const [reopeningId, setReopeningId] = useState<number | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  const fetchTournament = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const data = await api<{ categories?: BracketApiCategory[] }>(`/api/tournament/tournaments/${tournamentId}/bracket_state/`)
        setTournament(data)
        return data
      } catch (e) {
        console.error(e)
        return null
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [tournamentId]
  )

  useEffect(() => {
    void fetchTournament(false)
  }, [fetchTournament])

  // Realtime: событие сетки → тихий refetch (debounce против пачки).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])
  useTournamentEvents(tournamentId, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch, resync) => {
        if (!resync && !batch.some(isBracketEvent)) return
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null
          void fetchTournament(true)
        }, 400)
      },
      [fetchTournament]
    ),
  })

  const handleStartRound = useCallback(
    async (roundId: number | string) => {
      setStartingRoundId(roundId)
      try {
        await api(`/api/tournament/rounds/${roundId}/start/`, { method: "POST" })
        await fetchTournament(true)
      } catch (e) {
        console.error(e)
        alert(apiErrorMessage(e))
      } finally {
        setStartingRoundId(null)
      }
    },
    [fetchTournament]
  )

  const handleFinish = useCallback(
    async (matchId: number, payload: FinishPayload) => {
      setFinishingId(matchId)
      try {
        // Единый путь финиша: полный цикл (продвижение, раунд, очередь)
        // выполняется сервером в одной транзакции.
        await api(`/api/tournament/matches/${matchId}/finish_match/`, {
          method: "POST",
          body: JSON.stringify({
            winner_id: payload.winnerId,
            score1: payload.score1,
            score2: payload.score2,
          }),
        })
        const fresh = await fetchTournament(true)
        const advancedId = (() => {
          if (!fresh?.categories) return null
          for (const cat of fresh.categories) {
            for (const r of cat.rounds || []) {
              for (const m of r.matches || []) {
                const prev = [m.previous_match1, m.previous_match2]
                  .map((p) => idOf(p))
                  .filter((v) => v !== null && v !== undefined)
                if (!prev.includes(matchId)) continue
                const a1 = m.athlete1_id ?? idOf(m.athlete1)
                const a2 = m.athlete2_id ?? idOf(m.athlete2)
                if (a1 === payload.winnerId || a2 === payload.winnerId) return m.id as number
              }
            }
          }
          return null
        })()
        if (flashTimer.current) clearTimeout(flashTimer.current)
        setFlashId(advancedId ?? matchId)
        flashTimer.current = setTimeout(() => setFlashId(null), 1500)
      } catch (e) {
        console.error(e)
        alert(apiErrorMessage(e))
      } finally {
        setFinishingId(null)
      }
    },
    [fetchTournament]
  )

  const handleReopen = useCallback(
    async (matchId: number) => {
      if (!window.confirm("Переоткрыть бой? Результат будет откачен, победитель вернётся из следующего боя (если тот ещё не начался).")) {
        return
      }
      setReopeningId(matchId)
      try {
        await api(`/api/tournament/matches/${matchId}/reopen/`, { method: "POST" })
        await fetchTournament(true)
      } catch (e) {
        console.error(e)
        alert(apiErrorMessage(e))
      } finally {
        setReopeningId(null)
      }
    },
    [fetchTournament]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-secondary-text">Турнир не найден</p>
      </div>
    )
  }

  if (!tournament.categories || tournament.categories.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-border">
        <p className="text-secondary-text">У этого турнира пока нет категорий</p>
      </div>
    )
  }

  return (
    <div>
      {tournament.categories?.map((cat) => (
        <CategorySection
          key={cat.id}
          cat={cat}
          onFinish={handleFinish}
          onStartRound={handleStartRound}
          startingRoundId={startingRoundId}
          finishingId={finishingId}
          flashId={flashId}
          onReopen={handleReopen}
          reopeningId={reopeningId}
        />
      ))}
    </div>
  )
}
