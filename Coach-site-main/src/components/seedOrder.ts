/** Чистые помощники порядка посева (без React): покрыты unit-тестами. */

/** Переместить id внутри порядка. Возвращает новый массив, вход не мутирует. */
export function moveSeedId(ids: number[], athleteId: number, dir: -1 | 1): number[] {
  const i = ids.indexOf(athleteId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const next = [...ids]
  next[i] = next[j]
  next[j] = athleteId
  return next
}

/** Перетащить id на позицию toIndex (HTML5 DnD). Индексы за границами — clamp. */
export function dropSeedId(ids: number[], athleteId: number, toIndex: number): number[] {
  const from = ids.indexOf(athleteId)
  if (from < 0 || ids.length < 2) return ids
  const to = Math.max(0, Math.min(toIndex, ids.length - 1))
  if (to === from) return ids
  const next = ids.filter((id) => id !== athleteId)
  next.splice(to, 0, athleteId)
  return next
}

/** Тот же состав (для валидации перед POST: backend требует точную перестановку). */
export function isSameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  if (set.size !== a.length) return false
  return b.every((id) => set.has(id))
}

/** Нормализовать порядок: убрать дубли, отбросить id вне состава. */
export function normalizeSeedOrder(ids: number[], memberIds: number[]): number[] {
  const members = new Set(memberIds)
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of ids) {
    if (members.has(id) && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}
