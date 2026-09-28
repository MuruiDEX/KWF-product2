import { describe, expect, it } from "vitest"
import {
  buildStationQueue,
  nextUnweighedId,
  stationProgress,
  validateWeight,
  type StationRosterEntry,
} from "@/lib/weighinStation"

const roster: StationRosterEntry[] = [
  { id: 1, name: "Иван Петров", categories: [{ id: 1, name: "Кат", weightMax: 40 }] },
  { id: 2, name: "Иванов Артём", categories: [{ id: 1, name: "Кат", weightMax: 40 }] },
  { id: 3, name: "Сидоров Ким", categories: [{ id: 1, name: "Кат", weightMax: 40 }] },
]

describe("validateWeight", () => {
  it("accepts plain and comma decimals", () => {
    expect(validateWeight("72.4")).toEqual({ ok: true, value: 72.4 })
    expect(validateWeight("72,456")).toEqual({ ok: true, value: 72.46 })
    expect(validateWeight("  30 ")).toEqual({ ok: true, value: 30 })
  })

  it("rejects empty, NaN, non-positive", () => {
    expect(validateWeight("")).toEqual({ ok: false, error: "Введите вес" })
    expect(validateWeight("   ")).toEqual({ ok: false, error: "Введите вес" })
    expect(validateWeight("abc").ok).toBe(false)
    expect(validateWeight("-3")).toEqual({ ok: false, error: "Вес должен быть положительным" })
    expect(validateWeight("0")).toEqual({ ok: false, error: "Вес должен быть положительным" })
  })

  it("rejects impossible values (Decimal(5,2) mirror)", () => {
    expect(validateWeight("1000")).toEqual({ ok: false, error: "Слишком большой вес" })
    expect(validateWeight("999.99").ok).toBe(true)
  })
})

describe("buildStationQueue", () => {
  it("puts unweighed first, keeps order stable", () => {
    expect(buildStationQueue(roster, new Set([2]), "")).toEqual([1, 3, 2])
  })

  it("empty weighed set keeps roster order", () => {
    expect(buildStationQueue(roster, new Set(), "")).toEqual([1, 2, 3])
  })

  it("search narrows across full roster, still unweighed-first", () => {
    expect(buildStationQueue(roster, new Set([1]), "иван")).toEqual([2, 1])
  })

  it("accepts Map as weighed source", () => {
    const m = new Map([[3, { weight_actual: "30" }]])
    expect(buildStationQueue(roster, m, "")).toEqual([1, 2, 3])
  })

  it("empty roster and empty search result", () => {
    expect(buildStationQueue([], new Set(), "")).toEqual([])
    expect(buildStationQueue(roster, new Set(), "zzz-no-match")).toEqual([])
  })
})

describe("nextUnweighedId", () => {
  const isWeighed = (weighed: number[]) => (id: number) => weighed.includes(id)

  it("returns first unweighed without anchor", () => {
    expect(nextUnweighedId([1, 2, 3], isWeighed([1]), null)).toBe(2)
    expect(nextUnweighedId([1, 2, 3], isWeighed([]))).toBe(1)
  })

  it("moves forward after current", () => {
    expect(nextUnweighedId([1, 2, 3], isWeighed([1]), 1)).toBe(2)
    expect(nextUnweighedId([1, 2, 3], isWeighed([2]), 1)).toBe(3)
  })

  it("wraps to earlier skipped unweighed", () => {
    expect(nextUnweighedId([1, 2, 3], isWeighed([2, 3]), 3)).toBe(1)
  })

  it("returns null when all weighed", () => {
    expect(nextUnweighedId([1, 2, 3], isWeighed([1, 2, 3]), 3)).toBeNull()
    expect(nextUnweighedId([], isWeighed([]))).toBeNull()
  })

  it("unknown anchor starts from beginning", () => {
    expect(nextUnweighedId([1, 2, 3], isWeighed([]), 999)).toBe(1)
  })
})

describe("stationProgress", () => {
  const weights = new Map<number, string | null>([
    [1, "38"],
    [2, null],
    [3, "45"],
  ])
  const over = new Set([3])
  const p = () =>
    stationProgress(
      roster,
      (id) => weights.get(id) ?? null,
      (id) => over.has(id)
    )

  it("counts total/weighed/unweighed/overweight", () => {
    expect(p()).toEqual({ total: 3, weighed: 2, unweighed: 1, overweight: 1 })
  })

  it("empty roster gives zeros", () => {
    expect(
      stationProgress([], () => null, () => false)
    ).toEqual({ total: 0, weighed: 0, unweighed: 0, overweight: 0 })
  })
})
