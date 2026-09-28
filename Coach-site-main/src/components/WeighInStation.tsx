"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Scale,
  Search,
  TriangleAlert,
} from "lucide-react"
import {
  buildStationQueue,
  nextUnweighedId,
  stationProgress,
  validateWeight,
} from "@/lib/weighinStation"
import { checkOverweight, parseWeightLimit } from "@/lib/weight"
import type { CheckinRosterEntry } from "@/components/CheckinPanel"

export type SaveWeightResult = { ok: true } | { ok: false; error: string }

interface WeighInStationProps {
  roster: CheckinRosterEntry[]
  getWeight: (id: number) => string | null | undefined
  isCheckedIn: (id: number) => boolean
  onSaveWeight: (id: number, value: number) => Promise<SaveWeightResult>
  onExit: () => void
}

function pluralYears(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return "год"
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "года"
  return "лет"
}

function genderRu(gender?: string | null): string | null {
  if (gender === "male") return "М"
  if (gender === "female") return "Ж"
  return null
}

type Phase =
  | { kind: "input"; error?: string }
  | { kind: "saving" }
  | { kind: "ok"; weight: number }
  | { kind: "over"; weight: number; excess: number; limit: number; categoryName: string | null }
  | { kind: "error"; message: string }

/** Weigh-in Station: потоковое взвешивание — найти → ввести → Enter → следующий.
 * Сохранение — через существующий single-checkin endpoint (onSaveWeight),
 * здесь только очередь, фокус и состояния. */
