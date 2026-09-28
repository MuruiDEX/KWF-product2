"use client"

import { useState } from "react"
import { api, apiErrorMessage } from "@/lib/api"
import type { Athlete, Tournament, TournamentCategory } from "@/lib/types"

export interface CategoryFormState {
  id?: number
  name: string
  gender: string
  age_min: string
  age_max: string
  weight_min: string
  weight_max: string
}

export interface ParsedCategoryForm {
  name: string
  gender: string
  ageMin: number
  ageMax: number
  weightMin: number
  weightMax: number
}

/** Чистая валидация формы категории: текст ошибки или null. Покрыта тестами. */
export function validateCategoryForm(
  fields: CategoryFormState
): { error: string } | { parsed: ParsedCategoryForm } {
  const name = fields.name.trim()
  const ageMin = Number(fields.age_min)
  const ageMax = Number(fields.age_max)
  const weightMin = Number(String(fields.weight_min ?? "0").replace(",", ".")) || 0
  const weightMax = Number(String(fields.weight_max).replace(",", "."))
  if (!name) {
    return { error: "Введите название категории." }
  }
  if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 0 || ageMax < 0 || ageMin > ageMax) {
    return { error: "Укажите корректный возрастной диапазон." }
  }
  if (!Number.isFinite(weightMax) || weightMax <= 0) {
    return { error: "Укажите корректный максимальный вес." }
  }
  if (weightMin < 0 || weightMin > weightMax) {
    return { error: "Минимальный вес должен быть в пределах от 0 до максимального." }
  }
  return { parsed: { name, gender: fields.gender, ageMin, ageMax, weightMin, weightMax } }
}

// Категории: CRUD через модалку + состав (добавление, посев, удаление).
// Владеет membersBusy (татами-хук получает сеттер) и addSel селектов.
export function useCategoryActions(args: {
  tournament: Tournament | null
  onChanged: () => Promise<void> | void
  setMatchMsg: (m: { ok: boolean; text: string } | null) => void
}) {
  const { tournament, onChanged, setMatchMsg } = args
  const [catModal, setCatModal] = useState<CategoryFormState | null>(null)
  const [catModalError, setCatModalError] = useState("")
  const [catModalSaving, setCatModalSaving] = useState(false)
  const [membersBusy, setMembersBusy] = useState<string | null>(null)
  const [addSel, setAddSel] = useState<Record<number, string>>({})

  async function withBusy(key: string, fn: () => Promise<void>): Promise<void> {
    setMembersBusy(key)
    try {
      await fn()
    } finally {
      // Сбрасываем только свой флаг (та же гонка, что чинилась в татами-хуке).
      setMembersBusy((prev) => (prev === key ? null : prev))
    }
  }

  async function handleAddCategory() {
    setCatModalError("")
    setCatModal({ name: "", gender: "any", age_min: "8", age_max: "12", weight_min: "0", weight_max: "40" })
  }

  function openEditCategory(cat: TournamentCategory) {
    setCatModalError("")
    setCatModal({
      id: cat.id,
      name: cat.name,
      gender: cat.gender,
      age_min: String(cat.age_min),
      age_max: String(cat.age_max),
      weight_min: String(cat.weight_min ?? 0),
      weight_max: String(cat.weight_max),
    })
  }

  function closeCatModal() {
    setCatModal(null)
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!catModal || !tournament) return
    const validated = validateCategoryForm(catModal)
    if ("error" in validated) {
      setCatModalError(validated.error)
      return
    }
    const { parsed } = validated
    setCatModalSaving(true)
    setCatModalError("")
    try {
      if (catModal.id) {
        await api(`/api/tournament/categories/${catModal.id}/`, {
          method: "PATCH",
          body: JSON.stringify({
            name: parsed.name,
            gender: parsed.gender,
            age_min: parsed.ageMin,
            age_max: parsed.ageMax,
            weight_min: parsed.weightMin,
            weight_max: parsed.weightMax,
          }),
        })
      } else {
        await api("/api/tournament/categories/", {
          method: "POST",
          body: JSON.stringify({
            tournament: tournament.id,
            name: parsed.name,
            gender: parsed.gender,
            age_min: parsed.ageMin,
            age_max: parsed.ageMax,
            weight_min: parsed.weightMin,
            weight_max: parsed.weightMax,
            order: tournament.categories?.length || 0,
          }),
        })
      }
      setCatModal(null)
      await onChanged()
    } catch (err) {
      setCatModalError(apiErrorMessage(err))
    } finally {
      setCatModalSaving(false)
    }
  }

  async function handleAddToCategory(category: TournamentCategory) {
    const raw = addSel[category.id]
    if (!raw) return
    const key = `add-${category.id}`
    await withBusy(key, async () => {
      setMatchMsg(null)
      try {
        await api(`/api/tournament/categories/${category.id}/add_athletes/`, {
          method: "POST",
          body: JSON.stringify({ athlete_ids: [Number(raw)] }),
        })
        setAddSel((p) => ({ ...p, [category.id]: "" }))
        await onChanged()
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
      }
    })
  }

  // Посев: сдвинуть спортсмена в порядке (↑/↓), первый номер = топ посева.
  // Только до построения сетки.
  async function handleMoveSeed(
    category: TournamentCategory,
    athleteId: number,
    dir: -1 | 1
  ) {
    const ids = (category.athletes || []).map((a) => a.id)
    const i = ids.indexOf(athleteId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    const next = [...ids]
    next[i] = next[j]
    next[j] = athleteId
    const key = `seed-${category.id}`
    await withBusy(key, async () => {
      setMatchMsg(null)
      try {
        await api(`/api/tournament/categories/${category.id}/set_seed_order/`, {
          method: "POST",
          body: JSON.stringify({ athlete_ids: next }),
        })
        await onChanged()
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
      }
    })
  }

  async function handleRemoveFromCategory(category: TournamentCategory, athlete: Athlete) {
    const key = `rm-${category.id}-${athlete.id}`
    await withBusy(key, async () => {
      setMatchMsg(null)
      try {
        await api(`/api/tournament/categories/${category.id}/remove_athlete/`, {
          method: "POST",
          body: JSON.stringify({ athlete_id: athlete.id }),
        })
        await onChanged()
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
      }
    })
  }

  return {
    catModal,
    setCatModal,
    catModalError,
    catModalSaving,
    handleAddCategory,
    openEditCategory,
    closeCatModal,
    handleSaveCategory,
    membersBusy,
    setMembersBusy,
    addSel,
    setAddSel,
    handleAddToCategory,
    handleMoveSeed,
    handleRemoveFromCategory,
  }
}
