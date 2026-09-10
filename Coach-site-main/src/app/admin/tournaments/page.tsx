"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye } from "lucide-react"

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTournaments()
  }, [])

  async function fetchTournaments() {
    setLoading(true)
    try {
      const data = await api<Tournament[]>("/api/tournament/tournaments/")
      setTournaments(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Вы уверены, что хотите удалить этот турнир?")) return
    try {
      await api(`/api/tournament/tournaments/${id}/`, { method: "DELETE" })
      await fetchTournaments()
    } catch (e) {
      alert("Ошибка при удалении")
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-dark-text">Управление турнирами</h1>
          <p className="text-secondary-text">Создание, редактирование и организация соревнований</p>
        </div>
        <Link href="/admin/tournaments/new">
          <Button className="gap-2">
            <Plus size={20} />
            Создать турнир
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-light-gray border-b border-border">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Турнир</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Дата</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Статус</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tournaments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-secondary-text">
                  Турниров пока нет
                </td>
              </tr>
            ) : (
              tournaments.map((t) => (
                <tr key={t.id} className="hover:bg-light-gray/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-dark-text">{t.name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary-text">
                    {new Date(t.start_date).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === "published"
                          ? "bg-green-100 text-green-700"
                          : t.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {t.status === "published" ? "Опубликован" : t.status === "draft" ? "Черновик" : "Завершён"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/tournaments/${t.slug}`}
                        target="_blank"
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Просмотр"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        href={`/admin/tournaments/${t.slug}/edit`}
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-secondary-text hover:text-red-500 transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
