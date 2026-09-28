import { describe, expect, it } from "vitest"
import {
  isLinkActive,
  isRunningTournament,
  partitionTournaments,
} from "@/lib/nav"
import type { Tournament } from "@/lib/types"

function t(over: Partial<Tournament>): Tournament {
  return {
    id: 1,
    name: "Test",
    slug: "test",
    description: "",
    start_date: "2026-09-18",
    end_date: "2026-09-18",
    status: "published",
    created_at: "2026-09-01",
    ...over,
  } as Tournament
}

describe("isLinkActive", () => {
  it("root matches only /", () => {
    expect(isLinkActive("/", "/")).toBe(true)
    expect(isLinkActive("/tournaments", "/")).toBe(false)
  })
  it("matches nested routes", () => {
    expect(isLinkActive("/tournaments/abc", "/tournaments")).toBe(true)
    expect(isLinkActive("/live/tv", "/live")).toBe(true)
    expect(isLinkActive("/news", "/live")).toBe(false)
  })
})

describe("isRunningTournament", () => {
  const now = new Date("2026-09-18T12:00:00")
  it("published tournament within dates is running", () => {
    expect(isRunningTournament(t({}), now)).toBe(true)
  })
  it("draft/finished are never running", () => {
    expect(isRunningTournament(t({ status: "draft" }), now)).toBe(false)
    expect(isRunningTournament(t({ status: "finished" }), now)).toBe(false)
  })
  it("outside date range is not running", () => {
    expect(
      isRunningTournament(t({ start_date: "2026-09-20", end_date: "2026-09-21" }), now)
    ).toBe(false)
  })
})

describe("partitionTournaments", () => {
  it("splits running/upcoming/finished", () => {
    const now = new Date("2026-09-18T12:00:00")
    const part = partitionTournaments(
      [
        t({ id: 1, start_date: "2026-09-18", end_date: "2026-09-18" }),
        t({ id: 2, start_date: "2026-10-01", end_date: "2026-10-02" }),
        t({ id: 3, status: "finished" }),
      ],
      now
    )
    expect(part.running.map((x) => x.id)).toEqual([1])
    expect(part.upcoming.map((x) => x.id)).toEqual([2])
    expect(part.finished.map((x) => x.id)).toEqual([3])
  })
})

