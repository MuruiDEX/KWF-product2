// Phase 1: единый движок готовности турнира — единственный источник истины.
// Проблема, которую закрывает: раньше готовность считали три независимых
// места (computeReadiness в ReadinessChecklist, computeHealth/computeWeighin
// в controlCenter, getNextStep в nextStep) с разными входами — Dashboard мог
// говорить «готово», а вкладка «Сетки» — нет. Теперь UI только отображает
// TournamentReadiness, ничего не вычисляет сам.
// Чистые функции, без fetch. Данные приходят из TanStack Query слоя (Phase 0).
// Визуальный layout НЕ меняется: Overview/IssuesCenter появятся в Phase 2.

import type { ManageTabId } from "@/components/ReadinessChecklist"

/** Единый визуальный язык статусов для всего /manage. */
export type SectionStatus =
  | "not_started"
  | "in_progress"
  | "needs_attention"
  | "ready"
  | "completed"
  | "error"

export type NextActionTarget = ManageTabId | "publish" | "wizard"

export interface NextAction {
  id: string
  text: string
  actionLabel: string
  target: NextActionTarget
}

export interface TournamentIssue {
  id: string
  severity: "error" | "warn"
  title: string
  detail: string
  tab: ManageTabId
  actionLabel: string
  target: NextActionTarget
}

export type ReadinessSections = Record<
  | "participants"
  | "categories"
  | "weighIn"
  | "tatamis"
  | "schedule"
  | "brackets"
  | "judges",
  SectionStatus
>

export interface TournamentReadiness {
  sections: ReadinessSections
  /** 0–100, взвешенная сумма (не среднее арифметическое). */
  overall: number
  nextAction: NextAction | null
  /** Единственный список проблем — для IssuesCenter (Phase 2). */
  issues: TournamentIssue[]
  /** Тексты error-проблем — для диалога публикации (совместимо с blockers). */
  blockers: string[]
}

export interface ReadinessCategoryInput {
  id: number
  name: string
  athleteCount: number
  hasBracket: boolean
  tatamiId: number | null
}

export interface ReadinessCheckinInput {
  total: number
  checkedIn: number
  missing: number
}

export interface ReadinessWeighinInput {
  total: number
  weighed: number
  unweighed: number
  overweight: number
  overweightNames: string[]
}

export interface ReadinessEngineInput {
  status: string
  /** YYYY-MM-DD или null. */
  startDate: string | null
  categories: ReadinessCategoryInput[]
  tatamiCount: number
  fightsWithoutTatami: number
  fightsWithoutReferee: number
  /** Участники в regs, которых нет ни в одной категории. */
  uncategorizedCount: number
  /** null — данные явки недоступны (шаг пропускается, не врём нулями). */
  checkin: ReadinessCheckinInput | null
  /** null — данные взвешивания недоступны. */
  weighin: ReadinessWeighinInput | null
}

const WEIGHTS: Record<keyof ReadinessSections, number> = {
  participants: 20,
  categories: 20,
  weighIn: 15,
  tatamis: 10,
  brackets: 20,
  schedule: 10,
  judges: 5,
}

function statusScore(s: SectionStatus): number {
  switch (s) {
    case "completed":
    case "ready":
      return 100
    case "in_progress":
      return 50
    case "needs_attention":
      return 30
    case "not_started":
    case "error":
      return 0
  }
}

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1]
  return forms[2]
}

function namesPreview(names: string[]): string {
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} и ещё ${names.length - 3}`
}

function isPastDraft(startDate: string | null, status: string): boolean {
  if (status === "published" || status === "finished" || !startDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${startDate}T00:00:00`)
  return !Number.isNaN(start.getTime()) && start < today
}

