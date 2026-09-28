"use client"

import { memo } from "react"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import type { ManageTabId } from "@/components/ReadinessChecklist"
import type { ReadinessReport } from "@/components/ReadinessChecklist"
import type { HealthItem } from "@/lib/controlCenter"

export interface AttentionItem {
  id: string
  severity: "error" | "warn"
  text: string
  tab: ManageTabId
}

/** Слияние реальных проблем: health + только НЕ-ok пункты readiness.
 * Информационные метрики («Татами: 3», «Сетки построены») сюда не попадают. */
export function mergeAttention(
  health: HealthItem[],
  readiness: ReadinessReport | null
): AttentionItem[] {
  const items: AttentionItem[] = [...health]
  for (const r of readiness?.items ?? []) {
    if (!r.ok) {
      items.push({
        id: `readiness-${r.id}`,
        severity: r.level,
        text: r.text,
        tab: r.tab,
      })
    }
  }
  const seen = new Set<string>()
  const deduped = items.filter((i) => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })
  // Ошибки — первыми, стабильный порядок внутри группы.
  return deduped.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === "error" ? -1 : 1
  })
}

/** Phase 1: только реальные проблемы, каждая ведёт к исправлению.
 * Пусто — честное «всё чисто» (role=status), а не список метрик. */
function AttentionPanel({
  health,
  readiness,
  onGoTab,
}: {
  health: HealthItem[]
  readiness: ReadinessReport | null
  onGoTab: (tab: ManageTabId) => void
}) {
  const items = mergeAttention(health, readiness)

  return (
    <section
      aria-label="Требует внимания"
      className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase dark:text-slate-400">
          Требует внимания
        </h2>
        {items.length > 0 && (
          <span
            role="status"
            className="rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums"
          >
            <span className="sr-only">Проблем: </span>
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-semibold text-success"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          Проблем не обнаружено
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onGoTab(item.tab)}
                aria-label={`${item.severity === "error" ? "Ошибка" : "Предупреждение"}: ${item.text}. Перейти к разделу`}
                className="w-full cursor-pointer rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-light-gray dark:hover:bg-white/10"
              >
                <span className="flex items-start gap-2.5">
                  {item.severity === "error" ? (
                    <XCircle
                      size={16}
                      className="mt-0.5 shrink-0 text-error"
                      role="img"
                      aria-label="Ошибка"
                    />
                  ) : (
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 shrink-0 text-warning"
                      role="img"
                      aria-label="Предупреждение"
                    />
                  )}
                  <span
                    className={
                      item.severity === "error"
                        ? "text-sm leading-snug font-bold text-dark-text dark:text-slate-100"
                        : "text-sm leading-snug font-semibold text-dark-text dark:text-slate-100"
                    }
                  >
                    {item.text}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default memo(AttentionPanel)
