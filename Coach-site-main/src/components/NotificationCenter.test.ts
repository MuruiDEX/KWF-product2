import { describe, expect, it } from "vitest"
import { buildResultItems } from "./NotificationCenter"
import type { Match } from "@/lib/types"

function match(over: Partial<Match> & { id: number }): Match {
  return {
    round: 1,
    round_name: "Финал",
    round_order: 1,
    category: 10,
    category_name: "Кат",
    match_number: 1,
    athlete1: 1,
    athlete1_name: "Иван Петров",
    athlete2: 2,
    athlete2_name: "Айдын Сериков",
    score1: 3,
    score2: 1,
    winner: 1,
    winner_name: "Иван Петров",
    tatami: null,
    tatami_name: null,
    fight_number: 1,
    previous_match1: null,
    previous_match2: null,
    status: "finished",
    ...over,
  } as Match
}

const tByCat = (id: number) =>
  id === 10 ? { slug: "cup", name: "Кубок" } : undefined
const kidName = (id: number) => (id === 1 ? "Иван Петров" : undefined)

describe("buildResultItems", () => {
  it("берёт только завершённые бои своих детей, новые сверху", () => {
    const items = buildResultItems(
      [
        match({ id: 1 }),
        match({ id: 2, status: "ready", winner: null }),
        match({ id: 3, athlete1: 9, athlete1_name: "Чужой", winner: 9 }),
      ],
      [1],
      tByCat,
      kidName
    )
    expect(items.map((i) => i.id)).toEqual([1])
    expect(items[0].title).toContain("3:1")
    expect(items[0].body).toContain("победа")
    expect(items[0].href).toBe("/tournaments/cup#match-1")
    expect(items[0].won).toBe(true)
  })

  it("поражение и отсутствие турнира", () => {
    const items = buildResultItems(
      [match({ id: 5, winner: 2, winner_name: "Айдын Сериков", category: 99 })],
      [1],
      tByCat,
      kidName
    )
    expect(items[0].won).toBe(false)
    expect(items[0].body).toContain("поражение")
    expect(items[0].href).toBe("/tournaments")
  })

  it("пусто без завершённых", () => {
    expect(buildResultItems([], [1], tByCat, kidName)).toEqual([])
  })
})
