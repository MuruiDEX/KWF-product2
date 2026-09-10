"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import type { News } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye } from "lucide-react"

export default function AdminNewsPage() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews()
  }, [])

  async function fetchNews() {
    setLoading(true)
    try {
      const data = await api<News[]>("/api/news/")
      setNews(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Вы уверены, что хотите удалить эту новость?")) return
    try {
      await api(`/api/news/${id}/`, { method: "DELETE" })
      await fetchNews()
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
          <h1 className="text-3xl font-extrabold text-dark-text">Управление новостями</h1>
          <p className="text-secondary-text">Создание, редактирование и публикация новостей</p>
        </div>
        <Link href="/admin/news/new">
          <Button className="gap-2">
            <Plus size={20} />
            Создать новость
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-light-gray border-b border-border">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Новость</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Дата</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Статус</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {news.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-secondary-text">
                  Новостей пока нет
                </td>
              </tr>
            ) : (
              news.map((item) => (
                <tr key={item.id} className="hover:bg-light-gray/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <span className="text-sm font-medium text-dark-text line-clamp-1">
                        {item.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary-text">
                    {new Date(item.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.is_published ? "Опубликовано" : "Черновик"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/news/${item.slug}`}
                        target="_blank"
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Просмотр"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        href={`/admin/news/${item.slug}/edit`}
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(item.id)}
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
