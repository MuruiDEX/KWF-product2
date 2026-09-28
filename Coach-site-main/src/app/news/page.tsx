"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { usePagedList } from "@/lib/usePagedList"
import type { News } from "@/lib/types"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import EmptyState from "@/components/ui/EmptyState"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { Button } from "@/components/ui/button"
import { Newspaper } from "lucide-react"

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU")
}

export default function NewsListPage() {
  // F2: постраничная подгрузка вместо обрезки на 20.
  const {
    items: news,
    total,
    hasMore,
    loading,
    loadingMore,
    loadError,
    loadMore,
    reload: retry,
  } = usePagedList<News>((page) => `/api/news/?page=${page}`, "news")

  return (
    <AppShell>
      <div className="kwf-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Новости" }]} />
          <PageHeader
            eyebrow="Клуб"
            title="Новости"
            description="Последние новости нашей секции"
            className="mt-4"
          />
        </motion.div>

        {loading ? (
          <SkeletonGrid withImage label="Загрузка новостей" />
        ) : loadError ? (
          <ErrorRetry
            title="Не удалось загрузить новости"
            hint="Проверьте соединение с интернетом и попробуйте ещё раз"
            onRetry={retry}
          />
        ) : news.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white dark:bg-[#0E2035]">
            <EmptyState
              icon={<Newspaper size={26} />}
              title="Новостей пока нет"
              hint="Как только появятся новости секции, они будут опубликованы здесь"
            />
          </div>
        ) : (
          <>
            {total !== null && total > news.length && (
              <p className="text-xs text-secondary-text mb-4" role="status">
                Показано {news.length} из {total}
              </p>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item, i) => (
              <motion.div
                key={item.slug || item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i, 3) * 0.05 }}
              >
                <Link href={`/news/${item.slug}`}>
                  <div className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary-blue/25 transition-all duration-300 h-full dark:bg-[#0E2035]">
                    {item.image && (
                      <div className="aspect-video bg-light-gray dark:bg-white/[0.06]">
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
                      <h2 className="text-lg font-bold text-dark-text mt-2 mb-2 line-clamp-2 dark:text-slate-100">
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
            {hasMore && (
              <div className="flex justify-center mt-10">
                <Button onClick={loadMore} disabled={loadingMore} variant="secondary">
                  {loadingMore ? "Загрузка…" : "Показать ещё"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
