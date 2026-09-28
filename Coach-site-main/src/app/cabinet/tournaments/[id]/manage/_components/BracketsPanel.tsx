"use client"

import { useMemo, useState } from "react"
import { ChevronDown, PlayCircle, Plus, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import { FriendlyError } from "@/components/ui/FriendlyError"
import EmptyState from "@/components/ui/EmptyState"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import MatchCard from "./MatchCard"
import TournamentBrackets from "@/components/TournamentBrackets"
import {
  collectBracketCandidates,
  formatBracketGenSummary,
  generateAllBrackets,
  type BracketGenResult,
} from "@/lib/brackets"
import { planBulkGenerate } from "../hooks/useMatchMutations"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { Athlete, Match, Round, Tatami, TournamentCategory } from "@/lib/types"

function fmtDuration(totalSeconds?: number | null) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 120))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function parseDuration(text: string): number | null {
  const t = text.trim()
  const mmss = t.match(/^(\d{1,3}):([0-5]?\d)$/)
  if (mmss) {
    const sec = Number(mmss[1]) * 60 + Number(mmss[2])
    return sec >= 15 && sec <= 3600 ? sec : null
  }
  if (/^\d+$/.test(t)) {
    const sec = Number(t)
    return sec >= 15 && sec <= 3600 ? sec : null
  }
  return null
}

function DurationInput({ value, onSave, onError }: { value?: number | null; onSave: (sec: number) => void; onError?: (msg: string) => void }) {
  const [text, setText] = useState(fmtDuration(value ?? 120))
  const [invalid, setInvalid] = useState(false)
  // Синхронизация с внешним value — паттерном «adjust state during render»
  // вместо setState в effect (каскадный рендер после paint + lint-ошибка).
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(fmtDuration(value ?? 120))
    setInvalid(false)
  }
  const commit = () => {
    const sec = parseDuration(text)
    if (sec === null) {
      setText(fmtDuration(value ?? 120))
      setInvalid(true)
      onError?.("Некорректное время боя — используйте формат ММ:СС от 00:15 до 60:00.")
      return
    }
    setInvalid(false)
    if (sec !== (value ?? 120)) onSave(sec)
    else setText(fmtDuration(sec))
  }
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      placeholder="02:00"
      title="Длительность боя категории (ММ:СС)"
      aria-label="Длительность боя категории в формате минуты:секунды"
      aria-invalid={invalid}
      className={`w-20 p-1.5 text-xs font-bold tabular-nums rounded-lg border bg-white text-center focus:outline-none focus:ring-2 focus:ring-primary-blue/40 dark:bg-white/5 dark:text-white ${invalid ? "border-red-400" : "border-border"}`}
    />
  )
}

