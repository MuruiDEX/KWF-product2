"use client"

import Link from "next/link"
import { Swords, MapPin, ArrowRight } from "lucide-react"
import { EtaBadge } from "@/components/EtaBadge"
import type { MyNextFight } from "@/lib/useMyNextFight"

interface MyNextFightCardProps {
  fight: MyNextFight | null
  loading: boolean
  tournamentSlug?: string | null
  tournamentName?: string | null
}

/** Фаза 1 (K1) + Волна B (N5): hero-карточка «бой моего ребёнка».
 * Всегда видима: пустое состояние объясняет, когда бой появится. */
export function MyNextFightCard({
  fight,
  loading,
  tournamentSlug,
  tournamentName,
}: MyNextFightCardProps) {
  if (loading) {
    return (
      <div
        aria-label="Загрузка следующего боя"
        className="rounded-2xl bg-dark-blue border border-white/10 p-6 animate-pulse"
      >
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="h-7 w-3/4 rounded bg-white/10 mt-3" />
        <div className="h-4 w-1/2 rounded bg-white/10 mt-2" />
      </div>
    )
  }
  if (!fight) {
    return (
      <div className="rounded-2xl bg-dark-blue border border-white/10 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Swords size={14} className="text-gold" />
          <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-gold">
            Следующий бой
          </span>
        </div>
        <p className="text-base font-bold text-white">Боёв пока нет</p>
        <p className="text-sm text-white/70 mt-1 leading-relaxed">
          Как только ребёнка заявят на турнир и появится сетка, бой будет здесь — с татами и временем.
        </p>
      </div>
    )
  }

  const isLive = fight.state === "live"
  const href = tournamentSlug ? `/tournaments/${tournamentSlug}#match-${fight.match.id}` : "/cabinet"

  return (
    <Link
      href={href}
      className="block rounded-2xl bg-dark-blue border border-gold/40 p-6 shadow-lg shadow-dark-blue/20 hover:border-gold/70 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        {isLive ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gold" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-gold">
              Сейчас на татами
            </span>
          </>
        ) : (
          <>
            <Swords size={14} className="text-gold" />
            <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-gold">
              Следующий бой
            </span>
          </>
        )}
        {!isLive && <EtaBadge etaSeconds={fight.match.eta_seconds} />}
      </div>
      <div className="text-lg font-extrabold text-white leading-snug">
        {fight.match.athlete1} <span className="text-white/50 font-bold">vs</span>{" "}
        {fight.match.athlete2}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} className="text-gold" />
          {fight.tatamiName}
        </span>
        <span>
          {fight.match.category_name} · {fight.match.round_name}
        </span>
        {tournamentName && <span>{tournamentName}</span>}
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-gold">
        Смотреть турнир
        <ArrowRight size={15} />
      </div>
    </Link>
  )
}
