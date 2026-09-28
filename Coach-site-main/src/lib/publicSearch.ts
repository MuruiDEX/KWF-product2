// Публичный поиск бойца по загруженной сетке (без запросов).
// Обогащение: категория/раунд/статус/татами из тех же данных.
// ETA здесь нет и не выдумывается — в payload его нет.

export interface PublicSearchMatch {
  id: number
  matchNumber: number
  athlete1: string | null
  athlete2: string | null
  status: string
  tatamiName: string | null
}

export interface PublicSearchRound {
  name: string
  matches: PublicSearchMatch[]
}

export interface PublicSearchCategory {
  catId: number
  catName: string
  rounds: PublicSearchRound[]
}

export interface FighterResult {
  matchId: number
  catId: number
  label: string
  sub: string
  meta: string
}

const RU_STATUS: Record<string, string> = {
  finished: "Завершён",
  in_progress: "Идёт бой",
  paused: "Пауза",
  ready: "Готов",
  waiting: "Ожидает",
  bye: "BYE",
}

export function matchStatusRu(status: string): string {
  return RU_STATUS[status] ?? status
}

const MAX_RESULTS = 8

export function buildFighterResults(
  cats: PublicSearchCategory[],
  query: string
): FighterResult[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const out: FighterResult[] = []
  for (const v of cats) {
    for (const r of v.rounds) {
      for (const m of r.matches) {
        const label = `${m.athlete1 ?? ""} — ${m.athlete2 ?? ""}`.trim()
        if (!label || label === "—") continue
        if (!label.toLowerCase().includes(q)) continue
        const metaParts = [
          matchStatusRu(m.status),
          m.tatamiName ? `Татами ${m.tatamiName}` : null,
        ].filter((p): p is string => Boolean(p))
        out.push({
          matchId: m.id,
          catId: v.catId,
          label,
          sub: `${v.catName} · ${r.name} · Бой #${m.matchNumber}`,
          meta: metaParts.join(" · "),
        })
        if (out.length >= MAX_RESULTS) return out
      }
    }
  }
  return out
}
