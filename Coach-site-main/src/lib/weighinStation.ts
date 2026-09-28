import { matchAthleteName } from "@/lib/participants"
import { parseWeightLimit } from "@/lib/weight"

// Чистая логика Weigh-in Station: очередь, валидация, прогресс.
// Сохранение — через существующий single-checkin endpoint (см. CheckinPanel),
// здесь только решение ЧТО и В КАКОМ ПОРЯДКЕ взвешивать.

export interface StationRosterEntry {
  id: number
  name: string
  categories: { id: number; name: string; weightMax: number | null }[]
}

export type WeightValidation =
  | { ok: true; value: number }
  | { ok: false; error: string }

/** Валидация ввода веса — зеркало backend (Decimal parse, вес > 0,
 * Decimal(5,2) → максимум 999.99). Пустое/NaN/отрицательное не уходят в сеть. */
export function validateWeight(raw: string): WeightValidation {
  const value = raw.replace(",", ".").trim()
  if (value === "") return { ok: false, error: "Введите вес" }
  const num = Number(value)
  if (!Number.isFinite(num)) return { ok: false, error: "Некорректный вес" }
  if (num <= 0) return { ok: false, error: "Вес должен быть положительным" }
  if (num > 999.99) return { ok: false, error: "Слишком большой вес" }
  return { ok: true, value: Math.round(num * 100) / 100 }
}

/** Очередь станции: full roster → search → невзвешенные первыми (стабильно).
 * Взвешенные не выбрасываются — их можно найти поиском и перевзвесить. */
export function buildStationQueue(
  roster: StationRosterEntry[],
  weighedIds: { has(id: number): boolean },
  query: string
): number[] {
  const q = query.trim()
  const isWeighed = (id: number) => weighedIds.has(id)
  const matched = roster.filter((r) => (q ? matchAthleteName(r.name, q) : true))
  const unweighed = matched.filter((r) => !isWeighed(r.id)).map((r) => r.id)
  const weighed = matched.filter((r) => isWeighed(r.id)).map((r) => r.id)
  return [...unweighed, ...weighed]
}

/** Следующий невзвешенный после current (без current — первый).
 * Сначала вперёд по очереди, затем с начала (оператор мог пропускать
 * через поиск). Нет невзвешенных — null (финальное состояние). */
export function nextUnweighedId(
  queueIds: number[],
  isWeighed: (id: number) => boolean,
  afterId?: number | null
): number | null {
  const start = afterId == null ? 0 : queueIds.indexOf(afterId) + 1
  for (let i = start; i < queueIds.length; i++) {
    if (!isWeighed(queueIds[i])) return queueIds[i]
  }
  for (let i = 0; i < Math.min(start, queueIds.length); i++) {
    if (!isWeighed(queueIds[i])) return queueIds[i]
  }
  return null
}

export interface StationProgress {
  total: number
  weighed: number
  unweighed: number
  overweight: number
}

/** Прогресс по weight_actual из regs. Пустой regs — нули, не ошибка. */
export function stationProgress(
  roster: StationRosterEntry[],
  weightOf: (id: number) => string | null | undefined,
  isOverweight: (id: number) => boolean
): StationProgress {
  let weighed = 0
  let overweight = 0
  for (const r of roster) {
    if (parseWeightLimit(weightOf(r.id) ?? null) === null) continue
    weighed += 1
    if (isOverweight(r.id)) overweight += 1
  }
  return {
    total: roster.length,
    weighed,
    unweighed: roster.length - weighed,
    overweight,
  }
}
