export type ManageTabId =
  | "overview"
  | "participants"
  | "weighin"
  | "categories"
  | "schedule"
  | "brackets"
  | "staff"
  | "communication"
  | "documents"
  | "settings"

export interface ReadinessCategory {
  id: number
  name: string
  athleteCount: number
  hasBracket: boolean
}

export interface ReadinessInput {
  status: string
  /** YYYY-MM-DD или null. */
  startDate: string | null
  categories: ReadinessCategory[]
  tatamiCount: number
  /** Готовые/ожидающие бои без назначенного татами. */
  fightsWithoutTatami: number
}

export interface ReadinessItem {
  id: string
  ok: boolean
  level: "error" | "warn"
  text: string
  tab: ManageTabId
}

export interface ReadinessReport {
  items: ReadinessItem[]
  readyCount: number
  totalCount: number
  /** Тексты ошибок — для диалога публикации. */
  blockers: string[]
}

/** Чистая функция: готовность турнира к публикации/старту.
 * error — публиковать нельзя без последствий, warn — стоит проверить. */
export function computeReadiness(input: ReadinessInput): ReadinessReport {
  const items: ReadinessItem[] = []

  if (input.categories.length === 0) {
    items.push({
      id: "no-categories",
      ok: false,
      level: "error",
      text: "Нет категорий — создайте хотя бы одну",
      tab: "participants",
    })
  } else {
    const empty = input.categories.filter((c) => c.athleteCount === 0)
    const single = input.categories.filter((c) => c.athleteCount === 1)
    const noBracket = input.categories.filter(
      (c) => c.athleteCount >= 2 && !c.hasBracket
    )
    items.push({
      id: "categories-filled",
      ok: empty.length === 0 && single.length === 0,
      level: "error",
      text:
        empty.length > 0
          ? `Пустые категории: ${empty.map((c) => c.name).join(", ")}`
          : single.length > 0
            ? `По одному участнику (сетка невозможна): ${single.map((c) => c.name).join(", ")}`
            : `Состав категорий заполнен (${input.categories.length})`,
      tab: "participants",
    })
    items.push({
      id: "brackets-built",
      ok: noBracket.length === 0,
      level: "warn",
      text:
        noBracket.length > 0
          ? `Нет сетки: ${noBracket.map((c) => c.name).join(", ")}`
          : "Сетки построены",
      tab: "brackets",
    })
  }

  items.push({
    id: "tatamis",
    ok: input.tatamiCount > 0,
    level: "error",
    text:
      input.tatamiCount > 0
        ? `Татами: ${input.tatamiCount}`
        : "Нет татами — распределение боёв невозможно",
    tab: "schedule",
  })

  if (input.fightsWithoutTatami > 0) {
    items.push({
      id: "fights-tatami",
      ok: false,
      level: "warn",
      text: `Боёв без татами: ${input.fightsWithoutTatami} — распределите перед стартом`,
      tab: "schedule",
    })
  }

  if (input.status !== "published" && input.startDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(`${input.startDate}T00:00:00`)
    if (!Number.isNaN(start.getTime()) && start < today) {
      items.push({
        id: "date-past",
        ok: false,
        level: "warn",
        text: "Дата начала прошла, а турнир ещё черновик",
        tab: "settings",
      })
    }
  }

  const readyCount = items.filter((i) => i.ok).length
  return {
    items,
    readyCount,
    totalCount: items.length,
    blockers: items
      .filter((i) => !i.ok && i.level === "error")
      .map((i) => i.text),
  }
}
