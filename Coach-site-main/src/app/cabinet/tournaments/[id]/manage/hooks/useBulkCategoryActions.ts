"use client"

import { useId, useMemo, useState } from "react"
import { apiErrorMessage } from "@/lib/api"
import {
  bulkCheckinChunked,
  bulkUncheckChunked,
  buildCategoriesCsv,
  downloadTextFile,
  formatBulkCheckinSummary,
  formatBulkUncheckSummary,
} from "@/lib/bulkCategories"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { MatchableAthlete } from "@/lib/documentMatch"
import type { TournamentCategory } from "@/lib/types"
import type { DocumentPrefill } from "../_components/DocumentsSection"

export interface BulkFailed {
  ids: number[]
  names: Map<number, string>
}

// Декомпозиция page.tsx: выбор категорий + массовые действия над ними
// (экспорт/документы/явка/снятие явки/повторы). Хук владеет selection,
// busy-флагами и итогами; серверное обновление — через onChanged родителя
// (инвалидация Query), handoff документов — через onBulkDocuments.
export function useBulkCategoryActions(args: {
  tournamentId: string | null
  sortedCats: TournamentCategory[]
  regs: RegistrationEntry[] | null
  regsById: Map<number, boolean>
  onChanged: () => Promise<void> | void
  onBulkDocuments: (prefill: DocumentPrefill) => void
}) {
  const {
    tournamentId,
    sortedCats,
    regs,
    regsById,
    onChanged,
    onBulkDocuments,
  } = args
  // Ключ prefill — стабильный счётчик вместо Date.now (чистота для линтера).
  const prefillScope = useId()

  // Выбор самоочищается: id несуществующих категорий отфильтровываются.
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set())
  const liveCatIds = useMemo(
    () => new Set(sortedCats.map((c) => c.id)),
    [sortedCats]
  )
  const effectiveSelectedCats = useMemo(
    () => new Set([...selectedCats].filter((id) => liveCatIds.has(id))),
    [selectedCats, liveCatIds]
  )
  const toggleCatSelect = (key: string | number) => {
    if (typeof key !== "number") return
    setSelectedCats((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleCatSelectAll = (keys: (string | number)[], select: boolean) => {
    setSelectedCats((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (typeof k !== "number") continue
        if (select) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }

  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Неуспешные id + имена для повтора тем же составом (выбор не сбрасывается).
  const [failedCheckin, setFailedCheckin] = useState<BulkFailed | null>(null)
  const [failedUncheck, setFailedUncheck] = useState<BulkFailed | null>(null)
  // Id + имена на подтверждение снятия явки (ConfirmDialog).
  const [uncheckConfirm, setUncheckConfirm] = useState<BulkFailed | null>(null)
  // Версия данных явки — CheckinPanel перезагружает свой regs.
  const [checkinRefreshKey, setCheckinRefreshKey] = useState(0)
  const bumpCheckinRefresh = () => setCheckinRefreshKey((k) => k + 1)

  const selectedCategories = useMemo(
    () => sortedCats.filter((c) => effectiveSelectedCats.has(c.id)),
    [sortedCats, effectiveSelectedCats]
  )

  const clearBulkSelection = () => {
    setSelectedCats(new Set())
  }
  const clearBulkMsg = () => {
    setBulkMsg(null)
  }
  const closeUncheckConfirm = () => {
    if (!bulkBusy) setUncheckConfirm(null)
  }

  function handleBulkExport() {
    const csv = buildCategoriesCsv(
      selectedCategories.map((c) => ({ name: c.name, athletes: c.athletes || [] })),
      (id) => regsById.get(id) === true
    )
    downloadTextFile(`tournament-${tournamentId}-categories.csv`, csv)
  }

  function handleBulkDocuments() {
    const seen = new Map<number, MatchableAthlete>()
    for (const c of selectedCategories) {
      for (const a of c.athletes || []) {
        const prev = seen.get(a.id)
        const cats = [...(prev?.categoryNames ?? [])]
        if (!cats.includes(c.name)) cats.push(c.name)
        seen.set(a.id, {
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          birth_date: a.birth_date,
          club: a.club,
          weight: a.weight,
          gender: a.gender,
          categoryNames: cats,
        })
      }
    }
    onBulkDocuments({
      key: `${prefillScope}-${selectedCategories.map((c) => c.id).join("-")}`,
      source: `Категории: ${selectedCategories.map((c) => c.name).join(", ")}`,
      athletes: [...seen.values()],
    })
    clearBulkSelection()
  }

  async function handleBulkCheckin() {
    if (!regs) {
      setBulkMsg({ ok: false, text: "Данные явки недоступны — обновите страницу." })
      return
    }
    if (!tournamentId) {
      setBulkMsg({ ok: false, text: "Нет идентификатора турнира — обновите страницу." })
      return
    }
    const ids = new Set<number>()
    const names = new Map<number, string>()
    for (const c of selectedCategories) {
      for (const a of c.athletes || []) {
        if (regsById.get(a.id) !== true) {
          ids.add(a.id)
          names.set(a.id, `${a.last_name} ${a.first_name}`.trim())
        }
      }
    }
    if (ids.size === 0) {
      setBulkMsg({ ok: true, text: "Все спортсмены выбранных категорий уже отмечены." })
      return
    }
    setBulkBusy(true)
    setBulkMsg(null)
    setFailedCheckin(null)
    try {
      // Чанки по BULK_CHECKIN_MAX + итог с именами.
      const res = await bulkCheckinChunked(tournamentId, [...ids])
      setBulkMsg(formatBulkCheckinSummary(res, names))
      if (res.failed > 0) {
        // Выбор НЕ сбрасываем: ошибки можно повторить тем же составом.
        setFailedCheckin({
          ids: res.errors.map((e) => e.athlete_id),
          names,
        })
      } else {
        clearBulkSelection()
      }
      bumpCheckinRefresh()
      await onChanged()
    } catch (e) {
      console.error(e)
      setBulkMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleRetryFailedCheckin() {
    if (!tournamentId) return
    if (!failedCheckin || failedCheckin.ids.length === 0) return
    setBulkBusy(true)
    try {
      const res = await bulkCheckinChunked(tournamentId, failedCheckin.ids)
      setBulkMsg(formatBulkCheckinSummary(res, failedCheckin.names))
      if (res.failed > 0) {
        setFailedCheckin({
          ids: res.errors.map((e) => e.athlete_id),
          names: failedCheckin.names,
        })
      } else {
        setFailedCheckin(null)
      }
      bumpCheckinRefresh()
      await onChanged()
    } catch (e) {
      console.error(e)
      setBulkMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkUncheck() {
    if (!regs) {
      setBulkMsg({ ok: false, text: "Данные явки недоступны — обновите страницу." })
      return
    }
    const ids = new Set<number>()
    const names = new Map<number, string>()
    for (const c of selectedCategories) {
      for (const a of c.athletes || []) {
        if (regsById.get(a.id) === true) {
          ids.add(a.id)
          names.set(a.id, `${a.last_name} ${a.first_name}`.trim())
        }
      }
    }
    if (ids.size === 0) {
      setBulkMsg({ ok: true, text: "Все выбранные спортсмены уже без явки." })
      return
    }
    // Опасное действие — только через подтверждение, выбор не трогаем.
    setUncheckConfirm({ ids: [...ids], names })
  }

  async function runBulkUncheck(ids: number[], names: Map<number, string>) {
    if (!tournamentId) return
    setUncheckConfirm(null)
    setBulkBusy(true)
    setBulkMsg(null)
    setFailedUncheck(null)
    try {
      const res = await bulkUncheckChunked(tournamentId, ids)
      setBulkMsg(formatBulkUncheckSummary(res, names))
      if (res.failed > 0) {
        // Выбор НЕ сбрасываем: ошибки можно повторить тем же составом.
        setFailedUncheck({
          ids: res.errors.map((e) => e.athlete_id),
          names,
        })
      } else {
        clearBulkSelection()
      }
      bumpCheckinRefresh()
      await onChanged()
    } catch (e) {
      console.error(e)
      setBulkMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleRetryFailedUncheck() {
    if (!tournamentId) return
    if (!failedUncheck || failedUncheck.ids.length === 0) return
    setBulkBusy(true)
    try {
      const res = await bulkUncheckChunked(tournamentId, failedUncheck.ids)
      setBulkMsg(formatBulkUncheckSummary(res, failedUncheck.names))
      if (res.failed > 0) {
        setFailedUncheck({
          ids: res.errors.map((e) => e.athlete_id),
          names: failedUncheck.names,
        })
      } else {
        setFailedUncheck(null)
      }
      bumpCheckinRefresh()
      await onChanged()
    } catch (e) {
      console.error(e)
      setBulkMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setBulkBusy(false)
    }
  }

  return {
    effectiveSelectedCats,
    selectedCategories,
    toggleCatSelect,
    toggleCatSelectAll,
    clearBulkSelection,
    clearBulkMsg,
    bulkMsg,
    bulkBusy,
    failedCheckin,
    failedUncheck,
    uncheckConfirm,
    closeUncheckConfirm,
    bumpCheckinRefresh,
    checkinRefreshKey,
    handleBulkExport,
    handleBulkDocuments,
    handleBulkCheckin,
    handleRetryFailedCheckin,
    handleBulkUncheck,
    runBulkUncheck,
    handleRetryFailedUncheck,
  }
}
