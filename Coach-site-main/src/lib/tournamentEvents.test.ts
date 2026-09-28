import { describe, expect, it } from "vitest"
import { decideSync, EVENTS_PAGE_CAP } from "./useTournamentEvents"
import {
  isAnnouncementEvent,
  isBracketEvent,
  isQueueEvent,
  type TournamentEvent,
} from "./tournamentEvents"

function ev(id: number, type = "match.finished"): TournamentEvent {
  return {
    id,
    tournament: 1,
    type,
    match: 42,
    round: 7,
    category: 5,
    actor: 3,
    created_at: "2026-01-01T00:00:00Z",
  }
}

describe("decideSync", () => {
  it("пропускает только новые события и двигает якорь", () => {
    const d = decideSync(0, new Set(), [ev(1), ev(2)], 2)
    expect(d.batch.map((e) => e.id)).toEqual([1, 2])
    expect(d.lastId).toBe(2)
    expect(d.fullResync).toBe(false)
  })

  it("отсекает дубли и старые id", () => {
    const d = decideSync(2, new Set([3]), [ev(1), ev(2), ev(3), ev(4)], 4)
    expect(d.batch.map((e) => e.id)).toEqual([4])
    expect(d.lastId).toBe(4)
  })

  it("пустой батч двигает якорь к latest_id без resync", () => {
    const d = decideSync(5, new Set(), [], 5)
    expect(d.batch).toEqual([])
    expect(d.lastId).toBe(5)
    expect(d.fullResync).toBe(false)
  })

  it("полная страница — флаг fullResync (возможна обрезка)", () => {
    const events = Array.from({ length: EVENTS_PAGE_CAP }, (_, i) => ev(i + 1))
    const d = decideSync(0, new Set(), events, EVENTS_PAGE_CAP)
    expect(d.fullResync).toBe(true)
    expect(d.lastId).toBe(EVENTS_PAGE_CAP)
  })

  it("перестановка не ломает якорь (берётся max)", () => {
    const d = decideSync(0, new Set(), [ev(3), ev(1), ev(2)], 3)
    expect(d.batch.map((e) => e.id)).toEqual([3, 1, 2])
    expect(d.lastId).toBe(3)
  })
})

describe("event routing", () => {
  it("match/round → очередь", () => {
    for (const t of [
      "match.started",
      "match.paused",
      "match.resumed",
      "match.finished",
      "match.reopened",
      "match.tatami",
      "round.started",
      "round.finished",
    ]) {
      expect(isQueueEvent(ev(1, t))).toBe(true)
    }
    expect(isQueueEvent(ev(1, "category.members"))).toBe(false)
    expect(isQueueEvent(ev(1, "tournament.updated"))).toBe(false)
  })

  it("finish/reopen/round/category/tournament → сетка", () => {
    for (const t of [
      "match.finished",
      "match.reopened",
      "round.started",
      "round.finished",
      "category.members",
      "category.bracket",
      "tournament.updated",
    ]) {
      expect(isBracketEvent(ev(1, t))).toBe(true)
    }
    expect(isBracketEvent(ev(1, "match.started"))).toBe(false)
    expect(isBracketEvent(ev(1, "match.tatami"))).toBe(false)
  })

  it("announcement — только баннер (не очередь и не сетка)", () => {
    const a = ev(1, "tournament.announcement")
    expect(isAnnouncementEvent(a)).toBe(true)
    expect(isQueueEvent(a)).toBe(false)
    expect(isBracketEvent(a)).toBe(false)
    expect(isAnnouncementEvent(ev(1, "tournament.updated"))).toBe(false)
  })
})
