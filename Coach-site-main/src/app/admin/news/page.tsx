"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { usePagedList } from "@/lib/usePagedList"
import type { News } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye, Search } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import StatusPill from "@/components/ui/StatusPill"
import { toast } from "@/components/ui/Toaster"

type NewsStatusFilter = "all" | "published" | "draft"

const NEWS_FILTERS: { id: NewsStatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "published", label: "Опубликованы" },
  { id: "draft", label: "Черновики" },
]

export default function AdminNewsPage() {
  // N9: серверный поиск + фильтр публикации (?search=, ?is_published=).
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<NewsStatusFilter>("all")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams()
      if (debouncedQuery) params.set("search", debouncedQuery)
      if (statusFilter !== "all") params.set("is_published", statusFilter === "published" ? "true" : "false")
      params.set("page", String(page))
      return `/api/news/?${params.toString()}`
    },
    [debouncedQuery, statusFilter]
  )
  const {
    items: news,
    total,
    hasMore,
    loading,
    loadingMore,
    loadError,
    loadMore,
    reload: fetchNews,
  } = usePagedList<News>(buildUrl, `admin-news:${debouncedQuery}:${statusFilter}`)
  const [pendingDelete, setPendingDelete] = useState<News | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(item: News) {
    setPendingDelete(item)
  }

  async function doDelete(item: News) {
    setPendingDelete(null)
    setDeleting(true)
    try {
      // Lookup бэкенда — slug, удаление по id даёт 404.
      await api(`/api/news/${item.slug}/`, { method: "DELETE" })
      await fetchNews()
      toast("Новость удалена", "success")
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-dark-text">Управление новостями</h1>
          <p className="text-secondary-text">Создание, редактирование и публикация новостей</p>
        </div>
        <Link href="/admin/news/new">
          <Button className="gap-2">
            <Plus size={20} />
            Создать новость
          </Button>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
          />
          <label className="sr-only" htmlFor="admin-news-search">
            Поиск новости
          </label>
          <input
            id="admin-news-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти по заголовку…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по статусу">
          {NEWS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              aria-pressed={statusFilter === f.id}
              className={`h-11 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                statusFilter === f.id
                  ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue"
                  : "bg-white border border-border text-secondary-text hover:text-dark-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loadError && news.length === 0 && (
          <div className="p-4 border-b border-error/30 bg-error-bg/40 text-sm text-error" role="alert">
            Не удалось загрузить список — проверьте соединение и{" "}
            <button type="button" onClick={() => fetchNews()} className="font-bold underline cursor-pointer">
              повторите
            </button>
          </div>
        )}
        {/* Фаза 8: на мобильных — карточки вместо горизонтального скролла. */}
        <div className="md:hidden divide-y divide-border">
          {news.length === 0 ? (
            <div className="px-4 py-10 text-center text-secondary-text">
              {debouncedQuery || statusFilter !== "all"
                ? "По заданным фильтрам ничего не найдено"
                : "Новостей пока нет"}
            </div>
          ) : (
            news.map((item) => (
              <div key={item.id} className="px-4 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-dark-text line-clamp-2">
                    {item.title}
                  </div>
                  <div className="text-xs text-secondary-text mt-1">
                    {new Date(item.created_at).toLocaleDateString("ru-RU")} ·{" "}
                    {item.is_published ? "Опубликовано" : "Черновик"}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Link
                    href={`/news/${item.slug}`}
                    target="_blank"
                    className="p-2.5 text-secondary-text hover:text-primary-blue transition-colors"
                    title="Просмотр"
                    aria-label={`Просмотр: ${item.title}`}
                  >
                    <Eye size={18} />
                  </Link>
                  <Link
                    href={`/admin/news/${item.slug}/edit`}
                    className="p-2.5 text-secondary-text hover:text-primary-blue transition-colors"
                    title="Редактировать"
                    aria-label={`Редактировать: ${item.title}`}
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2.5 text-secondary-text hover:text-red-500 transition-colors cursor-pointer"
                    title="Удалить"
                    aria-label={`Удалить: ${item.title}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <table className="w-full text-left border-collapse hidden md:table">
          <thead className="bg-light-gray border-b border-border">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Новость</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Дата</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Статус</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {news.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-secondary-text">
                  {debouncedQuery || statusFilter !== "all"
                    ? "По заданным фильтрам ничего не найдено"
                    : "Новостей пока нет"}
                </td>
              </tr>
            ) : (
              news.map((item) => (
                <tr key={item.id} className="hover:bg-light-gray/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <span className="text-sm font-medium text-dark-text line-clamp-1">
                        {item.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary-text">
                    {new Date(item.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={item.is_published ? "published" : "draft"} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/news/${item.slug}`}
                        target="_blank"
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Просмотр"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        href={`/admin/news/${item.slug}/edit`}
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 text-secondary-text hover:text-red-500 transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {hasMore && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-light-gray/30">
            <p className="text-xs text-secondary-text" role="status">
              Загружено {news.length}
              {total !== null ? ` из ${total}` : ""}
            </p>
            <Button onClick={loadMore} disabled={loadingMore} variant="secondary" size="sm">
              {loadingMore ? "Загрузка…" : "Показать ещё"}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Удалить новость «${pendingDelete?.title ?? ""}»?`}
        confirmLabel="Удалить"
        danger
        busy={deleting}
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
