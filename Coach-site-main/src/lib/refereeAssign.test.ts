import { describe, expect, it } from "vitest"
import { filterRefereeCandidates } from "@/lib/refereeAssign"

const CANDIDATES = [
  { id: 1, name: "Иван Петров" },
  { id: 2, name: "Иванов Артём" },
  { id: 3, name: "Дмитрий Ким" },
]

describe("filterRefereeCandidates", () => {
  it("empty query returns full list in order", () => {
    expect(filterRefereeCandidates(CANDIDATES, "")).toEqual(CANDIDATES)
    expect(filterRefereeCandidates(CANDIDATES, "   ")).toEqual(CANDIDATES)
  })

  it("first name finds by prefix, case-insensitive", () => {
    expect(filterRefereeCandidates(CANDIDATES, "иван").map((c) => c.id)).toEqual([1, 2])
    expect(filterRefereeCandidates(CANDIDATES, "ДМИТРИЙ").map((c) => c.id)).toEqual([3])
  })

  it("surname finds regardless of token order", () => {
    expect(filterRefereeCandidates(CANDIDATES, "Петров").map((c) => c.id)).toEqual([1])
    expect(filterRefereeCandidates(CANDIDATES, "Петров Иван").map((c) => c.id)).toEqual([1])
  })

  it("partial surname prefix matches", () => {
    expect(filterRefereeCandidates(CANDIDATES, "ивано").map((c) => c.id)).toEqual([2])
  })

  it("no match returns empty list", () => {
    expect(filterRefereeCandidates(CANDIDATES, "Сидоров")).toEqual([])
  })

  it("does not mutate the input list", () => {
    const input = [...CANDIDATES]
    filterRefereeCandidates(input, "иван")
    expect(input).toEqual(CANDIDATES)
  })
})
