"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import  Link  from "next/link"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import {
  isAnnouncementEvent,
  isBracketEvent,
  type TournamentEvent,
  type TournamentEventsResponse,
} from "@/lib/tournamentEvents"
import {
  isFullBracketResponse,
  mergeBracketMatches,
  type BracketDeltaResponse,
} from "@/lib/bracketDelta"
import type { Tournament, TournamentCategory, Match } from "@/lib/types"
import { championOf } from "@/lib/bracketUtils"
import { Search } from "lucide-react"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { toast } from "@/components/ui/Toaster"
import TournamentTimeline from "@/components/TournamentTimeline"
import TournamentSchedule from "@/components/TournamentSchedule"
import { TournamentProgress } from "@/components/TournamentProgress"
import { AnnouncementBanner } from "@/components/AnnouncementBanner"
import { Trophy, CalendarDays } from "lucide-react"
import { buildIcs, downloadIcs, tournamentToIcs } from "@/lib/ics"

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
  // Как в TournamentBrackets: «следующие» — только бои идущих раундов.
  const live = rounds.filter((r) =>
    r.matches.some((m) => m.status === "in_progress" || m.status === "paused")
  )
  return live.flatMap((r) =>
    r.matches.filter((m) => m.status === "ready").map((m) => m.id)
  )
}


