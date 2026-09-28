import { describe, expect, it } from "vitest"
import { autoCategoryName, findCategoryOverlaps } from "./categoryUtils"

describe("autoCategoryName", () => {
  it("полный формат с нижней границей", () => {
    expect(
      autoCategoryName({ id: 1, gender: "male", age_min: 14, age_max: 15, weight_min: 30, weight_max: 60 })
    ).toBe("Мальчики / 14–15 / 30–60 кг")
  })

  it("без нижней границы — «до»", () => {
    expect(
      autoCategoryName({ id: 1, gender: "female", age_min: 10, age_max: 12, weight_max: 45 })
    ).toBe("Девочки / 10–12 / до 45 кг")
  })

  it("явное имя приоритетнее", () => {
    expect(
      autoCategoryName({ id: 1, name: "  Кадеты  ", gender: "male", age_min: 1, age_max: 2, weight_max: 3 })
    ).toBe("Кадеты")
  })
})

describe("findCategoryOverlaps", () => {
  const base = { gender: "male", age_min: 10, age_max: 12, weight_max: 45 }

  it("находит пересечение", () => {
    const out = findCategoryOverlaps([
      { ...base, id: 1 },
      { ...base, id: 2, weight_min: 40 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ aId: 1, bId: 2 })
  })

  it("разные полы не пересекаются", () => {
    expect(
      findCategoryOverlaps([
        { ...base, id: 1 },
        { ...base, id: 2, gender: "female" },
      ])
    ).toEqual([])
  })

  it("any пересекается со всеми", () => {
    expect(
      findCategoryOverlaps([
        { ...base, id: 1 },
        { ...base, id: 2, gender: "any" },
      ])
    ).toHaveLength(1)
  })

  it("непересекающиеся веса — тихо", () => {
    expect(
      findCategoryOverlaps([
        { ...base, id: 1, weight_min: 0, weight_max: 30 },
        { ...base, id: 2, weight_min: 30.01, weight_max: 45 },
      ])
    ).toEqual([])
  })

  it("непересекающийся возраст — тихо", () => {
    expect(
      findCategoryOverlaps([
        { ...base, id: 1 },
        { ...base, id: 2, age_min: 13, age_max: 15 },
      ])
    ).toEqual([])
  })
})
