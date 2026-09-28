import { describe, expect, it } from "vitest"
import { getNextStep } from "@/lib/nextStep"

const cats = (n: number, hasBracket: boolean) =>
  Array.from({ length: n }, () => ({ athleteCount: 4, hasBracket }))

describe("getNextStep", () => {
  it("returns null for finished tournaments", () => {
    expect(
      getNextStep({
        status: "finished",
        categories: [],
        fightsWithoutTatami: 5,
        checkinMissing: 10,
      })
    ).toBeNull()
  })

  it("asks to create categories first", () => {
    const s = getNextStep({
      status: "draft",
      categories: [],
      fightsWithoutTatami: 0,
      checkinMissing: null,
    })
    expect(s?.target).toBe("wizard")
    expect(s?.id).toBe("no-categories")
  })

  it("prioritises missing check-in over brackets", () => {
    const s = getNextStep({
      status: "draft",
      categories: cats(2, false),
      fightsWithoutTatami: 3,
      checkinMissing: 12,
    })
    expect(s?.id).toBe("checkin-missing")
    expect(s?.target).toBe("participants")
    expect(s?.text).toContain("12")
  })

  it("skips check-in when regs unavailable", () => {
    const s = getNextStep({
      status: "draft",
      categories: cats(2, false),
      fightsWithoutTatami: 0,
      checkinMissing: null,
    })
    expect(s?.id).toBe("no-bracket")
  })

  it("asks to distribute tatamis", () => {
    const s = getNextStep({
      status: "draft",
      categories: cats(2, true),
      fightsWithoutTatami: 4,
      checkinMissing: 0,
    })
    expect(s?.id).toBe("no-tatami")
  })

  it("asks to publish when everything is ready", () => {
    const s = getNextStep({
      status: "draft",
      categories: cats(2, true),
      fightsWithoutTatami: 0,
      checkinMissing: 0,
    })
    expect(s?.target).toBe("publish")
  })

  it("never recommends publish while readiness errors block it", () => {
    const s = getNextStep({
      status: "draft",
      categories: cats(2, true),
      fightsWithoutTatami: 0,
      checkinMissing: 0,
      blockerTabs: ["schedule", "participants"],
    })
    expect(s?.id).toBe("blockers")
    expect(s?.target).toBe("schedule")
    expect(s?.text).toContain("2")
  })

  it("blockers do not override earlier steps", () => {
    const s = getNextStep({
      status: "draft",
      categories: [],
      fightsWithoutTatami: 0,
      checkinMissing: null,
      blockerTabs: ["schedule"],
    })
    expect(s?.id).toBe("no-categories")
  })

  it("returns null when published and ready", () => {
    expect(
      getNextStep({
        status: "published",
        categories: cats(2, true),
        fightsWithoutTatami: 0,
        checkinMissing: 0,
      })
    ).toBeNull()
  })
})
