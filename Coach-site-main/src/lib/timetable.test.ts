import { describe, expect, it } from "vitest"
import {
  countByGroup,
  formatTimeShort,
  isTrainingSession,
  layoutDay,
  layoutWeek,
  normalizeSessions,
  parseTimeToMinutes,
  weekTimeBounds,
} from "@/lib/timetable"
import type { TrainingSession } from "@/lib/types"

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 1,
    day: 0,
    day_name: "Понедельник",
    start_time: "18:00:00",
    end_time: "19:30:00",
    group: "Средняя группа",
    kind: "Кекушинкай",
    trainer_name: "Иванов А.А.",
    room: "Зал 1",
    note: "",
    is_active: true,
    order: 0,
    ...overrides,
  }
}

describe("parseTimeToMinutes", () => {
  it("парсит HH:MM и HH:MM:SS из DRF", () => {
    expect(parseTimeToMinutes("18:00")).toBe(18 * 60)
    expect(parseTimeToMinutes("18:00:00")).toBe(18 * 60)
    expect(parseTimeToMinutes("09:05:30")).toBe(9 * 60 + 5)
  })
  it("возвращает null для мусора вместо исключений", () => {
    expect(parseTimeToMinutes(null)).toBeNull()
    expect(parseTimeToMinutes(undefined)).toBeNull()
    expect(parseTimeToMinutes(123)).toBeNull()
    expect(parseTimeToMinutes("")).toBeNull()
    expect(parseTimeToMinutes("25:00")).toBeNull()
    expect(parseTimeToMinutes("18:99")).toBeNull()
    expect(parseTimeToMinutes("вечер")).toBeNull()
  })
})

describe("normalizeSessions (причина TypeError)", () => {
  it("0 занятий: пустой массив, null, undefined, пустая пагинация", () => {
    expect(normalizeSessions([])).toEqual([])
    expect(normalizeSessions(null)).toEqual([])
    expect(normalizeSessions(undefined)).toEqual([])
    expect(normalizeSessions({ results: [] })).toEqual([])
    expect(normalizeSessions({ count: 0, next: null, previous: null, results: [] })).toEqual([])
  })
  it("пагинированный объект DRF разворачивается в массив", () => {
    const s = session()
    expect(
      normalizeSessions({ count: 1, next: null, previous: null, results: [s] })
    ).toEqual([s])
  })
  it("не-массив и мусор дают пустой массив, а не исключение", () => {
    expect(normalizeSessions({} as unknown)).toEqual([])
    expect(normalizeSessions("строка" as unknown)).toEqual([])
    expect(normalizeSessions(42 as unknown)).toEqual([])
  })
  it("пустые/неполные данные отбрасываются, валидные остаются", () => {
    const good = session({ id: 7 })
    const input = [
      good,
      null,
      undefined,
      { id: 8 }, // без дня/времени/группы
      session({ id: 9, day: 99 }), // день вне 0..6
      session({ id: 10, start_time: "вечер" }), // мусор во времени
      session({ id: 11, group: "   " }), // пустая группа
      session({ id: 12, end_time: null as unknown as string }),
    ]
    expect(normalizeSessions(input)).toEqual([good])
  })
})

describe("countByGroup (логика groups)", () => {
  it("1 занятие — одна группа", () => {
    expect(countByGroup([session()])).toEqual([{ group: "Средняя группа", count: 1 }])
  })
  it("несколько занятий одной группы считаются вместе", () => {
    const list = [session({ id: 1 }), session({ id: 2 }), session({ id: 3 })]
    expect(countByGroup(list)).toEqual([{ group: "Средняя группа", count: 3 }])
  })
  it("несколько групп сортируются по убыванию числа", () => {
    const list = [
      session({ id: 1, group: "B" }),
      session({ id: 2, group: "A" }),
      session({ id: 3, group: "B" }),
      session({ id: 4, group: "C" }),
    ]
    expect(countByGroup(list).map((g) => g.group)).toEqual(["B", "A", "C"])
  })
  it("пустой массив — пустой список групп", () => {
    expect(countByGroup([])).toEqual([])
  })
})

describe("layoutDay (позиционирование карточек)", () => {
  it("разные временные интервалы дают разные top", () => {
    const placed = layoutDay(
      [
        session({ id: 1, start_time: "10:00:00", end_time: "11:00:00" }),
        session({ id: 2, start_time: "18:00:00", end_time: "19:00:00" }),
      ],
      8 * 60
    )
    expect(placed).toHaveLength(2)
    expect(placed[1].top).toBeGreaterThan(placed[0].top)
    for (const p of placed) {
      expect(Number.isFinite(p.top)).toBe(true)
      expect(Number.isFinite(p.height)).toBe(true)
      expect(p.lanes).toBe(1)
    }
  })
  it("пересекающиеся занятия делят ширину (lanes=2, разные lane)", () => {
    const placed = layoutDay(
      [
        session({ id: 1, start_time: "18:00:00", end_time: "19:30:00" }),
        session({ id: 2, start_time: "18:10:00", end_time: "19:10:00" }),
      ],
      8 * 60
    )
    expect(placed).toHaveLength(2)
    expect(placed[0].lanes).toBe(2)
    expect(placed[1].lanes).toBe(2)
    expect(placed[0].lane).not.toBe(placed[1].lane)
  })
  it("непересекающиеся занятия переиспользуют lane 0", () => {
    const placed = layoutDay(
      [
        session({ id: 1, start_time: "10:00:00", end_time: "11:00:00" }),
        session({ id: 2, start_time: "12:00:00", end_time: "13:00:00" }),
      ],
      8 * 60
    )
    expect(placed.map((p) => p.lane)).toEqual([0, 0])
    expect(placed.map((p) => p.lanes)).toEqual([1, 1])
  })
})

describe("layoutWeek (распределение по колонкам-дням)", () => {
  it("занятия попадают в свои дни, остальные колонки пустые", () => {
    const byDay = layoutWeek(
      [
        session({ id: 1, day: 0 }),
        session({ id: 2, day: 2 }),
        session({ id: 3, day: 2 }),
      ],
      8 * 60
    )
    expect(byDay).toHaveLength(7)
    expect(byDay[0].map((p) => p.id)).toEqual([1])
    expect(byDay[1]).toEqual([])
    expect(byDay[2].map((p) => p.id).sort()).toEqual([2, 3])
  })
})

describe("weekTimeBounds", () => {
  it("пустой список даёт дефолт 8:00–21:00", () => {
    expect(weekTimeBounds([])).toEqual({ dayStart: 8 * 60, dayEnd: 21 * 60 })
  })
  it("границы выравниваются по часам вокруг занятий (минимум 4 часа)", () => {
    const bounds = weekTimeBounds([
      session({ start_time: "18:00:00", end_time: "19:30:00" }),
    ])
    expect(bounds.dayStart).toBe(18 * 60)
    // 18:00–20:00 короче 4 часов, поэтому hi растягивается до 22:00
    expect(bounds.dayEnd).toBe(22 * 60)
  })
})

describe("isTrainingSession + formatTimeShort", () => {
  it("валидная сессия проходит guard", () => {
    expect(isTrainingSession(session())).toBe(true)
  })
  it("формат времени безопасен", () => {
    expect(formatTimeShort("12:09:00")).toBe("12:09")
    expect(formatTimeShort(null)).toBe("—")
  })
})
