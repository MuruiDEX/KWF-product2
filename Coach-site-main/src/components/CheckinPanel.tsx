"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ClipboardCheck, Search, Zap } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { api, apiErrorMessage } from "@/lib/api"
import { manageKeys } from "@/lib/queryClient"
import { toast } from "@/components/ui/Toaster"
import { useManageRegsQuery } from "@/app/cabinet/tournaments/[id]/manage/hooks/useManageQueries"

export interface CheckinRosterEntry {
  id: number
  name: string
  /** Категории спортсмена с лимитами веса (кг). Пусто = вне категорий. */
  categories: { id: number; name: string; weightMax: number | null }[]
  /** Пол/возраст/клуб для подписи в WeighInStation (опционально). */
  meta?: { gender?: string | null; age?: number | null; club?: string | null }
}

/** Парсинг лимита веса ("40", "40,5", 40) → кг. Мусор = null (без лимита). */
export function parseWeightLimit(
  raw: string | number | null | undefined
): number | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).replace(",", ".").trim()
  if (text === "") return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export interface OverweightInfo {
  over: boolean
  /** Строжайший лимит среди категорий (кг). */
  limit: number | null
  /** Превышение над лимитом (кг). */
  excess: number | null
  /** Категория строжайшего лимита. */
  categoryName: string | null
}

/** Перевес: фактический вес против строжайшего лимита категорий.
 * weightActual — строка из input ("", "52,5"). Без веса/лимита — не перевес. */
export function checkOverweight(
  weightActual: string | null | undefined,
  categories: { name: string; weightMax: number | null }[]
): OverweightInfo {
  const none: OverweightInfo = {
    over: false,
    limit: null,
    excess: null,
    categoryName: null,
  }
  const actual = parseWeightLimit(weightActual)
  if (actual === null) return none
  let best: { name: string; weightMax: number } | null = null
  for (const c of categories) {
    if (c.weightMax === null) continue
    if (best === null || c.weightMax < best.weightMax) {
      best = { name: c.name, weightMax: c.weightMax }
    }
  }
  if (best === null) return none
  if (actual <= best.weightMax) return none
  return {
    over: true,
    limit: best.weightMax,
    excess: Math.round((actual - best.weightMax) * 100) / 100,
    categoryName: best.name,
  }
}

interface Registration {
  athlete_id: number
  name: string
  checked_in: boolean
  weight_actual: string | null
}

/** Поле фактического веса с локальным черновиком.
 * Корень бага «1 символ → потеря focus»: раньше у input был
 * key={`${id}-${weight}`} + defaultValue — после каждого сохранения
 * key менялся и React размонтировал поле. Здесь key стабилен (id),
 * ввод — controlled-черновик, серверное значение подтягивается только
 * когда поле не в фокусе, коммит — на blur/Enter. */
