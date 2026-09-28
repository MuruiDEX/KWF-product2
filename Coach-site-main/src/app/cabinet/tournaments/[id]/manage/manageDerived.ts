import { parseWeightLimit } from "@/lib/weight"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { Tatami, TournamentCategory } from "@/lib/types"
import type { CategoryDrawerData } from "./_components/CategoryDrawer"

// Производные данные /manage: чистые функции поверх уже загруженных
// payload (новых fetch нет). Раньше жили мемоидами в god-компоненте page.tsx.

export interface WeighinRosterEntry {
  id: number
  name: string
  categories: {
    id: number
    name: string
    weightMax: number | null
  }[]
  meta?: {
    gender?: string | null
    age?: number | null
    club?: string | null
  }
}

export interface CategoryRow {
  id: number
  name: string
  count: number
  checkedIn: number | null
  weighed: number | null
  overweight: number
  fights: number | null
  hasBracket: boolean
  tatamiName: string
  status: "waiting" | "active" | "finished"
  statusLabel: string
  canGenerate: boolean
}

/** Ростер взвешивания: id → категории с лимитами. Детерминированный порядок. */
export function buildWeighinRoster(
  sortedCats: TournamentCategory[]
): WeighinRosterEntry[] {
  const seen = new Map<number, WeighinRosterEntry>()
  for (const c of sortedCats) {
    const limit = parseWeightLimit(
      (c as { weight_max?: string | number }).weight_max
    )
    for (const a of c.athletes || []) {
      let entry = seen.get(a.id)
      if (!entry) {
        entry = {
          id: a.id,
          name: `${a.last_name} ${a.first_name}`,
          categories: [],
          meta: {
            gender: a.gender ?? null,
            age: typeof a.age === "number" ? a.age : null,
            club: a.club ?? null,
          },
        }
        seen.set(a.id, entry)
      }
      entry.categories.push({
        id: c.id,
        name: c.name,
        weightMax: limit,
      })
    }
  }
  // Детерминированный порядок для оператора и e2e (бэкенд порядок не гарантирует).
  return [...seen.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ru")
  )
}

/** Строки таблицы категорий: состав, явка, взвешивание, сетки, татами. */
export function buildCategoryRows(args: {
  sortedCats: TournamentCategory[]
  regs: RegistrationEntry[] | null
  regsById: Map<number, boolean>
  weightById: Map<number, string | null>
  tatamis: Tatami[]
}): CategoryRow[] {
  const { sortedCats, regs, regsById, weightById, tatamis } = args
  return sortedCats.map((cat) => {
    const members = cat.athletes || []
    const n = members.length
    const hasBracket = (cat.rounds || []).length > 0
    const matches = (cat.rounds || []).flatMap((r) => r.matches || [])
    const left = matches.filter((m) => m.status !== "finished" && m.status !== "bye").length
    const limit = parseWeightLimit(
      (cat as { weight_max?: string | number }).weight_max
    )
    let weighed: number | null = null
    let overweight = 0
    if (regs) {
      weighed = 0
      for (const a of members) {
        const actual = parseWeightLimit(weightById.get(a.id) ?? null)
        if (actual === null) continue
        weighed += 1
        if (limit !== null && actual > limit) overweight += 1
      }
    }
    return {
      id: cat.id,
      name: cat.name,
      count: n,
      checkedIn: regs ? members.filter((a) => regsById.get(a.id)).length : null,
      weighed,
      overweight,
      fights: hasBracket ? matches.filter((m) => m.status !== "bye").length : null,
      hasBracket,
      tatamiName: tatamis.find((t) => t.id === cat.tatami)?.name ?? "—",
      status: (!hasBracket ? "waiting" : left === 0 ? "finished" : "active") as
        | "waiting"
        | "active"
        | "finished",
      statusLabel: !hasBracket ? "Без сетки" : left === 0 ? "Завершена" : "В игре",
      canGenerate: !hasBracket && n >= 2,
    }
  })
}

/** Данные drawer категории (живой объект, без второго state). */
export function buildCategoryDrawerData(args: {
  cat: TournamentCategory | undefined
  regs: RegistrationEntry[] | null
  regsById: Map<number, boolean>
  tatamis: Tatami[]
}): CategoryDrawerData | null {
  const { cat, regs, regsById, tatamis } = args
  if (!cat) return null
  const members = cat.athletes || []
  const hasBracket = (cat.rounds || []).length > 0
  const matches = (cat.rounds || []).flatMap((r) => r.matches || [])
  return {
    cat,
    memberCount: members.length,
    checkedIn: regs ? members.filter((a) => regsById.get(a.id)).length : null,
    hasBracket,
    fights: hasBracket ? matches.filter((m) => m.status !== "bye").length : 0,
    left: matches.filter((m) => m.status !== "finished" && m.status !== "bye").length,
    canGenerate: !hasBracket && members.length >= 2,
    tatamiName: tatamis.find((t) => t.id === cat.tatami)?.name ?? "—",
  }
}

/** Первая незавершённая категория с сеткой (активная пилюля в сетках). */
export function findFirstOpenCategoryId(
  sortedCats: TournamentCategory[]
): number | null {
  return (
    sortedCats.find((c) => {
      const ms = (c.rounds || []).flatMap((r) => r.matches || [])
      return ms.length > 0 && !ms.every((m) => m.status === "finished" || m.status === "bye")
    })?.id ?? null
  )
}
