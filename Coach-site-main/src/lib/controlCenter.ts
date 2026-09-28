// Phase 4: чистая логика Control Center (метрики, здоровье, подписи событий).
// Источники — уже загруженные payload: Tournament (nested), registrations,
// tatamis. Новых endpoints не требует. Покрыто vitest.

import type { ManageTabId } from "@/components/ReadinessChecklist"
import type { Tournament, TournamentCategory, Match } from "@/lib/types"
import type { TournamentEvent } from "@/lib/tournamentEvents"
import { checkOverweight, parseWeightLimit } from "@/lib/weight"

export interface RegistrationEntry {
  athlete_id: number
  name: string
  checked_in: boolean
  weight_actual: string | null
}

function allMatches(t: Tournament): Match[] {
  return (t.categories ?? []).flatMap((c) =>
    (c.rounds ?? []).flatMap((r) => r.matches ?? [])
  )
}

function uniqueAthletes(t: Tournament) {
  const map = new Map<number, { id: number; club?: string | null }>()
  for (const c of t.categories ?? []) {
    for (const a of c.athletes ?? []) {
      if (!map.has(a.id)) map.set(a.id, { id: a.id, club: a.club })
    }
  }
  return [...map.values()]
}

// ---------- Operations overview ----------

export interface OpsMetrics {
  registration: { total: number; checkedIn: number; missing: number } | null
  participants: { total: number; categories: number; clubs: number | null }
  schedule: { scheduled: number; unscheduled: number; tatamis: number }
  live: { running: number; paused: number; waiting: number; finished: number }
  // Судьи всегда выводимы из payload (referee может отсутствовать — считаем «без судьи»).
  referees: { assigned: number; unassigned: number }
}

export function computeOps(
  t: Tournament,
  regs: RegistrationEntry[] | null,
  tatamiCount: number
): OpsMetrics {
  const matches = allMatches(t).filter((m) => m.status !== "bye")
  const athletes = uniqueAthletes(t)
  const clubs = new Set<string>()
  let hasClub = false
  for (const a of athletes) {
    if (typeof a.club === "string" && a.club.trim()) {
      hasClub = true
      clubs.add(a.club.trim())
    }
  }
  const active = matches.filter(
    (m) => m.status === "ready" || m.status === "in_progress" || m.status === "paused"
  )
  const withRef = active.filter((m) => m.referee !== null && m.referee !== undefined)
  return {
    registration: regs
      ? {
          total: regs.length,
          checkedIn: regs.filter((r) => r.checked_in).length,
          missing: regs.filter((r) => !r.checked_in).length,
        }
      : null,
    participants: {
      total: athletes.length,
      categories: (t.categories ?? []).length,
      clubs: hasClub ? clubs.size : null,
    },
    schedule: {
      scheduled: matches.filter(
        (m) =>
          (m.status === "ready" || m.status === "waiting") &&
          m.tatami !== null &&
          m.tatami !== undefined
      ).length,
      unscheduled: matches.filter(
        (m) =>
          (m.status === "ready" || m.status === "waiting") &&
          (m.tatami === null || m.tatami === undefined)
      ).length,
      tatamis: tatamiCount,
    },
    live: {
      running: matches.filter((m) => m.status === "in_progress").length,
      paused: matches.filter((m) => m.status === "paused").length,
      waiting: matches.filter((m) => m.status === "ready" || m.status === "waiting").length,
      finished: matches.filter((m) => m.status === "finished").length,
    },
    referees: {
      assigned: withRef.length,
      unassigned: active.length - withRef.length,
    },
  }
}

// ---------- Weigh-in ----------

export interface WeighinRosterEntry {
  id: number
  categories: { name: string; weightMax: number | null }[]
}

export interface WeighinMetrics {
  total: number
  weighed: number
  unweighed: number
  overweight: number
}

/** Взвешивание по данным registrations: взвешен = валидный weight_actual.
 * Перевес — той же семантикой checkOverweight, что и CheckinPanel.
 * regs === null → null (честное «недоступно», не ноль). */