function WeightInput({
  athleteId,
  athleteName,
  value,
  disabled,
  onCommit,
}: {
  athleteId: number
  athleteName: string
  value: string | null
  disabled: boolean
  onCommit: (id: number, raw: string) => void
}) {
  const [draft, setDraft] = useState(value ?? "")
  const focusedRef = useRef(false)
  const syncedRef = useRef(value ?? "")

  useEffect(() => {
    const incoming = value ?? ""
    if (!focusedRef.current && incoming !== syncedRef.current) {
      syncedRef.current = incoming
      setDraft(incoming)
    }
  }, [value])

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={(e) => {
        focusedRef.current = false
        onCommit(athleteId, e.target.value)
      }}
      disabled={disabled}
      inputMode="decimal"
      autoComplete="off"
      placeholder="—"
      aria-label={`Фактический вес: ${athleteName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      className="w-20 h-10 px-2 text-sm tabular-nums text-center rounded-lg border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
    />
  )
}

/** Фаза 2 (check-in v1): явка + фактический вес в день турнира. */
const VISIBLE_PAGE = 30
export function CheckinPanel({
  tournamentId,
  roster,
  refreshKey,
}: {
  tournamentId: string | number
  roster: CheckinRosterEntry[]
  /** Ключ принудительного обновления (родитель инкрементит после мутаций). */
  refreshKey?: number
}) {
  const [busyId, setBusyId] = useState<number | null>(null)
  // Query-migration: явка читается из общего кэша (тот же ключ, что page и
  // WeighInSection) — второго параллельного GET registrations/ больше нет.
  // Мутации пишут сразу в кэш (мгновенно всем подписчикам) + инвалидация
  // для серверного подтверждения. Локальной копии и эффектов синхронизации нет.
  const queryClient = useQueryClient()
  const regsKey = manageKeys.regs(String(tournamentId))
  const sharedRegs = useManageRegsQuery(String(tournamentId))
  const regs = useMemo(
    () => new Map((sharedRegs.data ?? []).map((r) => [r.athlete_id, r] as const)),
    [sharedRegs.data]
  )
  const loading = sharedRegs.isPending
  const putReg = useCallback(
    (res: Registration) => {
      queryClient.setQueryData<Registration[] | null>(regsKey, (prev) => {
        if (!prev) return prev
        const i = prev.findIndex((r) => r.athlete_id === res.athlete_id)
        if (i === -1) return [...prev, res]
        const next = [...prev]
        next[i] = res
        return next
      })
    },
    [queryClient, regsKey]
  )
  const touchRegs = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: regsKey })
  }, [queryClient, regsKey])

  // refreshKey — совместимость с родителем: bulk-операции page и так
  // инвалидируют ключ, это поясной ремень. setState внутри нет.
  useEffect(() => {
    touchRegs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])
  // N14: поиск по списку + быстрая явка по коду привязки (скан на стойке).
  const [query, setQuery] = useState("")
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState("")
  const [codeBusy, setCodeBusy] = useState(false)
  // Длинный ростер — порциями: полный список из сотен строк толкает
  // остальной контент далеко вниз. Выбор/состояние не зависят от лимита.
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_PAGE)

  const toggle = async (id: number, next: boolean) => {
    setBusyId(id)
    try {
      const res = await api<Registration>(
        `/api/tournament/tournaments/${tournamentId}/checkin/`,
        {
          method: "POST",
          body: JSON.stringify({ athlete_id: id, checked_in: next }),
        }
      )
      putReg(res)
      // Остальные потребители ключа (обзор, взвешивание) подтянутся сами.
      touchRegs()
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setBusyId(null)
    }
  }

  const saveWeight = async (id: number, raw: string) => {
    const value = raw.replace(",", ".").trim()
    if (value === "") return
    setBusyId(id)
    try {
      const res = await api<Registration>(
        `/api/tournament/tournaments/${tournamentId}/checkin/`,
        {
          method: "POST",
          body: JSON.stringify({ athlete_id: id, weight_actual: value }),
        }
      )
      putReg(res)
      toast("Вес сохранён", "success")
      touchRegs()
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setBusyId(null)
    }
  }

  const checkinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value || codeBusy) return
    setCodeBusy(true)
    setCodeError("")
    try {
      const res = await api<Registration>(
        `/api/tournament/tournaments/${tournamentId}/checkin/`,
        { method: "POST", body: JSON.stringify({ link_code: value }) }
      )
      putReg(res)
      setCode("")
      toast("Явка отмечена", "success")
      touchRegs()
    } catch {
      setCodeError("Код не найден — проверьте и попробуйте снова")
    } finally {
      setCodeBusy(false)
    }
  }

  if (roster.length === 0) return null
  const present = roster.filter((r) => regs.get(r.id)?.checked_in).length
  const absent = roster.length - present
  const presentPct = roster.length > 0 ? Math.round((present / roster.length) * 100) : 0
  // Перевес считаем по вписанному фактическому весу и лимитам категорий.
  const overweightById = new Map<number, OverweightInfo>()
  for (const r of roster) {
    const info = checkOverweight(regs.get(r.id)?.weight_actual, r.categories)
    if (info.over) overweightById.set(r.id, info)
  }
  const q = query.trim().toLowerCase()
  const visibleRoster =
    q.length === 0
      ? roster
      : roster.filter((r) => r.name.toLowerCase().includes(q))

  return (
    <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-bold text-dark-text inline-flex items-center gap-2">
          <ClipboardCheck size={16} className="text-primary-blue" />
          Явка
        </h3>
        <span className="text-xs font-bold text-secondary-text tabular-nums" role="status">
          {loading ? "…" : `${present}/${roster.length}`}
        </span>
      </div>
      {/* N14: прогресс явки. */}
      <div
        className="h-2 rounded-full bg-light-gray overflow-hidden mb-1.5"
        role="progressbar"
        aria-valuenow={present}
        aria-valuemin={0}
        aria-valuemax={roster.length}
        aria-label={`Явка: ${present} из ${roster.length}`}
      >
        <div
          className="h-full rounded-full bg-success transition-all"
          style={{ width: `${presentPct}%` }}
        />
      </div>
      <p className="text-xs text-secondary-text mb-3 tabular-nums">
        Пришли: {present} · Отсутствуют: {absent}
        {overweightById.size > 0 && ` · Перевес: ${overweightById.size}`}
      </p>
      <form onSubmit={checkinByCode} className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Zap
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
          />
          <label className="sr-only" htmlFor={`checkin-code-${tournamentId}`}>
            Быстрая явка по коду привязки
          </label>
          <input
            id={`checkin-code-${tournamentId}`}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Код с экрана родителя — Enter"
            autoComplete="off"
            maxLength={32}
            disabled={codeBusy}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-white text-dark-text text-sm font-mono font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all disabled:opacity-50 dark:bg-white/5 dark:text-white"
          />
        </div>
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
          />
          <label className="sr-only" htmlFor={`checkin-search-${tournamentId}`}>
            Поиск спортсмена в списке
          </label>
          <input
            id={`checkin-search-${tournamentId}`}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisibleLimit(VISIBLE_PAGE)
            }}
            placeholder="Найти в списке…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all dark:bg-white/5 dark:text-white"
          />
        </div>
      </form>
      {codeError && (
        <p role="alert" className="text-xs font-bold text-error mb-3">
          {codeError}
        </p>
      )}
      {overweightById.size > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-xs font-bold text-error tabular-nums"
        >
          Перевес: {overweightById.size} — переведите спортсменов в категорию
          выше до старта сетки
        </div>
      )}
      <ul className="divide-y divide-border border-y border-border">
        {visibleRoster.length === 0 && (
          <li className="py-6 text-center text-sm text-secondary-text">
            По запросу «{query.trim()}» никого не найдено
          </li>
        )}
        {visibleRoster.slice(0, visibleLimit).map((r) => {
          const reg = regs.get(r.id)
          const checked = reg?.checked_in ?? false
          const ow = overweightById.get(r.id)
          return (
            <li
              key={r.id}
              className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg ${
                ow ? "bg-error/5 border border-error/30" : "border border-transparent"
              }`}
            >
              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busyId === r.id}
                  onChange={(e) => void toggle(r.id, e.target.checked)}
                  aria-label={`Явка: ${r.name}`}
                  className="h-5 w-5 shrink-0 accent-[#17488F]"
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold truncate ${checked ? "text-dark-text" : "text-secondary-text"}`}
                  >
                    {r.name}
                  </span>
                  {ow && (
                    <span
                      className="block text-[11px] font-bold text-error tabular-nums"
                      title={`Лимит категории «${ow.categoryName}»: ${ow.limit} кг`}
                    >
                      +{ow.excess} кг к «{ow.categoryName}»
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-secondary-text">кг</span>
                <WeightInput
                  key={r.id}
                  athleteId={r.id}
                  athleteName={r.name}
                  value={reg?.weight_actual ?? null}
                  disabled={busyId === r.id}
                  onCommit={(id, raw) => void saveWeight(id, raw)}
                />
              </label>
            </li>
          )
        })}
      </ul>
      {visibleRoster.length > visibleLimit && (
        <button
          type="button"
          onClick={() => setVisibleLimit((n) => n + VISIBLE_PAGE)}
          className="mt-2 inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
        >
          Показать ещё ({visibleRoster.length - visibleLimit} из {visibleRoster.length})
        </button>
      )}
    </div>
  )
}
