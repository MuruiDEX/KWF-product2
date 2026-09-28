import { describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import {
  collectBracketCandidates,
  eligibleForBracket,
  formatBracketGenSummary,
  generateAllBrackets,
} from "@/lib/brackets"

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  apiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : "Ошибка"),
}))

const cat = (over: {
  id?: number
  name?: string
  athletes?: unknown[]
  rounds?: unknown[]
} = {}) => ({
  id: over.id ?? 1,
  name: over.name ?? "Кат",
  athletes: over.athletes ?? [{ id: 1 }, { id: 2 }],
  rounds: over.rounds ?? [],
})

describe("eligibleForBracket", () => {
  it("mirrors single-button rules: no rounds and 2+ athletes", () => {
    expect(eligibleForBracket(cat())).toBe(true)
    expect(eligibleForBracket(cat({ athletes: [{ id: 1 }] }))).toBe(false)
    expect(eligibleForBracket(cat({ athletes: [] }))).toBe(false)
    expect(eligibleForBracket(cat({ rounds: [{ id: 9 }] }))).toBe(false)
  })

  it("collects only eligible with id+name", () => {
    const out = collectBracketCandidates([
      cat({ id: 1, name: "A" }),
      cat({ id: 2, name: "B", athletes: [{ id: 1 }] }),
      cat({ id: 3, name: "C", rounds: [{ id: 9 }] }),
    ])
    expect(out).toEqual([{ id: 1, name: "A" }])
  })
})

describe("generateAllBrackets", () => {
  it("processes sequentially and aggregates success", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockResolvedValue({})
    const order: number[] = []
    mocked.mockImplementation(async (url: string) => {
      const m = url.match(/categories\/(\d+)\/generate_bracket/)
      order.push(Number(m?.[1]))
      return {}
    })
    const res = await generateAllBrackets([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ])
    expect(order).toEqual([1, 2])
    expect(mocked).toHaveBeenCalledTimes(2)
    expect(res).toMatchObject({ requested: 2, generated: 2, failed: 0 })
  })

  it("continues after individual failure and keeps names", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockImplementation(async (url: string) => {
      if (url.includes("/2/")) throw new Error("boom")
      return {}
    })
    const res = await generateAllBrackets([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ])
    expect(res).toMatchObject({ requested: 2, generated: 1, failed: 1 })
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].categoryId).toBe(2)
    expect(res.errors[0].name).toBe("B")
  })

  it("empty input makes zero requests", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    const res = await generateAllBrackets([])
    expect(mocked).not.toHaveBeenCalled()
    expect(res).toMatchObject({ requested: 0, generated: 0, failed: 0 })
  })

  it("retry uses only failed ids", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockResolvedValue({})
    const res = await generateAllBrackets([{ id: 2, name: "B" }])
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(
      "/api/tournament/categories/2/generate_bracket/",
      { method: "POST" }
    )
    expect(res.failed).toBe(0)
  })
})

describe("formatBracketGenSummary", () => {
  it("zero eligible", () => {
    expect(
      formatBracketGenSummary({ requested: 0, generated: 0, failed: 0, errors: [] })
    ).toEqual({ ok: true, text: "Нет готовых категорий — нечего генерировать." })
  })

  it("all success", () => {
    expect(
      formatBracketGenSummary({ requested: 12, generated: 12, failed: 0, errors: [] })
    ).toEqual({ ok: true, text: "Сетки созданы: 12." })
  })

  it("partial failure names categories", () => {
    const s = formatBracketGenSummary({
      requested: 3,
      generated: 1,
      failed: 2,
      errors: [
        { categoryId: 2, name: "B", error: "boom" },
        { categoryId: 3, name: "C", error: "boom" },
      ],
    })
    expect(s.ok).toBe(false)
    expect(s.text).toContain("Создано: 1")
    expect(s.text).toContain("Ошибки: 2")
    expect(s.text).toContain("B (boom)")
  })
})
