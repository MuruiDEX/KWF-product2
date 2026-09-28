"use client"

import { useMemo, useRef } from "react"
import { Pencil, Play, Plus, Swords, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import { useModalBehavior } from "@/lib/useModal"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { Tatami, TournamentCategory } from "@/lib/types"
import { buildCategoryDrawerData } from "../manageDerived"

export interface CategoryDrawerData {
  cat: TournamentCategory
  memberCount: number
  checkedIn: number | null
  hasBracket: boolean
  fights: number
  left: number
  canGenerate: boolean
  tatamiName: string
}

interface CategoryDrawerProps {
  open: boolean
  category: TournamentCategory | null
  regs: RegistrationEntry[] | null
  tatamis: Tatami[]
  tatamiBusy: boolean
  regsById: Map<number, boolean>
  onClose: () => void
  onGenerateBracket: () => void
  onCategoryTatami: (tatamiId: string) => void
  onEdit: () => void
  onAddRound: () => void
  onGoSchedule: () => void
  onGoBrackets: () => void
}

/** Phase 2B: drawer категории вместо прокрутки страницы.
 * Производные метрики считает сам из живого объекта категории. */
export function CategoryDrawer({
  open,
  category,
  regs,
  tatamis,
  tatamiBusy,
  regsById,
  onClose,
  onGenerateBracket,
  onCategoryTatami,
  onEdit,
  onAddRound,
  onGoSchedule,
  onGoBrackets,
}: CategoryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(open, onClose, panelRef)
  const data = useMemo(
    () =>
      open
        ? buildCategoryDrawerData({ cat: category ?? undefined, regs, regsById, tatamis })
        : null,
    [open, category, regs, regsById, tatamis]
  )

  if (!open || !data) return null
  const { cat } = data

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Категория: ${cat.name}`}
      className="fixed inset-0 z-[80] bg-black/50"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-white shadow-xl dark:bg-[#0E2035]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] text-secondary-text uppercase">
              Категория
            </p>
            <h2 className="truncate text-lg font-extrabold text-dark-text dark:text-slate-100">
              {cat.name}
            </h2>
            <p className="mt-0.5 text-xs text-secondary-text">
              {cat.gender === "male" ? "Мальчики" : cat.gender === "female" ? "Девочки" : "Смешанная"} ·{" "}
              {cat.age_min}–{cat.age_max} лет · до {String(cat.weight_max)} кг
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель категории"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-secondary-text hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <section aria-label="Статус">
            <StatusPill
              status={data.hasBracket ? (data.left === 0 ? "finished" : "active") : "waiting"}
              label={
                data.hasBracket
                  ? data.left === 0
                    ? "Завершена"
                    : `В игре · боёв осталось: ${data.left}`
                  : "Без сетки"
              }
            />
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-secondary-text">Участники</dt>
                <dd className="font-extrabold text-dark-text tabular-nums dark:text-slate-100">
                  {data.memberCount}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-secondary-text">Явка</dt>
                <dd className="font-extrabold text-dark-text tabular-nums dark:text-slate-100">
                  {data.checkedIn === null ? "—" : `${data.checkedIn}/${data.memberCount}`}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-semibold text-secondary-text">Бои</dt>
                <dd className="font-extrabold text-dark-text tabular-nums dark:text-slate-100">
                  {data.hasBracket ? data.fights : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="font-semibold text-secondary-text">Татами</dt>
                <dd>
                  <select
                    value={cat.tatami ?? ""}
                    disabled={tatamiBusy || tatamis.length === 0}
                    onChange={(e) => onCategoryTatami(e.target.value)}
                    aria-label={`Татами категории ${cat.name}`}
                    className="h-8 max-w-[160px] truncate px-2 text-xs font-bold rounded-lg border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 disabled:opacity-50 dark:bg-white/5 dark:text-white"
                  >
                    <option value="">—</option>
                    {tatamis.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            </dl>
          </section>

          <section aria-label="Участники">
            <h3 className="mb-2 text-xs font-extrabold tracking-[0.14em] text-secondary-text uppercase">
              Участники · {data.memberCount}
            </h3>
            {(cat.athletes || []).length === 0 ? (
              <p className="text-sm text-secondary-text">В категории пока никого нет.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {(cat.athletes || []).map((a) => {
                  const checked = regsById.get(a.id)
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      <span
                        aria-label={checked ? "Явка отмечена" : "Явка не отмечена"}
                        className={
                          checked
                            ? "font-extrabold text-success"
                            : "font-bold text-secondary-text"
                        }
                      >
                        {checked ? "✓" : "·"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-dark-text dark:text-slate-100">
                        {a.last_name} {a.first_name}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-label="Действия" className="flex flex-col gap-2">
            {data.canGenerate && (
              <Button onClick={onGenerateBracket} size="sm" className="gap-1.5">
                <Swords size={14} aria-hidden="true" />
                Сформировать сетку
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={onGoSchedule} variant="outline" size="sm" className="gap-1.5">
                <Play size={14} aria-hidden="true" />
                LIVE
              </Button>
              <Button onClick={onGoBrackets} variant="outline" size="sm" className="gap-1.5">
                Сетка
              </Button>
              <Button onClick={onEdit} variant="outline" size="sm" className="gap-1.5">
                <Pencil size={14} aria-hidden="true" />
                Изменить
              </Button>
              <Button onClick={onAddRound} variant="outline" size="sm" className="gap-1.5">
                <Plus size={14} aria-hidden="true" />
                Раунд
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
