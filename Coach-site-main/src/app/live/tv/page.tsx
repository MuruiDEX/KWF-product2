// Phase 1: публичный TV/scoreboard-режим.
// Без навигации и хедера — fullscreen-friendly для зала/проектора.
// Табло рендерит TournamentBoard (та же реализация, что и board-страница).

"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { MonitorPlay, Radio } from "lucide-react"
import { api, unwrapList, type ListResponse } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { partitionTournaments } from "@/lib/nav"
import { TournamentBoard } from "@/components/TournamentBoard"
import SyncBadge from "@/components/SyncBadge"
import EmptyState from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/button"

function TvView() {
  const search = useSearchParams()
  const slugParam = search.get("slug")
  const [running, setRunning] = useState<Tournament[] | null>(null)

  useEffect(() => {
    if (slugParam) return
    let cancelled = false
    api<ListResponse<Tournament>>("/api/tournament/tournaments/")
      .then((data) => {
        if (cancelled) return
        setRunning(partitionTournaments(unwrapList(data)).running)
      })
      .catch(() => {
        if (!cancelled) setRunning([])
      })
    return () => {
      cancelled = true
    }
  }, [slugParam])

  // Выбран конкретный турнир — сразу табло.
  if (slugParam) {
    return (
      <TournamentBoard
        slug={slugParam}
        backHref="/live/tv"
        renderConnection={(s) => <SyncBadge status={s.status} transport={s.transport} />}
      />
    )
  }

  // Один идущий турнир — сразу его табло, без лишнего клика оператора.
  if (running && running.length === 1) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-dark-blue flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <TournamentBoard
          slug={running[0].slug}
          backHref="/live/tv"
          renderConnection={(s) => <SyncBadge status={s.status} transport={s.transport} />}
        />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-dark-blue text-white flex flex-col">
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-10 py-10 flex-grow">
        <div className="flex items-center gap-3 mb-2">
          <MonitorPlay size={26} className="text-gold" aria-hidden="true" />
          <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-gold">
            Режим ТВ
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
          Live-табло турниров
        </h1>

        {running === null ? (
          <div className="mt-16 flex justify-center" role="status" aria-label="Загрузка">
            <div className="w-12 h-12 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : running.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5">
            <EmptyState
              icon={<Radio size={26} />}
              title="Сейчас нет live-турниров"
              hint="Табло появится автоматически, как только начнётся турнир"
              action={
                <Link href="/live">
                  <Button>К странице Live</Button>
                </Link>
              }
              className="[&_h3]:text-white [&_p]:!text-white/60"
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {running.map((t) => (
              <Link
                key={t.id}
                href={`/live/tv?slug=${t.slug}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 hover:border-gold/50 hover:bg-white/10 transition-all text-left"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-error/25 border border-error/40 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-red-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                  </span>
                  Live
                </span>
                <span className="block text-2xl sm:text-3xl font-black mt-4 leading-tight">
                  {t.name}
                </span>
                {t.location && (
                  <span className="block text-white/60 font-semibold mt-2">{t.location}</span>
                )}
                <span className="block text-gold font-bold mt-4">Открыть табло →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LiveTvPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-dark-blue flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TvView />
    </Suspense>
  )
}
