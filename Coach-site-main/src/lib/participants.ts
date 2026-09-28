// Чистые хелперы списка участников: поиск по имени, фильтры, пагинация.
// Используются CheckinPanel (view-level, данные уже загружены).

export type ParticipantFilter = "all" | "unchecked" | "unweighed" | "overweight"

export interface ParticipantFilterRow {
  id: number
  name: string
  checkedIn: boolean
  weighed: boolean
  overweight: boolean
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[\s\-–—]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Совпадение имени: каждый токен запроса — префикс какого-то токена имени.
 * Порядок не важен: «Петров Иван» находит «Иван Петров». */
export function matchAthleteName(name: string, query: string): boolean {
  const q = tokens(query)
  if (q.length === 0) return true
  const n = tokens(name)
  if (n.length === 0) return false
  return q.every((qt) => n.some((nt) => nt.startsWith(qt)))
}

export function filterParticipants(
  rows: ParticipantFilterRow[],
  query: string,
  filter: ParticipantFilter
): ParticipantFilterRow[] {
  const q = query.trim()
  return rows.filter((r) => {
    if (filter === "unchecked" && r.checkedIn) return false
    if (filter === "unweighed" && r.weighed) return false
    if (filter === "overweight" && !r.overweight) return false
    if (q && !matchAthleteName(r.name, q)) return false
    return true
  })
}

export interface ParticipantFilterCounts {
  all: number
  unchecked: number
  unweighed: number
  overweight: number
}

/** Счётчики — всегда по полному roster, не по странице. */
export function countParticipantFilters(rows: ParticipantFilterRow[]): ParticipantFilterCounts {
  let unchecked = 0
  let unweighed = 0
  let overweight = 0
  for (const r of rows) {
    if (!r.checkedIn) unchecked += 1
    if (!r.weighed) unweighed += 1
    if (r.overweight) overweight += 1
  }
  return { all: rows.length, unchecked, unweighed, overweight }
}

export const PARTICIPANT_PAGE_SIZE = 20

export function pageCountFor(total: number, pageSize: number = PARTICIPANT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Кламп текущей страницы при ужатии списка (фильтр/поиск/удаление). */
export function clampPage(page: number, total: number, pageSize: number = PARTICIPANT_PAGE_SIZE): number {
  return Math.min(Math.max(0, page), pageCountFor(total, pageSize) - 1)
}

export function paginateParticipants<T>(rows: T[], page: number, pageSize: number = PARTICIPANT_PAGE_SIZE): T[] {
  const safe = clampPage(page, rows.length, pageSize)
  return rows.slice(safe * pageSize, safe * pageSize + pageSize)
}

/** «Показано 1–20 из 184» — границы видимого диапазона. */
export function visibleRange(
  page: number,
  pageSize: number,
  total: number
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 }
  const safe = clampPage(page, total, pageSize)
  return { from: safe * pageSize + 1, to: Math.min(total, (safe + 1) * pageSize) }
}
