"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function CreateNewsPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    is_published: false,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api("/api/news/", {
        method: "POST",
        body: JSON.stringify(form),
      })
      router.push("/admin/news")
    } catch (e) {
      alert("Ошибка при создании новости")
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-3xl font-extrabold text-dark-text">Создать новость</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-border p-8"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5">
              Заголовок *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
              placeholder="Введите заголовок новости"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5">
              Описание (текст новости) *
            </label>
            <textarea
              required
              rows={8}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all resize-none"
              placeholder="Введите текст новости..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1.5">
              URL изображения
            </label>
            <input
              type="url"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_published"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
            />
            <label htmlFor="is_published" className="text-sm font-semibold text-dark-text cursor-pointer">
              Опубликовать сразу
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="px-8"
            >
              {loading ? "Сохранение..." : "Сохранить новость"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
