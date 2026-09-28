"use client"

import { memo } from "react"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NextActionTarget, TournamentIssue } from "@/lib/readiness"

// Phase 2: централизованный список проблем турнира из единого движка.
// Каждая проблема: описание + причина + кнопка исправления. После исправления
// issue исчезает сам (движок деривирует список из данных — ручных dismiss нет).
function IssuesCenter({
  issues,
  onResolve,
}: {
  issues: TournamentIssue[]
  onResolve: (target: NextActionTarget) => void
}) {
  const errors = issues.filter((i) => i.severity === "error").length
  return (
    <section
      aria-label="Требуют внимания"
      className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
          Требуют внимания{issues.length > 0 ? ` — ${issues.length}` : ""}
        </h2>
        {errors > 0 && (
          <span
            role="status"
            aria-label={`Критических проблем: ${errors}`}
            className="rounded-full bg-error/10 px-2.5 py-1 text-xs font-extrabold text-error tabular-nums"
          >
            {errors} крит.
          </span>
        )}
      </div>
      {issues.length === 0 ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm font-semibold text-success"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          Проблем не обнаружено
        </p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-3 py-2.5 dark:border-white/10"
            >
              {issue.severity === "error" ? (
                <XCircle
                  size={16}
                  className="shrink-0 text-error"
                  role="img"
                  aria-label="Ошибка"
                />
              ) : (
                <AlertTriangle
                  size={16}
                  className="shrink-0 text-amber-600 dark:text-amber-400"
                  role="img"
                  aria-label="Предупреждение"
                />
              )}
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-bold text-dark-text dark:text-slate-100">
                  {issue.title}
                </p>
                <p className="text-xs leading-snug text-secondary-text">
                  {issue.detail}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onResolve(issue.target)}
                aria-label={`${issue.actionLabel}: ${issue.title}`}
                className="h-8 shrink-0 text-xs"
              >
                {issue.actionLabel}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default memo(IssuesCenter)
