/** Фаза 6: инкремент сетки `bracket_state?since=`.
 *
 * Backend присылает либо full (`categories`), либо `changed` — затронутые
 * бои в сырой форме. Здесь — чистый merge по id, общий для обеих страниц
 * сетки (у них разные TS-типы матчей, поэтому пишем обе формы полей:
 * `athlete1` + `athlete1_id`/`athlete1_name` и т.д.).
 */

export interface DeltaMatch {
  id: number
  match_number: number
  round_id: number
  category_id: number
  athlete1_id: number | null
  athlete1_name: string | null
  athlete2_id: number | null
  athlete2_name: string | null
  winner_id: number | null
  winner_name: string | null
  score1: number
  score2: number
  status: string
  tatami_id: number | null
  tatami_name: string | null
  start_time: string | null
  previous_match1: number | null
  previous_match2: number | null
}

export interface BracketDeltaResponse {
  tournament_id: number
  changed?: DeltaMatch[]
  categories?: unknown
  latest_id: number
}

/** True, если ответ — full fallback (надо заменить всё, не мержить). */
export function isFullBracketResponse(
  data: BracketDeltaResponse | { categories?: unknown }
): boolean {
  return (data as { categories?: unknown }).categories !== undefined
}

/** Применить дельту одного боя к сырому матчу (обе формы полей). */
export function applyDeltaToMatch<T extends { id: number }>(
  old: T,
  d: DeltaMatch
): T {
  return {
    ...old,
    match_number: d.match_number,
    athlete1: d.athlete1_id,
    athlete1_id: d.athlete1_id,
    athlete1_name: d.athlete1_name,
    athlete2: d.athlete2_id,
    athlete2_id: d.athlete2_id,
    athlete2_name: d.athlete2_name,
    winner: d.winner_id,
    winner_id: d.winner_id,
    winner_name: d.winner_name,
    score1: d.score1,
    score2: d.score2,
    status: d.status,
    tatami: d.tatami_id,
    tatami_name: d.tatami_name,
    start_time: d.start_time,
    previous_match1: d.previous_match1,
    previous_match2: d.previous_match2,
  }
}

interface WithRounds<M extends { id: number }> {
  rounds?: { matches?: M[] }[] | null
}

/** Заменить изменившиеся бои по id. Неизвестные id игнорируются. */
export function mergeBracketMatches<
  C extends WithRounds<M>,
  M extends { id: number },
>(categories: C[], changed: DeltaMatch[]): C[] {
  if (changed.length === 0) return categories
  const byId = new Map(changed.map((d) => [d.id, d]))
  let anyTouched = false
  const out = categories.map((cat) => {
    if (!cat.rounds) return cat
    let touched = false
    const rounds = cat.rounds.map((r) => {
      if (!r.matches) return r
      let roundTouched = false
      const matches = r.matches.map((m) => {
        const d = byId.get(m.id)
        if (!d) return m
        roundTouched = true
        return applyDeltaToMatch(m, d)
      })
      if (!roundTouched) return r
      touched = true
      return { ...r, matches }
    })
    if (!touched) return cat
    anyTouched = true
    return { ...cat, rounds }
  })
  return anyTouched ? out : categories
}
