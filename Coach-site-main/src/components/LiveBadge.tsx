// Phase 1: глобальный LIVE-индикатор в Navbar.
// Polling поверх существующего GET /api/tournament/tournaments/ (контракт не меняем).
// SSE — только в Phase 6.

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api, unwrapList, type ListResponse } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { isRunningTournament } from "@/lib/nav"
import StatusPill from "@/components/ui/StatusPill"

const POLL_MS = 30000

export default function LiveBadge({ onNavigate }: { onNavigate?: () => void }) {
  const [running, setRunning] = useState<Tournament[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api<ListResponse<Tournament>>(
          "/api/tournament/tournaments/"
        )
        if (cancelled) return
        const now = new Date()
        setRunning(
          unwrapList(data).filter((t) => isRunningTournament(t, now))
        )
      } catch {
        // Индикатор не шумит: при офлайне/ошибке просто скрывается.
        if (!cancelled) setRunning([])
      }
    }
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (running.length === 0) return null
  const names = running.map((t) => t.name).join(", ")
  const label =
    running.length === 1 ? `Live · ${running[0].name}` : `Live · ${running.length}`

  return (
    <Link
      href="/live"
      onClick={onNavigate}
      title={names}
      aria-label={`Сейчас live: ${names}. Смотреть live.`}
      className="inline-flex max-w-[220px] shrink-0 items-center rounded-full transition-transform hover:scale-[1.03] motion-reduce:transform-none"
    >
      <span className="truncate">
        <StatusPill status="live" label={label} pulse tone="dark" />
      </span>
    </Link>
  )
}
