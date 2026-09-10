"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import  Link  from "next/link"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import { isBracketEvent, type TournamentEvent } from "@/lib/tournamentEvents"
import type { Tournament, TournamentCategory, Match } from "@/lib/types"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import TournamentTimeline from "@/components/TournamentTimeline"
import TournamentSchedule from "@/components/TournamentSchedule"
import { Trophy } from "lucide-react"

import TournamentBracket, {
  ChampionBanner,
  type BracketMatchData,
  type BracketRoundData,
  type FinishPayload,
} from "@/components/Bracket"

function normalizeMatch(m: Match, roundName: string, categoryName: string): BracketMatchData {
  return {
    id: m.id,
    matchNumber: m.match_number,
    roundName,
    athlete1: { id: m.athlete1, name: m.athlete1_name },
    athlete2: { id: m.athlete2, name: m.athlete2_name },
    winnerId: m.winner,
    winnerName: m.winner_name,
    score1: m.score1,
    score2: m.score2,
    status: m.status,
    tatamiName: m.tatami_name,
    startTime: m.start_time ?? null,
    categoryName,
    prevIds: [m.previous_match1 ?? null, m.previous_match2 ?? null],
    isBye: m.status === "bye",
  }
}

function normalizeRounds(cat: TournamentCategory): BracketRoundData[] {
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


export default function TournamentDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [startingRoundId, setStartingRoundId] = useState<number | string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStaff = user?.is_staff ?? false

  useEffect(() => {
    api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
      .then(setTournament)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.slug])

  // Realtime (только чтение): чужие изменения подтягиваются автоматически.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])
  useTournamentEvents(params.slug, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch: TournamentEvent[], resync: boolean) => {
        if (!resync && !batch.some(isBracketEvent)) return
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null
          api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
            .then(setTournament)
            .catch(() => {})
        }, 500)
      },
      [params.slug]
    ),
  })

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [])

  const handleFinish = useCallback(
    async (matchId: number, payload: FinishPayload) => {
      setFinishingId(matchId)
      try {
        // Единый путь финиша (PATCH напрямую запрещён guard'ом backend).
        await api(`/api/tournament/matches/${matchId}/finish_match/`, {
          method: "POST",
          body: JSON.stringify({
            winner_id: payload.winnerId,
            score1: payload.score1,
            score2: payload.score2,
          }),
        })
        const updated = await api<Tournament>(
          `/api/tournament/tournaments/${params.slug}/`
        )
        setTournament(updated)
        const advancedId = (() => {
          for (const cat of updated.categories || []) {
            for (const r of cat.rounds || []) {
              for (const m of r.matches || []) {
                const prev = [m.previous_match1, m.previous_match2].filter(
                  (v) => v !== null && v !== undefined
                )
                if (!prev.includes(matchId)) continue
                if (m.athlete1 === payload.winnerId || m.athlete2 === payload.winnerId) {
                  return m.id
                }
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
    [params.slug]
  )

  const handleStartRound = useCallback(
    async (roundId: number | string) => {
      setStartingRoundId(roundId)
      try {
        await api(`/api/tournament/rounds/${roundId}/start/`, { method: "POST" })
        const updated = await api<Tournament>(
          `/api/tournament/tournaments/${params.slug}/`
        )
        setTournament(updated)
      } catch (e) {
        console.error(e)
        alert(apiErrorMessage(e))
      } finally {
        setStartingRoundId(null)
      }
    },
    [params.slug]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-secondary-text">Турнир не найден</p>
        <Link
          href="/tournaments"
          className="text-sm font-semibold text-primary-blue hover:text-primary-blue-light"
        >
          ← Ко всем турнирам
        </Link>
      </div>
    )
  }

  const sortedCategories = [...(tournament.categories || [])].sort(
    (a, b) => a.order - b.order
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link
            href="/tournaments"
            className="inline-flex items-center text-sm font-semibold text-primary-blue hover:text-primary-blue-light mb-6 transition-colors"
          >
            ← Ко всем турнирам
          </Link>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl md:text-4xl font-extrabold text-dark-text">
              {tournament.name}
            </h1>
            {tournament.status && (
              <StatusPill status={tournament.status} />
            )}
          </div>

          <div className="text-sm text-secondary-text mb-8">
            {new Date(tournament.start_date).toLocaleDateString("ru-RU")} —{" "}
            {new Date(tournament.end_date).toLocaleDateString("ru-RU")}
          </div>

          {tournament.description && (
            <p className="text-secondary-text mb-8 max-w-2xl">
              {tournament.description}
            </p>
          )}
          <TournamentTimeline status={tournament.status} className="mb-6" />
        </motion.div>

        <TournamentSchedule tournamentId={params.slug as string} />

        {sortedCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<Trophy size={26} />}
              title="Категорий пока нет"
              hint="Организатор ещё не опубликовал категории и сетку этого турнира"
            />
          </div>
        ) : (
          sortedCategories.map((cat) => {
            const rounds = normalizeRounds(cat)
            const champion = championOf(rounds)
            const hasLive = rounds.some((r) =>
              r.matches.some((m) => m.status === "in_progress")
            )
            return (
              <section
                key={cat.id}
                aria-label={`Категория: ${cat.name}`}
                className={`mb-12 rounded-3xl border-2 p-4 sm:p-6 transition-colors ${
                  hasLive
                    ? "border-gold/70 shadow-lg shadow-gold/10"
                    : "border-[#1E3A5F]"
                }`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-light-gray rounded-2xl border border-border p-4 mb-4"
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-text mb-1">
                    Категория
                  </div>
                  <h2 className="text-xl font-bold text-dark-text">
                    {cat.name}
                  </h2>
                  <div className="text-sm text-secondary-text mt-1">
                    Возраст: {cat.age_min}–{cat.age_max} лет · Вес: до{" "}
                    {cat.weight_max} кг ·{" "}
                    {cat.gender === "male"
                      ? "Мальчики"
                      : cat.gender === "female"
                        ? "Девочки"
                        : "Любые"}
                  </div>
                  <div className="text-sm text-secondary-text mt-1">
                    Участников: {cat.athletes?.length || 0}
                  </div>
                </motion.div>

                {champion && <ChampionBanner name={champion} />}
                {rounds.length === 0 ? (
                  <p className="text-secondary-text py-8">
                    Сетка ещё не создана
                  </p>
                ) : (
                  <TournamentBracket
                    rounds={rounds}
                    interactive={isStaff}
                    finishingId={finishingId}
                    nextMatchIds={nextIds(rounds)}
                    flashMatchId={flashId}
                    onFinish={handleFinish}
                    onStartRound={handleStartRound}
                    startingRoundId={startingRoundId}
                    canManageRounds={isStaff}
                  />
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
