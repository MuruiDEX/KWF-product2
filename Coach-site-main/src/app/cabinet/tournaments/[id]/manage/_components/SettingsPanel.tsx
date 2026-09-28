"use client"

import { useState } from "react"
import { Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import type { Tournament } from "@/lib/types"

interface SettingsPanelProps {
  tournament: Tournament
  onPublishToggle: () => void
  onFinish: () => void
  onDelete: () => void
  onSaveMatsCount: (n: number) => Promise<void>
  onOpenTemplate: () => void
}

/** Phase 2B: только необходимые настройки турнира.
 * Операции (сетки, татами, явка) живут в своих вкладках. */
export function SettingsPanel({
  tournament,
  onPublishToggle,
  onFinish,
  onDelete,
  onSaveMatsCount,
  onOpenTemplate,
}: SettingsPanelProps) {
  const [mats, setMats] = useState(() => String(tournament.mats_count ?? 1))
  const [matsBusy, setMatsBusy] = useState(false)
  const [matsError, setMatsError] = useState("")
  const [prevMats, setPrevMats] = useState(tournament.mats_count ?? 1)
  if ((tournament.mats_count ?? 1) !== prevMats) {
    setPrevMats(tournament.mats_count ?? 1)
    setMats(String(tournament.mats_count ?? 1))
    setMatsError("")
  }

  const saveMats = async () => {
    const n = Number(mats)
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      setMatsError("Укажите число татами от 1 до 50.")
      return
    }
    setMatsError("")
    setMatsBusy(true)
    try {
      await onSaveMatsCount(n)
    } finally {
      setMatsBusy(false)
    }
  }

  const row = "flex items-center justify-between gap-3 py-1.5 text-sm"
  const dt = "font-semibold text-secondary-text shrink-0"
  const dd = "min-w-0 break-words text-right font-bold text-dark-text dark:text-slate-100"
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <h2 className="mb-2 text-base font-extrabold text-dark-text dark:text-slate-100">
          Турнир
        </h2>
        <dl>
          <div className={row}>
            <dt className={dt}>Название</dt>
            <dd className={dd}>{tournament.name}</dd>
          </div>
          <div className={row}>
            <dt className={dt}>Даты</dt>
            <dd className={`${dd} tabular-nums`}>
              {tournament.start_date}
              {tournament.end_date && tournament.end_date !== tournament.start_date
                ? ` — ${tournament.end_date}`
                : ""}
            </dd>
          </div>
          <div className={row}>
            <dt className={dt}>Место</dt>
            <dd className={dd}>
              {tournament.location || "—"}
            </dd>
          </div>
          <div className={row}>
            <dt className="font-semibold text-secondary-text">Статус</dt>
            <dd>
              <StatusPill status={tournament.status} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <h2 className="mb-2 text-base font-extrabold text-dark-text dark:text-slate-100">
          Татами
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="settings-mats" className="mb-1.5 block text-sm font-semibold text-dark-text dark:text-slate-100">
              Количество татами
            </label>
            <input
              id="settings-mats"
              type="number"
              min={1}
              max={50}
              value={mats}
              disabled={matsBusy}
              onChange={(e) => setMats(e.target.value)}
              className="h-10 w-28 rounded-xl border border-border bg-white px-3 text-sm tabular-nums text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none disabled:opacity-50 dark:bg-white/5 dark:text-white"
            />
          </div>
          <Button size="sm" className="h-10 gap-1.5 text-xs" disabled={matsBusy} onClick={() => void saveMats()}>
            <Save size={14} aria-hidden="true" />
            {matsBusy ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
        {matsError && (
          <p role="alert" className="mt-2 text-xs font-bold text-error">
            {matsError}
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-secondary-text">
          Сами татами создаются и распределяются во вкладке «Расписание».
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <h2 className="mb-2 text-base font-extrabold text-dark-text dark:text-slate-100">
          Публикация и завершение
        </h2>
        <div className="flex flex-wrap gap-2">
          {tournament.status !== "finished" && (
            <Button onClick={onPublishToggle} variant="outline" size="sm" className="h-9 text-xs">
              {tournament.status === "published" ? "Снять с публикации" : "Опубликовать"}
            </Button>
          )}
          {tournament.status !== "finished" && (
            <Button onClick={onFinish} variant="secondary" size="sm" className="h-9 text-xs">
              Завершить турнир
            </Button>
          )}
          <Button onClick={onOpenTemplate} variant="outline" size="sm" className="h-9 text-xs">
            Сохранить как шаблон
          </Button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/15"
          >
            <Trash2 size={14} aria-hidden="true" />
            Удалить турнир
          </Button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-secondary-text">
          Завершённый турнир изменить нельзя. Спортсмены при удалении турнира остаются в базе.
        </p>
      </div>
    </div>
  )
}
