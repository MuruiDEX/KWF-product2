// Чистые весовые хелперы weigh-in: парсинг лимитов и перевес.
// Вынесено из CheckinPanel для переиспользования в control-center
// (та же семантика везде: мусор = нет лимита/веса, строжайший лимит).

/** Парсинг лимита веса ("40", "40,5", 40) → кг. Мусор = null (без лимита). */
export function parseWeightLimit(
  raw: string | number | null | undefined
): number | null {
  if (raw === null || raw === undefined) return null
  const text = String(raw).replace(",", ".").trim()
  if (text === "") return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export interface OverweightInfo {
  over: boolean
  /** Строжайший лимит среди категорий (кг). */
  limit: number | null
  /** Превышение над лимитом (кг). */
  excess: number | null
  /** Категория строжайшего лимита. */
  categoryName: string | null
}

/** Перевес: фактический вес против строжайшего лимита категорий.
 * weightActual — строка из input ("", "52,5"). Без веса/лимита — не перевес. */
export function checkOverweight(
  weightActual: string | null | undefined,
  categories: { name: string; weightMax: number | null }[]
): OverweightInfo {
  const none: OverweightInfo = {
    over: false,
    limit: null,
    excess: null,
    categoryName: null,
  }
  const actual = parseWeightLimit(weightActual)
  if (actual === null) return none
  let best: { name: string; weightMax: number } | null = null
  for (const c of categories) {
    if (c.weightMax === null) continue
    if (best === null || c.weightMax < best.weightMax) {
      best = { name: c.name, weightMax: c.weightMax }
    }
  }
  if (best === null) return none
  if (actual <= best.weightMax) return none
  return {
    over: true,
    limit: best.weightMax,
    excess: Math.round((actual - best.weightMax) * 100) / 100,
    categoryName: best.name,
  }
}
