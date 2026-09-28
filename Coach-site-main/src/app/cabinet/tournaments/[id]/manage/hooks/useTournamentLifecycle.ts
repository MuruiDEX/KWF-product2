"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, apiErrorMessage } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import type { ManageTab } from "../manageTabs"
import type { ManageConfirm } from "../manageConfirm"

// Жизненный цикл турнира: confirm-машина + публикация/завершение/удаление +
// шаблон. Диспетчер runConfirm выполняет доменные действия, которые
// инжектятся снаружи (doReopenMatch из useMatchMutations, doDeleteTatami из
// useTatamiActions, gotoTab из page), — циклов импорта нет.
export function useTournamentLifecycle(args: {
  confirm: ManageConfirm
  tournament: Tournament | null
  tournamentId: string | null
  blockers: string[]
  onChanged: () => Promise<void> | void
  onDistributeMsg: (m: { ok: boolean; text: string } | null) => void
  doReopenMatch: (matchId: number) => Promise<void>
  doDeleteTatami: (tatamiId: number) => Promise<void>
  gotoTab: (tab: ManageTab) => void
}) {
  const {
    confirm: confirmCtl,
    tournament,
    tournamentId,
    blockers,
    onChanged,
    onDistributeMsg,
    doReopenMatch,
    doDeleteTatami,
    gotoTab,
  } = args
  const { confirm, setConfirm, confirmBusy, setConfirmBusy } = confirmCtl
  const router = useRouter()
  const [tplModal, setTplModal] = useState<{ name: string } | null>(null)
  const [tplModalError, setTplModalError] = useState("")
  const [tplModalSaving, setTplModalSaving] = useState(false)

  async function doPublishToggle() {
    if (!tournament || !tournamentId) return
    const toPublished = tournament.status !== "published"
    try {
      await api(`/api/tournament/tournaments/${tournamentId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: toPublished ? "published" : "draft" }),
      })
      await onChanged()
    } catch (e) {
      console.error(e)
      onDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handlePublishToggle() {
    if (!tournament) return
    const toPublished = tournament.status !== "published"
    if (toPublished) {
      // Блокеры единого движка прямо в диалоге — публикация сырого турнира
      // превращается в осознанное решение, а не случайность.
      setConfirm({
        title: "Опубликовать турнир?",
        text:
          `«${tournament.name}» станет виден всем зрителям.` +
          (blockers.length > 0
            ? `\n\nОбратите внимание:\n${blockers.map((p) => `• ${p}`).join("\n")}`
            : ""),
        confirmLabel: "Опубликовать",
        danger: false,
        action: "publish",
      })
      return
    }
    await doPublishToggle()
  }

  async function handleDeleteTournament() {
    if (!tournament) return
    setConfirm({
      title: "Удалить турнир?",
      text: `«${tournament.name}»: все категории, матчи и раунды будут удалены. Спортсмены останутся в базе.`,
      confirmLabel: "Удалить",
      danger: true,
      action: "delete-tournament",
    })
  }

  async function doDeleteTournament() {
    if (!tournamentId) return
    try {
      await api(`/api/tournament/tournaments/${tournamentId}/`, { method: "DELETE" })
      router.push("/cabinet/tournaments")
    } catch (e) {
      console.error(e)
      onDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleFinishTournament() {
    if (!tournament) return
    setConfirm({
      title: "Завершить турнир?",
      text: `«${tournament.name}» будет завершён. Изменить завершённый турнир нельзя — это действие необратимо.`,
      confirmLabel: "Завершить",
      danger: true,
      action: "finish-tournament",
    })
  }

  async function doFinishTournament() {
    if (!tournamentId) return
    try {
      await api(`/api/tournament/tournaments/${tournamentId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: "finished" }),
      })
      await onChanged()
    } catch (e) {
      console.error(e)
      onDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function runConfirm() {
    if (!confirm || confirmBusy) return
    setConfirmBusy(true)
    try {
      const action = confirm.action
      if (action === "publish") {
        await doPublishToggle()
      } else if (action === "finish-tournament") {
        await doFinishTournament()
      } else if (action === "delete-tournament") {
        await doDeleteTournament()
      } else if (typeof action === "object" && action.type === "reopen-match") {
        await doReopenMatch(action.matchId)
      } else if (typeof action === "object" && action.type === "delete-tatami") {
        await doDeleteTatami(action.tatamiId)
      } else if (typeof action === "object" && action.type === "goto-tab") {
        // Guardrail-навигация (напр. «Исправить проблемы»): мутации нет,
        // только переход к месту исправления.
        gotoTab(action.tab)
      }
    } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  function openTemplateModal() {
    setTplModalError("")
    setTplModal({ name: tournament?.name ? `${tournament.name} — шаблон` : "" })
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!tplModal || !tournament || !tournamentId) return
    const name = tplModal.name.trim()
    if (!name) {
      setTplModalError("Введите название шаблона.")
      return
    }
    setTplModalSaving(true)
    setTplModalError("")
    try {
      await api("/api/tournament/tournaments/" + tournamentId + "/save_as_template/", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      setTplModal(null)
      onDistributeMsg({ ok: true, text: `Шаблон «${name}» сохранён. Используйте его при создании турнира.` })
    } catch (err) {
      setTplModalError(apiErrorMessage(err))
    } finally {
      setTplModalSaving(false)
    }
  }

  return {
    confirm,
    openConfirm: setConfirm,
    confirmBusy,
    runConfirm,
    handlePublishToggle,
    handleFinishTournament,
    handleDeleteTournament,
    tplModal,
    setTplModal,
    tplModalError,
    tplModalSaving,
    openTemplateModal,
    handleSaveTemplate,
  }
}
