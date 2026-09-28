"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api, apiErrorMessage } from "@/lib/api"
import { eligibleForBracket } from "@/lib/brackets"
import { manageKeys } from "@/lib/queryClient"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { Match, Round, Tournament, TournamentCategory } from "@/lib/types"
import type { ManageTab } from "../manageTabs"
import type { ConfirmState } from "../manageConfirm"

export interface BracketBlocker {
  text: string
  tab: ManageTab
}

/** Чистый guardrail генерации сетки: что мешает — до запроса, не сырым 400. */
export function getBracketBlockers(args: {
  category: TournamentCategory
  sortedCats: TournamentCategory[]
  regs: RegistrationEntry[] | null
  tatamiCount: number
}): BracketBlocker[] {
  const { category, sortedCats, regs, tatamiCount } = args
  const blockers: BracketBlocker[] = []
  if ((category.athletes || []).length < 2) {
    blockers.push({
      text: `В категории «${category.name}» меньше 2 участников — сетку построить нельзя.`,
      tab: "participants",
    })
  }
  if (regs) {
    const inCats = new Set<number>()
    for (const c of sortedCats) {
      for (const a of c.athletes || []) inCats.add(a.id)
    }
    const uncategorized = regs.filter((r) => !inCats.has(r.athlete_id)).length
    if (uncategorized > 0) {
      blockers.push({
        text: `${uncategorized} уч. без категории — распределите их, иначе сетки будут неполными.`,
        tab: "participants",
      })
    }
  }
  if (tatamiCount === 0) {
    blockers.push({
      text: "Нет татами — бои будет некуда распределять.",
      tab: "schedule",
    })
  }
  return blockers
}

export type BulkGeneratePlan =
  | { ok: true }
  | { ok: false; blockers: BracketBlocker[]; firstCategory: TournamentCategory }

/** Чистый preflight bulk-генерации: те же getBracketBlockers-правила для
 * каждой категории-кандидата (без сетки, 2+ участников). Глобальные блокеры
 * (без категории/без татами) дедуплицируются по тексту. Не вызывает API. */
export function planBulkGenerate(args: {
  sortedCats: TournamentCategory[]
  regs: RegistrationEntry[] | null
  tatamiCount: number
}): BulkGeneratePlan {
  const { sortedCats, regs, tatamiCount } = args
  // Тот же отбор кандидатов, что у кнопки bulk-генерации
  // (collectBracketCandidates/eligibleForBracket) — gate и кнопка не расходятся.
  const candidates = sortedCats.filter(eligibleForBracket)
  const blockers: BracketBlocker[] = []
  const seen = new Set<string>()
  let firstCategory: TournamentCategory | null = null
  for (const category of candidates) {
    const local = getBracketBlockers({ category, sortedCats, regs, tatamiCount })
    if (local.length > 0 && !firstCategory) firstCategory = category
    for (const b of local) {
      if (!seen.has(b.text)) {
        seen.add(b.text)
        blockers.push(b)
      }
    }
  }
  if (blockers.length === 0 || !firstCategory) return { ok: true }
  return { ok: false, blockers, firstCategory }
}

