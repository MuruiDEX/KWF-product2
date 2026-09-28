import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FilterOption<T extends string = string> {
  id: T
  label: string
}

interface FilterBarProps<T extends string = string> {
  options: FilterOption<T>[]
  value: T
  onChange: (id: T) => void
  /** Accessible-имя группы (видимой подписи нет — компактность). */
  ariaLabel: string
  /** Слот под поиск/селекты справа; на mobile переносится вниз. */
  children?: ReactNode
  /** Счётчик вида «Найдено N» слева от слотов. */
  count?: ReactNode
  className?: string
}

/** Сегментированный фильтр + слот под поиск/селекты. Активный сегмент —
 * navy-заливка (gold только для operational strong-состояний, не здесь).
 * Высота сегментов h-10 — шкала control-md. */
export function FilterBar<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  children,
  count,
  className,
}: FilterBarProps<T>) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
        {options.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            aria-pressed={value === f.id}
            className={cn(
              "h-10 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50",
              value === f.id
                ? "bg-dark-blue text-white shadow dark:bg-gold dark:text-dark-blue"
                : "bg-white border border-border text-secondary-text hover:text-dark-text dark:hover:text-slate-100"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {(count || children) && (
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {count && (
            <span role="status" className="text-xs font-semibold text-secondary-text tabular-nums">
              {count}
            </span>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
