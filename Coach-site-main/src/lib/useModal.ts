"use client"

import { useEffect, type RefObject } from "react"

/**
 * D4: базовое поведение модалок (a11y).
 * - Escape закрывает;
 * - Tab trapped внутри панели;
 * - скролл body блокируется;
 * - фокус возвращается на элемент, открывший модалку.
 */
export function useModalBehavior(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return
      const items = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const enabled = [...items].filter((el) => !el.hasAttribute("disabled"))
      if (enabled.length === 0) return
      const first = enabled[0]
      const last = enabled[enabled.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      try {
        prev?.focus?.()
      } catch {
        /* ignore */
      }
    }
  }, [open, onClose, panelRef])
}
