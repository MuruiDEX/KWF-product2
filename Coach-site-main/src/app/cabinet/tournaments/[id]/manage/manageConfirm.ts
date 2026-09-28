"use client"

import { useState } from "react"
import type { ManageTab } from "./manageTabs"

export type ConfirmState = {
  title: string
  text: string
  confirmLabel: string
  danger: boolean
  action:
    | "publish"
    | "finish-tournament"
    | "delete-tournament"
    | { type: "reopen-match"; matchId: number }
    | { type: "delete-tatami"; tatamiId: number }
    | { type: "goto-tab"; tab: ManageTab }
}

// Общий стейт confirm-диалога: им владеет useTournamentLifecycle,
// открывают его useMatchMutations (переоткрытие, guardrail сеток) и
// useTatamiActions (удаление татами). Один диалог на весь /manage.
export function useManageConfirm() {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  return { confirm, setConfirm, confirmBusy, setConfirmBusy }
}

export type ManageConfirm = ReturnType<typeof useManageConfirm>