interface BracketsPanelProps {
  tournamentId: string | number
  sortedCats: TournamentCategory[]
  athletes: Athlete[]
  tatamis: Tatami[]
  firstOpenCatId: number | null
  startingRoundId: number | null
  finishingId: number | null
  membersBusy: string | null
  matchMsg: { ok: boolean; text: string } | null
  /** Явка и число татами — только для preflight bulk-генерации (guardrail). */
  regs: RegistrationEntry[] | null
  tatamiCount: number
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

/** Phase 2B: сетки и результаты — редактор раундов/боёв, переехавший
 * из старой вкладки «Управление». MatchCard-колбэки те же (memo цел). */
export function BracketsPanel({
  tournamentId,
  sortedCats,
  athletes,
  tatamis,
  firstOpenCatId,
  startingRoundId,
  finishingId,
  membersBusy,
  matchMsg,
  regs,
  tatamiCount,
  onRetry,
  onCategoryDuration,
  onDurationError,
  onCategoryTatami,
  onEditCategory,
  onAddRound,
  onGenerateBracket,
  onStartRound,
  onAddMatch,
  onGoSchedule,
  onPatch,
  onScoreDraft,
  onFinish,
  onReopen,
}: BracketsPanelProps) {
  const [genBusy, setGenBusy] = useState(false)
  const [genResult, setGenResult] = useState<BracketGenResult | null>(null)
  const [genConfirm, setGenConfirm] = useState(false)
  // Свернутые раунды: завершённые скрыты по умолчанию за тоглом.
  // MatchCard НЕ размонтируются (hidden) — черновики счёта/времени,
  // SSE-обновления и цепочки PATCH сохраняются.
  const [roundOverride, setRoundOverride] = useState<Set<number>>(new Set())
  const toggleRound = (roundId: number) => {
    setRoundOverride((prev) => {
      const next = new Set(prev)
      if (next.has(roundId)) next.delete(roundId)
      else next.add(roundId)
      return next
    })
  }
  const eligible = useMemo(() => collectBracketCandidates(sortedCats), [sortedCats])
  const genSummary = genResult ? formatBracketGenSummary(genResult) : null

  const runGenerateAll = async (candidates: { id: number; name: string }[]) => {
    setGenConfirm(false)
    setGenBusy(true)
    try {
      const res = await generateAllBrackets(candidates)
      setGenResult(res)
      onRetry()
    } finally {
      setGenBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            setGenResult(null)
            // Preflight тем же guardrail, что per-category генерация:
            // при блокерах открываем существующий guardrail-confirm
            // (через onGenerateBracket первой проблемной категории),
            // generateAllBrackets не вызывается. Иначе — bulk ConfirmDialog.
            const plan = planBulkGenerate({ sortedCats, regs, tatamiCount })
            if (!plan.ok) {
              onGenerateBracket(plan.firstCategory)
              return
            }
            setGenConfirm(true)
          }}
          disabled={genBusy || eligible.length === 0}
          size="sm"
          className="gap-1.5"
          title={
            eligible.length === 0
              ? "Нет категорий без сетки с 2+ участниками"
              : `Построить сетки: ${eligible.map((c) => c.name).join(", ")}`
          }
        >
          <Swords size={14} aria-hidden="true" />
          {genBusy ? "Генерация…" : `Сгенерировать все готовые${eligible.length > 0 ? ` (${eligible.length})` : ""}`}
        </Button>
      </div>
      {genSummary &&
        (genSummary.ok ? (
          <div
            role="status"
            className="p-3 rounded-xl border text-sm font-medium bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300"
          >
            {genSummary.text}
          </div>
        ) : (
          <div className="space-y-2">
            <FriendlyError message={genSummary.text} onRetry={onRetry} />
            <Button
              onClick={() =>
                void runGenerateAll(
                  (genResult?.errors ?? []).map((e) => ({
                    id: e.categoryId,
                    name: e.name,
                  }))
                )
              }
              disabled={genBusy || (genResult?.errors ?? []).length === 0}
              size="sm"
              variant="secondary"
              className="gap-1.5 h-8 text-xs"
            >
              {genBusy ? "Выполнение…" : `Повторить ошибки (${genResult?.failed ?? 0})`}
            </Button>
          </div>
        ))}
      <ConfirmDialog
        open={genConfirm}
        title="Сгенерировать сетки?"
        description={`Будут построены сетки для ${eligible.length} готовых категорий. Существующие сетки не тронуты.`}
        confirmLabel="Сгенерировать"
        onConfirm={() => void runGenerateAll(eligible)}
        onClose={() => {
          if (!genBusy) setGenConfirm(false)
        }}
      />
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <TournamentBrackets tournamentId={tournamentId} />
      </div>
      {matchMsg &&
        (matchMsg.ok ? (
          <div
            role="status"
            className="p-3 rounded-xl border text-sm font-medium bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300"
          >
            {matchMsg.text}
          </div>
        ) : (
          <FriendlyError message={matchMsg.text} onRetry={onRetry} />
        ))}
      {sortedCats.length === 0 && (
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
          <EmptyState
            compact
            title="Категорий пока нет"
            hint="Создайте первую кнопкой «Категорию» выше"
          />
        </div>
      )}
      {sortedCats.map((cat) => {
        const catMatches = (cat.rounds || []).flatMap((r) => r.matches || [])
        const catLeft = catMatches.filter((m) => m.status !== "finished" && m.status !== "bye").length
        const catStatus = catMatches.length === 0
          ? "waiting" as const
          : catLeft === 0 ? "finished" as const : cat.id === firstOpenCatId ? "active" as const : "waiting" as const
        const currentRound = [...(cat.rounds || [])]
          .sort((a, b) => a.order - b.order)
          .find((r) => (r.matches || []).some((m) => m.status !== "finished" && m.status !== "bye"))
        const canGenerate = catMatches.length === 0 && (cat.athletes || []).length >= 2
        return (
        <div key={cat.id} id={`cat-${cat.id}`} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm scroll-mt-24 dark:bg-[#0E2035]">
          <div className="px-3 sm:px-4 py-2 border-b border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-2 dark:bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h2 className="text-lg font-bold text-dark-text dark:text-slate-100">{cat.name}</h2>
              <span className="text-xs px-2 py-0.5 bg-white border border-border rounded-full text-secondary-text dark:bg-white/[0.06]">
                {cat.gender === "male" ? "Мальчики" : cat.gender === "female" ? "Девочки" : "Смешанная"} | {cat.age_min}-{cat.age_max} лет
              </span>
              <StatusPill status={catStatus === "active" ? "active" : catStatus === "finished" ? "finished" : "waiting"} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-secondary-text">
              <span><b className="text-dark-text tabular-nums dark:text-slate-100">{cat.athletes?.length || 0}</b> уч. · <b className="text-dark-text tabular-nums dark:text-slate-100">{catLeft}</b> боёв осталось</span>
              <span className="inline-flex items-center gap-1.5">
                Время боя:
                <DurationInput value={cat.match_duration} onSave={(sec) => onCategoryDuration(cat, sec)} onError={onDurationError} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                Татами:
                <select
                  value={cat.tatami ?? ""}
                  disabled={membersBusy === `ctat-${cat.id}` || tatamis.length === 0}
                  onChange={(e) => onCategoryTatami(cat, e.target.value)}
                  title="Татами категории — бои наследуют его. Ручной выбор не перезаписывается."
                  aria-label={`Татами категории ${cat.name}`}
                  className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 disabled:opacity-50 dark:bg-white/5 dark:text-white"
                >
                  <option value="">—</option>
                  {tatamis.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </span>
              <span>Текущий раунд: <b className="text-dark-text dark:text-slate-100">{currentRound ? currentRound.name : "—"}</b></span>
              <Button onClick={onGoSchedule} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">LIVE</Button>
              {canGenerate && (
                <Button onClick={() => onGenerateBracket(cat)} size="sm" variant="secondary" className="gap-1.5 h-8 text-xs">
                  <Swords size={14} aria-hidden="true" />
                  Сформировать сетку
                </Button>
              )}
              <Button onClick={() => onEditCategory(cat)} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                Изменить
              </Button>
              <Button onClick={() => onAddRound(cat)} size="sm" className="gap-1.5 h-8 text-xs">
                <Plus size={14} />
                Раунд
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {cat.rounds.map((round) => {
              const rDone = (round.matches || []).filter((m) => m.status === "finished" || m.status === "bye").length
              const rTotal = (round.matches || []).length
              const rStatus = round.status ?? (rTotal === 0 ? "waiting" : rDone === rTotal ? "finished" : "waiting")
              const rFinished = rTotal > 0 && rDone === rTotal
              const rCollapsed = rFinished !== roundOverride.has(round.id)
              return (
              <div
                key={round.id}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-dark-text dark:text-slate-100 flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary-blue text-white text-xs flex items-center justify-center shrink-0">
                      {round.order}
                    </span>
                    <span className="truncate min-w-0" title={round.name}>
                      {round.name}
                    </span>
                    <StatusPill status={rStatus === "in_progress" ? "active" : rStatus === "finished" ? "finished" : "waiting"} />
                    {rTotal > 0 && (
                      <span className="text-xs font-semibold text-secondary-text tabular-nums">
                        {rDone}/{rTotal}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {rTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleRound(round.id)}
                        aria-expanded={!rCollapsed}
                        aria-label={`${rCollapsed ? "Развернуть" : "Свернуть"} раунд ${round.name}`}
                        title={rCollapsed ? `Развернуть (${rTotal})` : "Свернуть"}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
                      >
                        <ChevronDown
                          size={14}
                          aria-hidden="true"
                          className={`transition-transform ${rCollapsed ? "-rotate-90" : ""}`}
                        />
                        {rDone}/{rTotal}
                      </button>
                    )}
                    {rStatus === "waiting" && rTotal > 0 && (
                      <Button
                        onClick={() => onStartRound(round)}
                        disabled={startingRoundId === round.id}
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 h-8 text-xs"
                        title="Открыть бои раунда и раздать татами"
                      >
                        <PlayCircle size={14} />
                        {startingRoundId === round.id ? "Старт..." : "Старт раунда"}
                      </Button>
                    )}
                    <Button onClick={() => onAddMatch(round)} size="sm" variant="ghost" className="gap-2 text-xs">
                      <Plus size={14} />
                      Матч
                    </Button>
                  </div>
                </div>

                {/* display:none вместо unmount: MatchCard-черновики и подписки живут дальше.
                    Инлайн-стиль, а не hidden-класс: детерминированно поверх display-утилит. */}
                <div
                  className="grid grid-cols-1 lg:grid-cols-2 gap-3"
                  style={rCollapsed ? { display: "none" } : undefined}
                >
                  {round.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      athletes={athletes}
                      finishing={finishingId === match.id}
                      onPatch={onPatch}
                      onScoreDraft={onScoreDraft}
                      onFinish={onFinish}
                      onReopen={onReopen}
                    />
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        </div>
        )
      })}
    </div>
  )
}