export function WeighInStation({
  roster,
  getWeight,
  isCheckedIn,
  onSaveWeight,
  onExit,
}: WeighInStationProps) {
  const [query, setQuery] = useState("")
  const [currentId, setCurrentId] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rosterById = useMemo(() => new Map(roster.map((r) => [r.id, r])), [roster])

  // Только что сохранённые id — regs родителя обновятся асинхронно,
  // очередь не должна ждать их, иначе авто-переход упрётся в того же.
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  const weighedIds = useMemo(() => {
    const set = new Set<number>(savedIds)
    for (const r of roster) {
      if (parseWeightLimit(getWeight(r.id) ?? null) !== null) set.add(r.id)
    }
    return set
  }, [roster, getWeight, savedIds])
  const queue = useMemo(
    () => buildStationQueue(roster, weighedIds, query),
    [roster, weighedIds, query]
  )
  const displayId =
    currentId != null && queue.includes(currentId) ? currentId : (queue[0] ?? null)
  // Фиксируем отображаемого спортсмена при первом показе: иначе после
  // сохранения очередь перестраивается (сохранённый уходит в конец) и вид
  // молча перепрыгивает на другого. Тем же adjust-during-render паттерном,
  // что и в проекте (сбросы — только явные: advance, очистка поиска — нет).
  const [claimed, setClaimed] = useState(false)
  if (!claimed && displayId != null) {
    setClaimed(true)
    setCurrentId(displayId)
  }
  const progress = useMemo(
    () =>
      stationProgress(
        roster,
        (id) => getWeight(id),
        (id) => {
          const entry = rosterById.get(id)
          if (!entry) return false
          return checkOverweight(getWeight(id) ?? null, entry.categories).over
        }
      ),
    [roster, rosterById, getWeight]
  )

  // "/" — быстрый фокус поиска (вне текстовых полей).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const advanceFrom = useCallback(
    (fromId: number | null) => {
      const next = nextUnweighedId(queue, (id) => weighedIds.has(id), fromId)
      setCurrentId(next)
    },
    [queue, weighedIds]
  )

  const handleSaved = useCallback(
    (id: number) => {
      setSavedIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
      advanceFrom(id)
    },
    [advanceFrom]
  )

  const athlete = displayId != null ? rosterById.get(displayId) ?? null : null
  const finished =
    roster.length > 0 && progress.unweighed === 0 && query.trim() === ""

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Вернуться к списку
        </button>
        <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.14em] text-secondary-text">
          <Scale size={15} aria-hidden="true" />
          Режим станции
        </h3>
        <span className="ml-auto text-xs font-bold text-secondary-text tabular-nums" role="status">
          Взвешено {progress.weighed} / {progress.total}
        </span>
      </div>

      <div
        className="h-2 rounded-full bg-light-gray overflow-hidden mb-3 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={progress.weighed}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label={`Взвешено: ${progress.weighed} из ${progress.total}`}
      >
        <div
          className="h-full rounded-full bg-success transition-all"
          style={{ width: `${progress.total > 0 ? Math.round((progress.weighed / progress.total) * 100) : 0}%` }}
        />
      </div>
      <p className="text-xs text-secondary-text mb-3 tabular-nums">
        Без веса: {progress.unweighed}
        {progress.overweight > 0 && ` · Перевес: ${progress.overweight}`}
      </p>

      <div className="relative mb-2">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
        />
        <label className="sr-only" htmlFor="station-search">
          Поиск спортсмена
        </label>
        <input
          ref={searchRef}
          id="station-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("")
          }}
          placeholder="Поиск спортсмена…"
          autoComplete="off"
          className="w-full h-10 pl-9 pr-9 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all dark:bg-white/5 dark:text-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Очистить поиск"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-secondary-text cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            ×
          </button>
        )}
      </div>

      {finished ? (
        <div className="rounded-xl border border-border bg-light-gray px-4 py-6 text-center dark:bg-white/[0.04]">
          <CheckCircle2 size={28} className="mx-auto text-success" aria-hidden="true" />
          <p className="mt-2 text-base font-extrabold text-dark-text dark:text-slate-100">
            Все спортсмены взвешены
          </p>
          <p className="mt-1 text-xs text-secondary-text tabular-nums">
            {progress.total} из {progress.total}
            {progress.overweight > 0 && ` · Перевес: ${progress.overweight}`}
          </p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-dark-blue px-4 text-sm font-bold text-white transition-colors cursor-pointer hover:bg-primary-blue dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Вернуться к списку
          </button>
        </div>
      ) : athlete ? (
        <StationCard
          key={athlete.id}
          athleteId={athlete.id}
          name={athlete.name}
          categories={athlete.categories.map((c) => c.name)}
          categoryLimits={athlete.categories}
          limit={strictestLimit(athlete.categories)}
          currentWeight={getWeight(athlete.id) ?? null}
          checkedIn={isCheckedIn(athlete.id)}
          meta={athlete.meta}
          onSaveWeight={onSaveWeight}
          onSaved={handleSaved}
        />
      ) : (
        <div className="rounded-xl border border-border px-4 py-6 text-center">
          <p className="text-sm font-bold text-dark-text dark:text-slate-100">
            Никого не найдено
          </p>
          <p className="mt-1 text-xs text-secondary-text">
            {roster.length === 0
              ? "В этой категории пока нет участников"
              : "Попробуйте изменить запрос"}
          </p>
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs font-bold text-dark-text cursor-pointer hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10"
            >
              Очистить поиск
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function strictestLimit(
  categories: { name: string; weightMax: number | null }[]
): number | null {
  let best: number | null = null
  for (const c of categories) {
    if (c.weightMax === null) continue
    if (best === null || c.weightMax < best) best = c.weightMax
  }
  return best
}

function StationCard({
  athleteId,
  name,
  categories,
  categoryLimits,
  limit,
  currentWeight,
  checkedIn,
  meta,
  onSaveWeight,
  onSaved,
}: {
  athleteId: number
  name: string
  categories: string[]
  categoryLimits: { name: string; weightMax: number | null }[]
  limit: number | null
  currentWeight: string | null
  checkedIn: boolean
  meta?: { gender?: string | null; age?: number | null; club?: string | null }
  onSaveWeight: (id: number, value: number) => Promise<SaveWeightResult>
  onSaved: (id: number) => void
}) {
  const [input, setInput] = useState(currentWeight ?? "")
  const [phase, setPhase] = useState<Phase>({ kind: "input" })
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)

  const submit = async (raw: string) => {
    if (busyRef.current) return
    const v = validateWeight(raw)
    if (!v.ok) {
      setPhase({ kind: "input", error: v.error })
      inputRef.current?.focus()
      return
    }
    busyRef.current = true
    setPhase({ kind: "saving" })
    try {
      const res = await onSaveWeight(athleteId, v.value)
      if (!res.ok) {
        setPhase({ kind: "error", message: res.error })
        inputRef.current?.focus()
        return
      }
      // Перевес — тем же strictest-limit правилом, что и остальной UI.
      const info = checkOverweight(String(v.value), categoryLimits)
      if (info.over) {
        setPhase({
          kind: "over",
          weight: v.value,
          excess: info.excess ?? 0,
          limit: info.limit ?? 0,
          categoryName: info.categoryName,
        })
      } else {
        setPhase({ kind: "ok", weight: v.value })
      }
    } finally {
      busyRef.current = false
    }
  }

  useEffect(() => {
    if (phase.kind !== "ok") return
    const t = window.setTimeout(() => onSaved(athleteId), 750)
    return () => window.clearTimeout(t)
  }, [phase, athleteId, onSaved])

  const metaBits: string[] = []
  const g = genderRu(meta?.gender)
  if (g) metaBits.push(g)
  if (typeof meta?.age === "number") metaBits.push(`${meta.age} ${pluralYears(meta.age)}`)
  if (meta?.club) metaBits.push(meta.club)

  return (
    <div className="rounded-xl border border-border bg-light-gray px-4 py-4 dark:bg-white/[0.04]">
      <p className="text-xl sm:text-2xl font-extrabold text-dark-text dark:text-slate-100">
        {name}
      </p>
      {metaBits.length > 0 && (
        <p className="mt-0.5 text-xs font-semibold text-secondary-text">{metaBits.join(" · ")}</p>
      )}
      {categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <span
              key={c}
              className="rounded-full border border-border bg-white px-2 py-0.5 text-[11px] font-bold text-secondary-text dark:bg-white/[0.06]"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-secondary-text tabular-nums">
        {limit !== null ? `Лимит: до ${limit} кг` : "Лимит не задан"}
        {currentWeight ? ` · Сейчас: ${currentWeight} кг` : " · Ещё не взвешен"}
        {checkedIn ? " · ✓ на явке" : ""}
      </p>

      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(input)
        }}
      >
        <label
          htmlFor={`station-weight-${athleteId}`}
          className="mb-1.5 block text-sm font-bold text-dark-text dark:text-slate-100"
        >
          Вес, кг
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={inputRef}
            id={`station-weight-${athleteId}`}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.target as HTMLInputElement).blur()
            }}
            disabled={phase.kind === "saving"}
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            placeholder="72.4"
            aria-label={`Вес спортсмена ${name} в килограммах`}
            aria-invalid={phase.kind === "input" && !!phase.error}
            className="h-12 flex-1 rounded-xl border border-border bg-white px-4 text-lg font-extrabold tabular-nums text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/40 focus:border-primary-blue transition-all disabled:opacity-50 dark:bg-white/5 dark:text-white"
          />
          <button
            type="submit"
            disabled={phase.kind === "saving"}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-dark-blue px-5 text-sm font-bold text-white transition-colors cursor-pointer hover:bg-primary-blue disabled:opacity-50 disabled:cursor-default dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
          >
            {phase.kind === "saving" ? "Сохранение…" : "Сохранить · Enter"}
          </button>
        </div>
        {phase.kind === "input" && phase.error && (
          <p role="alert" className="mt-1.5 text-xs font-bold text-error">
            {phase.error}
          </p>
        )}
      </form>

      <div aria-live="polite">
        {phase.kind === "ok" && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
            <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm font-bold text-dark-text dark:text-slate-100">
              ✓ {phase.weight} кг — в пределах лимита
            </p>
          </div>
        )}
        {phase.kind === "over" && (
          <div className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-bold text-error">
              <TriangleAlert size={16} className="shrink-0" aria-hidden="true" />
              ⚠ {phase.weight} кг — перевес +{phase.excess} кг
              {phase.categoryName ? ` (лимит категории «${phase.categoryName}»: ${phase.limit} кг)` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPhase({ kind: "input" })}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold text-dark-text cursor-pointer hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Исправить
              </button>
              <button
                type="button"
                onClick={() => onSaved(athleteId)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-dark-blue px-3 text-xs font-bold text-white cursor-pointer hover:bg-primary-blue dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
              >
                Далее
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {phase.kind === "error" && (
          <div className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-bold text-error">
              <TriangleAlert size={16} className="shrink-0" aria-hidden="true" />
              Не удалось сохранить вес
            </p>
            <p className="mt-0.5 text-xs text-secondary-text">{phase.message}</p>
            <button
              type="button"
              onClick={() => void submit(input)}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-dark-blue px-3 text-xs font-bold text-white cursor-pointer hover:bg-primary-blue dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Повторить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
