"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import type { RoundFormState } from "../hooks/useRoundActions"

// Модалка раунда: только название. Состояние и сохранение — в useRoundActions.
function RoundDialog({
  modal,
  error,
  saving,
  panelRef,
  onClose,
  onSubmit,
  onNameChange,
}: {
  modal: RoundFormState
  error: string
  saving: boolean
  panelRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  onNameChange: (name: string) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-round-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-border p-5 w-full max-w-md dark:bg-[#0E2035]"
      >
        <h3 id="manage-round-title" className="text-lg font-bold text-dark-text mb-3 dark:text-slate-100">Новый раунд</h3>
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
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="1/8 финала"
              autoFocus
              className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="default" className="h-10 px-4 text-sm" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="h-10 px-5 text-sm" disabled={saving}>
              {saving ? "Сохранение..." : "Создать"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default memo(RoundDialog)
