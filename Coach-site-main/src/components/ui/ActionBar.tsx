import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ActionBarProps {
  children: ReactNode
  /** start — слева, end — справа, between — по краям. */
  align?: "start" | "end" | "between"
  className?: string
}

/** Презентационный ряд действий: единый gap и перенос на mobile.
 * Без логики — только spacing/alignment. */
export function ActionBar({ children, align = "start", className }: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        align === "end" && "justify-end",
        align === "between" && "justify-between",
        className
      )}
    >
      {children}
    </div>
  )
}
