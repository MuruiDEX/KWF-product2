/** Типы realtime-ленты турнира (зеркало TournamentEvent бэкенда).
 *
 * Транспортно-независимые: сейчас доставляются лёгким tail-poll
 * `GET tournaments/{id}/events/?after=`, позже можно подменить на SSE/WS
 * без смены логики. Клиент НЕ мержит payload'ы — событие лишь инвалидирует
 * затронутые представления (тихий refetch), source of truth — БД backend.
 */

export type TournamentEventType =
  | "match.started"
  | "match.paused"
  | "match.resumed"
  | "match.finished"
  | "match.reopened"
  | "match.tatami"
  | "round.started"
  | "round.finished"
  | "category.members"
  | "category.bracket"
  | "tournament.updated"

export interface TournamentEvent {
  id: number
  tournament: number
  type: TournamentEventType | string
  match: number | null
  round: number | null
  category: number | null
  actor: number | null
  created_at: string
}

export interface TournamentEventsResponse {
  events: TournamentEvent[]
  latest_id: number
}

/** События очереди (спортсмены/таймеры/татами меняются). */
export function isQueueEvent(e: TournamentEvent): boolean {
  return (
    e.type === "match.started" ||
    e.type === "match.paused" ||
    e.type === "match.resumed" ||
    e.type === "match.finished" ||
    e.type === "match.reopened" ||
    e.type === "match.tatami" ||
    e.type === "round.started" ||
    e.type === "round.finished"
  )
}

/** События сетки (структура/победители/состав меняются). */
export function isBracketEvent(e: TournamentEvent): boolean {
  return (
    e.type === "match.finished" ||
    e.type === "match.reopened" ||
    e.type === "round.started" ||
    e.type === "round.finished" ||
    e.type === "category.members" ||
    e.type === "category.bracket" ||
    e.type === "tournament.updated"
  )
}
