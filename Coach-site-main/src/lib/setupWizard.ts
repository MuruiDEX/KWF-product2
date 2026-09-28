"use client"

/** Чистые хелперы setup-визарда турнира (превью считается локально,
 *  мутации — только через существующие backend-endpoints). */

export interface BracketPreview {
  slots: number
  byes: number
  fights: number
  rounds: number
}

/** Размер олимпийской сетки: ближайшая степень двойки сверху.
 *  Зеркалит services.generate_bracket (слоты/BYE/бои). */
export function bracketPreview(athletes: number): BracketPreview | null {
  if (!Number.isInteger(athletes) || athletes < 2) return null
  let slots = 1
  while (slots < athletes) slots *= 2
  const byes = slots - athletes
  // Боев всего = слоты − 1 (включая BYE-проходы и финалы waiting).
  return { slots, byes, fights: slots - 1, rounds: Math.log2(slots) }
}

export type CategorySetupState =
  | { kind: "empty" }
  | { kind: "ready"; athletes: number }
  | { kind: "built"; fights: number; live: boolean }
  | { kind: "too_few"; athletes: number }

/** Состояние категории для визарда по данным tournament.categories. */
export function categorySetupState(cat: {
  athletes?: { id: number }[] | null
  rounds?: { matches?: { status: string }[] | null }[] | null
}): CategorySetupState {
  const n = (cat.athletes || []).length
  const matches = (cat.rounds || []).flatMap((r) => r.matches || [])
  const real = matches.filter((m) => m.status !== "bye")
  if (real.length > 0) {
    const live = real.some(
      (m) => m.status !== "waiting" && m.status !== "ready"
    )
    return { kind: "built", fights: real.length, live }
  }
  if (n < 2) return n === 0 ? { kind: "empty" } : { kind: "too_few", athletes: n }
  return { kind: "ready", athletes: n }
}

export interface TatamiLoad {
  tatamiId: number
  fights: number
}

/** Нагрузка татами по нес finished/bye боям (для workload-индикатора). */
export function tatamiLoads(
  tatamis: { id: number }[],
  matches: { tatami: number | null; status: string }[]
): TatamiLoad[] {
  return tatamis.map((t) => ({
    tatamiId: t.id,
    fights: matches.filter(
      (m) => m.tatami === t.id && m.status !== "finished" && m.status !== "bye"
    ).length,
  }))
}

/** Формат минут ЧЧ:ММ для превью расписания. */
export function formatLaneTime(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** Парсинг ЧЧ:ММ в минуты (зеркалит backend-валидацию schedule_lanes). */
export function parseLaneStart(value: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(value || "")
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh > 23 || mm > 59) return null
  return hh * 60 + mm
}
