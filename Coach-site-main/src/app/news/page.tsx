"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { api, unwrapList } from "@/lib/api"
import type { News } from "@/lib/types"
import EmptyState from "@/components/ui/EmptyState"
import { Newspaper } from "lucide-react"

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU")
}

export default function NewsListPage() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api<News[] | { results: News[] }>("/api/news/")
      .then((data) => {
        if (!cancelled) setNews(unwrapList(data))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-4xl font-extrabold text-dark-text mb-2">
            Новости
          </h1>
          <p className="text-secondary-text mb-10">
            Последние новости нашей секции
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : news.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<Newspaper size={26} />}
              title="Новостей пока нет"
              hint="Как только появятся новости секции, они будут опубликованы здесь"
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item, i) => (
              <motion.div
                key={item.slug || item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link href={`/news/${item.slug}`}>
                  <div className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary-blue/25 transition-all duration-300 h-full">
                    {item.image && (
                      <div className="aspect-video bg-light-gray">
                        <img
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = "none"
                          }}
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <time className="text-xs font-medium text-secondary-text">
                        {formatDate(item.published_at || item.created_at)}
                      </time>
                      <h2 className="text-lg font-bold text-dark-text mt-2 mb-2 line-clamp-2">
                        {item.title}
                      </h2>
                      <p className="text-sm text-secondary-text line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
