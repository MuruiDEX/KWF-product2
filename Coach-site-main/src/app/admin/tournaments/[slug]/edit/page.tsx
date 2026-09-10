"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { Tournament } from "@/lib/types"

export default function EditTournamentPage() {
  const router = useRouter()
  const params = useParams()
  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "draft",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
      .then((data) => {
        setForm({
          name: data.name,
          description: data.description,
          start_date: data.start_date,
          end_date: data.end_date,
          status: data.status,
        })
      })
      .catch(() => alert("Ошибка при загрузке турнира"))
      .finally(() => setLoading(false))
  }, [params.slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api(`/api/tournament/tournaments/${params.slug}/`, {
        method: "PATCH",
        body: JSON.stringify(form),
      })
      router.push("/admin/tournaments")
    } catch (e) {
      alert("Ошибка при сохранении турнира")
    } finally {
      setSaving(false)
    }
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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-secondary-text"
          onClick={() => router.back()}
        >
          <ArrowLeft size={16} />
          Назад
        </Button>
        <h1 className="text-3xl font-extrabold text-dark-text">Редактировать турнир</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-border p-8"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5">
              Название турнира *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5">
              Описание
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5">
                Дата начала *
              </label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5">
                Дата окончания *
              </label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
            >
              <option value="draft">Черновик</option>
              <option value="published">Опубликован</option>
              <option value="finished">Завершен</option>
            </select>
            <span className="text-sm font-semibold text-dark-text">Статус турнира</span>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href={`/admin/tournaments/${params.slug}/manage`}>
              <Button variant="outline" className="px-8">
                Управление сеткой
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="px-8"
            >
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
