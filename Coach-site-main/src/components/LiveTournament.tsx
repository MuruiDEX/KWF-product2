"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { MapPin, CalendarDays, ArrowRight, Swords } from "lucide-react"
import { api } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import StatusPill from "@/components/ui/StatusPill"

function parseStart(t: Tournament): Date | null {
  if (!t.start_date) return null
  const time = t.start_time ? t.start_time.slice(0, 5) : "10:00"
  const d = new Date(`${t.start_date}T${time}:00`)
  return isNaN(d.getTime()) ? null : d
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function Countdown({ target, now }: { target: Date; now: Date }) {
  const diff = Math.max(0, target.getTime() - now.getTime())
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  const cells = [
    { v: days, l: "дней" },
    { v: hours, l: "часов" },
    { v: mins, l: "минут" },
    { v: secs, l: "секунд" },
  ]
  return (
    <div className="flex items-stretch gap-2">
      {cells.map((c) => (
        <div
          key={c.l}
          className="min-w-[62px] flex-1 sm:flex-none sm:w-[72px] rounded-xl bg-white/5 border border-white/10 px-2 py-2.5 text-center backdrop-blur-sm"
        >
          <div className="text-2xl font-extrabold text-white tabular-nums tracking-tight">
            {String(c.v).padStart(2, "0")}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 mt-0.5">
            {c.l}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LiveTournament() {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [mode, setMode] = useState<"live" | "next" | null>(null)
  const [loading, setLoading] = useState(true)
  const now = useNow()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api<Tournament[]>("/api/tournament/tournaments/")
        if (cancelled || !data.length) return
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const byStart = [...data].sort((a, b) => a.start_date.localeCompare(b.start_date))
        const running = byStart.find((t) => {
          if (t.status === "finished") return false
          const start = new Date(`${t.start_date}T00:00:00`)
          const end = new Date(`${t.end_date}T23:59:59`)
          return start <= new Date() && new Date() <= end
        })
        if (running) {
          setTournament(running)
          setMode("live")
          return
        }
        const upcoming = byStart.find((t) => t.status !== "finished" && new Date(`${t.start_date}T00:00:00`) >= today)
        if (upcoming) {
          setTournament(upcoming)
          setMode("next")
        }
      } catch {
        /* backend unavailable — section stays hidden */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <div className="rounded-3xl bg-dark-blue/5 border border-border p-8 animate-pulse">
            <div className="h-5 w-40 rounded bg-dark-blue/10 mb-4" />
            <div className="h-8 w-72 rounded bg-dark-blue/10" />
          </div>
        </div>
      </section>
    )
  }

  if (!tournament || !mode) return null

  const start = parseStart(tournament)
  const isLive = mode === "live"

  return (
    <section className="bg-white" aria-label="Ближайший турнир">
      <div className="mx-auto max-w-[1280px] px-6 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl bg-dark-blue border border-white/10 shadow-2xl shadow-dark-blue/30"
        >
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-blue/25 blur-[100px]" />
            <div className="absolute -bottom-28 right-0 w-[80vmin] h-[80vmin] max-w-[560px] max-h-[560px] rounded-full bg-gold/10 blur-[110px]" />
            <div className="absolute top-1/2 right-[6%] -translate-y-1/2 opacity-[0.06] text-[150px] font-black text-white leading-none select-none hidden lg:block">
              戦
            </div>
          </div>

          <div className="relative z-10 p-7 sm:p-10 flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <StatusPill status={isLive ? "live" : "upcoming"} tone="dark" pulse={isLive} />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  {isLive ? "Турнир идёт сейчас" : "Ближайший турнир"}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
                {tournament.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-white/75">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={15} className="text-gold/80" />
                  {new Date(`${tournament.start_date}T00:00:00`).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {tournament.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-gold/80" />
                    {tournament.location}
                  </span>
                )}
                {!!tournament.categories?.length && (
                  <span className="inline-flex items-center gap-1.5">
                    <Swords size={15} className="text-gold/80" />
                    {tournament.categories.length} кат.
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:items-end shrink-0">
              {!isLive && start && start.getTime() > now.getTime() && (
                <Countdown target={start} now={now} />
              )}
              {isLive && (
                <p className="text-sm text-white/70 max-w-[220px] lg:text-right leading-relaxed">
                  Бои уже идут. Следите за сеткой и результатами в реальном времени.
                </p>
              )}
              <Link href={`/tournaments/${tournament.slug}`}>
                <span className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-gold text-dark-blue font-bold text-sm hover:bg-accent-warm-light transition-all duration-200 shadow-lg shadow-gold/20 cursor-pointer">
                  {isLive ? "Смотреть турнир" : "Подробнее о турнире"}
                  <ArrowRight size={16} />
                </span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
