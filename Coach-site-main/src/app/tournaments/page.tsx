"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Trophy } from "lucide-react"
import { api, unwrapList } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import LiveTournament from "@/components/LiveTournament"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"

function formatRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sOk = !Number.isNaN(s.getTime())
  const eOk = !Number.isNaN(e.getTime())
  if (sOk && eOk) return `${s.toLocaleDateString("ru-RU")} — ${e.toLocaleDateString("ru-RU")}`
  if (sOk) return s.toLocaleDateString("ru-RU")
  return ""
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api<Tournament[] | { results: Tournament[] }>("/api/tournament/tournaments/")
      .then((data) => {
        if (!cancelled) setTournaments(unwrapList(data))
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
      <LiveTournament />
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-blue">
            Соревнования
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-dark-text tracking-tight mt-2 mb-2">
            Турниры
          </h1>
          <p className="text-secondary-text mb-10">
            Расписание и результаты соревнований
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<Trophy size={26} />}
              title="Турниров пока нет"
              hint="Как только появятся новые соревнования, они будут опубликованы на этой странице"
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t, i) => (
              <motion.div
                key={t.slug || t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link href={`/tournaments/${t.slug}`}>
                  <div className="bg-white rounded-2xl border border-border p-6 hover:shadow-lg hover:-translate-y-1 hover:border-primary-blue/25 transition-all duration-300 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <StatusPill status={t.status} />
                    </div>
                    <h2 className="text-xl font-bold text-dark-text mb-2">
                      {t.name}
                    </h2>
                    {t.description && (
                      <p className="text-sm text-secondary-text line-clamp-2 mb-4">
                        {t.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-secondary-text">
                      <span>{formatRange(t.start_date, t.end_date)}</span>
                      <span>Категорий: {(t as { categories_count?: number }).categories_count ?? t.categories?.length ?? 0}</span>
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
