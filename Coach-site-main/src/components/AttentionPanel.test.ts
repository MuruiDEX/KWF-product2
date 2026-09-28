import { describe, expect, it } from "vitest"
import { mergeAttention } from "@/components/AttentionPanel"
import type { ReadinessReport } from "@/components/ReadinessChecklist"

function readiness(okIds: string[] = []): ReadinessReport {
  const all = [
    { id: "categories-filled", ok: false, level: "error" as const, text: "Пустые категории", tab: "participants" as const },
    { id: "brackets-built", ok: false, level: "warn" as const, text: "Нет сетки", tab: "brackets" as const },
    { id: "tatamis", ok: true, level: "error" as const, text: "Татами: 2", tab: "schedule" as const },
  ]
  const items = all.map((i) => (okIds.includes(i.id) ? { ...i, ok: true } : i))
  return {
    items,
    readyCount: items.filter((i) => i.ok).length,
    totalCount: items.length,
    blockers: items.filter((i) => !i.ok && i.level === "error").map((i) => i.text),
  }
}

describe("mergeAttention", () => {
  it("includes only non-ok readiness items (no info metrics)", () => {
    const merged = mergeAttention([], readiness())
    expect(merged.map((i) => i.id)).toEqual([
      "readiness-categories-filled",
      "readiness-brackets-built",
    ])
  })

  it("merges health and sorts errors first", () => {
    const merged = mergeAttention(
      [{ id: "w", severity: "warn", text: "Мало участников", tab: "participants" }],
      readiness()
    )
    expect(merged[0].severity).toBe("error")
    expect(merged).toHaveLength(3)
  })

  it("is empty when everything is fine", () => {
    const ok: ReadinessReport = {
      items: [],
      readyCount: 0,
      totalCount: 0,
      blockers: [],
    }
    expect(mergeAttention([], ok)).toEqual([])
  })
})
