import { describe, expect, it } from "vitest"
import { filterEntries, type PaletteItem } from "@/lib/palette"

const items: PaletteItem[] = [
  { id: "a", label: "Открыть: сетки", hint: "Раунды", run: () => {} },
  { id: "b", label: "Экспорт: протокол XLSX", hint: "Скачать", run: () => {} },
]

describe("filterEntries", () => {
  it("returns all on empty query", () => {
    expect(filterEntries(items, "")).toHaveLength(2)
  })
  it("matches label and hint, case-insensitive", () => {
    expect(filterEntries(items, "сетки").map((i) => i.id)).toEqual(["a"])
    expect(filterEntries(items, "СКАЧАТЬ").map((i) => i.id)).toEqual(["b"])
  })
  it("returns empty when nothing matches", () => {
    expect(filterEntries(items, "zzz")).toEqual([])
  })
})
