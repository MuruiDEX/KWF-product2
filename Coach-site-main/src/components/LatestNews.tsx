"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Newspaper } from "lucide-react"
import { api, unwrapList } from "@/lib/api"
import type { News } from "@/lib/types"
import SectionHeader from "@/components/ui/SectionHeader"
import EmptyState from "@/components/ui/EmptyState"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"

/** Фаза 2: секция всегда в DOM (без return null → нет прыжка layout).
 * Состояния: загрузка — скелетоны, пусто/ошибка — EmptyState,
 * данные — те же 3 карточки. Логика загрузки не менялась. */
export default function LatestNews() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api<News[] | { results: News[] }>("/api/news/")
      .then((data) => {
        if (!cancelled) setNews(unwrapList(data).slice(0, 3))
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
    <section id="news" className="py-16 md:py-24 bg-light-gray scroll-mt-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Новости"
          title="Новости"
          description="Последние новости нашей секции и соревнований"
        />

        {loading ? (
          <SkeletonGrid count={3} withImage label="Загрузка новостей…" />
        ) : news.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-7 h-7" strokeWidth={1.5} />}
            title="Новостей пока нет"
            hint="Загляните позже или откройте архив новостей"
            action={
              <Link
                href="/news"
                className="inline-flex items-center text-sm font-semibold text-primary-blue hover:text-primary-blue-light transition-colors"
              >
                Все новости →
              </Link>
            }
          />
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {news.map((item, i) => (
              <motion.div
                key={item.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: Math.min(i, 3) * 0.08 }}
              >
                <Link href={`/news/${item.slug}`}>
                  <div className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary-blue/20 transition-all duration-300 h-full">
                    {item.image && (
                      <div className="aspect-video bg-light-gray">
                        {/* Картинка с backend-медиа (хост переменный) —
                            поэтому plain <img>, как на /news. */}
                        <img
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <time className="text-xs font-medium text-secondary-text">
                        {new Date(item.published_at || item.created_at).toLocaleDateString("ru-RU")}
                      </time>
                      <h3 className="text-lg font-bold text-dark-text mt-2 mb-2 line-clamp-2">
                        {item.title}
                      </h3>
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

        <div className="text-center mt-8">
          <Link
            href="/news"
            className="inline-flex items-center text-sm font-semibold text-primary-blue hover:text-primary-blue-light transition-colors"
          >
            Все новости →
          </Link>
        </div>
      </div>
    </section>
  )
}
