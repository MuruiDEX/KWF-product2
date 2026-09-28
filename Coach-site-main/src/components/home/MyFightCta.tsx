"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Timer } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { CabinetData } from "@/lib/types"
import { findMyNextFight, type MyNextFight } from "@/lib/useMyNextFight"
import type { TatamiQueueItem } from "@/components/LiveQueue"
function fmtEta(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null
  const d = new Date(Date.now() + seconds * 1000)
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}

export default function MyFightCta() {
  const { user, loading: authLoading } = useAuth()
  const [fight, setFight] = useState<MyNextFight | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const cab = await api<CabinetData>("/api/auth/cabinet/")
        const kidIds = cab.athletes.map((a) => a.id)
        if (!kidIds.length || !cab.tournaments.length) return
        const queues: { tournamentId: number; queue: TatamiQueueItem[] }[] = []
        for (const t of cab.tournaments.slice(0, 4)) {
          try {
            const q = await api<{ queue: TatamiQueueItem[] }>(`/api/tournament/tournaments/${t.id}/tatami_queue/`)
            queues.push({ tournamentId: t.id, queue: q.queue ?? [] })
          } catch {
            /* турнир без очереди — пропускаем */
          }
        }
        if (!cancelled) setFight(findMyNextFight(kidIds, queues))
      } catch {
        /* offline — покажем общий CTA */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return (
      <section aria-label="Мой бой" className="bg-dark-blue border-t border-white/10">
        <div className="kwf-container py-8">
          <div role="status" aria-label="Проверяем ваши бои" className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
            <div className="h-4 w-40 rounded bg-white/10" />
          </div>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section aria-label="Начать" className="bg-dark-blue border-t border-white/10">
        <div className="kwf-container py-10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <p className="kwf-meta text-gold mb-2">Родителям и спортсменам</p>
            <h2 className="kwf-h2 text-white">Ваш бой — татами, номер и ETA в одном месте</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-gold text-dark-blue font-bold text-sm hover:bg-accent-warm-light transition-colors min-h-[44px]">
              Создать кабинет <ArrowRight size={16} />
            </Link>
            <Link href="/tournaments" className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl border border-white/25 text-white font-bold text-sm hover:bg-white/10 transition-colors min-h-[44px]">
              Смотреть турниры
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (!fight) return null

  const eta = fmtEta(fight.match.eta_seconds)
  return (
    <section aria-label="Мой бой" className="bg-dark-blue border-t border-gold/25">
      <div className="kwf-container py-8 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="w-12 h-12 rounded-2xl bg-gold/15 border border-gold/40 flex items-center justify-center shrink-0">
            <Timer size={22} className="text-gold" />
          </span>
          <div className="min-w-0">
            <p className="kwf-meta text-gold">Your fight</p>
            <p className="text-white font-display font-extrabold text-xl kwf-numeric truncate">
              {fight.tatamiName} · Fight #{fight.match.match_number}
              {eta && <span className="text-white/70 font-bold"> · ETA {eta}</span>}
            </p>
            <p className="text-sm text-white/65 truncate">
              {fight.match.athlete1 ?? "TBD"} vs {fight.match.athlete2 ?? "TBD"} · {fight.match.category_name}
            </p>
          </div>
        </div>
        <Link href="/cabinet" className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-gold text-dark-blue font-bold text-sm hover:bg-accent-warm-light transition-colors shrink-0 min-h-[44px]">
          Открыть кабинет <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}
