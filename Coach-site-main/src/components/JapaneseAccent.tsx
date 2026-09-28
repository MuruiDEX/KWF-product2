// Сдержанная японская айдентика: вертикальная подпись сбоку секции
// и фоновый иероглиф очень низкой контрастности. Только явления
// с ясным смыслом: 極真 (кёкусин), 空手 (каратэ), 押忍 (осу).
// Всё декоративное (aria-hidden, pointer-events-none).

"use client"

import { cn } from "@/lib/utils"

/** Вертикальная подпись у края секции (скрыта ниже md, чтобы не теснить мобильные). */
export function SideKanji({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none hidden md:block text-sm font-extrabold tracking-[0.5em] text-primary-blue/25 dark:text-gold/25",
        className
      )}
      style={{ writingMode: "vertical-rl" }}
    >
      {children}
    </span>
  )
}

/** Крупный фоновый иероглиф: чувствуется, а не замечается. */
export function KanjiBackdrop({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none absolute font-black leading-none text-dark-blue/[0.05] dark:text-gold/[0.07]",
        className
      )}
    >
      {children}
    </span>
  )
}
