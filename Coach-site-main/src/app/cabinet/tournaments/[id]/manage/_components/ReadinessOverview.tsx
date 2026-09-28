"use client"

import { memo } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ReadinessSections,
  SectionStatus,
  TournamentReadiness,
} from "@/lib/readiness"
import type { ManageTabId } from "@/components/ReadinessChecklist"

export type ReadinessSectionKey = keyof ReadinessSections

// Phase 2: единый визуальный язык статусов для всего /manage.
// Один статус — один вид везде (обзор, IssuesCenter, таблицы секций в Phase 3).
export const SECTION_STATUS_META: Record<
  SectionStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  not_started: {
    label: "Не начато",
    className: "text-secondary-text",
    Icon: CircleDashed,
  },
  in_progress: {
    label: "В процессе",
    className: "text-primary-blue dark:text-blue-300",
    Icon: Loader,
  },
  needs_attention: {
    label: "Требует внимания",
    className: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  ready: { label: "Готово", className: "text-success", Icon: CheckCircle2 },
  completed: { label: "Завершено", className: "text-success", Icon: CheckCircle2 },
  error: { label: "Ошибка", className: "text-error", Icon: XCircle },
}

const SECTION_LABEL: Record<ReadinessSectionKey, string> = {
  participants: "Участники",
  categories: "Категории",
  weighIn: "Взвешивание",
  tatamis: "Татами",
  schedule: "Расписание",
  brackets: "Сетки",
  judges: "Судьи",
}

/** Секция движка → таб навигации. */
export function sectionTab(section: ReadinessSectionKey): ManageTabId {
  switch (section) {
    case "participants":
    case "categories":
      return section === "participants" ? "participants" : "categories"
    case "weighIn":
      return "weighin"
    case "tatamis":
    case "schedule":
      return "schedule"
    case "brackets":
      return "brackets"
    case "judges":
      return "staff"
  }
}

const SECTION_ORDER: ReadinessSectionKey[] = [
  "participants",
  "categories",
  "weighIn",
  "tatamis",
  "schedule",
  "brackets",
  "judges",
]

// Phase 2: главный экран — состояние турнира, а не набор карточек.
// Только отображает TournamentReadiness, ничего не вычисляет.
function ReadinessOverview({
  readiness,
  onGo,
}: {
  readiness: TournamentReadiness
  onGo: (tab: ManageTabId) => void
}) {
  return (
    <section
      aria-label="Состояние турнира"
      className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
          Турнир готов на {readiness.overall}%
        </h2>
        <span
          role="status"
          aria-label={`Готовность ${readiness.overall} процентов`}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums",
            readiness.overall >= 90
              ? "bg-success/10 text-success"
              : "bg-gold-soft text-dark-blue border border-gold/40 dark:bg-gold/15 dark:text-gold-pale dark:border-gold/30"
          )}
        >
          {readiness.overall}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={readiness.overall}
        aria-label="Процент готовности турнира"
        className="mb-3 h-2 overflow-hidden rounded-full bg-light-gray dark:bg-white/10"
      >
        <div
          className="h-full rounded-full bg-gold transition-[width]"
          style={{ width: `${readiness.overall}%` }}
        />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {SECTION_ORDER.map((key) => {
          const status = readiness.sections[key]
          const meta = SECTION_STATUS_META[status]
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onGo(sectionTab(key))}
                title="Перейти к разделу"
                aria-label={`${SECTION_LABEL[key]}: ${meta.label}. Перейти к разделу`}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-light-gray dark:hover:bg-white/10"
              >
                <meta.Icon
                  size={16}
                  className={cn("mt-0.5 shrink-0", meta.className)}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-dark-text dark:text-slate-100">
                  {SECTION_LABEL[key]}
                </span>
                <span className={cn("shrink-0 text-xs font-bold", meta.className)}>
                  {meta.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default memo(ReadinessOverview)
