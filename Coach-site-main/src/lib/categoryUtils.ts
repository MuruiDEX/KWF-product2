/** N13: автоназвания категорий и детект пересечений диапазонов.
 * Чистые функции — покрыты тестами. Пересечение считается только
 * при общем поле (any пересекается с male/female). */

export interface CategoryRange {
  id: number | string
  name?: string | null
  gender: string
  age_min: number
  age_max: number
  weight_min?: number | string | null
  weight_max: number | string
}

const GENDER_LABEL: Record<string, string> = {
  male: "Мальчики",
  female: "Девочки",
  any: "Смешанная",
}

function num(v: number | string | null | undefined, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : (v ?? fallback)
  return Number.isFinite(n) ? (n as number) : fallback
}

/** "Мальчики / 14–15 / 30–60 кг" (нижняя граница опускается при 0). */
export function autoCategoryName(cat: CategoryRange): string {
  const gender = GENDER_LABEL[cat.gender] ?? cat.gender
  const wMin = num(cat.weight_min, 0)
  const wMax = num(cat.weight_max, 0)
  const weight = wMin > 0 ? `${wMin}–${wMax} кг` : `до ${wMax} кг`
  const explicit = cat.name?.trim()
  if (explicit) return explicit
  return `${gender} / ${cat.age_min}–${cat.age_max} / ${weight}`
}

function rangesIntersect(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax)
}

function gendersIntersect(a: string, b: string): boolean {
  return a === "any" || b === "any" || a === b
}

export interface CategoryOverlap {
  aId: number | string
  bId: number | string
  aName: string
  bName: string
}

/** Пары категорий с пересекающимися диапазонами (предупреждение, не блок). */
export function findCategoryOverlaps(cats: CategoryRange[]): CategoryOverlap[] {
  const out: CategoryOverlap[] = []
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      const a = cats[i]
      const b = cats[j]
      if (!gendersIntersect(a.gender, b.gender)) continue
      if (!rangesIntersect(a.age_min, a.age_max, b.age_min, b.age_max)) continue
      const aWMin = num(a.weight_min, 0)
      const bWMin = num(b.weight_min, 0)
      if (!rangesIntersect(aWMin, num(a.weight_max, 0), bWMin, num(b.weight_max, 0))) continue
      out.push({ aId: a.id, bId: b.id, aName: autoCategoryName(a), bName: autoCategoryName(b) })
    }
  }
  return out
}
