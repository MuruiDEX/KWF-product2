"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import { findCategoryOverlaps } from "@/lib/categoryUtils"
import type { TournamentCategory } from "@/lib/types"
import type { CategoryFormState } from "../hooks/useCategoryActions"

// Модалка категории: создание/редактирование + предупреждение о пересечениях.
// Чистый layout: состояние и сохранение — в useCategoryActions.
function CategoryDialog({
  modal,
  error,
  saving,
  categories,
  panelRef,
  onClose,
  onSubmit,
  onPatch,
}: {
  modal: CategoryFormState
  error: string
  saving: boolean
  categories: TournamentCategory[]
  panelRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onPatch: (patch: Partial<CategoryFormState>) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-cat-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-border p-5 w-full max-w-md max-h-[90vh] overflow-y-auto dark:bg-[#0E2035]"
      >
        <h3 id="manage-cat-title" className="text-lg font-bold text-dark-text mb-3 dark:text-slate-100">
          {modal.id ? "Изменить категорию" : "Новая категория"}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 dark:bg-red-500/10 dark:border-red-400/20 dark:text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5 dark:text-slate-100">Название *</label>
            <input
              type="text"
              value={modal.name}
              onChange={(e) => onPatch({ name: e.target.value })}
              placeholder="Мальчики 10-12 лет, до 45 кг"
              className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5 dark:text-slate-100">Пол</label>
            <select
              value={modal.gender}
              onChange={(e) => onPatch({ gender: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
            >
              <option value="male">Мальчики</option>
              <option value="female">Девочки</option>
              <option value="any">Смешанная</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5 dark:text-slate-100">Возраст от</label>
              <input
                type="number" min={0}
                value={modal.age_min}
                onChange={(e) => onPatch({ age_min: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5 dark:text-slate-100">Возраст до</label>
              <input
                type="number" min={0}
                value={modal.age_max}
                onChange={(e) => onPatch({ age_max: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5 dark:text-slate-100">Вес от (кг)</label>
              <input
                type="number" step="0.5" min="0"
                value={modal.weight_min}
                onChange={(e) => onPatch({ weight_min: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5 dark:text-slate-100">Вес до (кг) *</label>
              <input
                type="number" step="0.1" min="0.1"
                value={modal.weight_max}
                onChange={(e) => onPatch({ weight_max: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
              />
            </div>
          </div>
          {(() => {
            const others = categories
              .filter((c) => c.id !== modal.id)
              .map((c) => ({
                id: c.id,
                name: c.name,
                gender: c.gender,
                age_min: c.age_min,
                age_max: c.age_max,
                weight_min: c.weight_min ?? 0,
                weight_max: c.weight_max,
              }))
            const draft = {
              id: modal.id ?? "draft",
              name: modal.name,
              gender: modal.gender,
              age_min: Number(modal.age_min) || 0,
              age_max: Number(modal.age_max) || 0,
              weight_min: Number(String(modal.weight_min ?? "0").replace(",", ".")) || 0,
              weight_max: Number(String(modal.weight_max).replace(",", ".")) || 0,
            }
            const overlaps = findCategoryOverlaps([draft, ...others]).filter(
              (o) => o.aId === draft.id || o.bId === draft.id
            )
            if (overlaps.length === 0) return null
            return (
              <div role="alert" className="rounded-xl border border-warning/40 bg-warning-bg/50 p-3">
                <p className="text-xs font-bold text-warning">
                  Пересекается с: {overlaps.map((o) => (o.aId === draft.id ? o.bName : o.aName)).join("; ")}
                </p>
              </div>
            )
          })()}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="default" className="h-10 px-4 text-sm" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="h-10 px-5 text-sm" disabled={saving}>
              {saving ? "Сохранение..." : modal.id ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default memo(CategoryDialog)
