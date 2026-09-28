"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { News } from "@/lib/types"
import { updateNews, type NewsFormValues } from "@/lib/news"
import { NewsForm } from "@/components/NewsForm"
import { toast } from "@/components/ui/Toaster"

export default function EditNewsPage() {
  const router = useRouter()
  const params = useParams()
  const slug = String(params.slug ?? "")
  const [item, setItem] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<News>(`/api/news/${slug}/`)
      .then((data) => {
        if (!cancelled) setItem(data)
      })
      .catch((e) => {
        if (!cancelled) toast(apiErrorMessage(e), "error")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleSubmit(values: NewsFormValues) {
    if (busy) return
    setBusy(true)
    try {
      const news = await updateNews(slug, values)
      toast(
        news.is_published ? "✓ Новость опубликована" : "Изменения сохранены",
        "success"
      )
      router.push("/admin/news")
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="bg-white rounded-2xl border border-border p-10 text-center">
        <h1 className="text-xl font-extrabold text-dark-text">Новость не найдена</h1>
        <p className="text-sm text-secondary-text mt-2">Возможно, она была удалена.</p>
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
        <h1 className="text-3xl font-extrabold text-dark-text">Редактировать новость</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl border border-border p-8"
      >
        <NewsForm
          initial={{
            title: item.title,
            description: item.description,
            imageFile: null,
            is_published: item.is_published,
          }}
          currentImage={item.image}
          submitDraftLabel="Снять с публикации"
          submitPublishLabel="Опубликовать"
          busy={busy}
          onSubmit={(v) => void handleSubmit(v)}
          onCancel={() => router.back()}
        />
      </motion.div>
    </div>
  )
}
