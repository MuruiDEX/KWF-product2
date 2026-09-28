import { describe, expect, it } from "vitest"
import { shouldNotifyFight } from "@/lib/notify"
import type { MyNextFight } from "@/lib/useMyNextFight"

function fight(over: Partial<MyNextFight> = {}): MyNextFight {
  return {
    match: {
      id: 10,
      match_number: 1,
      round_name: "Финал",
      category_name: "Кат",
      athlete1: "Али",
      athlete1_id: 1,
      athlete2: "Иван",
      athlete2_id: 2,
      status: "ready",
      eta_seconds: 300,
      ...over.match,
    } as MyNextFight["match"],
    tatamiName: "Татами 1",
    tournamentId: 3,
    state: "next",
    ...over,
  }
}

describe("shouldNotifyFight", () => {
  it("live → уведомить один раз", () => {
    const f = fight({ state: "live" })
    const ev = shouldNotifyFight(f, new Set())
    expect(ev?.live).toBe(true)
    expect(ev?.title).toContain("татами")
    expect(ev?.body).toContain("Татами 1")
    // Повтор того же боя — тихо.
    expect(shouldNotifyFight(f, new Set([ev!.key]))).toBeNull()
  })

  it("next с ETA в пороге → уведомить", () => {
    const ev = shouldNotifyFight(fight(), new Set())
    expect(ev?.live).toBe(false)
    expect(ev?.body).toContain("Татами 1")
  })

  it("next с большим ETA → тихо", () => {
    const f = fight()
    f.match.eta_seconds = 3600
    expect(shouldNotifyFight(f, new Set())).toBeNull()
  })

  it("next без ETA → тихо", () => {
    const f = fight()
    f.match.eta_seconds = null
    expect(shouldNotifyFight(f, new Set())).toBeNull()
  })

  it("waiting/null → тихо", () => {
    expect(shouldNotifyFight(fight({ state: "waiting" }), new Set())).toBeNull()
    expect(shouldNotifyFight(null, new Set())).toBeNull()
  })
})
