"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface CardProps {
  children: ReactNode
  className?: string
}

/** Фаза 0: каноническая карточка федерации.
 * Строгая, плоская, без glassmorphism: белый фон, hairline-граница,
 * скругление 16px. Существующие карточки не переписываем —
 * используем в новых/обновляемых блоках начиная с Фазы 1. */
export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("kwf-card", className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("p-6", className)}>{children}</div>
}
