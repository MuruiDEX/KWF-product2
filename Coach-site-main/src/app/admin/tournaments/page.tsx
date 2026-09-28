"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { usePagedList } from "@/lib/usePagedList"
import type { Tournament } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Eye, Search } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import StatusPill from "@/components/ui/StatusPill"
import { toast } from "@/components/ui/Toaster"

type TournamentStatusFilter = "all" | "draft" | "published" | "finished"

const STATUS_FILTERS: { id: TournamentStatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "draft", label: "Черновики" },
  { id: "published", label: "Опубликованы" },
  { id: "finished", label: "Завершены" },
]

export default function AdminTournamentsPage() {
  // N9: серверный поиск + фильтр статуса (?search=, ?status=).
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TournamentStatusFilter>("all")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(t)
  }, [query])

  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams()
      if (debouncedQuery) params.set("search", debouncedQuery)
      if (statusFilter !== "all") params.set("status", statusFilter)
      params.set("page", String(page))
      return `/api/tournament/tournaments/?${params.toString()}`
    },
    [debouncedQuery, statusFilter]
  )
  const {
    items: tournaments,
    total,
    hasMore,
    loading,
    loadingMore,
    loadError,
    loadMore,
    reload: fetchTournaments,
  } = usePagedList<Tournament>(buildUrl, `admin-tournaments:${debouncedQuery}:${statusFilter}`)
  const [pendingDelete, setPendingDelete] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(t: Tournament) {
    setPendingDelete(t)
  }

  async function doDelete(t: Tournament) {
    setPendingDelete(null)
    setDeleting(true)
    try {
      await api(`/api/tournament/tournaments/${t.id}/`, { method: "DELETE" })
      await fetchTournaments()
      toast("Турнир удалён", "success")
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
          <h1 className="text-3xl font-extrabold text-dark-text">Управление турнирами</h1>
          <p className="text-secondary-text">Создание, редактирование и организация соревнований</p>
        </div>
        <Link href="/cabinet/tournaments/create">
          <Button className="gap-2">
            <Plus size={20} />
            Создать турнир
          </Button>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
          />
          <label className="sr-only" htmlFor="admin-tournament-search">
            Поиск турнира
          </label>
          <input
            id="admin-tournament-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти по названию или месту…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по статусу">
          {STATUS_FILTERS.map((f) => (
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
        {loadError && tournaments.length === 0 && (
          <div className="p-4 border-b border-error/30 bg-error-bg/40 text-sm text-error" role="alert">
            Не удалось загрузить список — проверьте соединение и{" "}
            <button type="button" onClick={() => fetchTournaments()} className="font-bold underline cursor-pointer">
              повторите
            </button>
          </div>
        )}
        {/* Фаза 8: на мобильных — карточки вместо горизонтального скролла. */}
        <div className="md:hidden divide-y divide-border">
          {tournaments.length === 0 ? (
            <div className="px-4 py-10 text-center text-secondary-text">
              {debouncedQuery || statusFilter !== "all"
                ? "По заданным фильтрам ничего не найдено"
                : "Турниров пока нет"}
            </div>
          ) : (
            tournaments.map((t) => (
              <div key={t.id} className="px-4 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-dark-text truncate">
                    {t.name}
                  </div>
                  <div className="text-xs text-secondary-text mt-1">
                    {new Date(t.start_date).toLocaleDateString("ru-RU")} ·{" "}
                    {t.status === "published" ? "Опубликован" : t.status === "draft" ? "Черновик" : "Завершён"}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Link
                    href={`/tournaments/${t.slug}`}
                    target="_blank"
                    className="p-2.5 text-secondary-text hover:text-primary-blue transition-colors"
                    title="Просмотр"
                    aria-label={`Просмотр: ${t.name}`}
                  >
                    <Eye size={18} />
                  </Link>
                  <Link
                    href={`/admin/tournaments/${t.slug}/edit`}
                    className="p-2.5 text-secondary-text hover:text-primary-blue transition-colors"
                    title="Редактировать"
                    aria-label={`Редактировать: ${t.name}`}
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    onClick={() => handleDelete(t)}
                    className="p-2.5 text-secondary-text hover:text-red-500 transition-colors cursor-pointer"
                    title="Удалить"
                    aria-label={`Удалить: ${t.name}`}
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
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Турнир</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Дата</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text">Статус</th>
              <th className="px-6 py-4 text-sm font-semibold text-dark-text text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tournaments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-secondary-text">
                  {debouncedQuery || statusFilter !== "all"
                    ? "По заданным фильтрам ничего не найдено"
                    : "Турниров пока нет"}
                </td>
              </tr>
            ) : (
              tournaments.map((t) => (
                <tr key={t.id} className="hover:bg-light-gray/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-dark-text">{t.name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary-text">
                    {new Date(t.start_date).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-6 py-4">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/tournaments/${t.slug}`}
                        target="_blank"
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Просмотр"
                      >
                        <Eye size={18} />
                      </Link>
                      <Link
                        href={`/admin/tournaments/${t.slug}/edit`}
                        className="p-2 text-secondary-text hover:text-primary-blue transition-colors"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => handleDelete(t)}
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
              Загружено {tournaments.length}
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
        title={`Удалить турнир «${pendingDelete?.name ?? ""}»?`}
        description="Категории, матчи и раунды будут удалены. Спортсмены останутся в базе."
        confirmLabel="Удалить"
        danger
        busy={deleting}
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
