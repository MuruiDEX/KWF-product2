"use client"

import { useMemo } from "react"
import { BracketsPanel } from "./BracketsPanel"
import { collectBracketCandidates } from "@/lib/brackets"
import { pluralize } from "@/lib/display"
import { findFirstOpenCategoryId } from "../manageDerived"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { Athlete, Match, Round, Tatami, TournamentCategory } from "@/lib/types"

interface BracketsSectionProps {
  tournamentId: string | number
  sortedCats: TournamentCategory[]
  athletes: Athlete[]
  tatamis: Tatami[]
  regs: RegistrationEntry[] | null
  tatamiCount: number
  startingRoundId: number | null
  finishingId: number | null
  membersBusy: string | null
  matchMsg: { ok: boolean; text: string } | null
  onRetry: () => void
  onCategoryDuration: (cat: TournamentCategory, seconds: number) => void
  onDurationError: (msg: string) => void
  onCategoryTatami: (cat: TournamentCategory, tatamiId: string) => void
  onEditCategory: (cat: TournamentCategory) => void
  onAddRound: (cat: TournamentCategory) => void
  onGenerateBracket: (cat: TournamentCategory) => void
  onStartRound: (round: Round) => void
  onAddMatch: (round: Round) => void
  onGoSchedule: () => void
  onPatch: (match: Match, updates: Partial<Match>) => void
  onScoreDraft: (matchId: number, updates: Partial<Match>) => void
  onFinish: (match: Match) => void
  onReopen: (match: Match) => void
}

/** Сетки: компактное резюме + существующая BracketsPanel без изменений. */
export function BracketsSection({ sortedCats, ...rest }: BracketsSectionProps) {
  const summary = useMemo(() => {
    const built = sortedCats.filter((c) => (c.rounds || []).length > 0).length
    const attention = collectBracketCandidates(sortedCats).length
    return { total: sortedCats.length, built, attention }
  }, [sortedCats])
  const firstOpenCatId = useMemo(
    () => findFirstOpenCategoryId(sortedCats),
    [sortedCats]
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-white px-3 py-2 dark:bg-[#0E2035]">
        <span className="text-sm font-extrabold text-dark-text dark:text-slate-100">
          {summary.total} {pluralize(summary.total, "категория", "категории", "категорий")}
        </span>
        <span className="text-xs font-semibold text-secondary-text tabular-nums">
          {summary.built} {pluralize(summary.built, "готово", "готовы", "готово")}
          {summary.attention > 0 &&
            ` · ${summary.attention} ${pluralize(summary.attention, "требует", "требуют", "требуют")} внимания`}
        </span>
      </div>
      <BracketsPanel sortedCats={sortedCats} firstOpenCatId={firstOpenCatId} {...rest} />
    </div>
  )
}
