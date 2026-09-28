import { describe, expect, it } from "vitest"
import {
  MANAGE_TABS,
  isManageTab,
  resolveTab,
} from "@/app/cabinet/tournaments/[id]/manage/manageTabs"

describe("manageTabs", () => {
  it("isManageTab принимает все 10 табов и отвергает мусор", () => {
    for (const t of MANAGE_TABS(0, 0)) {
      expect(isManageTab(t.id)).toBe(true)
    }
    expect(MANAGE_TABS(0, 0)).toHaveLength(10)
    expect(isManageTab("setup")).toBe(false)
    expect(isManageTab(null)).toBe(false)
    expect(isManageTab("weighin")).toBe(true)
  })

  it("подписи содержат счётчики", () => {
    expect(
      MANAGE_TABS(148, 3).find((t) => t.id === "participants")?.label
    ).toContain("148")
    expect(
      MANAGE_TABS(148, 3).find((t) => t.id === "schedule")?.label
    ).toContain("LIVE 3")
    expect(
      MANAGE_TABS(148, 0).find((t) => t.id === "schedule")?.label
    ).not.toContain("LIVE")
  })

  it("legacy ?tab= маппятся на новую IA", () => {
    expect(resolveTab("setup", null).tab).toBe("categories")
    expect(resolveTab("live", null)).toEqual({ tab: "schedule", view: "live" })
    expect(resolveTab("bracket", null).tab).toBe("brackets")
    expect(resolveTab("weighin", null).tab).toBe("weighin")
    expect(resolveTab("nope", null).tab).toBe("overview")
    expect(resolveTab(null, null).tab).toBe("overview")
  })
})
