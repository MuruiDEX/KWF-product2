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
  draft: "bg-black/5 text-secondary-text dark:bg-white/10 dark:text-white/70",
  published: "bg-success-bg text-success dark:bg-success/20 dark:text-[#86EFAC]",
  finished: "bg-info-bg text-info dark:bg-info/20 dark:text-[#93C5FD]",
  pending: "bg-black/5 text-secondary-text dark:bg-white/10 dark:text-white/70",
  waiting: "bg-black/5 text-secondary-text dark:bg-white/10 dark:text-white/70",
  ready: "bg-info-bg text-info dark:bg-info/20 dark:text-[#93C5FD]",
  in_progress: "bg-warning-bg text-warning dark:bg-warning/20 dark:text-[#FCD34D]",
  bye: "bg-[#F3E8FF] text-[#7E22CE] dark:bg-[#7E22CE]/30 dark:text-[#E9D5FF]",
  paused: "bg-warning-bg text-warning dark:bg-warning/20 dark:text-[#FCD34D]",
  active: "bg-success-bg text-success dark:bg-success/20 dark:text-[#86EFAC]",
  live: "bg-error-bg text-error dark:bg-error/25 dark:text-[#FCA5A5]",
  upcoming: "bg-black/5 text-secondary-text dark:bg-white/10 dark:text-white/80",
  next: "bg-dark-blue text-white dark:bg-gold/20 dark:text-[#E7C95A]",
}

/* Фаза 0: полные тёмные варианты — светлые пастельные фоны
   (success-bg и т.п.) нечитаемы на navy, поэтому в tone="dark"
   и в .dark-контексте через dark: показаны ниже. */
const DARK_STYLES: Record<string, string> = {
  draft: "bg-white/10 text-white/70 border-white/10",
  pending: "bg-white/10 text-white/70 border-white/10",
  waiting: "bg-white/10 text-white/70 border-white/10",
  upcoming: "bg-white/10 text-white/80 border-white/10",
  published: "bg-success/20 text-[#86EFAC] border-success/30",
  active: "bg-success/20 text-[#86EFAC] border-success/30",
  finished: "bg-info/20 text-[#93C5FD] border-info/30",
  ready: "bg-info/20 text-[#93C5FD] border-info/30",
  in_progress: "bg-warning/20 text-[#FCD34D] border-warning/30",
  paused: "bg-warning/20 text-[#FCD34D] border-warning/30",
  live: "bg-error/25 text-[#FCA5A5] border-error/40",
  bye: "bg-[#7E22CE]/30 text-[#E9D5FF] border-white/10",
  next: "bg-gold/20 text-[#E7C95A] border-gold/30",
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
    "bg-black/5 text-secondary-text dark:bg-white/10 dark:text-white/70"
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
