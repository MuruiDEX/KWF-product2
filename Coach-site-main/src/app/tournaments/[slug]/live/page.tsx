// Phase 6: публичный live-маршрут турнира.
// Шапка (название/статус/дата/место из существующего detail) + тот же
// TournamentBoard, что у board/ТВ: татами-фильтр, очередь, SyncBadge.
// Отдельного live-движка нет — транспорт общий (SSE-first).

"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react"
import { api } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { TournamentBoard } from "@/components/TournamentBoard"
import SyncBadge from "@/components/SyncBadge"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"

function LiveRoute() {
  const params = useParams()
  const slug = params.slug as string
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<Tournament>(`/api/tournament/tournaments/${slug}/`)
      .then((t) => {
        if (!cancelled) setTournament(t)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-blue text-white">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-10 py-8">
          <div className="h-9 w-64 rounded-lg bg-white/10 animate-pulse" role="status" aria-label="Загрузка live" />
          <div className="mt-6">
            <SkeletonGrid label="Загрузка live…" />
          </div>
        </div>
      </div>
    )
  }

  if (failed || !tournament) {
    return (
      <div className="min-h-screen bg-dark-blue text-white">
        <div className="mx-auto max-w-[800px] px-6 py-16">
          <ErrorRetry
            title="Турнир не найден"
            hint="Проверьте ссылку — возможно, турнир удалён или ещё не опубликован"
            onRetry={() => window.location.reload()}
            className="bg-white text-dark-text"
          />
          <div className="text-center mt-4">
            <Link
              href="/live"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              Ко всем live-турнирам
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-blue text-white">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/tournaments/${slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={15} />
              К странице турнира
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
              {tournament.name}: live
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50 mt-1">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} aria-hidden="true" />
                {new Date(`${tournament.start_date}T00:00:00`).toLocaleDateString("ru-RU")}
              </span>
              {tournament.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} aria-hidden="true" />
                  {tournament.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tournament.status && <StatusPill status={tournament.status} tone="dark" />}
          </div>
        </div>
        {tournament.status !== "published" && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5">
            <EmptyState
              title={
                tournament.status === "finished"
                  ? "Турнир завершён — эфир окончен"
                  : "Турнир ещё не в эфире"
              }
              hint="Актуальные сетки и результаты — на странице турнира"
              action={
                <Link
                  href={`/tournaments/${slug}`}
                  className="text-sm font-bold text-gold hover:text-gold-bright transition-colors"
                >
                  К странице турнира →
                </Link>
              }
              className="[&_h3]:text-white [&_p]:!text-white/60"
            />
          </div>
        )}
      </div>
      <TournamentBoard
        slug={slug}
        backHref={`/tournaments/${slug}`}
        renderConnection={(s) => <SyncBadge status={s.status} transport={s.transport} />}
      />
    </div>
  )
}

export default function TournamentLivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-dark-blue flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LiveRoute />
    </Suspense>
  )
}