// Мутации боёв и сеток: дебаунс-очередь PATCH, финиш/переоткрытие,
// старт раунда, ручные матчи, длительность, генерация с guardrail.
// onChanged — инвалидация Query (стабильность колбэков для memo(MatchCard)
// держится через внутренний ref, как раньше через fetchDataRef).
export function useMatchMutations(args: {
  tournamentId: string | null
  sortedCats: TournamentCategory[]
  regs: RegistrationEntry[] | null
  tatamiCount: number
  onChanged: () => Promise<void> | void
  openConfirm: (c: ConfirmState) => void
}) {
  const { tournamentId, sortedCats, regs, tatamiCount, onChanged, openConfirm } = args
  const queryClient = useQueryClient()
  const [matchMsg, setMatchMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  const [startingRoundId, setStartingRoundId] = useState<number | null>(null)

  const onChangedRef = useRef(onChanged)
  useEffect(() => {
    onChangedRef.current = onChanged
  })
  const refresh = () => onChangedRef.current()

  // M6: очередь PATCH на матч. _pending копит последние значения
  // (схлопывание ДО отправки), flush одного боя — строго по цепочке
  // промисов. Разные бои независимы.
  const pendingUpdates = useRef(new Map<number, Partial<Match>>())
  const matchChains = useRef(new Map<number, Promise<void>>())
  const flushTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const timers = flushTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const applyLocalMatchUpdate = useCallback(
    (matchId: number, updates: Partial<Match>) => {
      if (!tournamentId) return
      queryClient.setQueryData<Tournament>(
        manageKeys.tournament(tournamentId),
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            categories: (prev.categories || []).map((c) => ({
              ...c,
              rounds: (c.rounds || []).map((r) => ({
                ...r,
                matches: (r.matches || []).map((m) =>
                  m.id === matchId ? { ...m, ...updates } : m
                ),
              })),
            })),
          }
        }
      )
    },
    [queryClient, tournamentId]
  )

  const flushMatchUpdate = useCallback(
    async (matchId: number, payload: Partial<Match>) => {
      if (Object.keys(payload).length === 0) return
      try {
        await api(`/api/tournament/matches/${matchId}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        await refresh()
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
        await refresh()
      }
    },
    []
  )

  const handleUpdateMatch = useCallback(
    async (match: Match, updates: Partial<Match>) => {
      // Оптимистично обновляем UI сразу, PATCH — с дебаунсом 600мс,
      // чтобы ввод счёта не давал шторм запросов; порядок гарантирует цепочка.
      applyLocalMatchUpdate(match.id, updates)
      const prev = pendingUpdates.current.get(match.id) ?? {}
      pendingUpdates.current.set(match.id, { ...prev, ...updates })
      const timer = flushTimers.current.get(match.id)
      if (timer) clearTimeout(timer)
      flushTimers.current.set(
        match.id,
        setTimeout(() => {
          flushTimers.current.delete(match.id)
          const payload = pendingUpdates.current.get(match.id) ?? {}
          pendingUpdates.current.delete(match.id)
          const chain = (matchChains.current.get(match.id) ?? Promise.resolve())
            .then(() => flushMatchUpdate(match.id, payload))
            .catch(() => {
              // flushMatchUpdate ошибки уже показывает сам; цепочку не рвём.
            })
          matchChains.current.set(match.id, chain)
        }, 600)
      )
    },
    [applyLocalMatchUpdate, flushMatchUpdate]
  )

  const handleFinishMatch = useCallback(
    async (match: Match) => {
      if (!match.winner) {
        setMatchMsg({ ok: false, text: "Сначала выберите победителя боя." })
        return
      }
      setFinishingId(match.id)
      setMatchMsg(null)
      try {
        // Единый путь финиша: продвижение и очередь — на сервере в транзакции.
        await api(`/api/tournament/matches/${match.id}/finish_match/`, {
          method: "POST",
          body: JSON.stringify({
            winner_id: match.winner,
            score1: match.score1,
            score2: match.score2,
          }),
        })
        await refresh()
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
      } finally {
        setFinishingId(null)
      }
    },
    []
  )

  const handleReopenMatch = useCallback(
    async (match: Match) => {
      openConfirm({
        title: "Переоткрыть бой?",
        text: "Результат будет откачен, победитель вернётся из следующего боя (если тот ещё не начался).",
        confirmLabel: "Переоткрыть",
        danger: false,
        action: { type: "reopen-match", matchId: match.id },
      })
    },
    [openConfirm]
  )

  const doReopenMatch = useCallback(
    async (matchId: number) => {
      setFinishingId(matchId)
      setMatchMsg(null)
      try {
        await api(`/api/tournament/matches/${matchId}/reopen/`, { method: "POST" })
        await refresh()
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
      } finally {
        setFinishingId(null)
      }
    },
    []
  )

  async function handleStartRound(round: Round) {
    setStartingRoundId(round.id)
    setMatchMsg(null)
    try {
      const res = await api<{ opened: number; distributed: number; already?: boolean }>(
        `/api/tournament/rounds/${round.id}/start/`,
        { method: "POST" }
      )
      if (res.already) {
        setMatchMsg({ ok: true, text: `Раунд «${round.name}» уже идёт.` })
      } else {
        setMatchMsg({
          ok: true,
          text: `Раунд «${round.name}» открыт: боёв готово ${res.opened}, на татами ${res.distributed}.`,
        })
      }
      await refresh()
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setStartingRoundId(null)
    }
  }

  async function handleCategoryDuration(cat: TournamentCategory, seconds: number) {
    try {
      await api(`/api/tournament/categories/${cat.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ match_duration: seconds }),
      })
      await refresh()
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleAddMatch(round: Round) {
    try {
      await api("/api/tournament/matches/", {
        method: "POST",
        body: JSON.stringify({
          round: round.id,
          match_number: round.matches.length + 1,
          score1: 0,
          score2: 0,
          status: "waiting",
        }),
      })
      await refresh()
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleGenerateBracket(category: TournamentCategory) {
    const blockers = getBracketBlockers({ category, sortedCats, regs, tatamiCount })
    if (blockers.length > 0) {
      openConfirm({
        title: "Нельзя создать сетку пока:",
        text: blockers.map((b) => `• ${b.text}`).join("\n"),
        confirmLabel: "Исправить проблемы",
        danger: false,
        action: { type: "goto-tab", tab: blockers[0].tab },
      })
      return
    }
    try {
      await api(`/api/tournament/categories/${category.id}/generate_bracket/`, {
        method: "POST",
      })
      await refresh()
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  return {
    matchMsg,
    setMatchMsg,
    reportError: useCallback(
      (text: string) => setMatchMsg({ ok: false, text }),
      []
    ),
    finishingId,
    startingRoundId,
    applyLocalMatchUpdate,
    handleUpdateMatch,
    handleFinishMatch,
    handleReopenMatch,
    doReopenMatch,
    handleStartRound,
    handleCategoryDuration,
    handleAddMatch,
    handleGenerateBracket,
  }
}
