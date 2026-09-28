"use client"

import type { ReactNode } from "react"
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

interface ErrorRetryProps {
  icon?: ReactNode
  title?: string
  hint?: string
  retryLabel?: string
  onRetry: () => void
  className?: string
}

/** N11: единый error-state с повтором (вместо голого текста
 * и проглоченных .catch). Поверх EmptyState — без новых сущностей. */
export function ErrorRetry({
  icon = <WifiOff size={26} />,
  title = "Не удалось загрузить",
  hint = "Проверьте соединение с интернетом и попробуйте ещё раз",
  retryLabel = "Повторить",
  onRetry,
  className,
}: ErrorRetryProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-white dark:bg-[#0E2035]", className)}>
      <EmptyState
        icon={icon}
        title={title}
        hint={hint}
        action={<Button onClick={onRetry}>{retryLabel}</Button>}
      />
    </div>
  )
}
