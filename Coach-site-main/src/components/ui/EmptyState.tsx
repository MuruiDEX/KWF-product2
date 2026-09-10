"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-14 px-6", className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-light-gray border border-border flex items-center justify-center text-secondary-text mb-5">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-dark-text">{title}</h3>
      {hint && <p className="text-sm text-secondary-text mt-2 max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
