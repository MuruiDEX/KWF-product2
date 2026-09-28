import { describe, expect, it } from "vitest"
import {
  computeHealth,
  computeOps,
  computeWeighin,
  computeWeighinHealth,
  describeEvent,
  type RegistrationEntry,
  type WeighinRosterEntry,
} from "@/lib/controlCenter"
import type { Tournament } from "@/lib/types"
import type { TournamentEvent } from "@/lib/tournamentEvents"

function t(over: Partial<Tournament> = {}): Tournament {
  return {
    id: 1,
    name: "Cup",
    slug: "cup",
    description: "",
    start_date: "2026-09-18",
    end_date: "2026-09-18",
    status: "published",
    created_at: "2026-09-01",
    ...over,
  } as Tournament
}

function ev(type: string, extra: Partial<TournamentEvent> = {}): TournamentEvent {
  return {
    id: 1,
    tournament: 1,
    type,
    match: null,
    round: null,
    category: null,
    actor: null,
    created_at: "2026-09-18T10:00:00Z",
    ...extra,
  }
}

describe("computeOps", () => {
  const tour = t({
    categories: [
      {
        id: 1,
        athletes: [
          { id: 1, club: "Барс" },
          { id: 2, club: "Тигр" },
        ],
        rounds: [
          {
            matches: [
              { status: "finished", tatami: 1, referee: 5 },
              { status: "in_progress", tatami: 1, referee: null },
              { status: "ready", tatami: null, referee: null },
              { status: "bye", tatami: null },
            ],
          },
        ],
      },
    ],
  } as unknown as Tournament)

  it("counts registration/check-in from regs (null when unavailable)", () => {
    const ops = computeOps(tour, [
      { athlete_id: 1, name: "A", checked_in: true, weight_actual: null },
      { athlete_id: 2, name: "B", checked_in: false, weight_actual: null },
    ], 2)
    expect(ops.registration).toEqual({ total: 2, checkedIn: 1, missing: 1 })
    expect(computeOps(tour, null, 2).registration).toBe(null)
  })

  it("counts participants/live/referees, skips bye", () => {
    const ops = computeOps(tour, null, 2)
    expect(ops.participants).toEqual({ total: 2, categories: 1, clubs: 2 })
    expect(ops.live).toEqual({ running: 1, paused: 0, waiting: 1, finished: 1 })
    expect(ops.schedule).toEqual({ scheduled: 0, unscheduled: 1, tatamis: 2 })
    expect(ops.referees).toEqual({ assigned: 0, unassigned: 2 })
  })
})

describe("computeHealth", () => {
  it("finds empty categories, duplicates, mismatches", () => {
    const items = computeHealth(
      t({
        categories: [
          { id: 1, name: "Пустая", athletes: [], rounds: [] },
          {
            id: 2,
            name: "Мальчики",
            age_min: 10,
            age_max: 11,
            weight_max: "40",
            athletes: [
              { id: 1, first_name: "Иван", last_name: "Петров", birth_date: "2010-01-01", weight: "45", age: 16 },
              { id: 2, first_name: "Иван", last_name: "Петров", birth_date: "2010-01-01", weight: "38", age: 10 },
            ],
            rounds: [],
          },
        ],
      } as unknown as Tournament)
    )
    const ids = items.map((i) => i.id)
    expect(ids).toContain("empty-1")
    expect(ids.some((id) => id.startsWith("dupe-"))).toBe(true)
    expect(ids).toContain("age-mismatch")
    expect(ids).toContain("weight-mismatch")
  })

  it("skips birth/weight checks when fields absent (public serializer)", () => {
    const items = computeHealth(
      t({
        categories: [
          {
            id: 1,
            name: "Кат",
            athletes: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
            rounds: [],
          },
        ],
      } as unknown as Tournament)
    )
    expect(items.map((i) => i.id)).not.toContain("missing-birth")
    expect(items.map((i) => i.id)).not.toContain("age-mismatch")
  })

  it("flags fights without referee", () => {
    const items = computeHealth(
      t({
        categories: [
          {
            id: 1,
            name: "Кат",
            athletes: [{ id: 1 }, { id: 2 }, { id: 3 }],
            rounds: [
              { matches: [{ status: "ready", tatami: 1, referee: null }] },
            ],
          },
        ],
      } as unknown as Tournament)
    )
    expect(items.map((i) => i.id)).toContain("no-referee")
  })
})

