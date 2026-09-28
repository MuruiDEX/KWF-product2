"use client"

import { memo } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NextAction } from "@/lib/readiness"

// Phase 2: самый заметный элемент главного экрана — ровно одно следующее
// действие из единого движка (computeTournamentReadiness). Родитель маппит
// target: wizard → открыть мастер, publish → диалог публикации, иначе таб.
function NextActionCard({
  action,
  tournamentFinished,
  onRun,
}: {
  action: NextAction | null
  tournamentFinished: boolean
  onRun: (target: NextAction["target"]) => void
}) {
  if (!action) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm dark:bg-[#0E2035]"
      >
        <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden="true" />
        <p className="min-w-[200px] flex-1 text-sm text-dark-text dark:text-slate-100">
          <span className="font-bold">
            {tournamentFinished ? "Турнир завершён. " : "Всё готово. "}
          </span>
          Проблем, мешающих старту, не обнаружено.
        </p>
      </div>
    )
  }
  return (
    <div
      role="status"
      aria-label={`Следующее действие: ${action.text}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border border-l-4 border-l-gold bg-white px-4 py-3 shadow-sm dark:bg-[#0E2035]"
    >
      <p className="min-w-[200px] flex-1 text-sm text-dark-text dark:text-slate-100">
        <span className="font-bold">Следующее действие: </span>
        {action.text}
      </p>
      <Button
        onClick={() => onRun(action.target)}
        size="sm"
        className="h-9 shrink-0 px-4 text-xs"
      >
        {action.actionLabel}
        <ArrowRight size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

export default memo(NextActionCard)
