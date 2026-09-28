import { describe, expect, it } from "vitest"
import {
  countSelectedOnPage,
  deselectScope,
  selectScope,
  toggleSelectedId,
} from "@/lib/childSelection"
import {
  clampPage,
  pageCountFor,
  paginateParticipants,
  visibleRange,
} from "@/lib/participants"

describe("childSelection ops", () => {
  it("toggle adds and removes a single id", () => {
    expect(toggleSelectedId([], 3)).toEqual([3])
    expect(toggleSelectedId([3, 5], 3)).toEqual([5])
    expect(toggleSelectedId([3], 5)).toEqual([3, 5])
  })

  it("selectScope adds only missing ids", () => {
    expect(selectScope([1], [1, 2, 3])).toEqual([1, 2, 3])
    expect(selectScope([], [])).toEqual([])
  })

  it("deselectScope removes only the scope", () => {
    expect(deselectScope([1, 2, 3], [2])).toEqual([1, 3])
    expect(deselectScope([1, 3], [2])).toEqual([1, 3])
  })

  // Случай 3 из ТЗ: страница 1 → страница 2 → возврат, выбор цел.
  it("selection persists across pages", () => {
    const rows = [1, 2, 3, 4, 5].map((id) => ({ id }))
    const page0 = paginateParticipants(rows, 0, 2).map((r) => r.id)
    const page1 = paginateParticipants(rows, 1, 2).map((r) => r.id)
    let sel: number[] = []
    sel = selectScope(sel, [page0[0]])
    sel = selectScope(sel, [page1[0]])
    expect(sel).toEqual([1, 3])
    // Возврат на страницу 1: выбор виден.
    expect(countSelectedOnPage(sel, page0)).toBe(1)
    // Снятие страницы 2 не трогает страницу 1.
    sel = deselectScope(sel, page1)
    expect(sel).toEqual([1])
  })

  // Случай 4 из ТЗ: выбор filtered-сета не цепляет остальных.
  it("selecting filtered results excludes the rest", () => {
    const filtered = [2, 3]
    const sel = selectScope([], filtered)
    expect(sel).toEqual([2, 3])
    expect(sel).not.toContain(1)
    expect(sel).not.toContain(4)
  })
})

describe("pagination pipeline (search → filter → paginate)", () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ id: i + 1 }))

  it("page count and ranges for 45 rows / 20 per page", () => {
    expect(pageCountFor(rows.length)).toBe(3)
    expect(visibleRange(0, 20, 45)).toEqual({ from: 1, to: 20 })
    expect(visibleRange(2, 20, 45)).toEqual({ from: 41, to: 45 })
  })

  it("empty result clamps to page 0 with empty range", () => {
    expect(clampPage(5, 0)).toBe(0)
    // Существующая семантика: пустой список → pageCount 1 → пейджер скрыт.
    expect(pageCountFor(0)).toBe(1)
    expect(paginateParticipants([], 0, 20)).toEqual([])
  })

  it("out-of-range page clamps to last page", () => {
    // Фильтр сузил список после смены поиска: страница корректируется.
    expect(clampPage(9, 45)).toBe(2)
    expect(paginateParticipants(rows, clampPage(9, 45), 20).map((r) => r.id)).toEqual([
      41, 42, 43, 44, 45,
    ])
  })

  it("pageWindow covers edges and gaps", async () => {
    const { pageWindow } = await import("@/components/Pager")
    expect(pageWindow(0, 3)).toEqual([0, 1, 2])
    expect(pageWindow(0, 20)[0]).toBe(0)
    expect(pageWindow(0, 20)).toContain("gap")
    expect(pageWindow(19, 20).at(-1)).toBe(19)
    expect(pageWindow(10, 20)).toContain(10)
  })
})
