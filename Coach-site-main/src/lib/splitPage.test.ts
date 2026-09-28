import { describe, expect, it } from "vitest"
import { splitPage, unwrapList } from "@/lib/api"

describe("splitPage", () => {
  it("пагинированный ответ → items + total", () => {
    const { items, total } = splitPage({
      count: 42,
      next: "http://x/?page=2",
      previous: null,
      results: [1, 2],
    })
    expect(items).toEqual([1, 2])
    expect(total).toBe(42)
  })

  it("plain-массив → total null (hasMore по эвристике)", () => {
    const { items, total } = splitPage([1, 2, 3])
    expect(items).toEqual([1, 2, 3])
    expect(total).toBeNull()
  })

  it("null/undefined → пусто с total 0", () => {
    expect(splitPage(null)).toEqual({ items: [], total: 0 })
    expect(splitPage(undefined)).toEqual({ items: [], total: 0 })
  })

  it("unwrapList совместим со старыми вызовами", () => {
    expect(unwrapList({ count: 1, next: null, previous: null, results: ["a"] })).toEqual(["a"])
    expect(unwrapList(["a"])).toEqual(["a"])
    expect(unwrapList(null)).toEqual([])
  })
})
