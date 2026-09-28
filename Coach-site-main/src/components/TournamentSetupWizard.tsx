"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Swords,
  Wand2,
  X,
} from "lucide-react"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import { useModalBehavior } from "@/lib/useModal"
import { cn } from "@/lib/utils"
import {
  bracketPreview,
  categorySetupState,
  parseLaneStart,
} from "@/lib/setupWizard"
import type {
  Match,
  Tatami,
  Tournament,
  TournamentCategory,
} from "@/lib/types"

const STEPS = [
  { id: 0, num: "01", label: "Категории", hint: "Выбери категории для подготовки" },
  { id: 1, num: "02", label: "Сетки", hint: "Система построит сетки с учётом посева" },
  { id: 2, num: "03", label: "Татами", hint: "Распределим категории по татами" },
  { id: 3, num: "04", label: "Расписание", hint: "Расставим время начала боёв" },
  { id: 4, num: "05", label: "Проверка", hint: "Проверь итог и заверши" },
] as const

interface DistributePlan {
  distributed: Record<string, number[]>
  loads?: Record<string, number>
  moved_matches?: number
  dry_run?: boolean
}

interface LaneItem {
  match_id: number
  time: string
}

interface Lane {
  tatami_id: number
  tatami_name: string
  items: LaneItem[]
}

interface SchedulePreview {
  lanes: Lane[]
  assigned: number
  skipped_filled: number
  dry_run?: boolean
}

interface WizardProps {
  open: boolean
  onClose: () => void
  tournamentId: string | number
}

function allMatchesOf(cats: TournamentCategory[]): Match[] {
  return cats.flatMap((c) => (c.rounds || []).flatMap((r) => r.matches || []))
}

