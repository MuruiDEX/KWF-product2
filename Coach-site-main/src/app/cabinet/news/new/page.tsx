"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { createNews, type NewsFormValues } from "@/lib/news"
import { NewsForm } from "@/components/NewsForm"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { toast } from "@/components/ui/Toaster"

const EMPTY: NewsFormValues = { title: "", description: "", imageFile: null, is_published: false }

export default function CabinetNewsNewPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const role = user?.profile?.role ?? "parent"
  const canAccess = !!user && (role === "trainer" || user.is_staff)

  useEffect(() => {
    if (authLoading) return
    if (!user) router.push("/login?next=/cabinet/news/new")
    else if (!canAccess) router.push("/cabinet/news")
  }, [authLoading, user, canAccess, router])

  if (authLoading || !canAccess) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  async function handleSubmit(values: NewsFormValues) {
    if (busy) return
    setBusy(true)
    try {
      const news = await createNews(values)
      toast(
        news.is_published ? "✓ Новость опубликована" : "Черновик сохранён",
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
          { label: "Новая публикация" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-extrabold text-dark-text">Новая публикация</h1>
        <p className="text-secondary-text">Черновик видите только вы, опубликованное — все посетители</p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl border border-border p-6 sm:p-8"
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
