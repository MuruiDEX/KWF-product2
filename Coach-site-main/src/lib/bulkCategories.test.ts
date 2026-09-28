import { describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import {
  buildCategoriesCsv,
  bulkCheckinChunked,
  bulkUncheckChunked,
  formatBulkCheckinSummary,
  formatBulkUncheckSummary,
  type BulkCheckinResult,
  type BulkUncheckResult,
} from "@/lib/bulkCategories"

vi.mock("@/lib/api", () => ({ api: vi.fn() }))

describe("buildCategoriesCsv", () => {
  it("builds header + rows with BOM and escaping", () => {
    const csv = buildCategoriesCsv(
      [
        {
          name: "Мальчики",
          athletes: [
            { id: 1, last_name: "Иванов", first_name: "Иван", birth_date: "2015-01-01", club: "Барс", weight: "32", gender: "male" },
            { id: 2, last_name: "=Хакер", first_name: "А", birth_date: null, club: null, weight: "30", gender: "male" },
          ],
        },
      ],
      (id) => id === 1
    )
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("Иванов")
    expect(csv).toContain("Да")
    // formula-injection guard
    expect(csv).toContain("'=Хакер")
  })
})

describe("bulkCheckinChunked", () => {
  it("sends exactly one bulk request for small batches (no N single check-ins)", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockResolvedValue({
      requested: 3,
      updated: 3,
      already_checked_in: 0,
      failed: 0,
      errors: [],
    })
    const res = await bulkCheckinChunked(7, [12, 15, 18])
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(
      "/api/tournament/tournaments/7/bulk_checkin/",
      { method: "POST", body: JSON.stringify({ athlete_ids: [12, 15, 18] }) }
    )
    expect(res.updated).toBe(3)
  })

  it("splits >500 ids into sequential chunks and aggregates", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockImplementation(async (_url: string, opts?: RequestInit) => {
      const ids = JSON.parse(String(opts?.body ?? "{}")).athlete_ids as number[]
      return {
        requested: ids.length,
        updated: ids.length,
        already_checked_in: 0,
        failed: 0,
        errors: [],
      }
    })
    const ids = Array.from({ length: 1200 }, (_, i) => i + 1)
    const res = await bulkCheckinChunked(7, ids)
    expect(mocked).toHaveBeenCalledTimes(3)
    const sizes = mocked.mock.calls.map(
      (c) => (JSON.parse(String((c[1] as { body: string }).body)).athlete_ids as number[]).length
    )
    expect(sizes).toEqual([500, 500, 200])
    expect(res).toMatchObject({ requested: 1200, updated: 1200, failed: 0 })
  })

  it("dedupes ids and handles empty input without requests", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockResolvedValue({
      requested: 1,
      updated: 1,
      already_checked_in: 0,
      failed: 0,
      errors: [],
    })
    const res = await bulkCheckinChunked(7, [5, 5, 5])
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(res.requested).toBe(1)
    mocked.mockClear()
    const empty = await bulkCheckinChunked(7, [])
    expect(mocked).not.toHaveBeenCalled()
    expect(empty).toMatchObject({ requested: 0, updated: 0, failed: 0 })
  })

  it("retry subset is just chunked() over failed ids", async () => {    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockResolvedValue({
      requested: 2,
      updated: 2,
      already_checked_in: 0,
      failed: 0,
      errors: [],
    })
    const res = await bulkCheckinChunked(7, [9, 10])
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(
      "/api/tournament/tournaments/7/bulk_checkin/",
      { method: "POST", body: JSON.stringify({ athlete_ids: [9, 10] }) }
    )
    expect(res.failed).toBe(0)
  })
})

