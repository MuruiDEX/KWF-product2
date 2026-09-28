import { matchAthleteName } from "@/lib/participants"

// Чистая логика inline-назначения судьи: полный список кандидатов
// → поиск → render. Без пагинации: кандидатов мало (тренеры + staff).

export interface RefereeCandidate {
  id: number
  name: string
}

/** Поиск судьи по имени/фамилии: case-insensitive, частичное совпадение
 * через общий токен-матчер (порядок не важен, «ё» нормализуется).
 * Пример: «иван» находит и «Иван Петров», и «Иванов Артём». */
export function filterRefereeCandidates(
  candidates: RefereeCandidate[],
  query: string
): RefereeCandidate[] {
  const q = query.trim()
  if (!q) return [...candidates]
  return candidates.filter((c) => matchAthleteName(c.name, q))
}
