// Phase 1: адаптер manage → движок готовности.
// Единственное место, где page-мемои (sortedCats, regs, weighinRoster,
// allMatches) превращаются в ReadinessEngineInput. UI в Phase 2 будет
// звать только buildReadinessInput + computeTournamentReadiness.

import { computeWeighin } from "@/lib/controlCenter"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { TournamentCategory } from "@/lib/types"
import type {
  ReadinessCategoryInput,
  ReadinessEngineInput,
} from "@/lib/readiness"

/** useParams() реально string|string[]|undefined — чиним в одном месте. */
export function resolveTournamentId(
  raw: string | string[] | undefined
): string | null {
  if (typeof raw === "string" && raw.length > 0) return raw
  return null
}

export interface WeighinRosterInput {
  id: number
  categories: { name: string; weightMax: number | null }[]
  /** regs-запись может отсутствовать в ростере (участник без категории). */
  name?: string
}

export function toReadinessCategories(
  sortedCats: TournamentCategory[]
): ReadinessCategoryInput[] {
  return sortedCats.map((c) => ({
    id: c.id,
    name: c.name,
    athleteCount: (c.athletes || []).length,
    hasBracket: (c.rounds || []).length > 0,
    tatamiId: c.tatami ?? null,
  }))
}

export interface BuildReadinessArgs {
  status: string
  startDate: string | null
  sortedCats: TournamentCategory[]
  tatamiCount: number
  fightsWithoutTatami: number
  fightsWithoutReferee: number
  regs: RegistrationEntry[] | null
  weighinRoster: WeighinRosterInput[]
}

/** Собирает вход движка из уже загруженных данных (новых fetch нет). */
export function buildReadinessInput(
  args: BuildReadinessArgs
): ReadinessEngineInput {
  const categorized = new Set<number>()
  for (const c of args.sortedCats) {
    for (const a of c.athletes || []) categorized.add(a.id)
  }
  const rosterIds = new Set(args.weighinRoster.map((r) => r.id))
  void rosterIds

  const uncategorizedCount = args.regs
    ? args.regs.filter((r) => !categorized.has(r.athlete_id)).length
    : 0

  const checkin = args.regs
    ? {
        total: args.regs.length,
        checkedIn: args.regs.filter((r) => r.checked_in).length,
        missing: args.regs.filter((r) => !r.checked_in).length,
      }
    : null

  const metrics = computeWeighin(args.regs, args.weighinRoster)
  const overweightNames =
    args.regs && metrics && metrics.overweight > 0
      ? args.regs
          .filter((r) => {
            const entry = args.weighinRoster.find(
              (x) => x.id === r.athlete_id
            )
            if (!entry) return false
            // Тот же строжайший лимит, что в computeWeighin: ищем перевес
            // поименно для человекочитаемого issues-текста.
            const limits = entry.categories
              .map((c) => c.weightMax)
              .filter((v): v is number => v !== null)
            if (limits.length === 0) return false
            const raw = String(r.weight_actual ?? "").replace(",", ".").trim()
            const actual = Number(raw)
            if (!Number.isFinite(actual) || actual <= 0) return false
            return actual > Math.min(...limits)
          })
          .map((r) => r.name)
      : []
  const weighin = metrics
    ? {
        total: metrics.total,
        weighed: metrics.weighed,
        unweighed: metrics.unweighed,
        overweight: metrics.overweight,
        overweightNames,
      }
    : null

  return {
    status: args.status,
    startDate: args.startDate,
    categories: toReadinessCategories(args.sortedCats),
    tatamiCount: args.tatamiCount,
    fightsWithoutTatami: args.fightsWithoutTatami,
    fightsWithoutReferee: args.fightsWithoutReferee,
    uncategorizedCount,
    checkin,
    weighin,
  }
}
