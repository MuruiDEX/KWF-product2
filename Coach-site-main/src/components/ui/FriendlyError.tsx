"use client"

import { useId, useState } from "react"
import { ChevronDown, RotateCcw, TriangleAlert } from "lucide-react"
import { apiErrorMessage, apiErrorStatus } from "@/lib/api"
import { cn } from "@/lib/utils"

interface FriendlyErrorProps {
  /** Исходная ошибка API — человеческий текст и статус выведутся сами. */
  error?: unknown
  /** Готовый текст (когда исходной ошибки уже нет, напр. сохранённый matchMsg). */
  message?: string
  /** Явный статус (когда error/message его не несут). */
  status?: number | null
  /** Технические детали для expandable-блока (по умолчанию — message). */
  details?: string
  title?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/** Человеческая причина по статусу — вместо голого «400 Bad Request». */
function reasonByStatus(status: number | null): string {
  if (status === 0) return "Проверьте интернет-соединение."
  if (status === 401) return "Ваша сессия истекла — войдите заново."
  if (status === 403)
    return "Возможно, не хватает прав или сессия устарела. Обновите страницу."
  if (status === 404) return "Данные устарели — обновите страницу."
  if (status === 409)
    return "Данные изменились, пока вы работали. Обновите страницу."
  if (status !== null && status >= 500)
    return "Проблема на сервере — попробуйте позже."
  return "Проверьте данные и попробуйте снова."
}

/** Phase 1: человеческая ошибка вместо технической.
 * Заголовок + причина + [Retry], технические детали — в expandable «Детали». */
export function FriendlyError({
  error,
  message,
  status,
  details,
  title = "Не удалось сохранить изменение",
  onRetry,
  retryLabel = "Повторить",
  className,
}: FriendlyErrorProps) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const resolvedStatus =
    status !== undefined ? status : error !== undefined ? apiErrorStatus(error) : null
  const resolvedMessage =
    message ?? (error !== undefined ? apiErrorMessage(error) : "Не удалось сохранить изменение.")
  const technical =
    details ??
    (resolvedStatus !== null
      ? `HTTP ${resolvedStatus} · ${resolvedMessage}`
      : resolvedMessage)

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-red-200 bg-red-50 p-3",
        "dark:border-red-400/20 dark:bg-red-500/10",
        className
      )}
    >
      <p className="flex items-start gap-2 text-sm font-bold text-red-700 dark:text-red-300">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        {title}
      </p>
      <p className="mt-1 pl-6 text-sm text-red-700 dark:text-red-300">{resolvedMessage}</p>
      <p className="mt-0.5 pl-6 text-xs text-red-700/80 dark:text-red-300/80">
        {reasonByStatus(resolvedStatus)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-bold text-white hover:opacity-90 dark:bg-red-500 dark:text-white"
          >
            <RotateCcw size={13} aria-hidden="true" />
            {retryLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-red-700/80 hover:text-red-700 dark:text-red-300/80 dark:hover:text-red-300"
        >
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={cn("transition-transform", open && "rotate-180")}
          />
          Детали
        </button>
      </div>
      {open && (
        <pre
          id={detailsId}
          className="mt-2 max-h-28 overflow-auto rounded-lg bg-red-700/5 p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-red-700/90 dark:bg-black/30 dark:text-red-200/90"
        >
          {technical}
        </pre>
      )}
    </div>
  )
}
