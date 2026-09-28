"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  className?: string
  /** Компактный вариант для плотных карточек (меньше отступы и типографика). */
  compact?: boolean
}

export default function EmptyState({ icon, title, hint, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(compact ? "py-6 px-4" : "py-14 px-6", "flex flex-col items-center justify-center text-center", className)}>
      {icon && (
        <div className={cn(
          "rounded-2xl bg-light-gray border border-border flex items-center justify-center text-secondary-text dark:bg-white/[0.04]",
          compact ? "w-10 h-10 mb-3" : "w-16 h-16 mb-5"
        )}>
          {icon}
        </div>
      )}
      <h3 className={cn("font-bold text-dark-text", compact ? "text-sm" : "text-lg")}>{title}</h3>
      {hint && <p className={cn("text-secondary-text leading-relaxed", compact ? "text-xs mt-1 max-w-xs" : "text-sm mt-2 max-w-sm")}>{hint}</p>}
      {action && <div className={compact ? "mt-3" : "mt-6"}>{action}</div>}
    </div>
  )
}