describe("formatBulkCheckinSummary", () => {
  const base: BulkCheckinResult = {
    requested: 0,
    updated: 0,
    already_checked_in: 0,
    failed: 0,
    errors: [],
  }

  it("all success", () => {
    expect(formatBulkCheckinSummary({ ...base, requested: 5, updated: 5 })).toEqual({
      ok: true,
      text: "Явка обновлена: успешно 5.",
    })
  })

  it("success with already checked-in", () => {
    const s = formatBulkCheckinSummary({
      ...base,
      requested: 5,
      updated: 3,
      already_checked_in: 2,
    })
    expect(s.ok).toBe(true)
    expect(s.text).toContain("успешно 3")
    expect(s.text).toContain("уже были отмечены 2")
  })

  it("partial failure shows names with reasons, falls back to #id", () => {
    const s = formatBulkCheckinSummary(
      {
        ...base,
        requested: 4,
        updated: 2,
        failed: 2,
        errors: [
          { athlete_id: 9, error: "Спортсмен не найден." },
          { athlete_id: 10, error: "Спортсмен не заявлен на турнир." },
        ],
      },
      new Map([[9, "Иванов Иван"]])
    )
    expect(s.ok).toBe(false)
    expect(s.text).toContain("Обработано 4")
    expect(s.text).toContain("успешно 2")
    expect(s.text).toContain("ошибок 2")
    expect(s.text).toContain("Иванов Иван (Спортсмен не найден.)")
    expect(s.text).toContain("#10 (Спортсмен не заявлен на турнир.)")
  })
})

describe("bulkUncheckChunked", () => {
  it("sends exactly one bulk_uncheck request for small batches", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockResolvedValue({
      requested: 2,
      updated: 2,
      already_unchecked: 0,
      failed: 0,
      errors: [],
    })
    const res = await bulkUncheckChunked(7, [12, 15])
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(mocked).toHaveBeenCalledWith(
      "/api/tournament/tournaments/7/bulk_uncheck/",
      { method: "POST", body: JSON.stringify({ athlete_ids: [12, 15] }) }
    )
    expect(res.updated).toBe(2)
  })

  it("splits >500 ids and aggregates already_unchecked", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    mocked.mockImplementation(async (_url: string, opts?: RequestInit) => {
      const ids = JSON.parse(String(opts?.body ?? "{}")).athlete_ids as number[]
      return {
        requested: ids.length,
        updated: ids.length - 1,
        already_unchecked: 1,
        failed: 0,
        errors: [],
      }
    })
    const res = await bulkUncheckChunked(7, Array.from({ length: 600 }, (_, i) => i + 1))
    expect(mocked).toHaveBeenCalledTimes(2)
    expect(res).toMatchObject({ requested: 600, updated: 598, already_unchecked: 2, failed: 0 })
  })

  it("empty input makes zero requests", async () => {
    const mocked = vi.mocked(api)
    mocked.mockClear()
    const res = await bulkUncheckChunked(7, [])
    expect(mocked).not.toHaveBeenCalled()
    expect(res).toMatchObject({ requested: 0, updated: 0, failed: 0 })
  })
})

describe("formatBulkUncheckSummary", () => {
  const base: BulkUncheckResult = {
    requested: 0,
    updated: 0,
    already_unchecked: 0,
    failed: 0,
    errors: [],
  }

  it("all success", () => {
    expect(formatBulkUncheckSummary({ ...base, requested: 4, updated: 4 })).toEqual({
      ok: true,
      text: "Явка снята: успешно 4.",
    })
  })

  it("success with already unchecked", () => {
    const s = formatBulkUncheckSummary({ ...base, requested: 4, updated: 2, already_unchecked: 2 })
    expect(s.ok).toBe(true)
    expect(s.text).toContain("успешно 2")
    expect(s.text).toContain("уже была снята 2")
  })

  it("partial failure shows names with reasons", () => {
    const s = formatBulkUncheckSummary(
      {
        ...base,
        requested: 3,
        updated: 1,
        failed: 2,
        errors: [
          { athlete_id: 9, error: "Спортсмен не найден." },
          { athlete_id: 10, error: "Спортсмен не заявлен на турнир." },
        ],
      },
      new Map([[10, "Петров Пётр"]])
    )
    expect(s.ok).toBe(false)
    expect(s.text).toContain("Обработано 3")
    expect(s.text).toContain("ошибок 2")
    expect(s.text).toContain("Петров Пётр (Спортсмен не заявлен на турнир.)")
    expect(s.text).toContain("#9 (Спортсмен не найден.)")
  })
})
