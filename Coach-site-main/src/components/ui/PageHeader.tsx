import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Короткий eyebrow сверху (раздел). */
  eyebrow?: string
  title: string
  description?: string
  /** Действия справа на desktop, стеком под заголовком на mobile. */
  actions?: ReactNode
  /** Строка мета-информации под описанием (статусы, даты, счётчики). */
  meta?: ReactNode
  className?: string
}

/** Компактный хедер внутренней страницы (homepage Design DNA, шаг вниз):
 * eyebrow + H1 (kwf-h1) + описание + meta; действия справа на desktop.
 * Отличается от editorial SectionHeader (центровка, моушн, kanji/номера) —
 * тот остаётся языком главной. */
export function PageHeader({ eyebrow, title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="kwf-eyebrow mb-2">{eyebrow}</p>}
          <h1 className="kwf-h1">{title}</h1>
          {description && <p className="kwf-lead mt-2 max-w-2xl">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
