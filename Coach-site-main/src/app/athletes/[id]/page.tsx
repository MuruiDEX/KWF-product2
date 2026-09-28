"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Trophy, Swords, UserRound } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import type { Athlete } from "@/lib/types"
import AppShell from "@/components/AppShell"
import EmptyState from "@/components/ui/EmptyState"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { Button } from "@/components/ui/button"

interface RecentFight {
  match_id: number
  tournament: string
  category: string
  round: string
  opponent: string
  score1: number
  score2: number
  won: boolean
}

interface AthleteMedal {
  tournament_id: number
  tournament_name: string
  tournament_slug: string
  category_name: string
  place: "gold" | "silver"
}

interface AthleteStats {
  athlete_id: number
  fights: number
  wins: number
  losses: number
  win_rate: number
  tournaments: { id: number; name: string; slug: string }[]
  recent: RecentFight[]
  medals: AthleteMedal[]
}

export default function AthletePassportPage() {
  const params = useParams()
  const router = useRouter()
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [stats, setStats] = useState<AthleteStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<Athlete>(`/api/tournament/athletes/${params.id}/`),
      api<AthleteStats>(`/api/tournament/athletes/${params.id}/stats/`),
    ])
      .then(([a, s]) => {
        if (cancelled) return
        setAthlete(a)
        setStats(s)
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params.id, reloadKey])

  if (loading) {
    return (
      <AppShell className="bg-light-gray">
        <div className="mx-auto max-w-[1280px] px-6 py-16 space-y-6" role="status" aria-label="Загрузка профиля спортсмена">
          <div className="h-10 w-64 rounded-lg bg-white animate-pulse" />
          <div className="grid sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white border border-border animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-white border border-border animate-pulse" />
        </div>
      </AppShell>
    )
  }

  if (error || !athlete || !stats) {
    const isNetwork = error.includes("соединение") || error.includes("Сервера")
    if (isNetwork) {
      return (
        <AppShell className="bg-light-gray">
          <div className="mx-auto max-w-[1280px] px-6 py-16">
            <ErrorRetry
              title="Не удалось загрузить профиль"
              hint={error || "Проверьте соединение с интернетом и попробуйте ещё раз"}
              onRetry={() => {
                setLoading(true)
                setError("")
                setReloadKey((k) => k + 1)
              }}
            />
          </div>
        </AppShell>
      )
    }
    return (
      <AppShell className="bg-light-gray">
        <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white">
          <EmptyState
            icon={<UserRound size={26} />}
            title="Нет доступа"
            hint={error || "Профиль спортсмена недоступен"}
            action={
              <Link href="/cabinet">
                <Button>В кабинет</Button>
              </Link>
            }
          />
        </div>
        </div>
      </AppShell>
    )
  }

  // N10: инициалы вместо отсутствующего фото (в API фото нет).
  const initials = `${athlete.last_name?.[0] ?? ""}${athlete.first_name?.[0] ?? ""}`.toUpperCase()
  const metaBits = [
    athlete.club?.trim() || null,
    athlete.age !== undefined && athlete.age !== null ? `${athlete.age} лет` : null,
    athlete.weight ? `${athlete.weight} кг` : null,
    athlete.height ? `${athlete.height} см` : null,
    athlete.gender === "male" ? "Мальчик" : athlete.gender === "female" ? "Девочка" : null,
  ].filter((b): b is string => !!b)

  const cards = [
    { label: "Боёв", value: stats.fights, icon: Swords },
    { label: "Побед", value: stats.wins, icon: Trophy },
    {
      label: "Процент побед",
      value: stats.fights > 0 ? `${Math.round(stats.win_rate * 100)}%` : "—",
      icon: Trophy,
    },
    { label: "Турниров", value: stats.tournaments.length, icon: Trophy },
  ]

  return (
    <AppShell className="bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center text-sm font-semibold text-primary-blue hover:text-primary-blue-light mb-6 transition-colors cursor-pointer"
          >
            ← Назад
          </button>
          <div className="flex items-center gap-4 mb-8">
            <div
              aria-hidden="true"
              className="w-16 h-16 rounded-2xl bg-dark-blue border border-gold/30 flex items-center justify-center shrink-0"
            >
              {initials ? (
                <span className="text-gold font-extrabold text-xl tracking-tight">
                  {initials}
                </span>
              ) : (
                <UserRound size={28} className="text-gold" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-text tracking-tight truncate">
                {athlete.last_name} {athlete.first_name}
              </h1>
              <p className="text-sm text-secondary-text mt-1">
                {metaBits.join(" · ") || "Спортсмен"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-white border border-border p-5"
              >
                <c.icon size={18} className="text-gold mb-2" />
                <div className="text-3xl font-extrabold text-dark-text tabular-nums">
                  {c.value}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-text mt-1">
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          {(stats.medals?.length ?? 0) > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-dark-text mb-3">Достижения</h2>
              <div className="flex flex-wrap gap-2">
                {stats.medals.map((m, i) => (
                  <Link
                    key={`${m.tournament_id}-${m.category_name}-${i}`}
                    href={`/tournaments/${m.tournament_slug}`}
                    title={`${m.tournament_name} · ${m.category_name}`}
                    className={`inline-flex items-center gap-2 h-10 pl-2.5 pr-4 rounded-full border text-sm font-bold transition-all hover:shadow-sm ${
                      m.place === "gold"
                        ? "bg-gold/15 border-gold/50 text-dark-blue dark:text-gold"
                        : "bg-white border-border text-dark-text hover:border-primary-blue/40"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                        m.place === "gold" ? "bg-gold text-dark-blue" : "bg-light-gray text-secondary-text"
                      }`}
                    >
                      {m.place === "gold" ? "1" : "2"}
                    </span>
                    <span className="truncate max-w-[220px]">{m.tournament_name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {stats.tournaments.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-dark-text mb-3">Турниры</h2>
              <div className="flex flex-wrap gap-2">
                {stats.tournaments.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tournaments/${t.slug}`}
                    className="inline-flex items-center h-9 px-4 rounded-full bg-white border border-border text-sm font-semibold text-dark-text hover:border-primary-blue/40 hover:shadow-sm transition-all"
                  >
                    <Trophy size={14} className="text-gold mr-2" />
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-lg font-bold text-dark-text mb-3">
            История боёв
          </h2>
          {stats.recent.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white">
              <EmptyState
                icon={<Swords size={26} />}
                title="Боёв пока нет"
                hint="Здесь появятся результаты выступлений"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_auto] gap-4 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-text border-b border-border">
                <span>Бой</span>
                <span className="w-24 text-right">Итог</span>
              </div>
              {stats.recent.map((f) => (
                <div
                  key={f.match_id}
                  className="grid sm:grid-cols-[1fr_auto] gap-2 sm:gap-4 px-5 py-4 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-dark-text truncate">
                      vs {f.opponent}
                    </div>
                    <div className="text-xs text-secondary-text mt-0.5">
                      {f.tournament} · {f.category} · {f.round} ·{" "}
                      <span className="tabular-nums">
                        {f.score1}:{f.score2}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center self-start sm:self-center justify-center h-7 px-3 rounded-full text-xs font-extrabold uppercase tracking-wider w-24 ${
                      f.won
                        ? "bg-success/10 text-success dark:bg-success/20 dark:text-[#86EFAC]"
                        : "bg-error/10 text-error dark:bg-error/25 dark:text-[#FCA5A5]"
                    }`}
                  >
                    {f.won ? "Победа" : "Поражение"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  )
}