export default function TournamentSetupWizard({ open, onClose, tournamentId }: WizardProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(open, onClose, panelRef)

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [tatamis, setTatamis] = useState<Tatami[]>([])
  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState<number[]>([0])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Step 1
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<number[]>([])
  const [rebuild, setRebuild] = useState<number[]>([])
  const [bracketResults, setBracketResults] = useState<Record<number, { ok: boolean; text: string }>>({})
  // Step 3
  const [tatamiCount, setTatamiCount] = useState(1)
  const [distMode, setDistMode] = useState<"balanced" | "round_robin">("balanced")
  const [plan, setPlan] = useState<DistributePlan | null>(null)
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [distApplied, setDistApplied] = useState(false)
  // Step 4
  const [startTime, setStartTime] = useState("09:00")
  const [lanes, setLanes] = useState<SchedulePreview | null>(null)
  const [schedApplied, setSchedApplied] = useState(false)

  const refresh = useCallback(async () => {
    const t = await api<Tournament>(`/api/tournament/tournaments/${tournamentId}/`)
    const tat = await api<Tatami[] | { results: Tatami[] }>(`/api/tournament/tatamis/`)
    setTournament(t)
    setTatamis([...unwrapList(tat)].sort((a, b) => a.order - b.order))
    return t
  }, [tournamentId])

  // Сброс при открытии — паттерном «adjust state during render»
  // (как в DurationInput): без каскадного рендера после paint.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open && open !== prevOpen) {
    setPrevOpen(open)
    setLoading(true)
    setLoadError(null)
    setTournament(null)
    setTatamis([])
    setStep(0)
    setVisited([0])
    setError(null)
    setNotice(null)
    setQuery("")
    setSelected([])
    setBracketResults({})
    setRebuild([])
    setPlan(null)
    setOverrides({})
    setDistApplied(false)
    setLanes(null)
    setSchedApplied(false)
    setBusy(null)
    setTatamiCount(1)
    setStartTime("09:00")
  }
  if (!open && open !== prevOpen) {
    setPrevOpen(open)
  }

  // Первичная загрузка — только чтение API, без логики сброса.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .then((t) => {
        if (cancelled) return
        const cats = [...(t.categories || [])].sort((a, b) => a.order - b.order)
        const eligible = cats
          .filter((c) => categorySetupState(c).kind === "ready")
          .map((c) => c.id)
        setSelected(eligible)
        setTatamiCount(Math.max(1, t.mats_count ?? 1))
        setStartTime(t.start_time ? String(t.start_time).slice(0, 5) : "09:00")
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tournamentId])

  const cats = useMemo(
    () => [...(tournament?.categories || [])].sort((a, b) => a.order - b.order),
    [tournament]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cats
    return cats.filter((c) => c.name.toLowerCase().includes(q))
  }, [cats, query])

  const go = (s: number) => {
    setError(null)
    setNotice(null)
    setStep(s)
    setVisited((v) => (v.includes(s) ? v : [...v, s]))
  }

  if (!open) return null

  const runBracketStep = async () => {
    setError(null)
    setNotice(null)
    const targets = cats.filter(
      (c) => selected.includes(c.id) && categorySetupState(c).kind === "ready"
    )
    const regens = cats.filter(
      (c) =>
        selected.includes(c.id) &&
        rebuild.includes(c.id) &&
        categorySetupState(c).kind === "built"
    )
    const all = [...targets, ...regens]
    if (all.length === 0) {
      setError("Нет категорий для построения — выбери хотя бы одну без сетки.")
      return
    }
    setBusy("brackets")
    const results: Record<number, { ok: boolean; text: string }> = {}
    for (const cat of all) {
      try {
        const res = await api<{ matches_created?: number; byes_count?: number }>(
          `/api/tournament/categories/${cat.id}/generate_bracket/`,
          { method: "POST" }
        )
        results[cat.id] = {
          ok: true,
          text: `Сетка построена (боёв: ${res.matches_created ?? "—"}, BYE: ${res.byes_count ?? "—"}).`,
        }
      } catch (e: unknown) {
        results[cat.id] = { ok: false, text: apiErrorMessage(e) }
      }
    }
    setBracketResults(results)
    setBusy(null)
    try {
      const t = await refresh()
      const okCount = Object.values(results).filter((r) => r.ok).length
      setNotice(`Готово: ${okCount} из ${all.length}. Данные обновлены${t ? "" : ""}.`)
    } catch (e: unknown) {
      setError(apiErrorMessage(e))
    }
  }

  const ensureTatamis = async () => {
    setError(null)
    setNotice(null)
    const need = Math.max(0, tatamiCount - tatamis.length)
    if (need === 0) {
      setNotice("Татами уже достаточно — ничего создавать не нужно.")
      return
    }
    setBusy("ensure")
    try {
      const startOrder = tatamis.length > 0 ? Math.max(...tatamis.map((t) => t.order)) + 1 : 1
      for (let i = 0; i < need; i++) {
        const order = startOrder + i
        await api("/api/tournament/tatamis/", {
          method: "POST",
          body: JSON.stringify({ name: `Татами ${order}`, order }),
        })
      }
      await refresh()
      setNotice(`Создано татами: ${need}.`)
    } catch (e: unknown) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const previewDistribution = async () => {
    setError(null)
    setNotice(null)
    if (tatamis.length === 0) {
      setError("Сначала создай хотя бы один татами.")
      return
    }
    setBusy("plan")
    try {
      const res = await api<DistributePlan>(
        `/api/tournament/tournaments/${tournamentId}/distribute_categories/`,
        { method: "POST", body: JSON.stringify({ mode: distMode, dry_run: true }) }
      )
      setPlan(res)
      setOverrides({})
      setDistApplied(false)
    } catch (e: unknown) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const applyDistribution = async () => {
    setError(null)
    setNotice(null)
    setBusy("apply-dist")
    try {
      await api(`/api/tournament/tournaments/${tournamentId}/distribute_categories/`, {
        method: "POST",
        body: JSON.stringify({ mode: distMode }),
      })
      // Ручные правки поверх предложения системы.
      const changed = Object.entries(overrides).filter(([, v]) => v !== "")
      for (const [catId, tatamiId] of changed) {
        await api(`/api/tournament/categories/${catId}/`, {
          method: "PATCH",
          body: JSON.stringify({ tatami: tatamiId === "" ? null : Number(tatamiId) }),
        })
      }
      await refresh()
      setPlan(null)
      setOverrides({})
      setDistApplied(true)
      setNotice(
        changed.length > 0
          ? `Распределено + ${changed.length} ручных правок применено.`
          : "Распределение применено."
      )
    } catch (e: unknown) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const previewSchedule = async () => {
    setError(null)
    setNotice(null)
    if (parseLaneStart(startTime) === null) {
      setError("Некорректное время старта (нужен формат ЧЧ:ММ).")
      return
    }
    setBusy("lanes")
    try {
      const res = await api<SchedulePreview>(
        `/api/tournament/tournaments/${tournamentId}/schedule_lanes/`,
        { method: "POST", body: JSON.stringify({ start_time: startTime, dry_run: true }) }
      )
      setLanes(res)
      setSchedApplied(false)
    } catch (e: unknown) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const applySchedule = async () => {
    setError(null)
    setNotice(null)
    setBusy("apply-sched")
    try {
      const res = await api<SchedulePreview>(
        `/api/tournament/tournaments/${tournamentId}/schedule_lanes/`,
        { method: "POST", body: JSON.stringify({ start_time: startTime }) }
      )
      setLanes(res)
      setSchedApplied(true)
      setNotice(
        res.assigned > 0
          ? `Время проставлено: ${res.assigned} боёв. Пропущено заполненных: ${res.skipped_filled}.`
          : `Новых назначений нет. Пропущено заполненных: ${res.skipped_filled}.`
      )
      await refresh()
    } catch (e: unknown) {
      setError(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const tatamiName = (id: number | null | undefined) =>
    tatamis.find((t) => t.id === id)?.name ?? "—"

  const review = tournament
    ? (() => {
        const allCats = tournament.categories || []
        const matches = allMatchesOf(allCats)
        const real = matches.filter((m) => m.status !== "bye")
        const withTatami = real.filter((m) => m.tatami !== null).length
        const withTime = real.filter((m) => m.start_time).length
        const built = allCats.filter((c) => (c.rounds || []).length > 0).length
        const athletes = new Set<number>()
        for (const c of allCats) for (const a of c.athletes || []) athletes.add(a.id)
        return {
          cats: allCats.length,
          athletes: athletes.size,
          fights: real.length,
          tatamis: tatamis.length,
          built,
          withTatami,
          withTime,
        }
      })()
    : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Автоматическая подготовка турнира"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-white shadow-xl dark:bg-[#0E2035]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-border px-4 sm:px-6 pt-4 pb-3 dark:bg-[#0E2035]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-dark-text flex items-center gap-2 dark:text-slate-100">
              <Wand2 size={18} className="text-gold-deep" aria-hidden="true" />
              Подготовить турнир
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть мастер подготовки"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-secondary-text hover:text-dark-text hover:bg-light-gray transition-colors cursor-pointer dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              <X size={18} />
            </button>
          </div>
          <p className="mt-2 text-xs text-secondary-text" aria-live="polite">
            Шаг {STEPS[step].num} из 05 — {STEPS[step].hint}
          </p>
          <ol className="flex items-center gap-1 mt-2 overflow-x-auto" aria-label="Шаги подготовки">
            {STEPS.map((s) => {
              const active = s.id === step
              const done = visited.includes(s.id) && s.id < step
              return (
                <li key={s.id} className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={!visited.includes(s.id)}
                    onClick={() => go(s.id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors",
                      active
                        ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue"
                        : done
                          ? "text-dark-text hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10"
                          : "text-secondary-text/50 cursor-not-allowed"
                    )}
                  >
                    <span className="tabular-nums opacity-70">{s.num}</span>
                    {s.label}
                  </button>
                  {s.id < STEPS.length - 1 && (
                    <span aria-hidden="true" className="text-border font-bold">·</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="px-4 sm:px-6 py-5">
          {loading && (
            <div className="space-y-3" role="status" aria-label="Загрузка данных турнира">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-light-gray animate-pulse dark:bg-white/[0.06]" />
              ))}
            </div>
          )}
          {!loading && loadError && (
            <EmptyState
              title="Не удалось загрузить турнир"
              hint={loadError}
              action={<Button onClick={onClose}>Закрыть</Button>}
            />
          )}
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl border text-sm font-medium bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="mb-4 p-3 rounded-xl border text-sm font-medium bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300">
              {notice}
            </div>
          )}

          {!loading && !loadError && step === 0 && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск категории…"
                  aria-label="Поиск категории"
                  className="h-10 px-3 text-sm rounded-xl border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 flex-1 min-w-[180px] dark:bg-white/5 dark:text-white"
                />
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((c) => selected.includes(c.id))}
                    onChange={(e) => {
                      const ids = filtered.map((c) => c.id)
                      setSelected((prev) =>
                        e.target.checked
                          ? [...new Set([...prev, ...ids])]
                          : prev.filter((id) => !ids.includes(id))
                      )
                    }}
                    className="w-4 h-4 accent-[#17488F]"
                  />
                  Выбрать все ({filtered.length})
                </label>
              </div>
              {filtered.length === 0 ? (
                <EmptyState
                  title="Категорий нет"
                  hint="Создай категории кнопкой «Категорию» на странице управления — визард их подхватит."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-secondary-text border-b border-border bg-light-gray/60 dark:bg-white/[0.04]">
                        <th className="font-bold px-3 py-2.5 w-10"><span className="sr-only">Выбор</span></th>
                        <th className="font-bold px-3 py-2.5">Категория</th>
                        <th className="font-bold px-3 py-2.5 text-right">Спортсмены</th>
                        <th className="font-bold px-3 py-2.5">Сетка</th>
                        <th className="font-bold px-3 py-2.5">Татами</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {filtered.map((c) => {
                        const st = categorySetupState(c)
                        return (
                          <tr key={c.id} className="hover:bg-light-gray/50 dark:hover:bg-white/[0.06]">
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={selected.includes(c.id)}
                                onChange={(e) =>
                                  setSelected((prev) =>
                                    e.target.checked
                                      ? [...new Set([...prev, c.id])]
                                      : prev.filter((id) => id !== c.id)
                                  )
                                }
                                aria-label={`Выбрать категорию ${c.name}`}
                                className="w-4 h-4 accent-[#17488F] cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-bold text-dark-text">{c.name}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-dark-text">
                              {(c.athletes || []).length}
                            </td>
                            <td className="px-3 py-2.5">
                              {st.kind === "built" ? (
                                <StatusPill status={st.live ? "active" : "finished"} label={st.live ? "В игре" : "Построена"} />
                              ) : st.kind === "ready" ? (
                                <StatusPill status="waiting" label="Нет сетки" />
                              ) : (
                                <StatusPill status="waiting" label={st.kind === "empty" ? "Пустая" : "Мало уч."} />
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-secondary-text text-xs">
                              {tatamiName(c.tatami ?? null)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-secondary-text">
                Выбрано: <b className="text-dark-text tabular-nums">{selected.length}</b>.
                Сетки строятся только для категорий с 2+ спортсменами без готовой сетки.
              </p>
            </div>
          )}

          {!loading && !loadError && step === 1 && (
            <div>
              {cats.filter((c) => selected.includes(c.id)).length === 0 ? (
                <EmptyState
                  title="Ничего не выбрано"
                  hint="Вернись на шаг 01 и отметь категории."
                  action={<Button onClick={() => go(0)} variant="secondary">К категориям</Button>}
                />
              ) : (
                <ul className="space-y-2.5">
                  {cats
                    .filter((c) => selected.includes(c.id))
                    .map((c) => {
                      const st = categorySetupState(c)
                      const prev = st.kind === "ready" ? bracketPreview((c.athletes || []).length) : null
                      const res = bracketResults[c.id]
                      return (
                        <li
                          key={c.id}
                          className="rounded-xl border border-border bg-white px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 dark:bg-[#0E2035]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-dark-text truncate">{c.name}</div>
                            <div className="text-xs text-secondary-text mt-0.5">
                              {(c.athletes || []).length} уч.
                              {prev && (
                                <> · прогноз: сетка на {prev.slots} (BYE {prev.byes}, боёв ~{prev.fights})</>
                              )}
                              {st.kind === "built" && (
                                <> · сетка уже построена{st.live ? ", идут бои" : ""}</>
                              )}
                              {(st.kind === "empty" || st.kind === "too_few") && (
                                <> · нельзя построить (нужно 2+ спортсмена)</>
                              )}
                            </div>
                            {res && (
                              <div className={cn("text-xs font-semibold mt-1", res.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                {res.text}
                              </div>
                            )}
                          </div>
                          {st.kind === "built" && !st.live ? (
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-dark-text cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={rebuild.includes(c.id)}
                                onChange={(e) =>
                                  setRebuild((prevRb) =>
                                    e.target.checked
                                      ? [...new Set([...prevRb, c.id])]
                                      : prevRb.filter((id) => id !== c.id)
                                  )
                                }
                                className="w-4 h-4 accent-[#17488F]"
                              />
                              Перестроить
                            </label>
                          ) : (
                            res?.ok && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                                <Check size={14} aria-hidden="true" /> Готово
                              </span>
                            )
                          )}
                        </li>
                      )
                    })}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={runBracketStep} disabled={busy !== null} size="sm" className="gap-1.5">
                  <Swords size={15} aria-hidden="true" />
                  {busy === "brackets" ? "Строим…" : "Создать сетки"}
                </Button>
                <p className="text-xs text-secondary-text">
                  Посев — текущий порядок спортсменов (топ получает BYE).
                  Категории в игре не трогаем.
                </p>
              </div>
            </div>
          )}

          {!loading && !loadError && step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-dark-text" aria-live="polite">
                <b className="tabular-nums">{cats.length}</b> категории ·{" "}
                <b className="tabular-nums">
                  {cats.flatMap((c) => (c.rounds || []).flatMap((r) => r.matches || [])).filter((m) => m.status !== "bye").length}
                </b>{" "}
                боёв · <b className="tabular-nums">{tatamis.length}</b> татами
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-text mb-1.5">
                    Татами
                  </div>
                  <div className="inline-flex items-center rounded-xl border border-border overflow-hidden" role="group" aria-label="Количество татами">
                    <button
                      type="button"
                      onClick={() => setTatamiCount((n) => Math.max(1, n - 1))}
                      disabled={busy !== null}
                      aria-label="Меньше татами"
                      className="w-10 h-10 flex items-center justify-center text-lg font-bold text-dark-text hover:bg-light-gray disabled:opacity-40 cursor-pointer dark:text-slate-100 dark:hover:bg-white/10"
                    >
                      −
                    </button>
                    <span className="w-12 text-center text-lg font-extrabold tabular-nums text-dark-text" aria-live="polite">
                      {tatamiCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTatamiCount((n) => Math.min(12, n + 1))}
                      disabled={busy !== null}
                      aria-label="Больше татами"
                      className="w-10 h-10 flex items-center justify-center text-lg font-bold text-dark-text hover:bg-light-gray disabled:opacity-40 cursor-pointer dark:text-slate-100 dark:hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-text mb-1.5">
                    Режим
                  </div>
                  <div className="inline-flex rounded-xl border border-border overflow-hidden" role="group" aria-label="Режим распределения">
                    {(["balanced", "round_robin"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setDistMode(m)
                          setPlan(null)
                          setDistApplied(false)
                        }}
                        aria-pressed={distMode === m}
                        className={cn(
                          "h-10 px-4 text-sm font-bold whitespace-nowrap transition-colors cursor-pointer",
                          distMode === m ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue" : "text-secondary-text hover:bg-light-gray dark:hover:bg-white/10"
                        )}
                      >
                        {m === "balanced" ? "По нагрузке" : "Поровну"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-2 ml-auto">
                  <Button onClick={ensureTatamis} disabled={busy !== null} variant="secondary" size="sm" className="h-10">
                    {busy === "ensure" ? "Создание…" : "Обеспечить"}
                  </Button>
                  <Button onClick={previewDistribution} disabled={busy !== null || tatamis.length === 0} variant="outline" size="sm" className="h-10">
                    {busy === "plan" ? "Считаем…" : "Предпросмотр"}
                  </Button>
                  {plan && (
                    <Button onClick={applyDistribution} disabled={busy !== null} size="sm" className="h-10">
                      {busy === "apply-dist" ? "Применение…" : "Применить"}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-secondary-text">
                Сейчас татами: <b className="text-dark-text tabular-nums">{tatamis.length}</b>.
                «По нагрузке» — тяжёлые категории первыми на свободные татами;
                «Поровну» — классический round-robin. Предпросмотр ничего не меняет.
              </p>
              {plan && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-light-gray/60 dark:bg-white/[0.04] border-b border-border text-xs font-bold uppercase tracking-[0.12em] text-secondary-text">
                    Предложение системы — можно править вручную
                  </div>
                  <div className="divide-y divide-border/70">
                    {Object.entries(plan.distributed).map(([tid, cids]) => {
                      const t = tatamis.find((x) => x.id === Number(tid))
                      const load = plan.loads?.[tid]
                      return (
                        <div key={tid} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-extrabold text-dark-text tabular-nums">
                              {t ? t.name : `Татами ${tid}`} —{" "}
                              {load !== undefined ? `${load} боёв` : `${cids.length} кат.`}
                            </span>
                          </div>
                          {cids.length === 0 ? (
                            <p className="text-xs text-secondary-text">Пусто — резерв.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {cids.map((cid) => {
                                const cat = cats.find((c) => c.id === cid)
                                if (!cat) return null
                                const n = (cat.athletes || []).length
                                return (
                                  <li key={cid} className="flex items-center gap-2">
                                    <span className="text-sm text-dark-text truncate flex-1 min-w-0">
                                      {cat.name} <span className="text-secondary-text tabular-nums">· {n} уч.</span>
                                    </span>
                                    <select
                                      value={overrides[cid] ?? String(tid)}
                                      onChange={(e) =>
                                        setOverrides((prev) => ({ ...prev, [cid]: e.target.value }))
                                      }
                                      aria-label={`Татами для ${cat.name}`}
                                      className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 max-w-[140px] dark:bg-white/5 dark:text-white"
                                    >
                                      {tatamis.map((tt) => (
                                        <option key={tt.id} value={String(tt.id)}>
                                          {tt.name}
                                        </option>
                                      ))}
                                    </select>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {distApplied && (
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <Check size={15} aria-hidden="true" /> Распределение применено.
                </p>
              )}
            </div>
          )}

          {!loading && !loadError && step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="wiz-start" className="block text-xs font-bold uppercase tracking-[0.14em] text-secondary-text mb-1.5">
                    Старт дорожек
                  </label>
                  <input
                    id="wiz-start"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="09:00"
                    inputMode="numeric"
                    className="h-10 w-32 px-3 text-sm font-bold tabular-nums rounded-xl border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={previewSchedule} disabled={busy !== null} variant="outline" size="sm" className="h-10">
                    {busy === "lanes" ? "Считаем…" : "Предпросмотр"}
                  </Button>
                  <Button onClick={applySchedule} disabled={busy !== null || !lanes} size="sm" className="h-10">
                    {busy === "apply-sched" ? "Применение…" : "Применить"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-secondary-text">
                Шаг дорожки — длительность боя категории. Время ориентировочное (~):
                заполненные вручную старты не перезаписываются.
                {schedApplied && " Расписание применено."}
              </p>
              {lanes && lanes.lanes.length === 0 && (
                <EmptyState title="Нечего планировать" hint="Нет ожидающих боёв с татами — сначала сетки и распределение." />
              )}
              {lanes && lanes.lanes.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-light-gray/60 dark:bg-white/[0.04] border-b border-border text-xs font-bold uppercase tracking-[0.12em] text-secondary-text">
                    Дорожки · назначено: {lanes.assigned}, пропущено заполненных: {lanes.skipped_filled}
                  </div>
                  <div className="divide-y divide-border/70 max-h-72 overflow-y-auto">
                    {lanes.lanes.map((lane) => (
                      <div key={lane.tatami_id} className="px-3 py-2">
                        <div className="text-sm font-extrabold text-dark-text tabular-nums mb-1">
                          {lane.tatami_name} — {lane.items.length} боёв
                        </div>
                        {lane.items.length === 0 ? (
                          <p className="text-xs text-secondary-text">Боёв нет.</p>
                        ) : (
                          <ul className="space-y-1">
                            {lane.items.slice(0, 8).map((it) => (
                              <li key={it.match_id} className="text-xs text-secondary-text tabular-nums">
                                <b className="text-dark-text">{it.time}</b> · бой #{it.match_id}
                              </li>
                            ))}
                            {lane.items.length > 8 && (
                              <li className="text-xs text-secondary-text">
                                …и ещё {lane.items.length - 8}
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !loadError && step === 4 && tournament && review && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-light-gray/60 dark:bg-white/[0.04] border-b border-border text-xs font-bold uppercase tracking-[0.12em] text-secondary-text">
                  {tournament.name} — итог подготовки
                </div>
                <dl className="divide-y divide-border/70">
                  {(
                    [
                      ["Категории", String(review.cats), true],
                      ["Спортсмены", String(review.athletes), true],
                      ["Бои", String(review.fights), true],
                      ["Татами", String(review.tatamis), review.tatamis > 0],
                      ["Сетки построены", `${review.built} из ${review.cats}`, review.built === review.cats && review.cats > 0],
                      ["Распределение", distApplied ? "применено" : "не применялось в мастере", distApplied],
                      [
                        "Расписание",
                        schedApplied ? `назначено: ${lanes?.assigned ?? 0}` : "не применялось в мастере",
                        schedApplied,
                      ],
                    ] as [string, string, boolean][]
                  ).map(([k, v, ok]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="text-sm text-secondary-text">{k}</dt>
                      <dd className="text-sm font-extrabold text-dark-text tabular-nums flex items-center gap-1.5">
                        {ok ? (
                          <Check size={14} className="text-green-700 dark:text-green-400" aria-hidden="true" />
                        ) : (
                          <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-border inline-block" />
                        )}
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="text-xs text-secondary-text">
                Дальше — вкладки «Сетка», «LIVE» и «Участники» выше. Повторный запуск мастера
                ничего не дублирует: построенные сетки пропускаются, время — только пустые слоты.
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-3 dark:bg-[#0E2035]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 0 ? onClose() : go(step - 1))}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {step === 0 ? "Отмена" : "Назад"}
          </Button>
          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => go(step + 1)}
              disabled={busy !== null || (step === 0 && selected.length === 0)}
              className="gap-1.5"
            >
              Далее
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          ) : (
            <Button size="sm" onClick={onClose} className="gap-1.5">
              <Check size={15} aria-hidden="true" />
              Готово
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
