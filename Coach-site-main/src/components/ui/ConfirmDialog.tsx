"use client"

import { useRef } from "react"
import { TriangleAlert } from "lucide-react"
import { useModalBehavior } from "@/lib/useModal"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Модалка подтверждения в стилистике проекта (замена window.confirm). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // D4: Escape + focus-trap + scroll-lock + возврат фокуса.
  useModalBehavior(open, onClose, panelRef)

  if (!open) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl dark:bg-[#0E2035]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {danger && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error/10">
              <TriangleAlert className="h-5 w-5 text-error" />
            </span>
          )}
          <div>
            <h3 className="text-lg font-bold text-dark-text">{title}</h3>
            {description && (
              <p className="mt-1 text-sm leading-relaxed text-secondary-text">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-dark-text hover:bg-light-gray disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={`h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${
              danger
                ? "bg-error hover:opacity-90"
                : "bg-dark-blue hover:bg-primary-blue dark:bg-gold dark:text-dark-blue"
            }`}
          >
            {busy ? "Выполняется…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
