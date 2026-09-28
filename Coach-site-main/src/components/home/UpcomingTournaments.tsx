"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin, Swords } from "lucide-react"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import SectionHeader from "@/components/ui/SectionHeader"
import EmptyState from "@/components/ui/EmptyState"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import StatusPill from "@/components/ui/StatusPill"

function fmtDate(iso: string) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export default function UpcomingTournaments() {
  const [items, setItems] = useState<Tournament[]>([])
  const [finished, setFinished] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<Tournament[] | { results: Tournament[] }>("/api/tournament/tournaments/")
      const list = unwrapList(data)
      const byStart = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date))
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      setItems(byStart.filter((t) => t.status !== "finished").slice(0, 4))
      setFinished(byStart.filter((t) => t.status === "finished").slice(-2).reverse())
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch-effect: сброс скелетона перед запросом намеренный.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  return (
    <section aria-label="Турниры" className="kwf-section bg-white dark:bg-[#07111F]">
      <div className="kwf-container">
        <SectionHeader
          eyebrow="Соревнования"
          title="Ближайшие турниры"
          description="Даты, места, категории и сетки — всё в одном Tournament Hub"
          align="left"
        />
        <div className="mb-6 -mt-6">
          <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue hover:text-primary-blue-light min-h-[44px]">
            Все турниры <ArrowRight size={15} />
          </Link>
        </div>
        {loading ? (
          <SkeletonGrid count={4} label="Загрузка турниров…" />
        ) : error ? (
          <ErrorRetry hint={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Ближайших турниров пока нет"
            hint="Организаторы ещё не опубликовали расписание — загляните позже"
            action={<Link href="/tournaments" className="text-sm font-bold text-primary-blue">Открыть архив →</Link>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.slug}`}
                className="kwf-card dojo-top-line p-5 hover:shadow-md hover:border-gold/40 transition-all group min-h-[44px]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <StatusPill status={t.status === "published" ? "upcoming" : t.status} />
                  {typeof t.categories_count === "number" && (
                    <span className="ml-auto text-xs font-semibold text-secondary-text kwf-numeric">{t.categories_count} кат.</span>
                  )}
                </div>
                <h3 className="font-display font-bold text-[17px] leading-snug tracking-tight line-clamp-2 group-hover:text-primary-blue transition-colors">
                  {t.name}
                </h3>
                <div className="mt-3 space-y-1.5 text-[13px] text-secondary-text">
                  <p className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-gold" />{fmtDate(t.start_date)}</p>
                  {t.location && <p className="flex items-center gap-1.5"><MapPin size={14} className="text-gold" /><span className="truncate">{t.location}</span></p>}
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary-blue">
                  <Swords size={14} /> Открыть hub
                </span>
              </Link>
            ))}
          </div>
        )}
        {!loading && !error && finished.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="kwf-meta text-secondary-text">Результаты:</span>
            {finished.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.slug}?tab=results`} className="rounded-full border border-border px-3.5 py-1.5 font-semibold hover:border-gold/50 hover:text-primary-blue transition-colors min-h-[36px] inline-flex items-center">
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
