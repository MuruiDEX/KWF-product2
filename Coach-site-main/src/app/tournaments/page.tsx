"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Trophy, WifiOff, Search } from "lucide-react"
import { usePagedList } from "@/lib/usePagedList"
import type { Tournament } from "@/lib/types"
import LiveTournament from "@/components/LiveTournament"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/PageHeader"
import { FilterBar } from "@/components/ui/FilterBar"

function formatRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sOk = !Number.isNaN(s.getTime())
  const eOk = !Number.isNaN(e.getTime())
  if (sOk && eOk) return `${s.toLocaleDateString("ru-RU")} — ${e.toLocaleDateString("ru-RU")}`
  if (sOk) return s.toLocaleDateString("ru-RU")
  return ""
}

type ArchiveFilter = "all" | "upcoming" | "finished"

const ARCHIVE_FILTERS: { id: ArchiveFilter; label: string; status: string | null }[] = [
  { id: "all", label: "Все", status: null },
  { id: "upcoming", label: "Предстоящие", status: "published" },
  { id: "finished", label: "Архив", status: "finished" },
]

export default function TournamentsPage() {
  // Фаза 2: поиск по названию/месту (?search= на бэке, debounce 400мс).
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  // N16: архив — фильтр по статусу (?status=).
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(timer)
  }, [query])

  // F2: постраничная подгрузка вместо обрезки на 20.
  const buildUrl = useCallback(
    (page: number) => {
      const base = "/api/tournament/tournaments/"
      const params = new URLSearchParams()
      if (debouncedQuery.length > 0) params.set("search", debouncedQuery)
      const status = ARCHIVE_FILTERS.find((f) => f.id === archiveFilter)?.status
      if (status) params.set("status", status)
      params.set("page", String(page))
      return `${base}?${params.toString()}`
    },
    [debouncedQuery, archiveFilter]
  )
  const {
    items: tournaments,
    total,
    hasMore,
    loading,
    loadingMore,
    loadError,
    loadMore,
    reload: retry,
  } = usePagedList<Tournament>(buildUrl, `${debouncedQuery}:${archiveFilter}`)

  return (
    <AppShell>
      <LiveTournament />
      <div className="kwf-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Турниры" }]} />
          <PageHeader
            eyebrow="Соревнования"
            title="Турниры"
            description="Расписание и результаты соревнований"
            className="mt-4"
          />
        </motion.div>

        <FilterBar
          options={ARCHIVE_FILTERS}
          value={archiveFilter}
          onChange={setArchiveFilter}
          ariaLabel="Фильтр турниров"
          count={
            !loading && !loadError && tournaments.length > 0
              ? total !== null
                ? `Показано ${tournaments.length} из ${total}`
                : `Показано: ${tournaments.length}`
              : undefined
          }
        >
          <div className="relative w-full sm:max-w-xs">
            <label className="sr-only" htmlFor="tournament-search">
              Поиск турнира
            </label>
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
            />
            <input
              id="tournament-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти турнир по названию или месту…"
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all dark:bg-white/5 dark:text-white"
            />
          </div>
        </FilterBar>

        {loading ? (
          <SkeletonGrid label="Загрузка турниров" />
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<WifiOff size={26} />}
              title="Не удалось загрузить турниры"
              hint="Проверьте соединение с интернетом и попробуйте ещё раз"
              action={<Button onClick={retry}>Повторить</Button>}
            />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<Trophy size={26} />}
              title={
                debouncedQuery || archiveFilter !== "all" ? "Ничего не найдено" : "Турниров пока нет"
              }
              hint={
                debouncedQuery || archiveFilter !== "all"
                  ? "Попробуйте изменить запрос или фильтр"
                  : "Как только появятся новые соревнования, они будут опубликованы на этой странице"
              }
            />
          </div>
        ) : (
          <div className="mt-6">
            <ul className="rounded-2xl border border-border bg-white overflow-hidden dark:bg-[#0E2035]">
            {tournaments.map((t, i) => {
              const categoriesCount =
                (t as { categories_count?: number }).categories_count ?? t.categories?.length ?? 0
              const matsCount = (t as { mats_count?: number }).mats_count ?? null
              const place = [formatRange(t.start_date, t.end_date), t.location].filter(Boolean).join(" · ")
              return (
              <motion.li
                key={t.slug || t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 5) * 0.04 }}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  href={`/tournaments/${t.slug}`}
                  className="flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-light-gray/60 transition-colors dark:hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-base font-extrabold text-dark-text tracking-tight dark:text-slate-100">
                        {t.name}
                      </span>
                      <StatusPill status={t.status} />
                    </span>
                    {place && (
                      <span className="mt-1 block truncate text-sm text-secondary-text">
                        {place}
                      </span>
                    )}
                    <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-semibold text-secondary-text tabular-nums">
                      <span>Категорий: {categoriesCount}</span>
                      {matsCount !== null && matsCount > 0 && <span>Татами: {matsCount}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-primary-blue dark:text-gold" aria-hidden="true">
                    Открыть →
                  </span>
                </Link>
              </motion.li>
              )
            })}
            </ul>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button onClick={loadMore} disabled={loadingMore} variant="secondary">
                  {loadingMore ? "Загрузка…" : "Показать ещё"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
