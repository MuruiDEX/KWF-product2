/** Общие pure-хелперы сетки (единая точка вместо дублей
 * в TournamentBrackets / print-странице).
 */

export function idOf(v: { id: number } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  return typeof v === "number" ? v : v.id
}

export function nameOf(
  v: { name?: string | null } | number | null | undefined
): string | null {
  if (v === null || v === undefined || typeof v === "number") return null
  return v.name ?? null
}

export interface ChampionMatch {
  winnerId: number | null
  winnerName?: string | null
  athlete1: { id: number | null; name: string | null }
  athlete2: { id: number | null; name: string | null }
}

export interface ChampionRound {
  matches: ChampionMatch[]
}

/** Чемпион категории: первый матч последнего раунда с победителем.
 * (Дубль логики из двух мест сведён сюда; семантику не меняем:
 * формат сетки — один финальный бой в последнем раунде.) */
export function championOf(rounds: ChampionRound[]): string | null {
  const last = rounds[rounds.length - 1]
  const champ = last?.matches.find((m) => m.winnerId !== null)
  if (!champ) return null
  return (
    champ.winnerName ??
    (champ.winnerId === champ.athlete1.id ? champ.athlete1.name : champ.athlete2.name)
  )
}
