// Единый язык переходов между крупными секциями: hairline + gold tick +
// номер и подпись следующего блока (+ опциональный kanji). Компактный,
// заметный, без лишнего шума. Всё декоративное (aria-hidden).

"use client"

import { cn } from "@/lib/utils"

export type DividerVariant = "tick" | "minimal" | "osu" | "kyokushin" | "geometric"

const SYMBOLS: Partial<Record<DividerVariant, string>> = {
  osu: "押忍",
  kyokushin: "極真",
}

function OverlayMark({ variant }: { variant: DividerVariant }) {
  if (variant === "tick") {
    return (
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-8 h-[2px] rounded-full bg-gold/70" />
    )
  }
  if (variant === "minimal") {
    return (
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-1.5 h-1.5 rounded-full bg-gold/80" />
    )
  }
  // geometric: ромб-контур поверх линии.
  return (
    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-2 h-2 rotate-45 border border-gold/80 bg-white dark:bg-dark-blue" />
  )
}

interface SectionDividerProps {
  variant?: DividerVariant
  /** Номер следующего блока («02»). */
  index?: string
  /** Подпись следующего блока («Путь ученика»). */
  label?: string
  /** Сдержанный kanji-акцент («押忍»). */
  kanji?: string
}

export default function SectionDivider({ variant = "tick", index, label, kanji }: SectionDividerProps) {
  const symbol = SYMBOLS[variant]
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-2 py-3 md:py-4">
      <div className={cn("w-full max-w-[1280px] px-6")}>
        {label || symbol ? (
          // Именованный переход: сегментированная линия с подписью.
          <div className="flex items-center gap-3 md:gap-4">
            <span className="h-px flex-1 bg-border/60" />
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="block w-6 h-[2px] rounded-full bg-gold/70" />
              {index && (
                <span className="text-[11px] font-black tabular-nums text-gold-deep dark:text-gold">
                  {index}
                </span>
              )}
              <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-secondary-text">
                {label}
              </span>
              {kanji && (
                <span className="text-[11px] font-extrabold tracking-[0.2em] text-gold-deep/80 dark:text-gold/80">
                  {kanji}
                </span>
              )}
              {symbol && !label && (
                <span className="text-[11px] font-extrabold tracking-[0.35em] text-gold-deep dark:text-gold">
                  {symbol}
                </span>
              )}
            </span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
        ) : (
          <div className="relative h-px bg-border/50">
            <OverlayMark variant={variant} />
          </div>
        )}
      </div>
    </div>
  )
}
