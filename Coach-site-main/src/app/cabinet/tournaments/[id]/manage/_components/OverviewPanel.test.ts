import { describe, expect, it } from "vitest"
import {
  buildHealthCells,
  issuesToAttention,
  toCellStatus,
} from "@/app/cabinet/tournaments/[id]/manage/_components/OverviewPanel"
import type {
  ReadinessSections,
  TournamentIssue,
} from "@/lib/readiness"

const ready: ReadinessSections = {
  participants: "ready",
  categories: "ready",
  weighIn: "ready",
  tatamis: "ready",
  schedule: "ready",
  brackets: "ready",
  judges: "ready",
}

const baseCells = {
  sections: ready,
  weighin: { total: 4, weighed: 3, unweighed: 1, overweight: 0 },
  participantCount: 10,
  categoriesCount: 3,
  bracketsBuilt: 3,
  tatamisCount: 2,
  liveCount: 0,
  unrefereedCount: 0,
}

describe("toCellStatus", () => {
  it("маппит единый язык статусов на ячейки обзора", () => {
    expect(toCellStatus("ready")).toBe("ok")
    expect(toCellStatus("completed")).toBe("ok")
    expect(toCellStatus("not_started")).toBe("ok")
    expect(toCellStatus("needs_attention")).toBe("attention")
    expect(toCellStatus("in_progress")).toBe("attention")
    expect(toCellStatus("error")).toBe("blocked")
  })
})

describe("buildHealthCells", () => {
  it("шесть ячеек со счётчиками, всё готово — все ok", () => {
    const cells = buildHealthCells(baseCells)
    expect(cells).toHaveLength(6)
    expect(cells.every((c) => c.status === "ok")).toBe(true)
    expect(cells.find((c) => c.label === "Weigh-in")?.id).toBe("weighin")
    expect(cells.find((c) => c.label === "Weigh-in")?.sub).toContain("3/4")
    expect(cells.find((c) => c.label === "Сетки")?.sub).toBe("3/3 готово")
    expect(cells.find((c) => c.label === "Судьи")?.sub).toBe("все назначены")
  })

  it("ошибка секции блокирует ячейку, внимание — подсвечивает", () => {
    const cells = buildHealthCells({
      ...baseCells,
      sections: {
        ...ready,
        participants: "error",
        judges: "needs_attention",
        schedule: "in_progress",
      },
      unrefereedCount: 5,
    })
    expect(cells.find((c) => c.label === "Check-in")?.status).toBe("blocked")
    expect(cells.find((c) => c.label === "Судьи")?.status).toBe("attention")
    expect(cells.find((c) => c.label === "Судьи")?.sub).toBe("без судьи: 5")
    expect(cells.find((c) => c.label === "Расписание")?.status).toBe("attention")
  })

  it("LIVE отражается в ячейке расписания", () => {
    const cells = buildHealthCells({ ...baseCells, liveCount: 3 })
    expect(cells.find((c) => c.label === "Расписание")?.sub).toContain("LIVE 3")
  })
})

describe("issuesToAttention", () => {
  const issues: TournamentIssue[] = [
    { id: "w", severity: "warn", title: "W", detail: "d", tab: "schedule", actionLabel: "A", target: "schedule" },
    { id: "e", severity: "error", title: "E", detail: "d", tab: "participants", actionLabel: "A", target: "participants" },
  ]

  it("ошибки первыми, формат HealthItem для AttentionPanel", () => {
    const items = issuesToAttention(issues)
    expect(items.map((i) => i.id)).toEqual(["e", "w"])
    expect(items[0]).toMatchObject({ severity: "error", text: "E", tab: "participants" })
  })

  it("пусто — пусто", () => {
    expect(issuesToAttention([])).toEqual([])
  })
})
