"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  eyebrow: string
  title: string
  description?: string
  align?: "center" | "left"
  dark?: boolean
  className?: string
  /** Номер раздела в истории страницы («01»). Только для крупных секций. */
  number?: string
  /** Сдержанный кандзи-акцент («極真», «空手», «押忍»). Виден всегда. */
  kanji?: string
}

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  dark = false,
  className,
  number,
  kanji,
}: SectionHeaderProps) {
  return (
    <motion.div
      className={cn(
        "mb-10 md:mb-14 max-w-2xl",
        align === "center" ? "text-center mx-auto" : "text-left",
        className
      )}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]",
          dark ? "text-accent-warm" : "text-primary-blue"
        )}
      >
        {number && (
          <span
            aria-hidden="true"
            className={cn(
              "text-sm font-black tracking-tight tabular-nums",
              dark ? "text-gold" : "text-gold-deep"
            )}
          >
            {number}
          </span>
        )}
        <span className={cn("h-px w-6", dark ? "bg-accent-warm/60" : "bg-primary-blue/40")} aria-hidden="true" />
        {eyebrow}
        {kanji && (
          <span aria-hidden="true" className="text-sm font-extrabold tracking-[0.2em]">
            {kanji}
          </span>
        )}
        {align === "center" && (
          <span className={cn("h-px w-6", dark ? "bg-accent-warm/60" : "bg-primary-blue/40")} aria-hidden="true" />
        )}
      </span>
      <h2
        className={cn(
          "text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4 text-balance",
          dark ? "text-white" : "text-dark-text"
        )}
      >
        {title}
      </h2>
      {description && (
        <p className={cn("text-base md:text-lg mt-4 leading-relaxed", dark ? "text-white/75" : "text-secondary-text")}>
          {description}
        </p>
      )}
    </motion.div>
  )
}
