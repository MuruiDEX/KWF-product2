"use client"

import { useEffect } from "react"
import { ClipboardCheck, ClipboardX, FileSpreadsheet, FileText, X } from "lucide-react"

interface BulkBarProps {
  count: number
  noun: string
  busy: boolean
  onExport: () => void
  onDocuments: () => void
  onCheckin: () => void
  onUncheck: () => void
  onClear: () => void
}

/** Phase 2B: sticky панель массовых действий. Видна только при selection,
 * место постоянно не занимает, закрывается по Escape и крестику. */
export function BulkBar({
  count,
  noun,
  busy,
  onExport,
  onDocuments,
  onCheckin,
  onUncheck,
  onClear,
}: BulkBarProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClear()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClear])

  if (count === 0) return null

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  return (
    <div
      role="toolbar"
      aria-label={`Массовые действия: выбрано ${count}`}
      className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-border bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:bg-[#0E2035]/95"
    >
      <p role="status" className="text-xs font-extrabold text-dark-text tabular-nums dark:text-slate-100">
        Выбрано: {count} {noun}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCheckin}
          className={`${btn} bg-dark-blue text-white hover:bg-primary-blue dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]`}
        >
          <ClipboardCheck size={14} aria-hidden="true" />
          {busy ? "Выполнение…" : "Отметить явку"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onUncheck}
          title="Снять явку у выбранных (с подтверждением)"
          className={`${btn} border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-400/25 dark:text-red-300 dark:hover:bg-red-500/10`}
        >
          <ClipboardX size={14} aria-hidden="true" />
          Снять явку
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onExport}
          className={`${btn} border border-border text-dark-text hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10`}
        >
          <FileSpreadsheet size={14} aria-hidden="true" />
          Экспорт CSV
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDocuments}
          className={`${btn} border border-border text-dark-text hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10`}
        >
          <FileText size={14} aria-hidden="true" />
          В документы
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Снять выбор"
          title="Снять выбор (Esc)"
          className="ml-auto inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-secondary-text hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
