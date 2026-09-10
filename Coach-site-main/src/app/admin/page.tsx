"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Newspaper, Trophy, Users, Activity } from "lucide-react"
import Link from "next/link"
import { api, unwrapList } from "@/lib/api"

export default function AdminDashboard() {
  const [stats, setStats] = useState<{
    label: string
    value: string
    icon: any
    href: string
    color: string
  }[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      try {
        const [news, tournaments, athletes, matches] = await Promise.all([
          api<any[] | { results: any[] }>("/api/news/"),
          api<any[] | { results: any[] }>("/api/tournament/tournaments/"),
          api<any[] | { results: any[] }>("/api/tournament/athletes/"),
          api<any[] | { results: any[] }>("/api/tournament/matches/"),
        ]).then((lists) => lists.map(unwrapList) as any[][])

        setStats([
          { label: "Всего новостей", value: news.length.toString(), icon: Newspaper, href: "/admin/news", color: "bg-blue-500" },
          { label: "Активные турниры", value: tournaments.filter(t => t.status === "published").length.toString(), icon: Trophy, href: "/admin/tournaments", color: "bg-green-500" },
          { label: "Всего атлетов", value: athletes.length.toString(), icon: Users, href: "/admin/athletes", color: "bg-purple-500" },
          { label: "Матчей в системе", value: matches.length.toString(), icon: Activity, href: "/admin/tournaments", color: "bg-orange-500" },
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
        <p className="text-secondary-text">Добро пожаловать в систему управления КWF</p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Link href={stat.href}>
                <div className="bg-white p-6 rounded-2xl border border-border hover:shadow-lg transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl text-white ${stat.color}`}>
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
