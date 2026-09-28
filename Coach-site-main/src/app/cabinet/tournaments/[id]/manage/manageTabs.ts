import type { ScheduleView } from "./_components/SchedulePanel"

export type ManageTab =
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

export function isManageTab(value: string | null): value is ManageTab {
  return (
    value === "overview" ||
    value === "participants" ||
    value === "weighin" ||
    value === "categories" ||
    value === "schedule" ||
    value === "brackets" ||
    value === "staff" ||
    value === "communication" ||
    value === "documents" ||
    value === "settings"
  )
}

/** Backward compatibility: старые ?tab= маппятся на новую IA. */
export function resolveTab(
  tab: string | null,
  view: string | null
): { tab: ManageTab; view: ScheduleView } {
  if (tab === "setup") return { tab: "categories", view: "planner" }
  if (tab === "live") return { tab: "schedule", view: "live" }
  if (tab === "bracket") return { tab: "brackets", view: "planner" }
  if (isManageTab(tab)) {
    return { tab, view: tab === "schedule" && view === "live" ? "live" : "planner" }
  }
  return { tab: "overview", view: "planner" }
}

/** Табы консоли: порядок и подписи в одном месте (таббар + keyboard nav). */
export function MANAGE_TABS(
  participantCount: number,
  liveCount: number
): { id: ManageTab; label: string }[] {
  return [
    { id: "overview", label: "Обзор" },
    { id: "participants", label: `Участники · ${participantCount}` },
    { id: "weighin", label: "Взвешивание" },
    { id: "categories", label: "Категории" },
    { id: "schedule", label: `Расписание${liveCount > 0 ? ` · LIVE ${liveCount}` : ""}` },
    { id: "brackets", label: "Сетки" },
    { id: "staff", label: "Судьи" },
    { id: "communication", label: "Связь" },
    { id: "documents", label: "Документы" },
    { id: "settings", label: "Настройки" },
  ]
}