export function computeWeighin(
  regs: RegistrationEntry[] | null,
  roster: WeighinRosterEntry[]
): WeighinMetrics | null {
  if (!regs) return null
  const catsById = new Map(roster.map((r) => [r.id, r.categories]))
  let weighed = 0
  let overweight = 0
  for (const r of regs) {
    if (parseWeightLimit(r.weight_actual) === null) continue
    weighed += 1
    if (checkOverweight(r.weight_actual, catsById.get(r.athlete_id) ?? []).over) {
      overweight += 1
    }
  }
  return { total: regs.length, weighed, unweighed: regs.length - weighed, overweight }
}

/** Единственный алерт взвешивания: перевес. Невзвешенность — нормальное
 * промежуточное состояние, не проблема (счётчики — в таблице и обзоре). */
export function computeWeighinHealth(
  regs: RegistrationEntry[] | null,
  roster: WeighinRosterEntry[]
): HealthItem[] {
  if (!regs) return []
  const catsById = new Map(roster.map((r) => [r.id, r.categories]))
  const bad: string[] = []
  for (const r of regs) {
    if (parseWeightLimit(r.weight_actual) === null) continue
    if (checkOverweight(r.weight_actual, catsById.get(r.athlete_id) ?? []).over) {
      bad.push(r.name)
    }
  }
  if (bad.length === 0) return []
  return [
    {
      id: "overweight",
      severity: "warn",
      text: `Перевес: ${bad.length} — ${namesPreview(bad)}`,
      tab: "weighin",
    },
  ]
}

// ---------- Tournament health ----------

export interface HealthItem {
  id: string
  severity: "error" | "warn"
  text: string
  tab: ManageTabId
}

function normName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

