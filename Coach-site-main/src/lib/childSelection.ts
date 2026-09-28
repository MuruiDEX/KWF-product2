"use client"

// Чистые операции выбора поверх отфильтрованного списка:
// модель выбора — Set/array id, область — явный набор id.
// Пагинация никогда не расширяет область: страница передаёт свои id.

/** Переключить один id. Возвращает новый массив (порядок: старые + новый). */
export function toggleSelectedId(selected: number[], id: number): number[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
}

/** Выбрать область (страница или весь filtered-сет): добавить недостающие. */
export function selectScope(selected: number[], scopeIds: number[]): number[] {
  const set = new Set(selected)
  for (const id of scopeIds) set.add(id)
  return [...set]
}

/** Снять область (страница): убрать только её id, остальное не трогать. */
export function deselectScope(selected: number[], scopeIds: number[]): number[] {
  const scope = new Set(scopeIds)
  return selected.filter((s) => !scope.has(s))
}

/** Сколько id страницы уже выбрано (для состояния тулбара). */
export function countSelectedOnPage(selected: number[], pageIds: number[]): number {
  const set = new Set(selected)
  let n = 0
  for (const id of pageIds) if (set.has(id)) n += 1
  return n
}
