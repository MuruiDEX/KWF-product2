import { describe, expect, it } from "vitest"
import {
  getBracketBlockers,
  planBulkGenerate,
} from "@/app/cabinet/tournaments/[id]/manage/hooks/useMatchMutations"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { TournamentCategory } from "@/lib/types"

function cat(
  over: Partial<TournamentCategory> = {}
): TournamentCategory {
  return {
    id: 1,
    tournament: 7,
    name: "Мальчики",
    age_min: 10,
    age_max: 11,
    weight_max: "40",
    gender: "male",
    order: 0,
    athletes: [
      { id: 1, first_name: "A", last_name: "A", birth_date: null, weight: "35", height: null, gender: "male", age: 10 },
      { id: 2, first_name: "B", last_name: "B", birth_date: null, weight: "36", height: null, gender: "male", age: 10 },
    ],
    rounds: [],
    ...over,
  } as TournamentCategory
}

function reg(athlete_id: number): RegistrationEntry {
  return { athlete_id, name: `A${athlete_id}`, checked_in: true, weight_actual: null }
}

describe("getBracketBlockers", () => {
  it("готовая категория — блокеров нет", () => {
    expect(
      getBracketBlockers({
        category: cat(),
        sortedCats: [cat()],
        regs: [reg(1), reg(2)],
        tatamiCount: 2,
      })
    ).toEqual([])
  })

  it("меньше 2 участников — блокер в participants", () => {
    const thin = cat({ athletes: [] })
    const blockers = getBracketBlockers({
      category: thin,
      sortedCats: [thin],
      regs: [],
      tatamiCount: 2,
    })
    expect(blockers).toHaveLength(1)
    expect(blockers[0].tab).toBe("participants")
    expect(blockers[0].text).toContain("Мальчики")
  })

  it("участники без категории и нет татами — два блокера с табами", () => {
    const blockers = getBracketBlockers({
      category: cat(),
      sortedCats: [cat()],
      regs: [reg(1), reg(2), reg(9)],
      tatamiCount: 0,
    })
    expect(blockers.map((b) => b.tab)).toEqual(["participants", "schedule"])
    expect(blockers[0].text).toContain("1 уч.")
  })

  it("regs null — проверка без категории пропускается, не врём", () => {
    expect(
      getBracketBlockers({
        category: cat(),
        sortedCats: [cat()],
        regs: null,
        tatamiCount: 1,
      })
    ).toEqual([])
  })
})

describe("planBulkGenerate", () => {
  it("Case 2 — без блокеров: ok, bulk ConfirmDialog может открываться", () => {
    expect(
      planBulkGenerate({
        sortedCats: [cat({ id: 1 }), cat({ id: 2 })],
        regs: [reg(1), reg(2)],
        tatamiCount: 2,
      })
    ).toEqual({ ok: true })
  })

  it("Case 1 — есть блокеры: генерация запрещена, API не вызывается", () => {
    const plan = planBulkGenerate({
      sortedCats: [cat({ id: 1 })],
      regs: [reg(1), reg(2), reg(9)],
      tatamiCount: 2,
    })
    expect(plan.ok).toBe(false)
    if (!plan.ok) {
      // Тот же guardrail, что per-category: первая проблемная категория
      // открывает существующий confirm с goto-tab.
      expect(plan.firstCategory.id).toBe(1)
      expect(plan.blockers.length).toBeGreaterThan(0)
    }
  })

  it("Case 3 — несколько блокеров сразу: все видны, глобальные без дублей", () => {
    const plan = planBulkGenerate({
      sortedCats: [cat({ id: 1 }), cat({ id: 2 })],
      regs: [reg(1), reg(2), reg(9)],
      tatamiCount: 0,
    })
    expect(plan.ok).toBe(false)
    if (!plan.ok) {
      // uncategorized + no-tatami, каждый ровно один раз (не N×M).
      expect(plan.blockers).toHaveLength(2)
      expect(plan.blockers.map((b) => b.tab)).toEqual([
        "participants",
        "schedule",
      ])
    }
  })

  it("категории с сеткой и тонкие — не кандидаты, план чист", () => {
    expect(
      planBulkGenerate({
        sortedCats: [
          cat({ id: 1, rounds: [{ id: 1 }] as never }),
          cat({ id: 2, athletes: [] }),
        ],
        regs: [],
        tatamiCount: 1,
      })
    ).toEqual({ ok: true })
  })
})
