import { describe, expect, it } from "vitest"
import { checkOverweight, parseWeightLimit } from "@/components/CheckinPanel"

describe("parseWeightLimit", () => {
  it("парсит строку/число/запятую", () => {
    expect(parseWeightLimit("40")).toBe(40)
    expect(parseWeightLimit("40,5")).toBe(40.5)
    expect(parseWeightLimit(32)).toBe(32)
    expect(parseWeightLimit("  55  ")).toBe(55)
  })

  it("мусор — null (без лимита)", () => {
    expect(parseWeightLimit(null)).toBeNull()
    expect(parseWeightLimit("")).toBeNull()
    expect(parseWeightLimit("abc")).toBeNull()
    expect(parseWeightLimit("0")).toBeNull()
    expect(parseWeightLimit("-5")).toBeNull()
  })
})

describe("checkOverweight", () => {
  const cats = [
    { name: "До 40", weightMax: 40 },
    { name: "До 45", weightMax: 45 },
  ]

  it("без веса или лимитов — не перевес", () => {
    expect(checkOverweight(null, cats).over).toBe(false)
    expect(checkOverweight("", cats).over).toBe(false)
    expect(checkOverweight("42", []).over).toBe(false)
    expect(
      checkOverweight("42", [{ name: "X", weightMax: null }]).over
    ).toBe(false)
  })

  it("в пределах строжайшего лимита — ок", () => {
    const r = checkOverweight("40", cats)
    expect(r.over).toBe(false)
  })

  it("сверх строжайшего — перевес с превышением", () => {
    const r = checkOverweight("42,5", cats)
    expect(r.over).toBe(true)
    expect(r.limit).toBe(40)
    expect(r.excess).toBe(2.5)
    expect(r.categoryName).toBe("До 40")
  })
})
