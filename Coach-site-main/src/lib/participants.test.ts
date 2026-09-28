import { describe, expect, it } from "vitest"
import {
  clampPage,
  countParticipantFilters,
  filterParticipants,
  matchAthleteName,
  pageCountFor,
  paginateParticipants,
  PARTICIPANT_PAGE_SIZE,
  visibleRange,
  type ParticipantFilterRow,
} from "@/lib/participants"

const row = (over: Partial<ParticipantFilterRow> & { id: number }): ParticipantFilterRow => ({
  name: `A${over.id}`,
  checkedIn: false,
  weighed: false,
  overweight: false,
  ...over,
})

describe("matchAthleteName", () => {
  it("matches first, last and full name case-insensitively", () => {
    expect(matchAthleteName("Иван Петров", "иван")).toBe(true)
    expect(matchAthleteName("Иван Петров", "ПЕТРОВ")).toBe(true)
    expect(matchAthleteName("Иван Петров", "Иван Петров")).toBe(true)
    expect(matchAthleteName("Иванов Артём", "иван")).toBe(true)
  })

  it("matches reversed order", () => {
    expect(matchAthleteName("Иван Петров", "Петров Иван")).toBe(true)
  })

  it("rejects non-matching and requires all tokens", () => {
    expect(matchAthleteName("Иван Петров", "сидоров")).toBe(false)
    expect(matchAthleteName("Иван Петров", "иван сидоров")).toBe(false)
    expect(matchAthleteName("", "иван")).toBe(false)
  })

  it("empty query matches everything", () => {
    expect(matchAthleteName("Иван Петров", "  ")).toBe(true)
  })

  it("handles long names", () => {
    const name = "Александр Сергеевич Пушкин-Водкин"
    expect(matchAthleteName(name, "пушкин")).toBe(true)
    expect(matchAthleteName(name, "сергеевич александр")).toBe(true)
  })
})

describe("filterParticipants", () => {
  const rowsUnique = [
    row({ id: 1, name: "Иван Петров", checkedIn: true, weighed: true }),
    row({ id: 2, name: "Иванов Артём", checkedIn: false, weighed: false }),
    row({ id: 3, name: "Сидоров Ким", checkedIn: true, weighed: true, overweight: true }),
  ]

  it("empty search returns all", () => {
    expect(filterParticipants(rowsUnique, "", "all")).toHaveLength(3)
  })

  it("combines search with filter", () => {
    expect(filterParticipants(rowsUnique, "сидоров", "overweight")).toHaveLength(1)
    expect(filterParticipants(rowsUnique, "иван", "unchecked").map((r) => r.id)).toEqual([2])
  })

  it("filters by status", () => {
    expect(filterParticipants(rowsUnique, "", "unchecked").map((r) => r.id)).toEqual([2])
    expect(filterParticipants(rowsUnique, "", "unweighed").map((r) => r.id)).toEqual([2])
    expect(filterParticipants(rowsUnique, "", "overweight").map((r) => r.id)).toEqual([3])
  })

  it("same names all match", () => {
    const dupes = [
      row({ id: 1, name: "Иван Петров" }),
      row({ id: 2, name: "Иван Петров" }),
    ]
    expect(filterParticipants(dupes, "иван петров", "all")).toHaveLength(2)
  })

  it("empty results", () => {
    expect(filterParticipants(rowsUnique, "никого", "all")).toEqual([])
  })
})

describe("countParticipantFilters", () => {
  it("counts over full roster", () => {
    expect(
      countParticipantFilters([
        row({ id: 1, checkedIn: true, weighed: true }),
        row({ id: 2, weighed: false }),
        row({ id: 3, checkedIn: true, weighed: true, overweight: true }),
      ])
    ).toEqual({ all: 3, unchecked: 1, unweighed: 1, overweight: 1 })
  })

  it("empty roster", () => {
    expect(countParticipantFilters([])).toEqual({ all: 0, unchecked: 0, unweighed: 0, overweight: 0 })
  })
})

describe("pagination", () => {
  const rows = Array.from({ length: 45 }, (_, i) => row({ id: i + 1, name: `A${i + 1}` }))

  it("pageCountFor boundaries: 0/1/20/21/100+", () => {
    expect(pageCountFor(0)).toBe(1)
    expect(pageCountFor(1)).toBe(1)
    expect(pageCountFor(20)).toBe(1)
    expect(pageCountFor(21)).toBe(2)
    expect(pageCountFor(184)).toBe(10)
  })

  it("paginate slices pages", () => {
    expect(paginateParticipants(rows, 0)).toHaveLength(20)
    expect(paginateParticipants(rows, 2)).toHaveLength(5)
    expect(paginateParticipants(rows, 2)[0].id).toBe(41)
  })

  it("clamps out-of-range page after shrink", () => {
    expect(clampPage(9, 21)).toBe(1)
    expect(clampPage(-3, 45)).toBe(0)
    expect(clampPage(0, 0)).toBe(0)
  })

  it("visibleRange text bounds", () => {
    expect(visibleRange(0, PARTICIPANT_PAGE_SIZE, 184)).toEqual({ from: 1, to: 20 })
    expect(visibleRange(9, PARTICIPANT_PAGE_SIZE, 184)).toEqual({ from: 181, to: 184 })
    expect(visibleRange(0, PARTICIPANT_PAGE_SIZE, 0)).toEqual({ from: 0, to: 0 })
    expect(visibleRange(5, PARTICIPANT_PAGE_SIZE, 21)).toEqual({ from: 21, to: 21 })
  })
})
