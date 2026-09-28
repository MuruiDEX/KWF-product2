import { api, apiErrorMessage } from "@/lib/api"

// Массовая генерация сеток: те же правила отбора, что у одиночной кнопки
// «Сформировать сетку» (нет раундов + минимум 2 участника). Sequential,
// continue-on-error, агрегат как в bulk-операциях Phase 3.

export interface BracketGenCandidate {
  id: number
  name: string
}

export interface BracketCategoryInput {
  id: number
  name: string
  rounds?: unknown[] | null
  athletes?: unknown[] | null
}

export function eligibleForBracket(cat: BracketCategoryInput): boolean {
  const hasBracket = (cat.rounds || []).length > 0
  const n = (cat.athletes || []).length
  return !hasBracket && n >= 2
}

export function collectBracketCandidates(
  cats: BracketCategoryInput[]
): BracketGenCandidate[] {
  return cats.filter(eligibleForBracket).map((c) => ({ id: c.id, name: c.name }))
}

export interface BracketGenResult {
  requested: number
  generated: number
  failed: number
  errors: { categoryId: number; name: string; error: string }[]
}

export async function generateAllBrackets(
  candidates: BracketGenCandidate[]
): Promise<BracketGenResult> {
  const agg: BracketGenResult = {
    requested: candidates.length,
    generated: 0,
    failed: 0,
    errors: [],
  }
  for (const c of candidates) {
    try {
      await api(`/api/tournament/categories/${c.id}/generate_bracket/`, {
        method: "POST",
      })
      agg.generated += 1
    } catch (e) {
      console.error(e)
      agg.failed += 1
      agg.errors.push({ categoryId: c.id, name: c.name, error: apiErrorMessage(e) })
    }
  }
  return agg
}

/** Человеческое резюме для панели сеток (чистая функция, покрыта тестами). */
export function formatBracketGenSummary(res: BracketGenResult): {
  ok: boolean
  text: string
} {
  if (res.requested === 0) {
    return { ok: true, text: "Нет готовых категорий — нечего генерировать." }
  }
  if (res.failed === 0) {
    return { ok: true, text: `Сетки созданы: ${res.generated}.` }
  }
  const shown = res.errors
    .slice(0, 3)
    .map((e) => `${e.name} (${e.error})`)
    .join("; ")
  const more = res.failed > 3 ? "…" : ""
  return {
    ok: false,
    text: `Создано: ${res.generated} · Ошибки: ${res.failed} (${shown}${more}).`,
  }
}
