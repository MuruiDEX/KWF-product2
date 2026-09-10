"use client"

import { cn } from "@/lib/utils"

const LABELS: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
  finished: "Завершён",
  pending: "Ожидает",
  waiting: "Ожидает",
  ready: "Готов",
  in_progress: "Идёт бой",
  bye: "BYE",
  paused: "Пауза",
  active: "Сейчас выступает",
  live: "LIVE",
  upcoming: "Скоро",
  next: "Следующий",
}

const STYLES: Record<string, string> = {
  draft: "bg-black/5 text-secondary-text",
  published: "bg-success-bg text-success",
  finished: "bg-info-bg text-info",
  pending: "bg-black/5 text-secondary-text",
  waiting: "bg-black/5 text-secondary-text",
  ready: "bg-info-bg text-info",
  in_progress: "bg-warning-bg text-warning",
  bye: "bg-[#F3E8FF] text-[#7E22CE]",
  paused: "bg-warning-bg text-warning",
  active: "bg-success-bg text-success",
  live: "bg-error-bg text-error",
  upcoming: "bg-black/5 text-secondary-text",
  next: "bg-dark-blue text-white",
}

const DARK_STYLES: Record<string, string> = {
  draft: "bg-white/10 text-white/70 border-white/10",
  upcoming: "bg-white/10 text-white/80 border-white/10",
}

interface StatusPillProps {
  status: string
  label?: string
  pulse?: boolean
  tone?: "light" | "dark"
  className?: string
}

export default function StatusPill({ status, label, pulse, tone = "light", className }: StatusPillProps) {
  const text = label ?? LABELS[status] ?? status
  const style =
    (tone === "dark" && DARK_STYLES[status]) ||
    STYLES[status] ||
    "bg-black/5 text-secondary-text"
  const showPulse = pulse ?? (status === "live" || status === "in_progress")
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-transparent",
        style,
        className
      )}
    >
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {text}
    </span>
  )
}
