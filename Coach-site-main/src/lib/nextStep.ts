// Phase 1: единый следующий шаг организатора — ровно ОДИН рекомендуемый action.
// Чистая функция поверх уже загруженных данных (новых endpoints не требует).
// Приоритет: категории → явка → сетки → татами → публикация.

import type { ManageTabId } from "@/components/ReadinessChecklist"

export type NextStepTarget = ManageTabId | "publish" | "wizard"

export interface NextStepCategory {
  athleteCount: number
  hasBracket: boolean
}

export interface NextStepInput {
  status: string
  categories: NextStepCategory[]
  /** Готовые/ожидающие бои без назначенного татами. */
  fightsWithoutTatami: number
  /** Не прошедших явку. null — данные явки недоступны (шаг пропускается). */
  checkinMissing: number | null
  /** Табы Readiness-ошибок (blockers). Непустой список отменяет «публикуйте»:
   * нельзя рекомендовать действие, заблокированное явной ошибкой готовности. */
  blockerTabs?: ManageTabId[]
}

export interface NextStep {
  id: string
  text: string
  actionLabel: string
  target: NextStepTarget
}

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1]
  return forms[2]
}

export function getNextStep(input: NextStepInput): NextStep | null {
  if (input.status === "finished") return null

  if (input.categories.length === 0) {
    return {
      id: "no-categories",
      text: "Категорий пока нет — мастер поможет подготовить турнир шаг за шагом.",
      actionLabel: "Подготовить турнир",
      target: "wizard",
    }
  }

  if (input.checkinMissing !== null && input.checkinMissing > 0) {
    const n = input.checkinMissing
    return {
      id: "checkin-missing",
      text: `${n} ${plural(n, ["спортсмен", "спортсмена", "спортсменов"])} ещё не прошли явку.`,
      actionLabel: "Проверить явку",
      target: "participants",
    }
  }

  const noBracket = input.categories.filter(
    (c) => !c.hasBracket && c.athleteCount >= 2
  ).length
  if (noBracket > 0) {
    return {
      id: "no-bracket",
      text: `Сетки не построены в кат.: ${noBracket} — мастер создаст их автоматически.`,
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

  if (input.status !== "published") {
    const blockers = input.blockerTabs ?? []
    if (blockers.length > 0) {
      return {
        id: "blockers",
        text: `Есть проблемы, мешающие публикации (${blockers.length}). Исправьте их перед стартом.`,
        actionLabel: "Проверить готовность",
        target: blockers[0],
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