/** Главная функция движка. Детерминирована: те же входы → тот же выход. */
export function computeTournamentReadiness(
  input: ReadinessEngineInput
): TournamentReadiness {
  const finished = input.status === "finished"
  const cats = input.categories
  const emptyCats = cats.filter((c) => c.athleteCount === 0)
  const thinCats = cats.filter(
    (c) => c.athleteCount >= 1 && c.athleteCount < 3
  )
  const noBracketCats = cats.filter(
    (c) => c.athleteCount >= 2 && !c.hasBracket
  )
  const catsWithoutTatami = cats.filter(
    (c) => c.hasBracket && c.tatamiId === null
  )
  const hasAnyBracket = cats.some((c) => c.hasBracket)

  let sections: ReadinessSections
  if (finished) {
    sections = {
      participants: "completed",
      categories: "completed",
      weighIn: "completed",
      tatamis: "completed",
      schedule: "completed",
      brackets: "completed",
      judges: "completed",
    }
  } else {
    // Участники: без категории — error (блокирует сетки), иначе явка.
    let participants: SectionStatus
    if (cats.length === 0) participants = "not_started"
    else if (input.uncategorizedCount > 0 || emptyCats.length > 0)
      participants = "error"
    else if (input.checkin === null) participants = "in_progress"
    else if (input.checkin.missing > 0) participants = "needs_attention"
    else participants = "ready"

    // Категории: пустые — error, тонкие (1–2) — needs_attention.
    let categories: SectionStatus
    if (cats.length === 0) categories = "not_started"
    else if (emptyCats.length > 0) categories = "error"
    else if (thinCats.length > 0) categories = "needs_attention"
    else categories = "ready"

    // Взвешивание: перевес и невзвешенные — needs_attention (не error:
    // взвешивание — нормальное промежуточное состояние, как в controlCenter).
    let weighIn: SectionStatus
    if (input.weighin === null) weighIn = "in_progress"
    else if (input.weighin.total === 0) weighIn = "not_started"
    else if (input.weighin.overweight > 0 || input.weighin.unweighed > 0)
      weighIn = "needs_attention"
    else weighIn = "ready"

    // Татами: отсутствие — error (распределение невозможно).
    let tatamis: SectionStatus
    if (input.tatamiCount === 0) tatamis = "error"
    else if (catsWithoutTatami.length > 0) tatamis = "needs_attention"
    else tatamis = "ready"

    // Сетки: нет категорий — not_started, иначе needs_attention пока есть
    // категории без сетки.
    let brackets: SectionStatus
    if (cats.length === 0) brackets = "not_started"
    else if (noBracketCats.length > 0) brackets = "needs_attention"
    else brackets = "ready"

    // Расписание: без татами — error, без сеток — in_progress (строить нечего),
    // бои без татами — needs_attention.
    let schedule: SectionStatus
    if (input.tatamiCount === 0) schedule = "error"
    else if (!hasAnyBracket) schedule = "in_progress"
    else if (input.fightsWithoutTatami > 0) schedule = "needs_attention"
    else schedule = "ready"

    // Судьи: без сеток оценивать нечего — not_started.
    let judges: SectionStatus
    if (!hasAnyBracket) judges = "not_started"
    else if (input.fightsWithoutReferee > 0) judges = "needs_attention"
    else judges = "ready"

    sections = {
      participants,
      categories,
      weighIn,
      tatamis,
      schedule,
      brackets,
      judges,
    }
  }

  // Issues: производны от тех же сигналов, поэтому после исправления
  // исчезают сами (никаких ручных dismiss).
  const issues: TournamentIssue[] = []
  if (!finished) {
    if (cats.length === 0) {
      issues.push({
        id: "no-categories",
        severity: "error",
        title: "Нет категорий",
        detail: "Создайте хотя бы одну категорию — без неё невозможны сетки и расписание.",
        tab: "participants",
        actionLabel: "Подготовить турнир",
        target: "wizard",
      })
    }
    if (emptyCats.length > 0) {
      issues.push({
        id: "empty-categories",
        severity: "error",
        title: `Пустые категории: ${emptyCats.length}`,
        detail: emptyCats.map((c) => c.name).join(", "),
        tab: "participants",
        actionLabel: "Открыть участников",
        target: "participants",
      })
    }
    if (input.uncategorizedCount > 0) {
      const n = input.uncategorizedCount
      issues.push({
        id: "uncategorized",
        severity: "error",
        title: `${n} ${plural(n, ["участник", "участника", "участников"])} без категории`,
        detail: "Распределите их по категориям — иначе они не попадут в сетки.",
        tab: "participants",
        actionLabel: "Распределить",
        target: "participants",
      })
    }
    if (thinCats.length > 0) {
      issues.push({
        id: "thin-categories",
        severity: "warn",
        title: `Мало участников: ${thinCats.map((c) => c.name).join(", ")}`,
        detail: "Сетка из 1–2 человек может не состояться — проверьте состав.",
        tab: "participants",
        actionLabel: "Проверить состав",
        target: "participants",
      })
    }
    if (input.checkin !== null && input.checkin.missing > 0) {
      const n = input.checkin.missing
      issues.push({
        id: "checkin-missing",
        severity: "warn",
        title: `${n} ${plural(n, ["спортсмен", "спортсмена", "спортсменов"])} без явки`,
        detail: "Отметьте явку до старта — без неё не сойдутся взвешивание и сетки.",
        tab: "participants",
        actionLabel: "Проверить явку",
        target: "participants",
      })
    }
    if (input.weighin !== null && input.weighin.unweighed > 0) {
      const n = input.weighin.unweighed
      issues.push({
        id: "weighin-pending",
        severity: "warn",
        title: `Не взвешены: ${n}`,
        detail: "Взвесьте участников до генерации сеток.",
        tab: "weighin",
        actionLabel: "Открыть взвешивание",
        target: "weighin",
      })
    }
    if (input.weighin !== null && input.weighin.overweight > 0) {
      issues.push({
        id: "overweight",
        severity: "warn",
        title: `Перевес: ${input.weighin.overweight} — ${namesPreview(input.weighin.overweightNames)}`,
        detail: "Проверьте вес перед стартом — участник может не попасть в категорию.",
        tab: "weighin",
        actionLabel: "Проверить вес",
        target: "weighin",
      })
    }
    if (input.tatamiCount === 0) {
      issues.push({
        id: "no-tatamis",
        severity: "error",
        title: "Нет татами",
        detail: "Без татами распределение боёв невозможно.",
        tab: "schedule",
        actionLabel: "Открыть расписание",
        target: "schedule",
      })
    } else if (catsWithoutTatami.length > 0) {
      issues.push({
        id: "categories-without-tatami",
        severity: "warn",
        title: `Категории без татами: ${catsWithoutTatami.map((c) => c.name).join(", ")}`,
        detail: "Назначьте татами каждой категории с сеткой.",
        tab: "schedule",
        actionLabel: "Назначить татами",
        target: "schedule",
      })
    }
    if (noBracketCats.length > 0) {
      issues.push({
        id: "no-brackets",
        severity: "warn",
        title: `Нет сетки: ${noBracketCats.map((c) => c.name).join(", ")}`,
        detail: "Постройте сетки — вручную или мастером.",
        tab: "brackets",
        actionLabel: "Создать сетки",
        target: "brackets",
      })
    }
    if (input.fightsWithoutTatami > 0) {
      issues.push({
        id: "fights-without-tatami",
        severity: "warn",
        title: `Боёв без татами: ${input.fightsWithoutTatami}`,
        detail: "Распределите бои перед стартом.",
        tab: "schedule",
        actionLabel: "Распределить",
        target: "schedule",
      })
    }
    if (hasAnyBracket && input.fightsWithoutReferee > 0) {
      issues.push({
        id: "fights-without-referee",
        severity: "warn",
        title: `Боёв без судьи: ${input.fightsWithoutReferee}`,
        detail: "Назначьте судей на готовые бои.",
        tab: "staff",
        actionLabel: "Назначить судей",
        target: "staff",
      })
    }
    if (isPastDraft(input.startDate, input.status)) {
      issues.push({
        id: "date-past",
        severity: "warn",
        title: "Дата начала прошла, а турнир ещё черновик",
        detail: "Проверьте дату или опубликуйте турнир.",
        tab: "settings",
        actionLabel: "Открыть настройки",
        target: "settings",
      })
    }
  }

  // Overall: взвешенная сумма (веса — в WEIGHTS выше).
  let overall: number
  if (finished) {
    overall = 100
  } else {
    let acc = 0
    let total = 0
    for (const [key, weight] of Object.entries(WEIGHTS) as [
      keyof ReadinessSections,
      number,
    ][]) {
      acc += statusScore(sections[key]) * weight
      total += weight
    }
    overall = Math.round(acc / total)
  }

  const nextAction = computeNextAction(input, issues, {
    emptyCats: emptyCats.length,
    noBracketCount: noBracketCats.length,
    catsWithoutTatami: catsWithoutTatami.length,
  })

  return {
    sections,
    overall,
    nextAction,
    issues,
    blockers: issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.title} — ${i.detail}`),
  }
}

function computeNextAction(
  input: ReadinessEngineInput,
  issues: TournamentIssue[],
  derived: { emptyCats: number; noBracketCount: number; catsWithoutTatami: number }
): NextAction | null {
  if (input.status === "finished") return null
  if (input.categories.length === 0) {
    return {
      id: "no-categories",
      text: "Категорий пока нет — мастер поможет подготовить турнир шаг за шагом.",
      actionLabel: "Подготовить турнир",
      target: "wizard",
    }
  }
  if (input.uncategorizedCount > 0) {
    const n = input.uncategorizedCount
    return {
      id: "uncategorized",
      text: `${n} ${plural(n, ["участник", "участника", "участников"])} без категории — распределите их.`,
      actionLabel: "Распределить",
      target: "participants",
    }
  }
  if (input.checkin !== null && input.checkin.missing > 0) {
    const n = input.checkin.missing
    return {
      id: "checkin-missing",
      text: `${n} ${plural(n, ["спортсмен", "спортсмена", "спортсменов"])} ещё не прошли явку.`,
      actionLabel: "Проверить явку",
      target: "participants",
    }
  }
  if (input.weighin !== null && input.weighin.unweighed > 0) {
    const n = input.weighin.unweighed
    return {
      id: "weighin-pending",
      text: `Не взвешены: ${n} — откройте взвешивание.`,
      actionLabel: "Открыть взвешивание",
      target: "weighin",
    }
  }
  if (input.weighin !== null && input.weighin.overweight > 0) {
    const n = input.weighin.overweight
    return {
      id: "overweight",
      text: `Перевес у ${n} ${plural(n, ["участника", "участников", "участников"])} — проверьте вес.`,
      actionLabel: "Проверить вес",
      target: "weighin",
    }
  }
  if (derived.catsWithoutTatami > 0) {
    return {
      id: "categories-without-tatami",
      text: `Категории без татами: ${derived.catsWithoutTatami} — назначьте татами.`,
      actionLabel: "Назначить татами",
      target: "schedule",
    }
  }
  if (derived.noBracketCount > 0) {
    return {
      id: "no-bracket",
      text: `Сетки не построены в кат.: ${derived.noBracketCount} — мастер создаст их автоматически.`,
      actionLabel: "Подготовить турнир",
      target: "wizard",
    }
  }
  if (input.fightsWithoutTatami > 0) {
    return {
      id: "no-tatami",
      text: `Бои без татами: ${input.fightsWithoutTatami} — распределите их мастером или кнопкой ниже.`,
      actionLabel: "Подготовить турнир",
      target: "wizard",
    }
  }
  if (input.fightsWithoutReferee > 0) {
    const n = input.fightsWithoutReferee
    return {
      id: "no-referee",
      text: `Бои без судьи: ${n} — назначьте судей.`,
      actionLabel: "Назначить судей",
      target: "staff",
    }
  }
  if (input.status !== "published") {
    const blocker = issues.find((i) => i.severity === "error")
    if (blocker) {
      return {
        id: "blockers",
        text: `Есть проблемы, мешающие публикации (${issues.filter((i) => i.severity === "error").length}). Исправьте их перед стартом.`,
        actionLabel: "Проверить готовность",
        target: blocker.tab,
      }
    }
    return {
      id: "unpublished",
      text: "Всё готово — публикуйте турнир для участников и зрителей.",
      actionLabel: "Опубликовать",
      target: "publish",
    }
  }
  return null
}
