"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Users, Plus, Edit, Trash, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api, apiErrorMessage } from "@/lib/api"
import { usePagedList } from "@/lib/usePagedList"
import type { Athlete } from "@/lib/types"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { FormField, TextInput } from "@/components/ui/FormField"
import { toast } from "@/components/ui/Toaster"
import { useModalBehavior } from "@/lib/useModal"

export default function AthletesPage() {
  // N9: серверный поиск (?search=, debounce 400мс) — раньше фильтровалось
  // только загруженное, при 500+ атлетах вводило в заблуждение.
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      params.set("page", String(page))
      return `/api/tournament/athletes/?${params.toString()}`
    },
    [debouncedSearch]
  )
  const {
    items: athletes,
    total,
    hasMore,
    loading,
    loadingMore,
    loadError,
    loadMore,
    reload: loadAthletes,
  } = usePagedList<Athlete>(buildUrl, `athletes:${debouncedSearch}`)
  const [showModal, setShowModal] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Athlete | null>(null)

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    weight: "",
    height: "",
    gender: "male" as "male" | "female",
  })
  // Фаза 5: Escape + focus-trap + scroll-lock + возврат фокуса.
  const modalPanelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(showModal, () => setShowModal(false), modalPanelRef)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingAthlete) {
        await api(`/api/tournament/athletes/${editingAthlete.id}/`, {
          method: "PATCH",
          body: JSON.stringify(form),
        })
      } else {
        await api("/api/tournament/athletes/", {
          method: "POST",
          body: JSON.stringify(form),
        })
      }
      setShowModal(false)
      setEditingAthlete(null)
      setForm({ first_name: "", last_name: "", birth_date: "", weight: "", height: "", gender: "male" })
      await loadAthletes()
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (a: Athlete) => {
    setPendingDelete(a)
  }

  const doDelete = async (a: Athlete) => {
    setPendingDelete(null)
    setSaving(true)
    try {
      await api(`/api/tournament/athletes/${a.id}/`, {
        method: "DELETE",
      })
      await loadAthletes()
      toast("Атлет удалён", "success")
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingAthlete(null)
    setForm({ first_name: "", last_name: "", birth_date: "", weight: "", height: "", gender: "male" })
    setShowModal(true)
  }

  const openEdit = (a: Athlete) => {
    setEditingAthlete(a)
    setForm({
      first_name: a.first_name,
      last_name: a.last_name,
      birth_date: a.birth_date ?? "",
      weight: a.weight,
      height: a.height || "",
      gender: a.gender,
    })
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-3 bg-primary-blue rounded-xl text-white">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-dark-text">Участники</h1>
            <p className="text-sm text-secondary-text">Управление базой атлетов</p>
          </div>
        </motion.div>

        <Button onClick={openCreate} className="bg-primary-blue hover:bg-primary-blue-light text-white font-semibold">
          <Plus size={20} className="mr-2" />
          Добавить атлета
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loadError && athletes.length === 0 && (
          <div className="p-4 border-b border-error/30 bg-error-bg/40 text-sm text-error" role="alert">
            Не удалось загрузить список — проверьте соединение и{" "}
            <button type="button" onClick={() => loadAthletes()} className="font-bold underline cursor-pointer">
              повторите
            </button>
          </div>
        )}
        <div className="p-4 border-b border-border bg-light-gray/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text" size={18} />
            <input
              type="text"
              placeholder="Поиск по имени, фамилии или клубу…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
            />
          </div>
        </div>

        {/* Фаза 8: на мобильных — карточки вместо горизонтального скролла. */}
        <div className="md:hidden divide-y divide-border">
          {athletes.map((a) => (
            <div key={a.id} className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-dark-text truncate">{a.last_name} {a.first_name}</div>
                <div className="text-xs text-secondary-text mt-0.5">
                  {a.gender === "male" ? "Мальчик" : "Девочка"} · {a.age} лет · {a.weight} кг
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-primary-blue hover:bg-primary-blue/10"
                  onClick={() => openEdit(a)}
                  aria-label={`Редактировать: ${a.last_name} ${a.first_name}`}
                >
                  <Edit size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-red-500 hover:bg-red-50"
                  onClick={() => handleDelete(a)}
                  aria-label={`Удалить: ${a.last_name} ${a.first_name}`}
                >
                  <Trash size={16} />
                </Button>
              </div>
            </div>
          ))}
          {athletes.length === 0 && (
            <div className="px-4 py-12 text-center text-secondary-text">
                    {debouncedSearch ? `По запросу «${debouncedSearch}» никого не найдено` : "Список атлетов пуст"}
            </div>
          )}
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-light-gray/50 text-secondary-text text-xs uppercase font-bold">
                <th className="px-6 py-4">Атлет</th>
                <th className="px-6 py-4">Пол</th>
                <th className="px-6 py-4">Возраст</th>
                <th className="px-6 py-4">Вес (кг)</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {athletes.map((a) => (
                <tr key={a.id} className="hover:bg-light-gray/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-dark-text">{a.last_name} {a.first_name}</div>
                    <div className="text-xs text-secondary-text">ID: {a.id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-text">
                    {a.gender === "male" ? "Мальчик" : "Девочка"}
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-text">{a.age} лет</td>
                  <td className="px-6 py-4 text-sm text-dark-text">{a.weight} кг</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 text-primary-blue hover:bg-primary-blue/10"
                        onClick={() => openEdit(a)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(a)}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {athletes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-secondary-text">
              {debouncedSearch ? `По запросу «${debouncedSearch}» никого не найдено` : "Список атлетов пуст"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* F2: догрузка + честный счётчик; поиск фильтрует загруженное. */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-light-gray/30">
          <p className="text-xs text-secondary-text" role="status">
            {total !== null
              ? `Загружено ${athletes.length} из ${total}`
              : `Загружено: ${athletes.length}`}
          </p>
          {hasMore && (
            <Button onClick={loadMore} disabled={loadingMore} variant="secondary" size="sm">
              {loadingMore ? "Загрузка…" : "Показать ещё"}
            </Button>
          )}
        </div>
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingAthlete ? "Редактировать атлета" : "Добавить атлета"}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            ref={modalPanelRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl"
          >
            <h3 className="text-xl font-bold text-dark-text mb-6">
              {editingAthlete ? "Редактировать атлета" : "Добавить атлета"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Имя *" htmlFor="ath-first-name">
                  <TextInput
                    id="ath-first-name"
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </FormField>
                <FormField label="Фамилия *" htmlFor="ath-last-name">
                  <TextInput
                    id="ath-last-name"
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Дата рождения *" htmlFor="ath-birth-date">
                  <TextInput
                    id="ath-birth-date"
                    type="date"
                    required
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  />
                </FormField>
                <FormField label="Пол *" htmlFor="ath-gender">
                  <select
                    id="ath-gender"
                    value={form.gender}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gender: e.target.value === "female" ? "female" : "male",
                      })
                    }
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  >
                    <option value="male">Мальчик</option>
                    <option value="female">Девочка</option>
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Вес (кг) *" htmlFor="ath-weight">
                  <TextInput
                    id="ath-weight"
                    type="number"
                    step="0.1"
                    required
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  />
                </FormField>
                <FormField label="Рост (см)" htmlFor="ath-height">
                  <TextInput
                    id="ath-height"
                    type="number"
                    step="0.1"
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="h-11 px-6 text-sm"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-11 px-6 text-sm bg-primary-blue hover:bg-primary-blue-light text-white font-semibold"
                >
                  {saving ? "Сохранение..." : editingAthlete ? "Сохранить изменения" : "Добавить атлета"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Удалить атлета ${pendingDelete?.last_name ?? ""} ${pendingDelete?.first_name ?? ""}?`}
        confirmLabel="Удалить"
        danger
        busy={saving}
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
