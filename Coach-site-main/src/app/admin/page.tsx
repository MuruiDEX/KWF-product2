"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Newspaper, Trophy, Users, Activity } from "lucide-react"
import Link from "next/link"
import { api, splitPage, type ListResponse } from "@/lib/api"
import type { LucideIcon } from "lucide-react"

export default function AdminDashboard() {
  const [stats, setStats] = useState<{
    label: string
    value: string
    icon: LucideIcon
    href: string
    color: string
  }[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      try {
        const responses = await Promise.all([
          api<ListResponse<{ status?: string }>>("/api/news/"),
          api<ListResponse<{ status?: string }>>("/api/tournament/tournaments/"),
          api<ListResponse<unknown>>("/api/tournament/athletes/"),
          api<ListResponse<unknown>>("/api/tournament/matches/"),
        ])
        const news = splitPage(responses[0])
        const tournaments = splitPage(responses[1])
        const athletes = splitPage(responses[2])
        const matches = splitPage(responses[3])

        // F2: счётчики по total, а не по длине первой страницы.
        const newsTotal = news.total ?? news.items.length
        const athletesTotal = athletes.total ?? athletes.items.length
        const matchesTotal = matches.total ?? matches.items.length

        // Фаза 5: бренд-палитра вместо blue/green/purple/orange-500.
        setStats([
          { label: "Всего новостей", value: newsTotal.toString(), icon: Newspaper, href: "/admin/news", color: "bg-primary-blue text-white" },
          { label: "Активные турниры", value: tournaments.items.filter(t => t.status === "published").length.toString(), icon: Trophy, href: "/admin/tournaments", color: "bg-success text-white" },
          { label: "Всего атлетов", value: athletesTotal.toString(), icon: Users, href: "/admin/athletes", color: "bg-navy text-white" },
          { label: "Матчей в системе", value: matchesTotal.toString(), icon: Activity, href: "/admin/tournaments", color: "bg-gold text-dark-blue" },
        ])
      } catch (e) {
        console.error("Failed to load stats", e)
      } finally {
        setLoading(false)
      }
    }

    void loadStats()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-secondary-text">
        Не удалось загрузить статистику
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-extrabold text-dark-text">Панель управления</h1>
        <p className="text-secondary-text">Добро пожаловать в систему управления KWF</p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i, 3) * 0.08 }}
            >
              <Link href={stat.href}>
                <div className="bg-white p-6 rounded-2xl border border-border hover:shadow-lg transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${stat.color}`}>
                      <Icon size={24} />
                    </div>
                    <span className="text-xs font-bold text-secondary-text group-hover:text-primary-blue transition-colors">
                      Перейти →
                    </span>
                  </div>
                  <p className="text-sm font-medium text-secondary-text mb-1">{stat.label}</p>
                  <p className="text-3xl font-extrabold text-dark-text">{stat.value}</p>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
