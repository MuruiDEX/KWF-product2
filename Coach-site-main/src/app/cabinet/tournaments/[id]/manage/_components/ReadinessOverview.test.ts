import { describe, expect, it } from "vitest"
import {
  SECTION_STATUS_META,
  sectionTab,
} from "@/app/cabinet/tournaments/[id]/manage/_components/ReadinessOverview"

describe("ReadinessOverview helpers", () => {
  it("покрывает все 6 статусов единым визуальным языком", () => {
    expect(Object.keys(SECTION_STATUS_META).sort()).toEqual(
      ["completed", "error", "in_progress", "needs_attention", "not_started", "ready"].sort()
    )
    for (const meta of Object.values(SECTION_STATUS_META)) {
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.className.length).toBeGreaterThan(0)
      expect(typeof meta.Icon).toBeDefined()
    }
  })

  it("ошибка и внимание визуально различимы", () => {
    expect(SECTION_STATUS_META.error.className).not.toBe(
      SECTION_STATUS_META.needs_attention.className
    )
    expect(SECTION_STATUS_META.ready.label).not.toBe(
      SECTION_STATUS_META.completed.label
    )
  })

  it("секции ведут в существующие табы (weigh-in пока в participants)", () => {
    expect(sectionTab("participants")).toBe("participants")
    expect(sectionTab("categories")).toBe("categories")
    expect(sectionTab("weighIn")).toBe("weighin")
    expect(sectionTab("tatamis")).toBe("schedule")
    expect(sectionTab("schedule")).toBe("schedule")
    expect(sectionTab("brackets")).toBe("brackets")
    expect(sectionTab("judges")).toBe("staff")
  })
})
