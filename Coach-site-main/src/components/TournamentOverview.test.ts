import { describe, expect, it } from "vitest"
import { tournamentStats } from "@/components/TournamentOverview"
import type { Tournament } from "@/lib/types"

function t(over: Partial<Tournament> = {}): Tournament {
  return {
    id: 1,
    name: "Cup",
    slug: "cup",
    description: "",
    start_date: "2026-09-18",
    end_date: "2026-09-18",
    status: "published",
    created_at: "2026-09-01",
    ...over,
  } as Tournament
}

describe("tournamentStats", () => {
  it("counts unique participants, fights and completion", () => {
    const stats = tournamentStats(
      t({
        categories: [
          {
            id: 1,
            athletes: [
              { id: 1, first_name: "A", last_name: "A" },
              { id: 2, first_name: "B", last_name: "B" },
            ],
            rounds: [
              {
                matches: [
                  { status: "finished" },
                  { status: "in_progress" },
                  { status: "bye" },
                ],
              },
            ],
          },
          {
            id: 2,
            athletes: [{ id: 2, first_name: "B", last_name: "B" }],
            rounds: [],
          },
        ],
      } as unknown as Tournament)
    )
    expect(stats.participants).toBe(2)
    expect(stats.categories).toBe(2)
    expect(stats.fights).toBe(2)
    expect(stats.finished).toBe(1)
  })

  it("clubs is null when backend hides club field (anonymous)", () => {
    const stats = tournamentStats(
      t({
        categories: [
          { id: 1, athletes: [{ id: 1 }], rounds: [] },
        ],
      } as unknown as Tournament)
    )
    expect(stats.clubs).toBe(null)
  })

  it("clubs counted when present (staff view)", () => {
    const stats = tournamentStats(
      t({
        categories: [
          {
            id: 1,
            athletes: [
              { id: 1, club: "Барс" },
              { id: 2, club: "Барс" },
              { id: 3, club: "Тигр" },
            ],
            rounds: [],
          },
        ],
      } as unknown as Tournament)
    )
    expect(stats.clubs).toBe(2)
  })
})
