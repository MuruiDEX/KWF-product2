"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FriendlyError } from "@/components/ui/FriendlyError"
import { toast } from "@/components/ui/Toaster"
import { api, apiErrorMessage } from "@/lib/api"
import type { RegistrationEntry } from "@/lib/controlCenter"
import { checkOverweight, parseWeightLimit } from "@/lib/weight"

export interface WeighinSectionAthlete {
  id: number
  name: string
  categories: { id: number; name: string; weightMax: number | null }[]
  meta?: {
    gender?: string | null
    age?: number | null
    club?: string | null
  }
}

export interface WeighinRow {
  id: number
  name: string
  club: string | null
  categoryNames: string
  categoryId: number | null
  weightActual: string | null
  limit: number | null
  overweight: boolean
  weighed: boolean
}

export type WeighinStatusFilter = "all" | "unweighed" | "overweight"

const PAGE_SIZE = 30

/** Чистая фильтрация строк для тестов и UI (поиск по имени + фильтры). */
export function filterWeighinRows(
  rows: WeighinRow[],
  opts: { query: string; status: WeighinStatusFilter; categoryId: number | null }
): WeighinRow[] {
  const q = opts.query.trim().toLowerCase()
  return rows.filter((r) => {
    if (opts.categoryId !== null && r.categoryId !== opts.categoryId) return false
    if (opts.status === "unweighed" && r.weighed) return false
    if (opts.status === "overweight" && !r.overweight) return false
    if (q.length > 0 && !r.name.toLowerCase().includes(q)) return false
    return true
  })
}

function buildRows(
  roster: WeighinSectionAthlete[],
  regs: RegistrationEntry[] | null,
  overrides: Map<number, string | null>
): WeighinRow[] {
  const byId = new Map((regs ?? []).map((r) => [r.athlete_id, r]))
  return roster.map((a) => {
    const reg = byId.get(a.id)
    const override = overrides.has(a.id) ? overrides.get(a.id) : undefined
    const weightActual = override !== undefined ? override : (reg?.weight_actual ?? null)
    const weighed = parseWeightLimit(weightActual) !== null
    const info = checkOverweight(
      weightActual,
      a.categories.map((c) => ({ name: c.name, weightMax: c.weightMax }))
    )
    const limits = a.categories
      .map((c) => c.weightMax)
      .filter((v): v is number => v !== null)
    return {
      id: a.id,
      name: a.name,
      club: a.meta?.club ?? null,
      categoryNames: a.categories.map((c) => c.name).join(", ") || "—",
      categoryId: a.categories[0]?.id ?? null,
      weightActual,
      limit: limits.length > 0 ? Math.min(...limits) : null,
      overweight: info.over,
      weighed,
    }
  })
}

