import { describe, expect, it } from "vitest"
import {
  buildStreamUrl,
  normalizeSSEFrame,
  parseSSEBlocks,
  sseBackoffMs,
  SSE_FAILURES_BEFORE_FALLBACK,
} from "@/lib/liveTransport"
import { decideSync } from "@/lib/useTournamentEvents"
import type { TournamentEvent } from "@/lib/tournamentEvents"

function ev(id: number, type = "match.finished"): TournamentEvent {
  return {
    id,
    tournament: 1,
    type,
    match: 7,
    round: null,
    category: null,
    actor: null,
    created_at: "2026-09-18T10:00:00Z",
  }
}

describe("parseSSEBlocks", () => {
  it("parses id/event/data frames and skips heartbeat comments", () => {
    const text = [
      ": ping",
      "",
      'id: 101\nevent: tournament_event\ndata: {"id":101}',
      "",
      'id: 102\nevent: tournament_event\ndata: {"id":102,"type":"x"}',
      "",
    ].join("\n")
    const frames = parseSSEBlocks(text)
    expect(frames).toHaveLength(2)
    expect(frames[0]).toEqual({ id: 101, event: "tournament_event", data: '{"id":101}' })
    expect(frames[1].id).toBe(102)
  })

  it("ignores blocks without data", () => {
    expect(parseSSEBlocks("id: 5\n\n")).toEqual([])
    expect(parseSSEBlocks("")).toEqual([])
  })
})

describe("normalizeSSEFrame", () => {
  it("keeps tournament_event JSON with numeric id", () => {
    const out = normalizeSSEFrame({
      id: 7,
      event: "tournament_event",
      data: JSON.stringify(ev(7)),
    })
    expect(out?.id).toBe(7)
    expect(out?.match).toBe(7)
  })
  it("drops foreign events, bad JSON and missing id", () => {
    expect(normalizeSSEFrame({ id: 1, event: "other", data: "{}" })).toBe(null)
    expect(normalizeSSEFrame({ id: 1, event: "tournament_event", data: "nope" })).toBe(null)
    expect(normalizeSSEFrame({ id: null, event: "tournament_event", data: '{"id":"x"}' })).toBe(null)
  })
})

describe("sseBackoffMs", () => {
  it("grows 1s,2s,4s,8s and caps at 30s", () => {
    expect([sseBackoffMs(0), sseBackoffMs(1), sseBackoffMs(2), sseBackoffMs(3)]).toEqual([
      1000, 2000, 4000, 8000,
    ])
    expect(sseBackoffMs(99)).toBe(30000)
    expect(SSE_FAILURES_BEFORE_FALLBACK).toBe(3)
  })
})

describe("buildStreamUrl", () => {
  it("builds replay URL with ?after=", () => {
    expect(buildStreamUrl("http://localhost:8000", 5, 102)).toBe(
      "http://localhost:8000/api/tournament/tournaments/5/events/stream/?after=102"
    )
    expect(buildStreamUrl("http://x/", "abc", -3)).toContain("?after=0")
  })
})

describe("SSE and polling converge (shared processor)", () => {
  it("reconnect replay with duplicate is deduped like polling batch", () => {
    const seen = new Set<number>([105])
    // Дисконнект после 105,106; replay вернул 106,107.
    const d = decideSync(105, seen, [ev(106), ev(107)], 107)
    expect(d.batch.map((e) => e.id)).toEqual([106, 107])
    expect(d.lastId).toBe(107)
    // Повторный 106 уже виден — пусто.
    const d2 = decideSync(107, new Set([105, 106, 107]), [ev(106)], 107)
    expect(d2.batch).toEqual([])
  })
})
