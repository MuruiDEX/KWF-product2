"use client"

import { StaffPanel } from "./StaffPanel"
import type { Tatami, Tournament } from "@/lib/types"

interface StaffSectionProps {
  tournamentId: string | number
  tournament: Tournament
  tatamis: Tatami[]
  onAssigned: (matchId: number, refereeId: number, refereeName: string) => void
}

/** Судьи: StaffPanel уже компактен (inline-назначение) — без изменений. */
export function StaffSection(props: StaffSectionProps) {
  return <StaffPanel {...props} />
}
