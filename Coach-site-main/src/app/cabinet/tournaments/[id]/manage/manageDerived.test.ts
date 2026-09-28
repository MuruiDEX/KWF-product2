import { describe, expect, it } from "vitest"
import {
  buildCategoryDrawerData,
  buildCategoryRows,
  buildWeighinRoster,
  findFirstOpenCategoryId,
} from "@/app/cabinet/tournaments/[id]/manage/manageDerived"
import type { TournamentCategory } from "@/lib/types"

function cat(over: Partial<TournamentCategory> = {}): TournamentCategory {
  return {
    id: 1,
    tournament: 7,
    name: "Мальчики",
    age_min: 10,
    age_max: 11,
    weight_max: "40",
    gender: "male",
    order: 0,
    athletes: [],
    rounds: [],
    ...over,
  } as TournamentCategory
}

function athlete(id: number, last = `Ф${id}`, first = `И${id}`) {
  return {
    id,
    first_name: first,
    last_name: last,
    birth_date: null,
    weight: "35",
    height: null,
    gender: "male",
    age: 10,
    club: "Барс",
  }
}

/** Раунд-заглушка: важны только статусы боёв. */
function roundWith(statuses: string[]) {
  return [{ matches: statuses.map((status) => ({ status })) }] as never
}

describe("buildWeighinRoster", () => {
  it("сливает дубликаты спортсмена из нескольких категорий с лимитами", () => {
    const roster = buildWeighinRoster([
      cat({ id: 1, name: "A", weight_max: "40", athletes: [athlete(1)] as never }),
      cat({ id: 2, name: "B", weight_max: "45", athletes: [athlete(1), athlete(2)] as never }),
    ])
    expect(roster).toHaveLength(2)
    expect(roster[0].categories).toEqual([
      { id: 1, name: "A", weightMax: 40 },
      { id: 2, name: "B", weightMax: 45 },
    ])
    expect(roster[0].meta).toMatchObject({ club: "Барс", age: 10 })
  })

  it("пустые категории дают пустой ростер", () => {
    expect(buildWeighinRoster([cat()])).toEqual([])
  })
})

describe("buildCategoryRows", () => {
  const regsById = new Map([[1, true]])
  const weightById = new Map([[1, "38"]])
  const tatamis = [{ id: 5, name: "Татами 1", order: 1 }]

  it("считает состав, явку, взвешивание и статус сетки", () => {
    const rows = buildCategoryRows({
      sortedCats: [
        cat({
          athletes: [athlete(1), athlete(2)] as never,
          rounds: roundWith(["ready", "bye"]),
          tatami: 5,
        }),
      ],
      regs: [{ athlete_id: 1, name: "A", checked_in: true, weight_actual: "38" }],
      regsById,
      weightById,
      tatamis,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      count: 2,
      checkedIn: 1,
      weighed: 1,
      overweight: 0,
      fights: 1,
      hasBracket: true,
      tatamiName: "Татами 1",
      status: "active",
      statusLabel: "В игре",
      canGenerate: false,
    })
  })

  it("без сетки и с перевесом", () => {
    const rows = buildCategoryRows({
      sortedCats: [cat({ athletes: [athlete(1), athlete(2)] as never })],
      regs: [{ athlete_id: 1, name: "A", checked_in: false, weight_actual: "44" }],
      regsById: new Map(),
      weightById: new Map([[1, "44"]]),
      tatamis: [],
    })
    expect(rows[0]).toMatchObject({
      status: "waiting",
      statusLabel: "Без сетки",
      overweight: 1,
      canGenerate: true,
      tatamiName: "—",
    })
  })

  it("regs null — честное «недоступно», а не нули", () => {
    const rows = buildCategoryRows({
      sortedCats: [cat({ athletes: [athlete(1)] as never })],
      regs: null,
      regsById: new Map(),
      weightById: new Map(),
      tatamis: [],
    })
    expect(rows[0].weighed).toBeNull()
    expect(rows[0].checkedIn).toBeNull()
  })
})

describe("buildCategoryDrawerData", () => {
  it("считает метрики живой категории, null для missing", () => {
    expect(
      buildCategoryDrawerData({
        cat: undefined,
        regs: null,
        regsById: new Map(),
        tatamis: [],
      })
    ).toBeNull()
    const data = buildCategoryDrawerData({
      cat: cat({
        athletes: [athlete(1)] as never,
        rounds: roundWith(["finished"]),
      }),
      regs: [{ athlete_id: 1, name: "A", checked_in: true, weight_actual: null }],
      regsById: new Map([[1, true]]),
      tatamis: [],
    })
    expect(data).toMatchObject({
      memberCount: 1,
      checkedIn: 1,
      hasBracket: true,
      left: 0,
      canGenerate: false,
    })
  })
})

describe("findFirstOpenCategoryId", () => {
  it("первая незавершённая с сеткой, иначе null", () => {
    expect(findFirstOpenCategoryId([cat({ id: 1 })])).toBeNull()
    expect(
      findFirstOpenCategoryId([
        cat({ id: 1, rounds: roundWith(["finished"]) }),
        cat({ id: 2, rounds: roundWith(["ready"]) }),
      ])
    ).toBe(2)
  })
})