function namesPreview(names: string[]): string {
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} и ещё ${names.length - 3}`
}

export function computeHealth(t: Tournament): HealthItem[] {
  const items: HealthItem[] = []
  const cats: TournamentCategory[] = t.categories ?? []

  // Пустые и тонкие категории.
  for (const c of cats) {
    const n = (c.athletes ?? []).length
    if (n === 0) {
      items.push({
        id: `empty-${c.id}`,
        severity: "error",
        text: `Пустая категория: ${c.name}`,
        tab: "participants",
      })
    } else if (n < 3) {
      items.push({
        id: `thin-${c.id}`,
        severity: "warn",
        text: `Мало участников (${n}): ${c.name} — сетка может не состояться`,
        tab: "participants",
      })
    }
  }

  // Возможные дубликаты (ФИ + дата рождения, если видна).
  const seen = new Map<string, string[]>()
  for (const c of cats) {
    for (const a of c.athletes ?? []) {
      const key = `${normName(a.last_name)}|${normName(a.first_name)}|${a.birth_date ?? "?"}`
      const list = seen.get(key) ?? []
      list.push(`${a.last_name} ${a.first_name}`.trim())
      seen.set(key, list)
    }
  }
  for (const [, list] of seen) {
    const uniqCats = new Set(list)
    if (list.length > 1 && uniqCats.size === 1 && list[0]) {
      items.push({
        id: `dupe-${list[0]}`,
        severity: "warn",
        text: `Возможный дубликат: ${list[0]} заявлен ${list.length} раза`,
        tab: "participants",
      })
    }
  }

  // Недостающие данные и несоответствия (только если поля реально пришли —
  // анонимный PublicAthleteSerializer их не содержит, проверка пропускается).
  const withBirth = cats.flatMap((c) => c.athletes ?? []).filter((a) => "birth_date" in a)
  if (withBirth.length > 0) {
    const missing = withBirth.filter((a) => !a.birth_date)
    if (missing.length > 0) {
      items.push({
        id: "missing-birth",
        severity: "warn",
        text: `Нет даты рождения: ${namesPreview(missing.map((a) => `${a.last_name} ${a.first_name}`.trim()))}`,
        tab: "participants",
      })
    }
    const ageMismatch: string[] = []
    const weightMismatch: string[] = []
    for (const c of cats) {
      for (const a of c.athletes ?? []) {
        if (typeof a.age === "number" && (a.age < c.age_min || a.age > c.age_max)) {
          ageMismatch.push(`${a.last_name} ${a.first_name} (${a.age} лет → ${c.name})`)
        }
        const w = Number(a.weight)
        const wMax = Number(c.weight_max)
        const wMin = Number(c.weight_min ?? 0)
        if (Number.isFinite(w) && w > 0 && Number.isFinite(wMax) && wMax > 0 && (w > wMax || (wMin > 0 && w < wMin))) {
          weightMismatch.push(`${a.last_name} ${a.first_name} (${a.weight} кг → ${c.name})`)
        }
      }
    }
    if (ageMismatch.length > 0) {
      items.push({
        id: "age-mismatch",
        severity: "error",
        text: `Возраст вне категории: ${namesPreview(ageMismatch)}`,
        tab: "participants",
      })
    }
    if (weightMismatch.length > 0) {
      items.push({
        id: "weight-mismatch",
        severity: "warn",
        text: `Вес вне категории: ${namesPreview(weightMismatch)}`,
        tab: "participants",
      })
    }
  }

  // Татами: перегрузка и бои без судьи.
  const perTatami = new Map<number, number>()
  for (const m of allMatches(t)) {
    if ((m.status === "ready" || m.status === "waiting" || m.status === "in_progress" || m.status === "paused") && m.tatami != null) {
      perTatami.set(m.tatami, (perTatami.get(m.tatami) ?? 0) + 1)
    }
  }
  if (perTatami.size > 1) {
    const counts = [...perTatami.values()]
    const avg = counts.reduce((s, n) => s + n, 0) / counts.length
    const max = Math.max(...counts)
    if (max > avg * 1.5 + 1 && max - Math.min(...counts) >= 3) {
      items.push({
        id: "tatami-overload",
        severity: "warn",
        text: `Татами перегружены неравномерно (максимум ${max} боёв при среднем ${Math.round(avg)})`,
        tab: "schedule",
      })
    }
  }
  const noRef = allMatches(t).filter(
    (m) =>
      (m.status === "ready" || m.status === "in_progress" || m.status === "paused") &&
      (m.referee === null || m.referee === undefined)
  ).length
  if (noRef > 0) {
    items.push({
      id: "no-referee",
      severity: "warn",
      text: `Боёв без назначенного судьи: ${noRef}`,
      tab: "staff",
    })
  }

  return items
}

// ---------- Activity labels ----------

export interface EventContext {
  matchLabel: (id: number) => string | null
  categoryName: (id: number) => string | null
}

const FALLBACK = "Событие турнира"

/** Человекочитаемая RU-подпись события (технический JSON не показываем). */
export function describeEvent(e: TournamentEvent, ctx?: EventContext): string {
  switch (e.type) {
    case "match.started": {
      const label = e.match != null ? ctx?.matchLabel(e.match) : null
      return label ? `Бой начат — ${label}` : "Бой начат"
    }
    case "match.paused":
      return "Бой приостановлен"
    case "match.resumed":
      return "Бой продолжен"
    case "match.finished": {
      const label = e.match != null ? ctx?.matchLabel(e.match) : null
      return label ? `Бой завершён — ${label}` : "Бой завершён"
    }
    case "match.reopened":
      return "Бой переоткрыт — результат откачен"
    case "match.tatami":
      return "Бой перемещён на другое татами"
    case "round.started": {
      const cat = e.category != null ? ctx?.categoryName(e.category) : null
      return cat ? `Раунд открыт — ${cat}` : "Раунд открыт"
    }
    case "round.finished":
      return "Раунд завершён"
    case "category.members":
      return "Состав категории обновлён"
    case "category.bracket":
      return "Сетка категории обновлена"
    case "tournament.updated":
      return "Настройки турнира обновлены"
    case "tournament.announcement":
      return e.detail ? `Объявление: ${e.detail}` : "Объявление организатора"
    case "tournament.checkin":
      return "Массовая явка"
    case "tournament.uncheck":
      return "Массовое снятие явки"
    default:
      return FALLBACK
  }
}
