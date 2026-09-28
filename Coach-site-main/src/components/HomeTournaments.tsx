// Phase 3: домашние ленты «Ближайшие турниры» и «Последние результаты».
// Один запрос к публичному GET tournaments/, деление через partitionTournaments.

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, Trophy, WifiOff } from "lucide-react"
import { api, unwrapList, type ListResponse } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { partitionTournaments } from "@/lib/nav"
import SectionHeader from "@/components/ui/SectionHeader"
import EmptyState from "@/components/ui/EmptyState"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { Button } from "@/components/ui/button"
import TournamentCard from "@/components/TournamentCard"

export default function HomeTournaments() {
  const [upcoming, setUpcoming] = useState<Tournament[] | null>(null)
  const [finished, setFinished] = useState<Tournament[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<ListResponse<Tournament>>("/api/tournament/tournaments/")
      .then((data) => {
        if (cancelled) return
        const part = partitionTournaments(unwrapList(data))
        setUpcoming(part.upcoming.slice(0, 3))
        setFinished(part.finished.slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section aria-label="Турниры" className="kwf-section">
        <div className="kwf-container">
          <SkeletonGrid label="Загрузка турниров" />
        </div>
      </section>
    )
  }

  if (loadError) {
    return (
      <section aria-label="Турниры" className="kwf-section">
        <div className="kwf-container">
          <ErrorRetry
            icon={<WifiOff size={26} />}
            title="Не удалось загрузить турниры"
            hint="Проверьте соединение и попробуйте ещё раз"
            onRetry={() => window.location.reload()}
          />
        </div>
      </section>
    )
  }

  return (
    <>
      <section aria-label="Ближайшие турниры" className="kwf-section">
        <div className="kwf-container">
          <SectionHeader
            align="left"
            number="07"
            eyebrow="Календарь"
            title="Ближайшие турниры"
            description="Где и когда пройдут следующие соревнования"
          />
          {(upcoming ?? []).length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={26} />}
              title="Анонсов пока нет"
              hint="Как только появятся новые соревнования, они будут опубликованы здесь"
            />
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(upcoming ?? []).map((t) => (
                  <TournamentCard key={t.slug || t.id} tournament={t} />
                ))}
              </div>
              <div className="mt-8">
                <Link href="/tournaments">
                  <Button variant="secondary">Смотреть все турниры</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section aria-label="Последние результаты" className="kwf-section bg-light-gray border-y border-border">
        <div className="kwf-container">
          <SectionHeader
            align="left"
            eyebrow="Архив"
            title="Последние результаты"
            description="Недавно завершённые турниры и их итоги"
          />
          {(finished ?? []).length === 0 ? (
            <EmptyState
              icon={<Trophy size={26} />}
              title="Результатов пока нет"
              hint="Итоги завершённых турниров появятся здесь"
            />
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(finished ?? []).map((t) => (
                  <TournamentCard key={t.slug || t.id} tournament={t} />
                ))}
              </div>
              <div className="mt-8">
                <Link href="/tournaments">
                  <Button variant="secondary">Смотреть все турниры</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}