export default function TournamentDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  // N11: повторная загрузка после ошибки (раньше — вечный «не найден»).
  const [reloadKey, setReloadKey] = useState(0)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [startingRoundId, setStartingRoundId] = useState<number | string | null>(null)
  // N7: активный таб категории + поиск бойца (до ранних return — хуки всегда вызываются).
  const [activeCatId, setActiveCatId] = useState<number | null>(null)
  const [fighterQuery, setFighterQuery] = useState("")
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStaff = user?.is_staff ?? false

  useEffect(() => {
    // L1: флаг отмены — быстрое переключение турниров/уход со страницы
    // не должны вызывать setState размонтированного компонента.
    let cancelled = false
    // N11: сброс скелетона перед запросом намеренный (fetch-effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
      .then((t) => {
        if (!cancelled) setTournament(t)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params.slug, reloadKey])

  // Realtime (только чтение): чужие изменения подтягиваются автоматически.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Фаза 6: якорь инкремента сетки (latest_id ленты событий).
  const anchorRef = useRef<number | null>(null)
  const fetchFull = useCallback(() => {
    anchorRef.current = null
    api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
      .then(setTournament)
      .catch(() => {})
  }, [params.slug])
  const fetchDelta = useCallback(() => {
    const anchor = anchorRef.current
    if (anchor === null) {
      fetchFull()
      return Promise.resolve()
    }
    return api<BracketDeltaResponse>(
      `/api/tournament/tournaments/${params.slug}/bracket_state/?since=${anchor}`
    )
      .then((data) => {
        anchorRef.current = data.latest_id
        if (isFullBracketResponse(data)) {
          fetchFull()
          return
        }
        setTournament((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            categories: mergeBracketMatches(
              prev.categories ?? [],
              data.changed ?? []
            ),
          }
        })
      })
      .catch(() => {
        fetchFull()
      })
  }, [params.slug, fetchFull])
  // Фаза 2: объявления организатора — баннером (последние 3).
  const [announcements, setAnnouncements] = useState<TournamentEvent[]>([])
  const pushAnnouncements = useCallback((batch: TournamentEvent[]) => {
    const fresh = batch.filter(isAnnouncementEvent)
    if (fresh.length === 0) return
    setAnnouncements((prev) => {
      const seen = new Set(prev.map((a) => a.id))
      const merged = [...prev]
      for (const a of fresh) {
        if (!seen.has(a.id)) merged.push(a)
      }
      return merged.slice(-3)
    })
  }, [])
  useEffect(() => {
    let cancelled = false
    anchorRef.current = null
    api<TournamentEventsResponse>(`/api/tournament/tournaments/${params.slug}/events/?after=0`)
      .then((data) => {
        if (cancelled) return
        anchorRef.current = data.latest_id
        pushAnnouncements(data.events)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [params.slug, pushAnnouncements])
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])
  useTournamentEvents(params.slug, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch: TournamentEvent[], resync: boolean) => {
        pushAnnouncements(batch)
        if (resync) {
          fetchFull()
          return
        }
        if (!batch.some(isBracketEvent)) return
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null
          void fetchDelta()
        }, 500)
      },
      [pushAnnouncements, fetchFull, fetchDelta]
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
        toast(apiErrorMessage(e), "error")
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
        toast(apiErrorMessage(e), "error")
      } finally {
        setStartingRoundId(null)
      }
    },
    [params.slug]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-16 space-y-6">
          <div className="h-10 w-2/3 rounded-lg bg-light-gray animate-pulse" aria-hidden="true" />
          <div className="h-4 w-1/3 rounded bg-light-gray animate-pulse" aria-hidden="true" />
          <SkeletonGrid label="Загрузка турнира…" />
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-16 space-y-6">
          <ErrorRetry
            title="Турнир не найден"
            hint="Проверьте ссылку или соединение — возможно, турнир удалён"
            onRetry={() => setReloadKey((k) => k + 1)}
          />
          <div className="text-center">
            <Link
              href="/tournaments"
              className="text-sm font-semibold text-primary-blue hover:text-primary-blue-light"
            >
              ← Ко всем турнирам
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const sortedCategories = [...(tournament.categories || [])].sort(
    (a, b) => a.order - b.order
  )

  // N7: виды категорий + активный таб (по умолчанию — идущая, иначе первая).
  const catViews = sortedCategories.map((cat) => {
    const rounds = normalizeRounds(cat)
    return {
      cat,
      rounds,
      champion: championOf(rounds),
      hasLive: rounds.some((r) =>
        r.matches.some((m) => m.status === "in_progress" || m.status === "paused")
      ),
    }
  })
  const activeView =
    catViews.find((v) => v.cat.id === activeCatId) ??
    catViews.find((v) => v.hasLive) ??
    catViews[0] ??
    null

  // N7: поиск бойца по всем сеткам (без запросов — по загруженному).
  const fighterResults = (() => {
    const q = fighterQuery.trim().toLowerCase()
    if (q.length < 2) return []
    const out: { matchId: number; catId: number; label: string; sub: string }[] = []
    for (const v of catViews) {
      for (const r of v.rounds) {
        for (const m of r.matches) {
          const label = `${m.athlete1.name ?? ""} — ${m.athlete2.name ?? ""}`.trim()
          if (!label || label === "—") continue
          if (label.toLowerCase().includes(q)) {
            out.push({
              matchId: m.id,
              catId: v.cat.id,
              label,
              sub: `${v.cat.name} · ${r.name} · Бой #${m.matchNumber}`,
            })
            if (out.length >= 8) return out
          }
        }
      }
    }
    return out
  })()

  const jumpToMatch = (catId: number, matchId: number) => {
    setActiveCatId(catId)
    setFighterQuery("")
    setTimeout(() => {
      document.getElementById(`match-${matchId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
  }

  // Фаза 1: прогресс турнира из уже загруженной сетки (без запросов).
  const { totalFights, finishedFights } = (() => {
    let total = 0
    let finished = 0
    for (const cat of tournament.categories || []) {
      for (const r of cat.rounds || []) {
        for (const m of r.matches || []) {
          if (m.status === "bye") continue
          total += 1
          if (m.status === "finished") finished += 1
        }
      }
    }
    return { totalFights: total, finishedFights: finished }
  })()

  return (
    <div className="min-h-screen bg-white dark:bg-[#07111F]">
      <div className="kwf-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Breadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Соревнования", href: "/tournaments" },
              { label: tournament.name },
            ]}
          />
          <PageHeader
            className="mt-4"
            eyebrow={tournament.location ?? "Соревнования"}
            title={tournament.name}
            description={tournament.description || undefined}
            meta={
              <>
                {tournament.status && <StatusPill status={tournament.status} />}
                <span className="text-sm text-secondary-text tabular-nums">
                  {new Date(tournament.start_date).toLocaleDateString("ru-RU")} —{" "}
                  {new Date(tournament.end_date).toLocaleDateString("ru-RU")}
                </span>
              </>
            }
            actions={
              <>
                <Link
                  href={`/tournaments/${params.slug}/board`}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-dark-blue text-white text-sm font-bold hover:bg-primary-blue transition-colors dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                >
                  Табло
                </Link>
                <Link
                  href={`/tournaments/${params.slug}/print`}
                  title="Печатный протокол для судей и секретариата"
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-white text-dark-text text-sm font-bold hover:border-primary-blue/40 transition-colors dark:bg-white/5 dark:text-white dark:border-white/15"
                >
                  Печать
                </Link>
                <button
                  type="button"
                  title="Скачать событие для календаря (.ics)"
                  onClick={() => {
                    const ev = tournamentToIcs(tournament)
                    if (ev) downloadIcs(`tournament-${tournament.slug}.ics`, buildIcs([ev]))
                  }}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-white text-dark-text text-sm font-bold hover:border-primary-blue/40 transition-colors cursor-pointer dark:bg-white/5 dark:text-white dark:border-white/15"
                >
                  <CalendarDays size={15} />
                  В календарь
                </button>
              </>
            }
          />
          <TournamentTimeline status={tournament.status} className="mt-2" />
          {totalFights > 0 && (
            <div className="max-w-md mt-4">
              <TournamentProgress total={totalFights} finished={finishedFights} />
            </div>
          )}
        </motion.div>

        <div className="mt-8 border-t border-border pt-8">
          <AnnouncementBanner items={announcements} />
          <TournamentSchedule tournamentId={params.slug as string} />
        </div>

        {catViews.length === 0 ? (
          <div className="mt-8 border-t border-border pt-8">
            <EmptyState
              icon={<Trophy size={26} />}
              title="Категорий пока нет"
              hint="Организатор ещё не опубликовал категории и сетку этого турнира"
            />
          </div>
        ) : (
          <div className="mt-8 border-t border-border pt-8">
            {catViews.some((v) => v.rounds.some((r) => r.matches.length > 0)) && (
              <div className="relative max-w-md mb-4">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
                />
                <label className="sr-only" htmlFor="fighter-search">
                  Найти спортсмена на турнире
                </label>
                <input
                  id="fighter-search"
                  type="search"
                  value={fighterQuery}
                  onChange={(e) => setFighterQuery(e.target.value)}
                  placeholder="Найти спортсмена…"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
                {fighterQuery.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border border-border bg-white shadow-xl overflow-hidden">
                    {fighterResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-secondary-text">
                        По запросу «{fighterQuery.trim()}» никого не найдено
                      </p>
                    ) : (
                      fighterResults.map((r) => (
                        <button
                          key={r.matchId}
                          type="button"
                          onClick={() => jumpToMatch(r.catId, r.matchId)}
                          className="w-full text-left px-4 py-2.5 hover:bg-light-gray transition-colors cursor-pointer"
                        >
                          <span className="block text-sm font-semibold text-dark-text truncate">
                            {r.label}
                          </span>
                          <span className="block text-xs text-secondary-text truncate">
                            {r.sub}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {catViews.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4" role="tablist" aria-label="Категории турнира">
                {catViews.map((v) => (
                  <button
                    key={v.cat.id}
                    type="button"
                    role="tab"
                    aria-selected={activeView?.cat.id === v.cat.id}
                    onClick={() => setActiveCatId(v.cat.id)}
                    className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap border transition-colors cursor-pointer ${
                      activeView?.cat.id === v.cat.id
                        ? "bg-dark-blue text-white border-dark-blue dark:bg-gold dark:text-dark-blue dark:border-gold"
                        : "bg-white text-secondary-text border-border hover:text-dark-text hover:border-primary-blue/40"
                    }`}
                  >
                    {v.hasLive && (
                      <span className="relative flex h-2 w-2" aria-hidden="true">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-error" />
                      </span>
                    )}
                    {v.cat.name}
                  </button>
                ))}
              </div>
            )}
            {activeView && (() => {
              const { cat, rounds, champion, hasLive } = activeView
              return (
              <section
                key={cat.id}
                aria-label={`Категория: ${cat.name}`}
                className="mt-6 rounded-2xl border border-border bg-white dark:bg-[#0E2035]"
              >
                <div
                  className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 sm:px-5 pt-4 pb-3 border-b border-border ${
                    hasLive ? "border-l-4 border-l-gold" : ""
                  }`}
                >
                  <h2 className="kwf-h2">
                    {cat.name}
                  </h2>
                  <p className="text-xs text-secondary-text tabular-nums">
                    {cat.gender === "male"
                      ? "Мальчики"
                      : cat.gender === "female"
                        ? "Девочки"
                        : "Любые"}{" "}
                    · {cat.age_min}–{cat.age_max} лет · до{" "}
                    {cat.weight_max} кг · Участников: {cat.athletes?.length || 0}
                  </p>
                </div>
                <div className="p-4 sm:p-5">
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
                </div>
              </section>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
