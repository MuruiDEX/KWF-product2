"use client"

import { memo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useModalBehavior } from "@/lib/useModal"
import type { ConfirmState } from "../manageConfirm"

// Confirm-диалог /manage: подтверждение опасных действий и guardrail-
// навигация («Исправить проблемы»). Состояние и диспетчер —
// в useTournamentLifecycle; здесь только layout.
function ManageConfirmDialog({
  confirm,
  busy,
  onCancel,
  onRun,
}: {
  confirm: ConfirmState
  busy: boolean
  onCancel: () => void
  onRun: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  // D4: общий dialog behavior (focus-trap + scroll-lock + возврат фокуса).
  // Escape обрабатывает сам хук; busy-guard закрытия живёт в caller (onCancel
  // уже проверяет confirmBusy) — семантика не меняется, текст/мутации те же.
  useModalBehavior(true, onCancel, panelRef)
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-border p-5 w-full max-w-md dark:bg-[#0E2035]"
      >
        <h3 id="manage-confirm-title" className="text-lg font-bold text-dark-text mb-2 dark:text-slate-100">
          {confirm.title}
        </h3>
          <p className="text-sm text-secondary-text leading-relaxed whitespace-pre-line">{confirm.text}</p>
        <div className="flex justify-end gap-3 pt-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-4 text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            variant={confirm.danger ? "primary" : "secondary"}
            className={`h-9 px-5 text-sm gap-1.5 ${confirm.danger ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
            disabled={busy}
            onClick={onRun}
          >
            {busy ? "Выполнение..." : confirm.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default memo(ManageConfirmDialog)
