import type { CSSProperties } from "react"

/** Цветовая тема одной группы: приглушённые пастельные тона. */
export interface GroupColor {
  /** Основной акцент: полоса, точка, свечение. */
  accent: string
  /** Тёмный оттенок для текста на светлом фоне (контраст). */
  ink: string
  /** Светлая подложка: бейджи, чипы, тёмная тема. */
  soft: string
}

/** Современная спокойная палитра: синий, фиолетовый, бирюза, зелень, розовый, янтарь, циан. */
const PALETTE: GroupColor[] = [
  { accent: "#3B82F6", ink: "#1D4ED8", soft: "#DBEAFE" },
  { accent: "#8B5CF6", ink: "#6D28D9", soft: "#EDE9FE" },
  { accent: "#0D9488", ink: "#0F766E", soft: "#CCFBF1" },
  { accent: "#10B981", ink: "#047857", soft: "#D1FAE5" },
  { accent: "#EC4899", ink: "#BE185D", soft: "#FCE7F3" },
  { accent: "#D97706", ink: "#B45309", soft: "#FEF3C7" },
  { accent: "#0891B2", ink: "#0E7490", soft: "#CFFAFE" },
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h
}

/** Детерминированный цвет группы по её названию — одна и та же группа всегда одного цвета. */
export function groupColor(name: string): GroupColor {
  return PALETTE[hashName(name || "?") % PALETTE.length]
}

export function groupColorByIndex(index: number): GroupColor {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]
}

type ColorVars = CSSProperties & Record<"--gc-accent" | "--gc-ink" | "--gc-soft", string>

function toVars(c: GroupColor): ColorVars {
  return { "--gc-accent": c.accent, "--gc-ink": c.ink, "--gc-soft": c.soft }
}

/** Инлайн-стиль с CSS-переменными для `.session-card` / `.group-card` / `.filter-pill-active`. */
export function groupColorVars(name: string): ColorVars {
  return toVars(groupColor(name))
}

export function groupColorVarsByIndex(index: number): ColorVars {
  return toVars(groupColorByIndex(index))
}
