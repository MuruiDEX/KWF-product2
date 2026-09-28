"use client"

import { SchedulePanel, type ScheduleView } from "./SchedulePanel"
import type { Tatami, TournamentCategory } from "@/lib/types"

interface ScheduleSectionProps {
  tournamentId: string | number
  view: ScheduleView
  onViewChange: (v: ScheduleView) => void
  tatamis: Tatami[]
  sortedCats: TournamentCategory[]
  tatamiLiveCount: (tatamiId: number) => number
  onAddTatami: () => void
  onDeleteTatami: (t: Tatami) => void
  dataUpdatedAt: number | null
}

/** Расписание: тонкая обёртка — логика/очередь живут в SchedulePanel. */
export function ScheduleSection(props: ScheduleSectionProps) {
  return <SchedulePanel {...props} />
}
