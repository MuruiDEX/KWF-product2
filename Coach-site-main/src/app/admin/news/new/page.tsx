"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { apiErrorMessage } from "@/lib/api"
import { createNews, type NewsFormValues } from "@/lib/news"
import { NewsForm } from "@/components/NewsForm"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { toast } from "@/components/ui/Toaster"

const EMPTY: NewsFormValues = { title: "", description: "", imageFile: null, is_published: false }

export default function CreateNewsPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleSubmit(values: NewsFormValues) {
    if (busy) return
    setBusy(true)
    try {
      // FormData: картинка уходит файлом (бэкенд ждёт файл, не URL).
      const news = await createNews(values)
      toast(
        news.is_published ? "✓ Новость опубликована" : "Черновик сохранён",
        "success"
      )
      router.push("/admin/news")
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setBusy(false)
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
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl border border-border p-8"
      >
        <NewsForm
          initial={EMPTY}
          submitDraftLabel="Сохранить черновик"
          submitPublishLabel="Опубликовать"
          busy={busy}
          onSubmit={(v) => void handleSubmit(v)}
          onCancel={() => router.back()}
        />
      </motion.div>
    </div>
  )
}
