import { describe, expect, it } from "vitest"
import {
  computeTournamentReadiness,
  type ReadinessEngineInput,
} from "@/lib/readiness"
import {
  buildReadinessInput,
  resolveTournamentId,
  toReadinessCategories,
} from "@/lib/readinessAdapter"
import type { TournamentCategory } from "@/lib/types"

function base(
  over: Partial<ReadinessEngineInput> = {}
): ReadinessEngineInput {
  return {
    status: "draft",
    startDate: "2099-01-01",
    categories: [
      { id: 1, name: "Кат", athleteCount: 4, hasBracket: true, tatamiId: 1 },
    ],
    tatamiCount: 2,
    fightsWithoutTatami: 0,
    fightsWithoutReferee: 0,
    uncategorizedCount: 0,
    checkin: { total: 4, checkedIn: 4, missing: 0 },
    weighin: {
      total: 4,
      weighed: 4,
      unweighed: 0,
      overweight: 0,
      overweightNames: [],
    },
    ...over,
  }
}

describe("computeTournamentReadiness", () => {
  it("идеальный черновик — ready, overall высокий, next=publish", () => {
    const r = computeTournamentReadiness(base())
    expect(r.blockers).toEqual([])
    expect(r.issues).toEqual([])
    expect(r.nextAction?.target).toBe("publish")
    expect(r.overall).toBeGreaterThanOrEqual(90)
    expect(r.sections.participants).toBe("ready")
    expect(r.sections.brackets).toBe("ready")
  })

  it("нет категорий — not_started, ошибка, next=wizard, overall низкий", () => {
    const r = computeTournamentReadiness(
      base({ categories: [], checkin: null, weighin: null })
    )
    expect(r.sections.categories).toBe("not_started")
    expect(r.sections.brackets).toBe("not_started")
    expect(r.issues.some((i) => i.id === "no-categories")).toBe(true)
    expect(r.blockers.length).toBeGreaterThan(0)
    expect(r.nextAction?.target).toBe("wizard")
    expect(r.overall).toBeLessThan(60)
  })

  it("участники без категории — error и первый nextAction", () => {
    const r = computeTournamentReadiness(
      base({ uncategorizedCount: 4, checkin: { total: 8, checkedIn: 8, missing: 0 } })
    )
    expect(r.sections.participants).toBe("error")
    expect(r.issues.some((i) => i.id === "uncategorized")).toBe(true)
    expect(r.nextAction?.id).toBe("uncategorized")
    expect(r.nextAction?.target).toBe("participants")
  })

  it("приоритет: явка раньше сеток и татами", () => {
    const r = computeTournamentReadiness(
      base({
        categories: [
          { id: 1, name: "A", athleteCount: 4, hasBracket: false, tatamiId: null },
        ],
        fightsWithoutTatami: 3,
        checkin: { total: 4, checkedIn: 1, missing: 3 },
        weighin: { total: 4, weighed: 0, unweighed: 4, overweight: 0, overweightNames: [] },
      })
    )
    expect(r.nextAction?.id).toBe("checkin-missing")
  })

  it("взвешивание: невзвешенные и перевес — needs_attention + issues", () => {
    const r = computeTournamentReadiness(
      base({
        weighin: {
          total: 4,
          weighed: 2,
          unweighed: 2,
          overweight: 1,
          overweightNames: ["Иванов Иван"],
        },
      })
    )
    expect(r.sections.weighIn).toBe("needs_attention")
    expect(r.issues.some((i) => i.id === "weighin-pending")).toBe(true)
    const over = r.issues.find((i) => i.id === "overweight")
    expect(over?.severity).toBe("warn")
    expect(over?.title).toContain("Иванов Иван")
    // Взвешивание живёт на отдельной вкладке — issues и next ведут туда же.
    expect(r.issues.find((i) => i.id === "weighin-pending")?.tab).toBe("weighin")
    expect(over?.target).toBe("weighin")
    // Явка чистая → следующий шаг именно взвешивание, а не явка.
    expect(r.nextAction?.id).toBe("weighin-pending")
    expect(r.nextAction?.target).toBe("weighin")
  })

  it("перевес без невзвешенных — next=overweight", () => {
    const r = computeTournamentReadiness(
      base({
        weighin: {
          total: 4,
          weighed: 4,
          unweighed: 0,
          overweight: 2,
          overweightNames: ["A", "B"],
        },
      })
    )
    expect(r.nextAction?.id).toBe("overweight")
  })

  it("категории без татами — needs_attention + next=schedule", () => {
    const r = computeTournamentReadiness(
      base({
        categories: [
          { id: 1, name: "A", athleteCount: 4, hasBracket: true, tatamiId: null },
        ],
      })
    )
    expect(r.sections.tatamis).toBe("needs_attention")
    expect(r.nextAction?.id).toBe("categories-without-tatami")
    expect(r.nextAction?.target).toBe("schedule")
  })

  it("нет татами — error во всех зависимых секциях", () => {
    const r = computeTournamentReadiness(base({ tatamiCount: 0 }))
    expect(r.sections.tatamis).toBe("error")
    expect(r.sections.schedule).toBe("error")
    expect(r.issues.some((i) => i.id === "no-tatamis")).toBe(true)
    expect(r.blockers.length).toBeGreaterThan(0)
  })

  it("бои без судьи — next=staff", () => {
    const r = computeTournamentReadiness(
      base({ fightsWithoutReferee: 3 })
    )
    expect(r.sections.judges).toBe("needs_attention")
    expect(r.nextAction?.id).toBe("no-referee")
    expect(r.nextAction?.target).toBe("staff")
  })

  it("blockers отменяют publish", () => {
    const r = computeTournamentReadiness(
      base({
        categories: [
          { id: 1, name: "Пустая", athleteCount: 0, hasBracket: false, tatamiId: null },
        ],
        checkin: { total: 0, checkedIn: 0, missing: 0 },
        weighin: { total: 0, weighed: 0, unweighed: 0, overweight: 0, overweightNames: [] },
      })
    )
    expect(r.nextAction?.id).not.toBe("unpublished")
    expect(r.blockers.length).toBeGreaterThan(0)
  })

  it("finished — все completed, overall 100, без issues и next", () => {
    const r = computeTournamentReadiness(base({ status: "finished" }))
    expect(Object.values(r.sections).every((s) => s === "completed")).toBe(true)
    expect(r.overall).toBe(100)
    expect(r.issues).toEqual([])
    expect(r.nextAction).toBeNull()
  })

  it("published и готов — next null", () => {
    expect(computeTournamentReadiness(base({ status: "published" })).nextAction).toBeNull()
  })

  it("прошедшая дата черновика — warn-issue в settings", () => {
    const r = computeTournamentReadiness(base({ startDate: "2000-01-01" }))
    const item = r.issues.find((i) => i.id === "date-past")
    expect(item?.severity).toBe("warn")
    expect(item?.tab).toBe("settings")
  })

  it("issues исчезают после исправления (детерминизм)", () => {
    const bad = computeTournamentReadiness(base({ uncategorizedCount: 2 }))
    expect(bad.issues.some((i) => i.id === "uncategorized")).toBe(true)
    const fixed = computeTournamentReadiness(base({ uncategorizedCount: 0 }))
    expect(fixed.issues.some((i) => i.id === "uncategorized")).toBe(false)
  })

  it("overall всегда в диапазоне 0–100", () => {
    for (const input of [
      base(),
      base({ categories: [] }),
      base({ tatamiCount: 0, uncategorizedCount: 9 }),
    ]) {
      const r = computeTournamentReadiness(input)
      expect(r.overall).toBeGreaterThanOrEqual(0)
      expect(r.overall).toBeLessThanOrEqual(100)
    }
  })
})

