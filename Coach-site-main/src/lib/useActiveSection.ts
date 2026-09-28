"use client"

import { useEffect, useState } from "react"

/** Section-aware навигация: активный якорь по IntersectionObserver.
 * Один observer на страницу, без scroll-listener'а. rootMargin учитывает
 * фиксированную шапку (5.5rem ≈ 88px): секция активна, когда её верх
 * проходит под шапкой. */
export function useActiveSection(ids: string[], enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || ids.length === 0 || typeof IntersectionObserver === "undefined") {
      return
    }
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio)
          } else {
            visible.delete(id)
          }
        }
        let best: string | null = null
        let bestRatio = 0
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        }
        setActive((prev) => (prev === best ? prev : best))
      },
      {
        // Верхняя полоса под шапкой решает, нижняя половина вьюпорта — нет.
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      }
    )
    const elements: Element[] = []
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) {
        elements.push(el)
        observer.observe(el)
      }
    }
    return () => observer.disconnect()
    // ids стабилен (константа NAV_LINKS) — пересоздание не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return active
}
