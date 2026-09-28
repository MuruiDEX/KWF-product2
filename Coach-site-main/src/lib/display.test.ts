import { describe, expect, it } from "vitest"
import { formatTatamiName, pluralize } from "@/lib/display"

describe("formatTatamiName", () => {
  it("keeps already-prefixed names as-is (no doubling)", () => {
    expect(formatTatamiName("Татами 1")).toBe("Татами 1")
    expect(formatTatamiName("татами 2")).toBe("татами 2")
    expect(formatTatamiName("Татами")).toBe("Татами")
    expect(formatTatamiName("Татами-1")).toBe("Татами-1")
  })

  it("prefixes bare names", () => {
    expect(formatTatamiName("1")).toBe("Татами 1")
    expect(formatTatamiName("A")).toBe("Татами A")
    expect(formatTatamiName("  Главная  ")).toBe("Татами Главная")
  })

  it("falls back to em-dash for empty", () => {
    expect(formatTatamiName(null)).toBe("—")
    expect(formatTatamiName(undefined)).toBe("—")
    expect(formatTatamiName("   ")).toBe("—")
  })

  it("does not treat lookalikes as prefixed", () => {
    expect(formatTatamiName("Татамишная")).toBe("Татами Татамишная")
  })
})

describe("pluralize", () => {
  it("handles Russian category counts", () => {
    const c = (n: number) => pluralize(n, "категория", "категории", "категорий")
    expect(c(1)).toBe("категория")
    expect(c(2)).toBe("категории")
    expect(c(4)).toBe("категории")
    expect(c(5)).toBe("категорий")
    expect(c(11)).toBe("категорий")
    expect(c(12)).toBe("категорий")
    expect(c(14)).toBe("категорий")
    expect(c(21)).toBe("категория")
    expect(c(22)).toBe("категории")
    expect(c(0)).toBe("категорий")
  })
})
