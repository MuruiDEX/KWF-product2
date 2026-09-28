"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PagerProps {
  page: number
  pageCount: number
  rangeFrom: number
  rangeTo: number
  total: number
  onPage: (page: number) => void
  /** aria-label для nav, напр. «Страницы участников». */
  label: string
  /** Подпись диапазона, напр. «Показано». */
  rangeLabel?: string
}

/** Окно номеров страниц: 1 … p-1 p p+1 … N (компактно, без простыни кнопок). */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i)
  }
  const keep = new Set([0, 1, page - 1, page, page + 1, pageCount - 2, pageCount - 1])
  const nums = [...keep].filter((n) => n >= 0 && n < pageCount).sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("gap")
    out.push(nums[i])
  }
  return out
}

/** Общий компактный пейджер: desktop — номера, mobile — «x / N».
 * Логика страниц — существующие paginateParticipants/clampPage/pageCountFor. */
export function Pager({
  page,
  pageCount,
  rangeFrom,
  rangeTo,
  total,
  onPage,
  label,
  rangeLabel = "Показано",
}: PagerProps) {
  const windowed = useMemo(() => pageWindow(page, pageCount), [page, pageCount])
  if (pageCount <= 1) return null
  const btn =
    "inline-flex items-center justify-center rounded-lg border border-border text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text disabled:opacity-40 disabled:cursor-default dark:hover:bg-white/10 dark:hover:text-slate-100"
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-secondary-text tabular-nums">
        {rangeLabel} {rangeFrom}–{rangeTo} из {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label="Назад"
          className={`${btn} h-8 w-8`}
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        {/* Desktop: номера страниц. */}
        <span className="hidden items-center gap-1 sm:flex" aria-hidden={false}>
          {windowed.map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-0.5 text-xs text-secondary-text">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                disabled={n === page}
                aria-label={`Страница ${n + 1}`}
                aria-current={n === page ? "page" : undefined}
                className={`${btn} h-8 min-w-8 px-1.5 tabular-nums ${
                  n === page ? "bg-light-gray text-dark-text dark:bg-white/10 dark:text-slate-100" : ""
                }`}
              >
                {n + 1}
              </button>
            )
          )}
        </span>
        {/* Mobile: компактный счётчик. */}
        <span
          aria-hidden="true"
          className="px-1 text-xs font-bold text-secondary-text tabular-nums sm:hidden"
        >
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Далее"
          className={`${btn} h-8 gap-0.5 px-2.5`}
        >
          Далее
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