describe("readinessAdapter", () => {
  it("resolveTournamentId чинит string|string[]|undefined", () => {
    expect(resolveTournamentId("12")).toBe("12")
    expect(resolveTournamentId(["12"])).toBeNull()
    expect(resolveTournamentId(undefined)).toBeNull()
    expect(resolveTournamentId("")).toBeNull()
  })

  it("toReadinessCategories маппит hasBracket и tatami", () => {
    const cats = [
      { id: 1, name: "A", athletes: [{ id: 1 }, { id: 2 }], rounds: [{ id: 1 }], tatami: 3 },
      { id: 2, name: "B", athletes: [], rounds: [] },
    ] as unknown as TournamentCategory[]
    expect(toReadinessCategories(cats)).toEqual([
      { id: 1, name: "A", athleteCount: 2, hasBracket: true, tatamiId: 3 },
      { id: 2, name: "B", athleteCount: 0, hasBracket: false, tatamiId: null },
    ])
  })

  it("buildReadinessInput считает uncategorized/checkin/weighin без новых fetch", () => {
    const cats = [
      {
        id: 1,
        name: "A",
        athletes: [{ id: 1, last_name: "Иванов", first_name: "Иван" }],
        rounds: [],
      },
    ] as unknown as TournamentCategory[]
    const input = buildReadinessInput({
      status: "draft",
      startDate: null,
      sortedCats: cats,
      tatamiCount: 1,
      fightsWithoutTatami: 0,
      fightsWithoutReferee: 0,
      regs: [
        { athlete_id: 1, name: "Иванов Иван", checked_in: true, weight_actual: "38" },
        { athlete_id: 2, name: "Петров Пётр", checked_in: false, weight_actual: null },
      ],
      weighinRoster: [
        { id: 1, categories: [{ name: "A", weightMax: 40 }] },
        { id: 2, categories: [{ name: "A", weightMax: 40 }] },
      ],
    })
    expect(input.uncategorizedCount).toBe(1)
    expect(input.checkin).toEqual({ total: 2, checkedIn: 1, missing: 1 })
    expect(input.weighin).toMatchObject({ total: 2, weighed: 1, unweighed: 1 })
  })

  it("regs null — честное «недоступно», а не нули", () => {
    const input = buildReadinessInput({
      status: "draft",
      startDate: null,
      sortedCats: [],
      tatamiCount: 0,
      fightsWithoutTatami: 0,
      fightsWithoutReferee: 0,
      regs: null,
      weighinRoster: [],
    })
    expect(input.checkin).toBeNull()
    expect(input.weighin).toBeNull()
    expect(input.uncategorizedCount).toBe(0)
  })
})
