import { describe, expect, it } from "vitest"
import { matchLines, matchName, normalizeName } from "@/lib/documentMatch"
import type { MatchableAthlete } from "@/lib/documentMatch"

const athletes: MatchableAthlete[] = [
  { id: 1, first_name: "Иван", last_name: "Иванов", birth_date: "2015-03-01", club: "Барс", weight: "32", gender: "male", categoryNames: ["Мальчики 10-12"] },
  { id: 2, first_name: "Пётр", last_name: "Петров", birth_date: null, club: null },
  { id: 3, first_name: "Алексей", last_name: "Сидоров" },
]

describe("normalizeName", () => {
  it("lowercases, ё→е, collapses spaces", () => {
    expect(normalizeName("  ПЕТРОВ  Пётр ")).toBe("петров петр")
  })
})

describe("matchName", () => {
  it("exact match both orders", () => {
    expect(matchName("Иванов Иван", athletes)).toMatchObject({ status: "matched", athlete: { id: 1 } })
    expect(matchName("иван иванов", athletes).confidence).toBeGreaterThanOrEqual(90)
  })

  it("typo becomes possible, not matched", () => {
    const m = matchName("Иваноф Иван", athletes)
    expect(m.status).toBe("possible")
    expect(m.athlete?.id).toBe(1)
  })

  it("unknown name is notfound", () => {
    expect(matchName("Сидоров Неизвестный", athletes).status).toBe("notfound")
  })

  it("empty line is notfound with zero confidence", () => {
    expect(matchName("   ", athletes)).toMatchObject({ status: "notfound", confidence: 0 })
  })
})

describe("matchLines", () => {
  it("skips blanks, keeps order", () => {
    const res = matchLines(["Иванов Иван", "", "Петров Пётр"], athletes)
    expect(res).toHaveLength(2)
    expect(res[0].athlete?.id).toBe(1)
    expect(res[1].athlete?.id).toBe(2)
  })
})
