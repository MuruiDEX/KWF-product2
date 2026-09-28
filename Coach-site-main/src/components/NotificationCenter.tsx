"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BellRing, Megaphone, Trophy } from "lucide-react"
import { api } from "@/lib/api"
import {
  isAnnouncementEvent,
  type TournamentEvent,
  type TournamentEventsResponse,
} from "@/lib/tournamentEvents"
import type { MyNextFight } from "@/lib/useMyNextFight"
import type { Match } from "@/lib/types"
import EmptyState from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

export type CenterPriority = "urgent" | "important" | "info"

export interface CenterResult {
  id: number
  title: string
  body: string
  href: string
  won: boolean | null
}

export interface WatchTournament {
  slug: string
  name: string
}

interface AnnItem {
  id: number
  tournamentName: string
  detail: string
  createdAt: string
}

const PRIORITY_STYLE: Record<CenterPriority, string> = {
  urgent: "bg-energy/15 text-energy border-energy/40",
  important: "bg-gold/15 text-dark-blue border-gold/40 dark:text-gold",
  info: "bg-primary-blue/10 text-primary-blue border-primary-blue/30",
}

const PRIORITY_LABEL: Record<CenterPriority, string> = {
  urgent: "Срочно",
  important: "Важно",
  info: "Инфо",
}

