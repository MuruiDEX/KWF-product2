import { describe, expect, it } from "vitest"
import {
  applyDeltaToMatch,
  isFullBracketResponse,
  mergeBracketMatches,
  type DeltaMatch,
} from "@/lib/bracketDelta"

function delta(over: Partial<DeltaMatch> & { id: number }): DeltaMatch {
  return {
    match_number: 1,
    round_id: 10,
    category_id: 5,
    athlete1_id: 1,
    athlete1_name: "Иванов И.",
    athlete2_id: 2,
    athlete2_name: "Петров П.",
    winner_id: null,
    winner_name: null,
    score1: 0,
    score2: 0,
    status: "ready",
    tatami_id: null,
    tatami_name: null,
    start_time: null,
    previous_match1: null,
    previous_match2: null,
    ...over,
  }
}

describe("isFullBracketResponse", () => {
  it("различает full и delta", () => {
    expect(isFullBracketResponse({ categories: [], latest_id: 3 })).toBe(true)
    expect(
      isFullBracketResponse({
        tournament_id: 5,
        changed: [] as DeltaMatch[],
        latest_id: 3,
      })
    ).toBe(false)
  })
})

interface TestMatch {
  id: number
  status: string
  athlete1: number | null
  athlete1_name?: string | null
  winner?: number | null
  winner_id?: number | null
  score1?: number
  tatami?: number | null
  tatami_name?: string | null
}

describe("mergeBracketMatches", () => {
  const cats: { id: number; rounds: { id: number; matches: TestMatch[] }[] }[] = [
    {
      id: 5,
      rounds: [
        {
          id: 10,
          matches: [
            { id: 100, status: "ready", athlete1: 1, score1: 0 },
            { id: 101, status: "waiting", athlete1: null },
          ],
        },
      ],
    },
  ]

  it("обновляет бой по id, остальных не трогает", () => {
    const out = mergeBracketMatches(cats, [
      delta({ id: 100, status: "finished", winner_id: 1, winner_name: "Иванов И.", score1: 5, score2: 3 }),
    ])
    const [m100, m101] = out[0].rounds![0].matches!
    expect(m100.status).toBe("finished")
    expect(m100.winner_id).toBe(1)
    expect(m100.winner).toBe(1)
    expect(m100.score1).toBe(5)
    expect(m101.status).toBe("waiting")
    // Неизменённые объекты — те же ссылки.
    expect(m101).toBe(cats[0].rounds![0].matches![1])
  })

  it("продвижение победителя меняет состав следующего боя", () => {
    const out = mergeBracketMatches(cats, [
      delta({ id: 101, status: "ready", athlete1_id: 1, athlete1_name: "Иванов И." }),
    ])
    const m = out[0].rounds![0].matches![1]
    expect(m.status).toBe("ready")
    expect(m.athlete1).toBe(1)
    expect(m.athlete1_name).toBe("Иванов И.")
  })

  it("неизвестные id игнорируются, пустая дельта возвращает как есть", () => {
    expect(mergeBracketMatches(cats, [delta({ id: 999 })])).toBe(cats)
    expect(mergeBracketMatches(cats, [])).toBe(cats)
  })

  it("applyDeltaToMatch пишет обе формы полей", () => {
    const m = applyDeltaToMatch(
      { id: 1, status: "ready", tatami: null as number | null, tatami_name: null as string | null },
      delta({ id: 1, tatami_id: 7, tatami_name: "Т1" })
    )
    expect(m.tatami).toBe(7)
    expect(m.tatami_name).toBe("Т1")
  })
})
