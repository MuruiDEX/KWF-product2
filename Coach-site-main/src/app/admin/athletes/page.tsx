"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Users, Plus, Edit, Trash, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api, unwrapList } from "@/lib/api"
import type { Athlete } from "@/lib/types"

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    weight: "",
    height: "",
    gender: "male" as "male" | "female",
  })

  const loadAthletes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<Athlete[] | { results: Athlete[] }>(
        "/api/tournament/athletes/"
      )
      setAthletes(unwrapList(data))
    } catch (e) {
      console.error("Failed to load athletes", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAthletes()
  }, [loadAthletes])

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
      alert("Ошибка при сохранении атлета")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить этого атлета?")) return
    setSaving(true)
    try {
      await api(`/api/tournament/athletes/${id}/`, {
        method: "DELETE",
      })
      await loadAthletes()
    } catch (e) {
      alert("Ошибка при удалении атлета")
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
      birth_date: a.birth_date,
      weight: a.weight,
      height: a.height || "",
      gender: a.gender,
    })
    setShowModal(true)
  }

  const filteredAthletes = athletes.filter(
    (a) =>
      `${a.first_name} ${a.last_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )

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
        <div className="p-4 border-b border-border bg-light-gray/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text" size={18} />
            <input
              type="text"
              placeholder="Поиск по имени или фамилии..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {filteredAthletes.map((a) => (
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
                        className="h-8 w-8 p-0 text-primary-blue hover:bg-primary-blue/10"
                        onClick={() => openEdit(a)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAthletes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-secondary-text">
                    {search ? "Ничего не найдено" : "Список атлетов пуст"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl"
          >
            <h3 className="text-xl font-bold text-dark-text mb-6">
              {editingAthlete ? "Редактировать атлета" : "Добавить атлета"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Имя *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Фамилия *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Дата рождения *</label>
                  <input
                    type="date"
                    required
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Пол *</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  >
                    <option value="male">Мальчик</option>
                    <option value="female">Девочка</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Вес (кг) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Рост (см)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
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
    </div>
  )
}
