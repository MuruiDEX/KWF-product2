import type { TrainingSession } from "@/lib/types"

/** Пикселей на минуту — высота блока пропорциональна длительности. */
export const PX_PER_MIN = 1.2
export const MIN_BLOCK_H = 64

/** День недели в терминах API: 0 = понедельник … 6 = воскресенье. */
export const WEEK_DAYS = 7

/**
 * Строгий парсинг времени "HH:MM" / "HH:MM:SS" (так сериализует DRF TimeField).
 * Возвращает минуты от полуночи или null для любого невалидного входа
 * (null/undefined/число/мусор/час вне 0–23/минуты вне 0–59).
 */
export function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null
  const m = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const sec = m[3] !== undefined ? Number(m[3]) : 0
  if (
    !Number.isInteger(h) ||
    !Number.isInteger(min) ||
    !Number.isInteger(sec) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59 ||
    sec < 0 ||
    sec > 59
  ) {
    return null
  }
  return h * 60 + min
}

/** Короткий формат для подписей: "12:09:00" -> "12:09", мусор -> "—". */
export function formatTimeShort(value: unknown): string {
  const mins = parseTimeToMinutes(value)
  if (mins === null) return "—"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Type guard сырой записи расписания.
 * Отсекает null/не-объекты, неизвестный день, пустую группу,
 * непарсящиеся start_time/end_time. Такие записи не могут быть
 * размещены ни в одной колонке и ни в одном временном интервале,
 * поэтому в сетку они не попадают.
 */
export function isTrainingSession(value: unknown): value is TrainingSession {
  if (typeof value !== "object" || value === null) return false
  const s = value as Record<string, unknown>
  if (typeof s.id !== "number" || !Number.isFinite(s.id)) return false
  if (typeof s.day !== "number" || !Number.isInteger(s.day) || s.day < 0 || s.day >= WEEK_DAYS) {
    return false
  }
  if (typeof s.group !== "string" || s.group.trim() === "") return false
  if (parseTimeToMinutes(s.start_time) === null) return false
  if (parseTimeToMinutes(s.end_time) === null) return false
  return true
}

/** Сырой источник списка: массив, DRF-пагинация, null/undefined/мусор. */
export type SessionSource =
  | TrainingSession[]
  | { results?: unknown }
  | null
  | undefined

/**
 * Нормализация границы API -> компонент.
 * Всегда возвращает массив только валидных сессий.
 * Именно здесь не-массив превращается в массив, а не в `for..of`.
 */
export function normalizeSessions(input: SessionSource | unknown): TrainingSession[] {
  if (!input) return []
  const raw: unknown = Array.isArray(input)
    ? input
    : typeof input === "object" && input !== null && Array.isArray((input as { results?: unknown }).results)
      ? (input as { results: unknown[] }).results
      : []
  if (!Array.isArray(raw)) return []
  return raw.filter(isTrainingSession)
}

export interface GroupCount {
  group: string
  count: number
}

/**
 * Группировка для фильтра-пилюль: группы по убыванию числа занятий.
 * Принимает только валидный массив — пустой массив даёт пустой список.
 */
export function countByGroup(sessions: TrainingSession[]): GroupCount[] {
  const counts = new Map<string, number>()
  for (const s of sessions) counts.set(s.group, (counts.get(s.group) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([group, count]) => ({ group, count }))
}

export interface Placed extends TrainingSession {
  top: number
  height: number
  lane: number
  lanes: number
}

/**
 * Раскладка пересекающихся занятий одного дня по соседним колонкам.
 * Позиционирование (top/height/lane/lanes) — как было: first-fit lanes,
 * пересекающиеся группы делят ширину поровну. Невалидные записи
 * отбрасываются до раскладки, поэтому top/height всегда конечные числа.
 */
export function layoutDay(sessions: TrainingSession[], dayStart: number): Placed[] {
  const valid = sessions.filter(isTrainingSession)
  const sorted = [...valid].sort((a, b) => {
    const sa = parseTimeToMinutes(a.start_time) ?? 0
    const sb = parseTimeToMinutes(b.start_time) ?? 0
    if (sa !== sb) return sa - sb
    const ea = parseTimeToMinutes(a.end_time) ?? 0
    const eb = parseTimeToMinutes(b.end_time) ?? 0
    return ea - eb
  })
  const lanesEnd: number[] = []
  const placed: (Placed & { end: number })[] = []
  for (const s of sorted) {
    const start = parseTimeToMinutes(s.start_time) ?? 0
    const rawEnd = parseTimeToMinutes(s.end_time) ?? start
    const end = Math.max(rawEnd, start + 15)
    let lane = lanesEnd.findIndex((e) => e <= start)
    if (lane === -1) {
      lane = lanesEnd.length
      lanesEnd.push(end)
    } else {
      lanesEnd[lane] = end
    }
    placed.push({
      ...s,
      top: (start - dayStart) * PX_PER_MIN,
      height: Math.max((end - start) * PX_PER_MIN, MIN_BLOCK_H),
      lane,
      lanes: 1,
      end,
    })
  }
  // Группы пересечений делят ширину поровну.
  let i = 0
  while (i < placed.length) {
    let j = i
    let groupEnd = placed[i].end
    while (
      j + 1 < placed.length &&
      (parseTimeToMinutes(placed[j + 1].start_time) ?? 0) < groupEnd
    ) {
      j++
      groupEnd = Math.max(groupEnd, placed[j].end)
    }
    const group = placed.slice(i, j + 1)
    const lanes = Math.max(...group.map((p) => p.lane)) + 1
    for (const p of group) p.lanes = lanes
    i = j + 1
  }
  return placed
}

/** Разложить отфильтрованные сессии по 7 колонкам-дням. */
export function layoutWeek(
  sessions: TrainingSession[],
  dayStart: number
): Placed[][] {
  const map: Placed[][] = Array.from({ length: WEEK_DAYS }, () => [])
  for (let d = 0; d < WEEK_DAYS; d++) {
    map[d] = layoutDay(
      sessions.filter((s) => s.day === d),
      dayStart
    )
  }
  return map
}

/** Границы временной шкалы по отфильтрованным сессиям (как было). */
export function weekTimeBounds(sessions: TrainingSession[]): {
  dayStart: number
  dayEnd: number
} {
  let lo = 8 * 60
  let hi = 21 * 60
  if (sessions.length > 0) {
    const starts = sessions
      .map((s) => parseTimeToMinutes(s.start_time))
      .filter((v): v is number => v !== null)
    const ends = sessions
      .map((s) => parseTimeToMinutes(s.end_time))
      .filter((v): v is number => v !== null)
    if (starts.length > 0) lo = Math.min(...starts)
    if (ends.length > 0) hi = Math.max(...ends)
    lo = Math.max(7 * 60, Math.floor(lo / 60) * 60)
    hi = Math.min(22 * 60, Math.ceil(hi / 60) * 60)
    if (hi - lo < 4 * 60) hi = lo + 4 * 60
  }
  return { dayStart: lo, dayEnd: hi }
}
