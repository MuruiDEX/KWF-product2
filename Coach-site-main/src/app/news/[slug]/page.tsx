"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import type { News } from "@/lib/types"
import AppShell from "@/components/AppShell"
import EmptyState from "@/components/ui/EmptyState"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { Newspaper } from "lucide-react"

export default function NewsDetailPage() {
  const params = useParams()
  const [item, setItem] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // L1: отмена setState после unmount (быстрое переключение новостей).
    let cancelled = false
    api<News>(`/api/news/${params.slug}/`)
      .then((data) => {
        if (!cancelled) setItem(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params.slug])

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[800px] px-6 py-16 space-y-5" role="status" aria-label="Загрузка новости">
          <div className="h-4 w-40 rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
          <div className="h-10 w-3/4 rounded-lg bg-light-gray animate-pulse dark:bg-white/[0.06]" />
          <div className="aspect-video rounded-2xl bg-light-gray animate-pulse dark:bg-white/[0.06]" />
          <div className="space-y-2.5">
            <div className="h-4 w-full rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
            <div className="h-4 w-full rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
            <div className="h-4 w-2/3 rounded bg-light-gray animate-pulse dark:bg-white/[0.06]" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!item) {
    return (
      <AppShell>
        <div className="flex items-center justify-center px-6 py-16">
          <EmptyState
            icon={<Newspaper size={26} />}
            title="Новость не найдена"
            hint="Возможно, она была удалена или ещё не опубликована"
            action={
              <Link
                href="/news"
                className="text-sm font-semibold text-primary-blue hover:text-primary-blue-light"
              >
                ← Ко всем новостям
              </Link>
            }
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[800px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Breadcrumbs
            items={[
              { label: "Главная", href: "/" },
              { label: "Новости", href: "/news" },
              { label: item.title },
            ]}
          />

          <time className="block text-sm font-medium text-secondary-text mt-6 mb-3">
            {new Date(item.published_at || item.created_at).toLocaleDateString("ru-RU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {item.author_name ? ` · ${item.author_name}` : ""}
          </time>

          <h1 className="text-3xl md:text-4xl font-extrabold text-dark-text mb-6">
            {item.title}
          </h1>

          {item.image && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-light-gray mb-8">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="prose prose-lg max-w-none text-dark-text/80 leading-relaxed">
            {item.description}
          </div>
        </motion.div>
      </div>
    </AppShell>
  )
}
