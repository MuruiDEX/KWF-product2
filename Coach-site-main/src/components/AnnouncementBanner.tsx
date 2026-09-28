"use client"

import { Megaphone } from "lucide-react"
import type { TournamentEvent } from "@/lib/tournamentEvents"

/** Баннеры объявлений организатора (лента tournament.announcement). */
export function AnnouncementBanner({ items }: { items: TournamentEvent[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2 mb-6" role="status" aria-label="Объявления организатора">
      {items.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-2xl border border-gold/50 bg-gold-soft px-4 py-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/20">
            <Megaphone size={17} className="text-dark-blue" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-dark-blue/60">
              Объявление
            </div>
            <div className="text-sm font-semibold text-dark-blue leading-snug">
              {a.detail || "Объявление организатора"}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
