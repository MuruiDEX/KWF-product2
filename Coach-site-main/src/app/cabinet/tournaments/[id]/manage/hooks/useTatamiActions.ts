"use client"

import { useState } from "react"
import { api, apiErrorMessage } from "@/lib/api"
import type { Tatami, Tournament, TournamentCategory } from "@/lib/types"
import type { ConfirmState } from "../manageConfirm"

function allMatchesCount(tournament: Tournament | null, tatamiId: number) {
  return (tournament?.categories || [])
    .flatMap((c) => (c.rounds || []).flatMap((r) => r.matches || []))
    .filter(
      (m) => m.tatami === tatamiId && m.status !== "finished" && m.status !== "bye"
    ).length
}

// Татами и распределение: создание/удаление, раздача боёв и категорий,
// привязка категории к татами, mats_count. Ошибки операций — в distributeMsg
// (шапка), ошибки привязки категории — в matchMsg через onMatchError
// (панель сеток), как раньше.
export function useTatamiActions(args: {
  tournamentId: string | null
  tournament: Tournament | null
  tatamis: Tatami[]
  onChanged: () => Promise<void> | void
  openConfirm: (c: ConfirmState) => void
  setMembersBusy: React.Dispatch<React.SetStateAction<string | null>>
  onMatchError: (text: string) => void
}) {
  const {
    tournamentId,
    tournament,
    tatamis,
    onChanged,
    openConfirm,
    setMembersBusy,
    onMatchError,
  } = args
  const [distributing, setDistributing] = useState(false)
  const [distributeMsg, setDistributeMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function withBusy<T>(key: string, fn: () => Promise<T>): Promise<T> {
    setMembersBusy(key)
    try {
      return await fn()
    } finally {
      // Сбрасываем только свой флаг: параллельная операция в другой
      // категории не должна гаситься чужому finally.
      setMembersBusy((prev) => (prev === key ? null : prev))
    }
  }

  async function handleDistributeTatamis() {
    if (!tournamentId) return
    setDistributing(true)
    setDistributeMsg(null)
    try {
      const res = await api<{ distributed: number; waiting: number; hint?: string | null }>(
        `/api/tournament/tournaments/${tournamentId}/distribute_tatamis/`,
        { method: "POST" }
      )
      if (res.distributed > 0) {
        setDistributeMsg({ ok: true, text: `Распределено боёв: ${res.distributed}.` })
      } else if (res.hint) {
        setDistributeMsg({ ok: true, text: res.hint })
      } else {
        setDistributeMsg({ ok: true, text: "Все готовые бои уже распределены." })
      }
      await onChanged()
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setDistributing(false)
    }
  }

  async function handleEnsureTatamis() {
    if (!tournamentId) return
    const need = Math.max(1, tournament?.mats_count ?? 1) - tatamis.length
    if (need <= 0) return
    const startOrder = tatamis.length > 0 ? Math.max(...tatamis.map((t) => t.order)) + 1 : 1
    setDistributing(true)
    setDistributeMsg(null)
    try {
      for (let i = 0; i < need; i++) {
        const order = startOrder + i
        await api("/api/tournament/tatamis/", {
          method: "POST",
          body: JSON.stringify({ name: `Татами ${order}`, order }),
        })
      }
      setDistributeMsg({ ok: true, text: `Создано татами: ${need}. Теперь нажмите «Распределить татами».` })
      await onChanged()
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setDistributing(false)
    }
  }

  async function handleAddTatami() {
    const order = tatamis.length > 0 ? Math.max(...tatamis.map((t) => t.order)) + 1 : 1
    try {
      await api("/api/tournament/tatamis/", {
        method: "POST",
        body: JSON.stringify({ name: `Татами ${order}`, order }),
      })
      await onChanged()
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleDistributeCategories() {
    if (!tournamentId) return
    setDistributing(true)
    setDistributeMsg(null)
    try {
      const res = await api<{ distributed: Record<string, number[]>; moved_matches: number }>(
        `/api/tournament/tournaments/${tournamentId}/distribute_categories/`,
        { method: "POST" }
      )
      const parts = Object.entries(res.distributed).map(([tid, cids]) => {
        const t = tatamis.find((x) => x.id === Number(tid))
        return `${t ? t.name : `Татами ${tid}`}: ${cids.length} кат.`
      })
      setDistributeMsg({
        ok: true,
        text: parts.length
          ? `Категории распределены — ${parts.join(" · ")}. Боёв перенесено: ${res.moved_matches}.`
          : "Категорий пока нет.",
      })
      await onChanged()
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setDistributing(false)
    }
  }

  async function handleCategoryTatami(cat: TournamentCategory, tatamiId: string) {
    const key = `ctat-${cat.id}`
    await withBusy(key, async () => {
      try {
        await api(`/api/tournament/categories/${cat.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ tatami: tatamiId === "" ? null : Number(tatamiId) }),
        })
        await onChanged()
      } catch (e) {
        console.error(e)
        onMatchError(apiErrorMessage(e))
      }
    })
  }

  function handleDeleteTatami(tatami: Tatami) {
    const live = allMatchesCount(tournament, tatami.id)
    openConfirm({
      title: `Удалить «${tatami.name}»?`,
      text:
        live > 0
          ? `На нём есть незавершённые бои (${live}) — они останутся без татами.`
          : "Татами будет удалено.",
      confirmLabel: "Удалить",
      danger: true,
      action: { type: "delete-tatami", tatamiId: tatami.id },
    })
  }

  async function doDeleteTatami(tatamiId: number) {
    try {
      await api(`/api/tournament/tatamis/${tatamiId}/`, { method: "DELETE" })
      await onChanged()
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleSaveMatsCount(n: number) {
    if (!tournamentId) return
    try {
      await api(`/api/tournament/tournaments/${tournamentId}/`, {
        method: "PATCH",
        body: JSON.stringify({ mats_count: n }),
      })
      setDistributeMsg({ ok: true, text: `Количество татами: ${n}. Недостающие создаются во вкладке «Расписание».` })
      await onChanged()
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  return {
    distributing,
    distributeMsg,
    setDistributeMsg,
    clearDistributeMsg: () => setDistributeMsg(null),
    handleDistributeTatamis,
    handleEnsureTatamis,
    handleAddTatami,
    handleDistributeCategories,
    handleCategoryTatami,
    handleDeleteTatami,
    doDeleteTatami,
    handleSaveMatsCount,
  }
}
