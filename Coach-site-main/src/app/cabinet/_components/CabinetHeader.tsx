"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Calendar,
  Newspaper,
  Plus,
  Swords,
  Trophy,
  UserRound,
  Users,
} from "lucide-react"

interface CabinetHeaderProps {
  displayName: string
  role: "trainer" | "parent"
  loading: boolean
  tournamentCount: number
  athleteCount: number
  matchCount: number
}

/** Фаза 4: шапка кабинета (бывший инлайн-блок page.tsx).
 * Чисто презентационный компонент — вся логика осталась в page. */
export function CabinetHeader({
  displayName,
  role,
  loading,
  tournamentCount,
  athleteCount,
  matchCount,
}: CabinetHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl bg-dark-blue border border-white/10 shadow-xl shadow-dark-blue/20 mb-8"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-20 right-10 w-72 h-72 rounded-full bg-primary-blue/30 blur-[90px]" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-gold/10 blur-[90px]" />
      </div>
      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <UserRound size={28} className="text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {displayName}
              </h1>
              <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-white/75 border border-white/10">
                {role === "trainer" ? "Тренер" : "Родитель"}
              </span>
            </div>
            <p className="text-sm text-white/75 mt-1">
              {role === "trainer"
                ? "Панель управления школой, турнирами и спортсменами"
                : "Профиль, дети и турниры вашей семьи"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            {role === "trainer" ? (
              <>
                <Link href="/cabinet/tournaments/create">
                  <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-gold text-dark-blue text-sm font-bold hover:bg-accent-warm-light transition-colors cursor-pointer">
                    <Plus size={16} />
                    Создать турнир
                  </span>
                </Link>
                <Link href="/cabinet/tournaments">
                  <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer">
                    Управление
                    <ArrowRight size={15} />
                  </span>
                </Link>
                <Link href="/cabinet/schedule">
                  <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer">
                    <Calendar size={15} />
                    Расписание
                  </span>
                </Link>
                <Link href="/cabinet/news">
                  <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/10 transition-colors cursor-pointer">
                    <Newspaper size={15} />
                    Новости
                  </span>
                </Link>
              </>
            ) : (
              <Link href="/tournaments">
                <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-gold text-dark-blue text-sm font-bold hover:bg-accent-warm-light transition-colors cursor-pointer">
                  <Trophy size={16} />
                  Смотреть турниры
                </span>
              </Link>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { icon: Trophy, label: "Турниры", value: loading ? null : tournamentCount },
            { icon: Users, label: role === "trainer" ? "Спортсмены" : "Дети", value: loading ? null : athleteCount },
            { icon: Swords, label: "Матчи", value: loading ? null : matchCount },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 backdrop-blur-sm"
            >
              <s.icon size={17} className="text-gold/80 mb-2" />
              <div className="text-2xl font-extrabold text-white tabular-nums">
                {s.value === null ? (
                  <span className="inline-block w-8 h-7 rounded bg-white/10 animate-pulse" />
                ) : (
                  s.value
                )}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
