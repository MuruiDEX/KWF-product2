"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { api, unwrapList } from "@/lib/api"
import type { News } from "@/lib/types"

export default function LatestNews() {
  const [news, setNews] = useState<News[]>([])

  useEffect(() => {
    let cancelled = false
    api<News[] | { results: News[] }>("/api/news/")
      .then((data) => {
        if (!cancelled) setNews(unwrapList(data).slice(0, 3))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (news.length === 0) return null

  return (
    <section id="news" className="py-16 md:py-24 bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-dark-text mb-4">
            Новости
          </h2>
          <p className="text-secondary-text max-w-2xl mx-auto">
            Последние новости нашей секции и соревнований
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {news.map((item, i) => (
            <motion.div
              key={item.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link href={`/news/${item.slug}`}>
                <div className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:border-primary-blue/20 transition-all duration-300 h-full">
                  {item.image && (
                    <div className="aspect-video bg-light-gray">
                      <img
                        src={item.image}
                        alt={item.title}
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
