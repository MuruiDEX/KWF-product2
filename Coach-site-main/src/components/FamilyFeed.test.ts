import { describe, expect, it } from "vitest"
import { matchOutcome, sortFeed } from "@/components/FamilyFeed"
import type { Match } from "@/lib/types"

function mk(over: Partial<Match> & { id: number; status: Match["status"] }): Match {
  return {
    round: 1,
    round_name: "Финал",
    round_order: 1,
    category: 1,
    category_name: "Кат",
    match_number: 1,
    athlete1: 1,
    athlete1_name: "Иванов И.",
    athlete2: 2,
    athlete2_name: "Петров П.",
    score1: 0,
    score2: 0,
    winner: null,
    winner_name: null,
    tatami: null,
    tatami_name: null,
    fight_number: 1,
    previous_match1: null,
    previous_match2: null,
    ...over,
  }
}

describe("matchOutcome", () => {
  it("win/loss только для завершённых", () => {
    expect(matchOutcome(mk({ id: 1, status: "finished", winner: 1 }), 1)).toBe("win")
    expect(matchOutcome(mk({ id: 1, status: "finished", winner: 2 }), 1)).toBe("loss")
    expect(matchOutcome(mk({ id: 1, status: "in_progress", winner: null }), 1)).toBeNull()
    expect(matchOutcome(mk({ id: 1, status: "finished", winner: null }), 1)).toBeNull()
  })
})

describe("sortFeed", () => {
  it("живые → готовые → ожидающие → завершённые (новые сверху)", () => {
    const list = [
      mk({ id: 1, status: "finished" }),
      mk({ id: 5, status: "finished" }),
      mk({ id: 2, status: "waiting" }),
      mk({ id: 3, status: "in_progress" }),
      mk({ id: 4, status: "ready" }),
    ]
    expect(sortFeed(list).map((m) => m.id)).toEqual([3, 4, 2, 5, 1])
  })

  it("не мутирует вход", () => {
    const list = [mk({ id: 1, status: "finished" })]
    expect(sortFeed(list)).not.toBe(list)
  })
})
