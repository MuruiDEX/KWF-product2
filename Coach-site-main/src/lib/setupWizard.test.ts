import { describe, expect, it } from "vitest"
import {
  bracketPreview,
  categorySetupState,
  formatLaneTime,
  parseLaneStart,
  tatamiLoads,
} from "./setupWizard"

describe("bracketPreview", () => {
  it("возвращает null для <2 участников", () => {
    expect(bracketPreview(0)).toBeNull()
    expect(bracketPreview(1)).toBeNull()
    expect(bracketPreview(2.5)).toBeNull()
  })
  it("считает слоты/BYE/бои как backend", () => {
    expect(bracketPreview(2)).toEqual({ slots: 2, byes: 0, fights: 1, rounds: 1 })
    expect(bracketPreview(3)).toEqual({ slots: 4, byes: 1, fights: 3, rounds: 2 })
    expect(bracketPreview(8)).toEqual({ slots: 8, byes: 0, fights: 7, rounds: 3 })
    expect(bracketPreview(9)).toEqual({ slots: 16, byes: 7, fights: 15, rounds: 4 })
    expect(bracketPreview(100)).toEqual({ slots: 128, byes: 28, fights: 127, rounds: 7 })
  })
})

describe("categorySetupState", () => {
  it("различает пустую/малую/готовую/построенную", () => {
    expect(categorySetupState({ athletes: [] })).toEqual({ kind: "empty" })
    expect(categorySetupState({ athletes: [{ id: 1 }] })).toEqual({
      kind: "too_few",
      athletes: 1,
    })
    expect(categorySetupState({ athletes: [{ id: 1 }, { id: 2 }] })).toEqual({
      kind: "ready",
      athletes: 2,
    })
    expect(
      categorySetupState({
        athletes: [{ id: 1 }, { id: 2 }],
        rounds: [{ matches: [{ status: "ready" }] }],
      })
    ).toEqual({ kind: "built", fights: 1, live: false })
    expect(
      categorySetupState({
        athletes: [{ id: 1 }, { id: 2 }],
        rounds: [{ matches: [{ status: "finished" }] }],
      })
    ).toEqual({ kind: "built", fights: 1, live: true })
  })
})

describe("tatamiLoads", () => {
  it("считает только незавершённые не-BYE бои", () => {
    expect(
      tatamiLoads([{ id: 1 }, { id: 2 }], [
        { tatami: 1, status: "ready" },
        { tatami: 1, status: "finished" },
        { tatami: 1, status: "bye" },
        { tatami: 2, status: "waiting" },
        { tatami: null, status: "ready" },
      ])
    ).toEqual([
      { tatamiId: 1, fights: 1 },
      { tatamiId: 2, fights: 1 },
    ])
  })
})

describe("lane time", () => {
  it("форматирует и парсит ЧЧ:ММ", () => {
    expect(formatLaneTime(540)).toBe("09:00")
    expect(formatLaneTime(1500)).toBe("01:00")
    expect(parseLaneStart("09:15")).toBe(555)
    expect(parseLaneStart("9:05")).toBe(545)
    expect(parseLaneStart("утром")).toBeNull()
    expect(parseLaneStart("25:00")).toBeNull()
  })
})
