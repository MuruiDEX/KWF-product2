// Phase 6: индикатор состояния live-подключения (транспорт скрыт от глаза,
// но различим: LIVE / переподключение / офлайн). Цвет не единственный носитель.

"use client"

import type { EventsSyncStatus } from "@/lib/useTournamentEvents"
import type { EventsTransport } from "@/lib/liveTransport"
import { cn } from "@/lib/utils"

const TRANSPORT_HINT: Record<EventsTransport, string> = {
  sse: "прямое подключение",
  polling: "резервный опрос",
  offline: "без соединения",
}

export default function SyncBadge({
  status,
  transport,
  className,
}: {
  status: EventsSyncStatus
  transport: EventsTransport
  className?: string
}) {
  const text =
    status === "live"
      ? "LIVE"
      : status === "reconnecting"
        ? "Переподключение…"
        : "Офлайн"
  return (
    <span
      data-testid="sync-state"
      data-transport={transport}
      title={`Live-обновления: ${TRANSPORT_HINT[transport]}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-extrabold uppercase tracking-widest",
        status === "live" &&
          "bg-error/20 border-error/40 text-red-300",
        status === "reconnecting" &&
          "bg-gold/15 border-gold/40 text-gold-pale",
        status === "offline" &&
          "bg-white/5 border-white/15 text-white/50",
        className
      )}
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {status !== "offline" && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
        )}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current" />
      </span>
      {text}
    </span>
  )
}
