"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import type { News } from "@/lib/types"
import EmptyState from "@/components/ui/EmptyState"
import { Newspaper } from "lucide-react"

export default function NewsDetailPage() {
  const params = useParams()
  const [item, setItem] = useState<News | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<News>(`/api/news/${params.slug}/`)
      .then(setItem)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
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
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[800px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link
            href="/news"
            className="inline-flex items-center text-sm font-semibold text-primary-blue hover:text-primary-blue-light mb-6 transition-colors"
          >
            ← Ко всем новостям
          </Link>

          <time className="block text-sm font-medium text-secondary-text mb-3">
            {new Date(item.published_at || item.created_at).toLocaleDateString("ru-RU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
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
    </div>
  )
}
