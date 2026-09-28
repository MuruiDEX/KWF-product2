import { describe, expect, it } from "vitest"
import {
  buildIcs,
  nextWeekday,
  sessionToIcs,
  tournamentToIcs,
} from "@/lib/ics"

describe("tournamentToIcs", () => {
  it("all-day без времени", () => {
    const e = tournamentToIcs({
      id: 1,
      slug: "cup",
      name: "Кубок",
      start_date: "2026-10-01",
      end_date: "2026-10-02",
    })
    expect(e?.allDay).toBe(true)
    const ics = buildIcs([e!])
    expect(ics).toContain("DTSTART;VALUE=DATE:20261001")
    // DTEND exclusive → +1 день.
    expect(ics).toContain("DTEND;VALUE=DATE:20261003")
    expect(ics).toContain("SUMMARY:Кубок")
  })

  it("со временем и местом", () => {
    const e = tournamentToIcs({
      id: 2,
      name: "Кубок",
      location: "Зал 1",
      start_date: "2026-10-01",
      start_time: "10:00:00",
      end_date: "2026-10-01",
      end_time: "18:00:00",
    })
    expect(e?.allDay).toBe(false)
    const ics = buildIcs([e!])
    expect(ics).toContain("DTSTART:20261001T100000")
    expect(ics).toContain("DTEND:20261001T180000")
    expect(ics).toContain("LOCATION:Зал 1")
  })

  it("битая дата → null", () => {
    expect(
      tournamentToIcs({ id: 3, name: "X", start_date: "мусор", end_date: "" })
    ).toBeNull()
  })
})

describe("sessionToIcs", () => {
  // Понедельник 2026-09-14.
  const monday = new Date(2026, 8, 14, 12, 0, 0)

  it("ближайший понедельник", () => {
    const e = sessionToIcs(
      {
        id: 5,
        day: 0,
        group: "Средняя",
        kind: "Кекушинкай",
        start_time: "18:00",
        end_time: "19:30",
      },
      monday
    )
    expect(e).not.toBeNull()
    const ics = buildIcs([e!])
    expect(ics).toContain("DTSTART:20260914T180000")
    expect(ics).toContain("DTEND:20260914T193000")
    expect(ics).toContain("Средняя")
  })

  it("воскресенье от понедельника → +6 дней", () => {
    const e = sessionToIcs(
        { id: 6, day: 6, group: "G", start_time: "10:00", end_time: "11:00" },
      monday
    )
    expect(buildIcs([e!])).toContain("DTSTART:20260920T100000")
  })

  it("невалидный день/время → null", () => {
    expect(
      sessionToIcs({ id: 7, day: 9, group: "G", start_time: "10:00", end_time: "11:00" })
    ).toBeNull()
    expect(
      sessionToIcs({ id: 8, day: 1, group: "G", start_time: "xx", end_time: "11:00" })
    ).toBeNull()
  })
})

describe("buildIcs", () => {
  it("экранирует , ; и переносы, режет длинные строки", () => {
    const ics = buildIcs([
      {
        uid: "x@kwf",
        title: "Иван, Петров; лучший\nvan",
        start: new Date(2026, 9, 1, 10, 0, 0),
        end: new Date(2026, 9, 1, 11, 0, 0),
      },
    ])
    expect(ics).toContain("SUMMARY:Иван\\, Петров\\; лучший\\nvan")
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
    const long = buildIcs([
      {
        uid: "y@kwf",
        title: "А".repeat(100),
        start: new Date(2026, 9, 1, 10, 0, 0),
        end: new Date(2026, 9, 1, 11, 0, 0),
      },
    ])
    for (const line of long.split("\r\n")) {
      // continuation-строки: 1 пробел + ≤74 символа.
      expect(line.length).toBeLessThanOrEqual(75)
    }
  })

  it("nextWeekday: 0=Пн", () => {
    // 2026-09-14 — понедельник.
    expect(nextWeekday(0, new Date(2026, 8, 14))).toEqual(new Date(2026, 8, 14))
    expect(nextWeekday(2, new Date(2026, 8, 14))).toEqual(new Date(2026, 8, 16))
  })
})