/** Чистая функция: результаты моих детей из матчей кабинета (без запросов). */
export function buildResultItems(
  matches: Match[],
  kidIds: number[],
  tournamentOfCategory: (categoryId: number) => { slug: string; name: string } | undefined,
  kidNameOf: (kidId: number) => string | undefined,
  limit = 5
): CenterResult[] {
  const kids = new Set(kidIds)
  return matches
    .filter((m) => m.status === "finished")
    .filter((m) =>
      [m.athlete1 ?? m.athlete1_id, m.athlete2 ?? m.athlete2_id].some(
        (v) => typeof v === "number" && kids.has(v)
      )
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, limit)
    .map((m) => {
      const kidId = [m.athlete1 ?? m.athlete1_id, m.athlete2 ?? m.athlete2_id].find(
        (v): v is number => typeof v === "number" && kids.has(v)
      )
      const winner = m.winner ?? m.winner_id ?? null
      const won = kidId !== undefined && winner !== null ? winner === kidId : null
      const t = tournamentOfCategory(m.category as number)
      const score =
        m.score1 !== null && m.score2 !== null ? `${m.score1}:${m.score2}` : null
      return {
        id: m.id,
        title: `${m.athlete1_name || "TBD"} — ${m.athlete2_name || "TBD"}${score ? ` · ${score}` : ""}`,
        body: [
          kidNameOf(kidId ?? -1) ? `${kidNameOf(kidId ?? -1)}: ${won === null ? "бой завершён" : won ? "победа" : "поражение"}` : null,
          t?.name ?? null,
          m.category_name ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: t ? `/tournaments/${t.slug}#match-${m.id}` : "/tournaments",
        won,
      }
    })
}

function readSeen(key: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = JSON.parse(raw ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

interface NotificationCenterProps {
  userId: number | string
  role: "trainer" | "parent"
  myFight: MyNextFight | null
  fightHref: string | null
  results: CenterResult[]
  watch: WatchTournament[]
}

/** N12: центр уведомлений кабинета. Источники — только уже загруженные
 * данные (бой, результаты) + объявления наблюдаемых турниров.
 * Без спама: приоритеты, прочитанное в localStorage, пусто → EmptyState. */
export function NotificationCenter({
  userId,
  role,
  myFight,
  fightHref,
  results,
  watch,
}: NotificationCenterProps) {
  const storageKey = `kwf-center-seen-${userId}`
  const [seen, setSeen] = useState<string[]>(() => readSeen(storageKey))
  const [announcements, setAnnouncements] = useState<AnnItem[]>([])

  const watchKey = watch.map((w) => w.slug).join(",")
  useEffect(() => {
    if (watch.length === 0) return
    let cancelled = false
    const names = new Map(watch.map((w) => [w.slug, w.name]))
    void Promise.all(
      watch.map((w) =>
        api<TournamentEventsResponse>(
          `/api/tournament/tournaments/${w.slug}/events/?after=0`
        )
          .then((data) =>
            data.events.filter(isAnnouncementEvent).slice(-3).map((e: TournamentEvent) => ({
              id: e.id,
              tournamentName: names.get(w.slug) ?? w.slug,
              detail: e.detail || "Объявление организатора",
              createdAt: e.created_at,
            }))
          )
          .catch(() => [] as AnnItem[])
      )
    ).then((lists) => {
      if (cancelled) return
      setAnnouncements(
        lists
          .flat()
          .sort((a, b) => b.id - a.id)
          .slice(0, 5)
      )
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey])

  const seenSet = useMemo(() => new Set(seen), [seen])
  const isNew = (id: string) => !seenSet.has(id)

  // Пустой watch — показываем пусто без сброса стейта в effect.
  const visibleAnnouncements = watch.length === 0 ? [] : announcements

  const urgent = myFight?.state === "live" ? myFight : null
  const allIds = [
    ...(urgent ? [`fight:${urgent.match.id}`] : []),
    ...results.map((r) => `result:${r.id}`),
    ...visibleAnnouncements.map((a) => `ann:${a.id}`),
  ]
  const newCount = allIds.filter(isNew).length

  const markAllRead = () => {
    setSeen(allIds)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(allIds))
    } catch {
      /* ignore */
    }
  }

  if (!urgent && results.length === 0 && visibleAnnouncements.length === 0) {
    return (
      <section aria-label="Уведомления" className="rounded-2xl border border-border bg-white dark:bg-[#0E2035]">
        <EmptyState
          icon={<BellRing size={26} />}
          title="Пока тихо"
          hint={
            role === "trainer"
              ? "Результаты боёв и объявления турниров появятся здесь"
              : "Включите «Уведомить о бое» выше — и не пропустите выход ребёнка"
          }
        />
      </section>
    )
  }

  return (
    <section aria-label="Уведомления" className="rounded-2xl border border-border bg-white p-6 dark:bg-[#0E2035]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-dark-text">
          Уведомления
          {newCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-energy text-white text-xs font-extrabold tabular-nums">
              {newCount}
            </span>
          )}
        </h2>
        {newCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-bold text-primary-blue hover:text-primary-blue-light transition-colors cursor-pointer"
          >
            Отметить прочитанными
          </button>
        )}
      </div>

      <div className="space-y-3">
        {urgent && (
          <Link
            href={fightHref ?? "/cabinet"}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-energy/40 bg-energy/5 hover:bg-energy/10 transition-colors"
          >
            <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-energy opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-energy" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-dark-text">
                  Ребёнок сейчас на татами
                </span>
                <PriorityBadge priority="urgent" isNew={isNew(`fight:${urgent.match.id}`)} />
              </span>
              <span className="block text-xs text-secondary-text mt-0.5 truncate">
                {urgent.match.athlete1} vs {urgent.match.athlete2} · {urgent.tatamiName}
              </span>
            </span>
          </Link>
        )}

        {results.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-light-gray border border-transparent hover:bg-white hover:border-primary-blue/20 transition-all dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-border dark:bg-white/[0.06]">
              <Trophy size={16} className={r.won ? "text-gold" : "text-secondary-text"} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-dark-text truncate">{r.title}</span>
                <PriorityBadge priority="important" isNew={isNew(`result:${r.id}`)} />
              </span>
              {r.body && (
                <span className="block text-xs text-secondary-text mt-0.5 truncate">{r.body}</span>
              )}
            </span>
          </Link>
        ))}

        {visibleAnnouncements.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-gold/40 bg-gold-soft/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/20">
              <Megaphone size={16} className="text-dark-blue" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-dark-text truncate">{a.tournamentName}</span>
                <PriorityBadge priority="info" isNew={isNew(`ann:${a.id}`)} />
              </span>
              <span className="block text-xs text-secondary-text mt-0.5 leading-relaxed">
                {a.detail}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function PriorityBadge({ priority, isNew }: { priority: CenterPriority; isNew: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
        PRIORITY_STYLE[priority]
      )}
    >
      {isNew && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
