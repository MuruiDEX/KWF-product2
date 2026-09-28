"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Trophy, Swords, Users, Medal } from "lucide-react"
import { api } from "@/lib/api"

interface TopRow {
  id: number
  name: string
  fights: number
  wins: number
}

interface ClubStats {
  athletes: number
  fights: number
  wins: number
  losses: number
  win_rate: number
  top: TopRow[]
  medals?: { gold: number; silver: number }
}

/** Фаза 3: виджет «Статистика клуба» для тренера. Молча пуст без данных. */
export function ClubStatsCard() {
  const [stats, setStats] = useState<ClubStats | null>(null)

  useEffect(() => {
    let cancelled = false
    api<ClubStats>("/api/tournament/athletes/club_stats/")
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats || stats.fights === 0) return null

  return (
    <div className="rounded-xl border border-gold/40 bg-gold-soft/40 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-bold text-dark-text">
          <Users size={14} className="text-gold" />
          <span className="tabular-nums">{stats.athletes}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-dark-text">
          <Swords size={14} className="text-gold" />
          <span className="tabular-nums">
            {stats.fights} боёв · {stats.wins} побед
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-dark-text">
          <Trophy size={14} className="text-gold" />
          <span className="tabular-nums">{Math.round(stats.win_rate * 100)}%</span>
        </span>
        {stats.medals && (stats.medals.gold > 0 || stats.medals.silver > 0) && (
          <span className="inline-flex items-center gap-1.5 font-bold text-dark-text">
            <Medal size={14} className="text-gold" />
            <span className="tabular-nums">
              {stats.medals.gold}×1-е · {stats.medals.silver}×2-е
            </span>
          </span>
        )}
      </div>
      {stats.top.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {stats.top.slice(0, 3).map((r) => (
            <li key={r.id} className="text-xs text-secondary-text tabular-nums">
              <Link
                href={`/athletes/${r.id}`}
                className="font-semibold text-dark-text hover:text-primary-blue transition-colors"
              >
                {r.name}
              </Link>{" "}
              — {r.wins}/{r.fights}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
