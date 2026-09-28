"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { News } from "@/lib/types"
import { updateNews, type NewsFormValues } from "@/lib/news"
import { NewsForm } from "@/components/NewsForm"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { toast } from "@/components/ui/Toaster"

/** Редактирование своей новости. Чужая — отказ на клиенте (и 403 на сервере). */
export default function CabinetNewsEditPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const slug = String(params.slug ?? "")
  const [item, setItem] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push(`/login?next=/cabinet/news/${slug}/edit`)
      return
    }
    let cancelled = false
    api<News>(`/api/news/${slug}/`)
      .then((data) => {
        if (cancelled) return
        const own = data.author === user.id || user.is_staff
        if (!own) {
          setDenied(true)
        } else {
          setItem(data)
        }
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
  }, [authLoading, user, slug, router])

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (denied || !item) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Кабинет", href: "/cabinet" },
            { label: "Новости", href: "/cabinet/news" },
            { label: "Редактирование" },
          ]}
        />
        <div className="bg-white rounded-2xl border border-border p-10 text-center">
          <h1 className="text-xl font-extrabold text-dark-text">
            {denied ? "Чужая публикация" : "Новость не найдена"}
          </h1>
          <p className="text-sm text-secondary-text mt-2">
            {denied
              ? "Редактировать можно только собственные новости."
              : "Возможно, она была удалена."}
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit(values: NewsFormValues) {
    if (busy) return
    setBusy(true)
    try {
      const news = await updateNews(slug, values)
      toast(
        news.is_published ? "✓ Новость опубликована" : "Изменения сохранены",
        "success"
      )
      router.push("/cabinet/news")
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Кабинет", href: "/cabinet" },
          { label: "Новости", href: "/cabinet/news" },
          { label: "Редактирование" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-extrabold text-dark-text">Редактировать новость</h1>
        <p className="text-secondary-text truncate">{item.title}</p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl border border-border p-6 sm:p-8"
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
