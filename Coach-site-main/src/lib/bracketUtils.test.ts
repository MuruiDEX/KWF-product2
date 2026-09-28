import { describe, expect, it } from "vitest"
import { championOf, idOf, nameOf } from "@/lib/bracketUtils"

describe("idOf/nameOf", () => {
  it("разворачивает id/name формы", () => {
    expect(idOf(5)).toBe(5)
    expect(idOf({ id: 7 })).toBe(7)
    expect(idOf(null)).toBeNull()
    expect(idOf(undefined)).toBeNull()
    expect(nameOf({ name: "A" })).toBe("A")
    expect(nameOf(5)).toBeNull()
    expect(nameOf(null)).toBeNull()
  })
})

describe("championOf", () => {
  const mk = (winnerId: number | null, winnerName: string | null = null) => ({
    winnerId,
    winnerName,
    athlete1: { id: 1, name: "Иванов И." },
    athlete2: { id: 2, name: "Петров П." },
  })

  it("пусто без победителя", () => {
    expect(championOf([])).toBeNull()
    expect(championOf([{ matches: [mk(null)] }])).toBeNull()
  })

  it("имя из winnerName или бойца", () => {
    expect(
      championOf([{ matches: [mk(2, "Петров П.")] }])
    ).toBe("Петров П.")
    expect(championOf([{ matches: [mk(1)] }])).toBe("Иванов И.")
    expect(championOf([{ matches: [mk(2)] }])).toBe("Петров П.")
  })

  it("берёт последний раунд", () => {
    expect(
      championOf([{ matches: [mk(1)] }, { matches: [mk(null)] }])
    ).toBeNull()
  })
})
