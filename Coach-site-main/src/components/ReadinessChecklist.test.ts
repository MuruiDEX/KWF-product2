import { describe, expect, it } from "vitest"
import { computeReadiness, type ReadinessInput } from "@/components/ReadinessChecklist"

const base: ReadinessInput = {
  status: "draft",
  startDate: "2099-01-01",
  categories: [{ id: 1, name: "Кат", athleteCount: 4, hasBracket: true }],
  tatamiCount: 2,
  fightsWithoutTatami: 0,
}

describe("computeReadiness", () => {
  it("идеальный турнир — всё ок, блокеров нет", () => {
    const r = computeReadiness(base)
    expect(r.blockers).toEqual([])
    expect(r.readyCount).toBe(r.totalCount)
    expect(r.totalCount).toBeGreaterThan(0)
  })

  it("нет категорий и татами — ошибки", () => {
    const r = computeReadiness({ ...base, categories: [], tatamiCount: 0 })
    expect(r.blockers.length).toBe(2)
    expect(r.items.find((i) => i.id === "no-categories")?.tab).toBe(
      "participants"
    )
    expect(r.items.find((i) => i.id === "tatamis")?.tab).toBe("schedule")
  })

  it("пустая и одиночная категории — ошибка с именами", () => {
    const r = computeReadiness({
      ...base,
      categories: [
        { id: 1, name: "Пустая", athleteCount: 0, hasBracket: false },
        { id: 2, name: "Одна", athleteCount: 1, hasBracket: false },
      ],
    })
    const item = r.items.find((i) => i.id === "categories-filled")
    expect(item?.ok).toBe(false)
    expect(item?.level).toBe("error")
    expect(item?.text).toContain("Пустая")
  })

  it("нет сетки — warn, а не блокер", () => {
    const r = computeReadiness({
      ...base,
      categories: [{ id: 1, name: "Кат", athleteCount: 4, hasBracket: false }],
    })
    const item = r.items.find((i) => i.id === "brackets-built")
    expect(item?.ok).toBe(false)
    expect(item?.level).toBe("warn")
    expect(r.blockers).toEqual([])
  })

  it("бои без татами и прошедшая дата — warn", () => {
    const r = computeReadiness({
      ...base,
      fightsWithoutTatami: 3,
      startDate: "2000-01-01",
    })
    expect(r.items.find((i) => i.id === "fights-tatami")?.tab).toBe("schedule")
    expect(r.items.find((i) => i.id === "date-past")?.level).toBe("warn")
    expect(r.items.find((i) => i.id === "date-past")?.tab).toBe("settings")
    expect(r.items.find((i) => i.id === "brackets-built")?.tab).toBe("brackets")
  })
})
