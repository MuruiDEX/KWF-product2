"use client"

import { useState } from "react"
import { api, apiErrorMessage } from "@/lib/api"
import type { Tournament, TournamentCategory } from "@/lib/types"

export interface RoundFormState {
  categoryId: number
  name: string
}

// Раунды: создание через модалку. Маленький хук — отдельная ответственность,
// чтобы page не держала ещё три useState ради одной формы.
export function useRoundActions(args: {
  tournament: Tournament | null
  onChanged: () => Promise<void> | void
}) {
  const { tournament, onChanged } = args
  const [roundModal, setRoundModal] = useState<RoundFormState | null>(null)
  const [roundModalError, setRoundModalError] = useState("")
  const [roundModalSaving, setRoundModalSaving] = useState(false)

  async function handleAddRound(category: TournamentCategory) {
    setRoundModalError("")
    setRoundModal({ categoryId: category.id, name: "" })
  }

  function closeRoundModal() {
    setRoundModal(null)
  }

  async function handleSaveRound(e: React.FormEvent) {
    e.preventDefault()
    if (!roundModal || !tournament) return
    const name = roundModal.name.trim()
    if (!name) {
      setRoundModalError("Введите название раунда.")
      return
    }
    const category = (tournament.categories || []).find((c) => c.id === roundModal.categoryId)
    if (!category) {
      setRoundModalError("Категория не найдена. Обновите страницу.")
      return
    }
    setRoundModalSaving(true)
    setRoundModalError("")
    try {
      await api("/api/tournament/rounds/", {
        method: "POST",
        body: JSON.stringify({
          category: category.id,
          name,
          order: category.rounds.length || 0,
        }),
      })
      setRoundModal(null)
      await onChanged()
    } catch (err) {
      setRoundModalError(apiErrorMessage(err))
    } finally {
      setRoundModalSaving(false)
    }
  }

  return {
    roundModal,
    setRoundModal,
    roundModalError,
    roundModalSaving,
    handleAddRound,
    closeRoundModal,
    handleSaveRound,
  }
}