describe("describeEvent", () => {
  const ctx = {
    matchLabel: (id: number) => (id === 7 ? "Петров vs Сидоров" : null),
    categoryName: (id: number) => (id === 3 ? "Мальчики 10-11" : null),
  }
  it("labels known types with context", () => {
    expect(describeEvent(ev("match.started", { match: 7 }), ctx)).toBe(
      "Бой начат — Петров vs Сидоров"
    )
    expect(describeEvent(ev("match.finished", { match: 9 }), ctx)).toBe("Бой завершён")
    expect(describeEvent(ev("round.started", { category: 3 }), ctx)).toBe(
      "Раунд открыт — Мальчики 10-11"
    )
    expect(
      describeEvent(ev("tournament.announcement", { detail: "Финал!" }), ctx)
    ).toBe("Объявление: Финал!")
  })
  it("labels bulk audit events", () => {
    expect(describeEvent(ev("tournament.checkin"), ctx)).toBe("Массовая явка")
    expect(describeEvent(ev("tournament.uncheck"), ctx)).toBe("Массовое снятие явки")
  })
  it("falls back for unknown types", () => {
    expect(describeEvent(ev("something.new"), ctx)).toBe("Событие турнира")
  })
})

describe("computeWeighin", () => {
  const roster: WeighinRosterEntry[] = [
    { id: 1, categories: [{ name: "До 40", weightMax: 40 }] },
    { id: 2, categories: [{ name: "До 40", weightMax: 40 }] },
    { id: 3, categories: [{ name: "До 40", weightMax: 40 }] },
  ]
  const reg = (
    athlete_id: number,
    weight_actual: string | null,
    name = `A${athlete_id}`
  ): RegistrationEntry => ({ athlete_id, name, checked_in: true, weight_actual })

  it("returns null when regs unavailable", () => {
    expect(computeWeighin(null, roster)).toBeNull()
  })

  it("all weighed", () => {
    expect(
      computeWeighin([reg(1, "38"), reg(2, "40"), reg(3, "39,5")], roster)
    ).toEqual({ total: 3, weighed: 3, unweighed: 0, overweight: 0 })
  })

  it("none weighed", () => {
    expect(
      computeWeighin([reg(1, null), reg(2, ""), reg(3, "мусор")], roster)
    ).toEqual({ total: 3, weighed: 0, unweighed: 3, overweight: 0 })
  })

  it("mixed weighed/unweighed", () => {
    expect(computeWeighin([reg(1, "38"), reg(2, null)], roster)).toEqual({
      total: 2,
      weighed: 1,
      unweighed: 1,
      overweight: 0,
    })
  })

  it("detects overweight against strictest limit", () => {
    const multi: WeighinRosterEntry[] = [
      {
        id: 1,
        categories: [
          { name: "До 45", weightMax: 45 },
          { name: "До 40", weightMax: 40 },
        ],
      },
    ]
    expect(computeWeighin([reg(1, "42")], multi)).toEqual({
      total: 1,
      weighed: 1,
      unweighed: 0,
      overweight: 1,
    })
  })

  it("no false positive at exactly the limit or without categories", () => {
    expect(computeWeighin([reg(1, "40")], roster)?.overweight).toBe(0)
    expect(computeWeighin([reg(9, "99")], roster)?.overweight).toBe(0)
  })

  it("empty regs give zero totals", () => {
    expect(computeWeighin([], [])).toEqual({
      total: 0,
      weighed: 0,
      unweighed: 0,
      overweight: 0,
    })
  })
})

describe("computeWeighinHealth", () => {
  const roster: WeighinRosterEntry[] = [
    { id: 1, categories: [{ name: "До 40", weightMax: 40 }] },
    { id: 2, categories: [{ name: "До 40", weightMax: 40 }] },
  ]
  const reg = (
    athlete_id: number,
    weight_actual: string | null,
    name = `A${athlete_id}`
  ): RegistrationEntry => ({ athlete_id, name, checked_in: true, weight_actual })

  it("empty when regs unavailable or no overweight", () => {
    expect(computeWeighinHealth(null, roster)).toEqual([])
    expect(
      computeWeighinHealth([reg(1, "38"), reg(2, null)], roster)
    ).toEqual([])
  })

  it("single aggregated warn item pointing to weighin", () => {
    const items = computeWeighinHealth([reg(1, "44", "Иванов Иван"), reg(2, "38")], roster)
    expect(items).toHaveLength(1)
    expect(items[0].severity).toBe("warn")
    expect(items[0].tab).toBe("weighin")
    expect(items[0].text).toContain("Перевес: 1")
    expect(items[0].text).toContain("Иванов Иван")
  })
})
