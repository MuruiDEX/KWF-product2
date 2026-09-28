"use client"

import { ClipboardList, Scale, Flag, Swords, Trophy, Medal } from "lucide-react"
import { cn } from "@/lib/utils"

const STAGES = [
  { label: "Регистрация", icon: ClipboardList },
  { label: "Взвешивание", icon: Scale },
  { label: "Начало", icon: Flag },
  { label: "Полуфиналы", icon: Swords },
  { label: "Финал", icon: Trophy },
  { label: "Награждение", icon: Medal },
]

interface TournamentTimelineProps {
  status?: string
  className?: string
}

export default function TournamentTimeline({ status, className }: TournamentTimelineProps) {
  const current = status === "finished" ? STAGES.length : status === "published" ? 2 : 0
  return (
    <div className={cn("rounded-2xl border border-border bg-white p-5 sm:p-6", className)}>
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-text mb-5">
        Этапы турнира
      </div>
      <ol className="flex items-start gap-1 sm:gap-2 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const done = i < current
          const active = i === current && status !== "finished"
          return (
            <li key={s.label} className="flex-1 min-w-[86px] flex flex-col items-center text-center relative">
              {i > 0 && (
                <span
                  className={cn(
                    "absolute top-5 right-1/2 w-full h-0.5 z-0",
                    i <= current ? "bg-gold/70" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative z-10 w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors",
                  done && "bg-gold/15 border-gold/40 text-gold",
                  active && "bg-dark-blue border-dark-blue text-white shadow-lg shadow-dark-blue/25",
                  !done && !active && "bg-light-gray border-border text-secondary-text"
                )}
              >
                <s.icon size={17} />
                {active && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gold border-2 border-white animate-pulse" />
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold mt-2 leading-tight",
                  done || active ? "text-dark-text" : "text-secondary-text"
                )}
              >
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
