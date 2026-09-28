import { cn } from "@/lib/utils"

export type StatTone = "default" | "warn" | "strong"

interface StatProps {
  label: string
  value: string
  tone?: StatTone
  /** Всплывающая подсказка (title). */
  hint?: string
  className?: string
}

/** Атомарный показатель: значение + подпись. Тон warn — только проблемы,
 * strong — ключевой operational state (gold-акцент, не заливка).
 * Та же визуальная единица, что ячейки KpiStrip. */
export function Stat({ label, value, tone = "default", hint, className }: StatProps) {
  return (
    <div
      title={hint}
      className={cn(
        "rounded-xl border border-border bg-white px-3 py-2 dark:bg-[#0E2035]",
        tone === "strong" && "border-gold/40 dark:border-gold/30",
        className
      )}
    >
      <p
        className={cn(
          "text-lg font-extrabold tabular-nums leading-tight text-dark-text dark:text-slate-100",
          tone === "warn" && "text-warning",
          tone === "strong" && "text-gold-deep dark:text-gold-pale"
        )}
      >
        {value}
      </p>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-text leading-tight mt-0.5">
        {label}
      </p>
    </div>
  )
}