// Phase 3: отдельная вкладка взвешивания — видимый этап workflow.
// Таблица Имя → клуб → категория → вес → статус → действие; вес правится
// инлайн (тот же POST checkin {weight_actual}, что в CheckinPanel).
function WeighInSection({
  tournamentId,
  regs,
  roster,
  onSaved,
}: {
  tournamentId: string | number
  regs: RegistrationEntry[] | null
  roster: WeighinSectionAthlete[]
  /** Родитель тихо обновляет regs + явку после успешного сохранения. */
  onSaved: () => void
}) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [status, setStatus] = useState<WeighinStatusFilter>("all")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)
  const [overrides, setOverrides] = useState<Map<number, string | null>>(new Map())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Поиск с debounce 300мс — ввод не дёргает фильтрацию на каждую букву.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Родительские regs — источник истины: сбрасываем optimistic-перекрытия,
  // когда пришёл свежий снапшот (успешный save уже позвал onSaved).
  // Синхронизация с внешним API при смене данных — прецедент: CheckinPanel.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrides(new Map())
  }, [regs])

  const rows = useMemo(() => buildRows(roster, regs, overrides), [roster, regs, overrides])
  const categories = useMemo(() => {
    const seen = new Map<number, string>()
    for (const a of roster) {
      for (const c of a.categories) {
        if (!seen.has(c.id)) seen.set(c.id, c.name)
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [roster])
  const visible = useMemo(
    () => filterWeighinRows(rows, { query: debouncedQuery, status, categoryId }),
    [rows, debouncedQuery, status, categoryId]
  )
  const weighed = rows.filter((r) => r.weighed).length
  const overweight = rows.filter((r) => r.overweight).length

  // Сброс пагинации при смене фильтров — иначе пустой экран под списком.
  // Состояние зависит от внешних фильтров, а не от рендера — effect оправдан.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleLimit(PAGE_SIZE)
  }, [debouncedQuery, status, categoryId])

  const startEdit = (row: WeighinRow) => {
    setEditingId(row.id)
    setDraft(row.weightActual ?? "")
    setDraftError("")
  }

  const save = async (id: number) => {
    const value = draft.replace(",", ".").trim()
    if (value === "") {
      setDraftError("Введите вес.")
      return
    }
    const num = Number(value)
    if (!Number.isFinite(num) || num <= 0) {
      setDraftError("Укажите корректный вес больше нуля.")
      return
    }
    setBusyId(id)
    setDraftError("")
    setLoadError(null)
    // Optimistic: показываем вес сразу, откатываем при ошибке.
    const prev = rows.find((r) => r.id === id)?.weightActual ?? null
    setOverrides((m) => new Map(m).set(id, value))
    setEditingId(null)
    try {
      await api(
        `/api/tournament/tournaments/${tournamentId}/checkin/`,
        {
          method: "POST",
          body: JSON.stringify({ athlete_id: id, weight_actual: value }),
        }
      )
      toast("Вес сохранён", "success")
      onSaved()
    } catch (e) {
      console.error(e)
      setOverrides((m) => {
        const next = new Map(m)
        if (prev === null) next.delete(id)
        else next.set(id, prev)
        return next
      })
      const text = apiErrorMessage(e)
      setLoadError(text)
      toast(text, "error")
    } finally {
      setBusyId(null)
    }
  }

  if (regs === null) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:bg-[#0E2035]">
        <FriendlyError
          message="Данные взвешивания недоступны — обновите страницу."
          onRetry={onSaved}
        />
      </div>
    )
  }

  if (roster.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:bg-[#0E2035]">
        <p role="status" className="text-sm text-secondary-text">
          Нет участников в категориях — сначала распределите спортсменов, затем взвешивайте.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold text-dark-text dark:text-slate-100">
            <Scale size={16} className="text-primary-blue" aria-hidden="true" />
            Взвешивание
          </h2>
          <span role="status" className="text-xs font-bold text-secondary-text tabular-nums">
            Взвешено {weighed}/{rows.length}
            {rows.length - weighed > 0 && ` · без веса ${rows.length - weighed}`}
            {overweight > 0 && ` · перевес ${overweight}`}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени…"
              aria-label="Поиск участника по имени"
              className="h-10 w-full rounded-xl border border-border bg-white px-4 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-xs font-bold text-secondary-text hover:text-dark-text"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as WeighinStatusFilter)}
              aria-label="Фильтр по статусу взвешивания"
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-dark-text dark:bg-white/5 dark:text-white"
            >
              <option value="all">Все</option>
              <option value="unweighed">Без веса</option>
              <option value="overweight">Перевес</option>
            </select>
            <select
              value={categoryId === null ? "" : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === "" ? null : Number(e.target.value))}
              aria-label="Фильтр по категории"
              className="h-10 max-w-44 rounded-xl border border-border bg-white px-3 text-sm text-dark-text dark:bg-white/5 dark:text-white"
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadError && (
        <FriendlyError message={loadError} onRetry={onSaved} />
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm dark:bg-[#0E2035]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] font-bold tracking-[0.12em] text-secondary-text uppercase">
              <th scope="col" className="sticky left-0 bg-white px-3 py-2.5 dark:bg-[#0E2035]">Имя</th>
              <th scope="col" className="px-3 py-2.5">Клуб</th>
              <th scope="col" className="px-3 py-2.5">Категория</th>
              <th scope="col" className="px-3 py-2.5">Вес</th>
              <th scope="col" className="px-3 py-2.5">Статус</th>
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">Действие</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, visibleLimit).map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0 dark:border-white/10">
                <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-dark-text dark:bg-[#0E2035] dark:text-slate-100">
                  {row.name}
                </td>
                <td className="px-3 py-2 text-secondary-text">{row.club ?? "—"}</td>
                <td className="max-w-44 truncate px-3 py-2 text-secondary-text" title={row.categoryNames}>
                  {row.categoryNames}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {editingId === row.id ? (
                    <span className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft}
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void save(row.id)
                          else if (e.key === "Escape") setEditingId(null)
                        }}
                        placeholder="52,5"
                        aria-label={`Вес: ${row.name}`}
                        className="h-9 w-24 rounded-lg border border-border bg-white px-2.5 text-sm dark:bg-white/5 dark:text-white"
                      />
                      <span className="text-xs text-secondary-text">кг</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-dark-text dark:text-slate-100">
                      {row.weightActual ? `${row.weightActual} кг` : "—"}
                      {row.limit !== null && (
                        <span className="ml-1.5 text-xs font-normal text-secondary-text">
                          / до {row.limit}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.overweight ? (
                    <span className="text-xs font-bold text-error">Перевес</span>
                  ) : row.weighed ? (
                    <span className="text-xs font-bold text-success">Взвешен</span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Без веса</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editingId === row.id ? (
                    <span className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="h-8 px-3 text-xs"
                      >
                        Отмена
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void save(row.id)}
                        disabled={busyId === row.id}
                        className="h-8 px-3 text-xs"
                      >
                        {busyId === row.id ? "Сохранение…" : "Сохранить"}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(row)}
                      disabled={busyId === row.id}
                      aria-label={row.weighed ? `Изменить вес: ${row.name}` : `Взвесить: ${row.name}`}
                      className="h-8 px-3 text-xs"
                    >
                      {row.weighed ? "Изменить" : "Взвесить"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editingId !== null && draftError && (
          <p role="alert" className="px-3 py-2 text-xs font-semibold text-error">
            {draftError}
          </p>
        )}
        {visible.length === 0 && (
          <p role="status" className="px-4 py-6 text-center text-sm text-secondary-text">
            Ничего не найдено — измените запрос или сбросьте фильтры.
          </p>
        )}
      </div>

      {visible.length > visibleLimit && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setVisibleLimit((l) => l + PAGE_SIZE)}
            className="h-9 px-5 text-xs"
          >
            Показать ещё ({visible.length - visibleLimit})
          </Button>
        </div>
      )}
    </div>
  )
}

export default memo(WeighInSection)
