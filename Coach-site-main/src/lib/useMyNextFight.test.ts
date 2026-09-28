import { describe, expect, it } from "vitest"
import { findMyNextFight } from "@/lib/useMyNextFight"
import type { QueueMatch, TatamiQueueItem } from "@/components/LiveQueue"

function match(over: Partial<QueueMatch> & { id: number }): QueueMatch {
  return {
    match_number: 1,
    round_name: "Финал",
    category_name: "Кат",
    athlete1: "Иванов И.",
    athlete1_id: null,
    athlete2: "Петров П.",
    athlete2_id: null,
    status: "waiting",
    ...over,
  }
}

function tatami(
  name: string,
  over: Partial<TatamiQueueItem> = {}
): TatamiQueueItem {
  return {
    tatami: { id: 1, name, order: 0 },
    current: null,
    next: null,
    waiting: [],
    ...over,
  }
}

describe("findMyNextFight", () => {
  it("возвращает null без очередей", () => {
    expect(findMyNextFight([1], [])).toBeNull()
  })

  it("игнорирует чужих детей", () => {
    const q = [tatami("Т1", { next: match({ id: 1, athlete1_id: 9 }) })]
    expect(findMyNextFight([1], [{ tournamentId: 5, queue: q }])).toBeNull()
  })

  it("live важнее next и waiting", () => {
    const q = [
      tatami("Т1", {
        current: match({ id: 1, athlete1_id: 7, status: "in_progress" }),
        next: match({ id: 2, athlete1_id: 1, eta_seconds: 0 }),
        waiting: [match({ id: 3, athlete1_id: 1, eta_seconds: 60 })],
      }),
    ]
    const res = findMyNextFight([1, 7], [{ tournamentId: 5, queue: q }])
    expect(res?.state).toBe("live")
    expect(res?.match.id).toBe(1)
  })

  it("из ожиданий берёт минимальный ETA", () => {
    const q = [
      tatami("Т1", {
        waiting: [
          match({ id: 1, athlete1_id: 1, eta_seconds: 600 }),
          match({ id: 2, athlete1_id: 1, eta_seconds: 120 }),
        ],
      }),
    ]
    const res = findMyNextFight([1], [{ tournamentId: 5, queue: q }])
    expect(res?.state).toBe("waiting")
    expect(res?.match.id).toBe(2)
  })

  it("next без ETA бьёт waiting", () => {
    const q = [
      tatami("Т1", {
        next: match({ id: 1, athlete1_id: 1, status: "ready" }),
        waiting: [match({ id: 2, athlete1_id: 1, eta_seconds: 30 })],
      }),
    ]
    const res = findMyNextFight([1], [{ tournamentId: 5, queue: q }])
    expect(res?.match.id).toBe(1)
  })
})
