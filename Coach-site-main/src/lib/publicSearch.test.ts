import { describe, expect, it } from "vitest"
import {
  buildFighterResults,
  matchStatusRu,
  type PublicSearchCategory,
} from "@/lib/publicSearch"

const cats: PublicSearchCategory[] = [
  {
    catId: 1,
    catName: "14–15 лет · −60 кг",
    rounds: [
      {
        name: "1/4 финала",
        matches: [
          {
            id: 11,
            matchNumber: 18,
            athlete1: "Иван Петров",
            athlete2: "Алексей Сидоров",
            status: "waiting",
            tatamiName: "Татами 2",
          },
          {
            id: 12,
            matchNumber: 19,
            athlete1: "Иван Петров",
            athlete2: null,
            status: "in_progress",
            tatamiName: null,
          },
        ],
      },
    ],
  },
  {
    catId: 2,
    catName: "16–17 лет · −65 кг",
    rounds: [
      {
        name: "Финал",
        matches: [
          {
            id: 21,
            matchNumber: 5,
            athlete1: "Пётр Иванов",
            athlete2: "Ким Чен",
            status: "finished",
            tatamiName: "Татами 1",
          },
        ],
      },
    ],
  },
]

describe("matchStatusRu", () => {
  it("maps known statuses, passes through unknown", () => {
    expect(matchStatusRu("finished")).toBe("Завершён")
    expect(matchStatusRu("in_progress")).toBe("Идёт бой")
    expect(matchStatusRu("waiting")).toBe("Ожидает")
    expect(matchStatusRu("weird")).toBe("weird")
  })
})

describe("buildFighterResults", () => {
  it("matches by name across categories", () => {
    const res = buildFighterResults(cats, "иван")
    expect(res.map((r) => r.matchId).sort()).toEqual([11, 12, 21])
  })

  it("renders category, round, status and tatami", () => {
    const res = buildFighterResults(cats, "сидоров")
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({
      matchId: 11,
      catId: 1,
      sub: "14–15 лет · −60 кг · 1/4 финала · Бой #18",
      meta: "Ожидает · Татами Татами 2",
    })
  })

  it("omits tatami when missing, keeps status", () => {
    const res = buildFighterResults(cats, "иван")
    const live = res.find((r) => r.matchId === 12)
    expect(live?.meta).toBe("Идёт бой")
    expect(live?.sub).toContain("Бой #19")
  })

  it("short query and no match give empty", () => {
    expect(buildFighterResults(cats, "и")).toEqual([])
    expect(buildFighterResults(cats, "никого")).toEqual([])
    expect(buildFighterResults([], "иван")).toEqual([])
  })

  it("caps results at 8", () => {
    const many: PublicSearchCategory[] = Array.from({ length: 3 }, (_, ci) => ({
      catId: 10 + ci,
      catName: `Кат ${ci}`,
      rounds: [
        {
          name: "Раунд",
          matches: Array.from({ length: 5 }, (_, mi) => ({
            id: ci * 100 + mi,
            matchNumber: mi + 1,
            athlete1: "Иван Тестов",
            athlete2: "Соперник",
            status: "waiting",
            tatamiName: null,
          })),
        },
      ],
    }))
    expect(buildFighterResults(many, "иван")).toHaveLength(8)
  })
})
