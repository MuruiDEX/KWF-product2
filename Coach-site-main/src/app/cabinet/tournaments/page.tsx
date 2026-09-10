"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Tournament } from "@/lib/types"
import { Trophy, Calendar, Users, Plus } from "lucide-react"

const statusLabel: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликован",
  finished: "Завершён",
}

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  finished: "bg-blue-100 text-blue-700",
}

export default function TrainerTournamentsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }
    if (user && user.profile?.role !== "trainer") {
      router.push("/cabinet")
      return
    }
    if (!user) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const data = await api<Tournament[] | { results: Tournament[] }>(
          "/api/tournament/tournaments/"
        )
        if (cancelled) return
        const list = unwrapList(data)
        // Фильтрация по владельцу — fallback, пока нет ?owned на бэке.
        // Сравнение по id надёжнее username (переименование ломает фильтр).
        const mine = list.filter((t) => {
          const owner = (t as Tournament & { created_by?: unknown }).created_by
          if (typeof owner === "number") return owner === user.id
          if (typeof owner === "string") return owner === user.username
          return false
        })
        setTournaments(mine.length ? mine : list.filter((t) => (t as { created_by?: unknown }).created_by === user.username))
      } catch (e) {
        if (!cancelled) console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, router])

  async function fetchTournaments() {
    try {
      const data = await api<Tournament[] | { results: Tournament[] }>(
        "/api/tournament/tournaments/"
      )
      const list = unwrapList(data)
      const userTournaments = list.filter(
        (t) => (t as { created_by?: unknown }).created_by === user?.username
      )
      setTournaments(userTournaments)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handlePublish(t: Tournament) {
    const toPublished = t.status !== "published"
    if (toPublished && !window.confirm(`Опубликовать турнир «${t.name}»? Он станет виден всем зрителям.`)) {
      return
    }
    setPublishingId(t.id)
    try {
      await api(`/api/tournament/tournaments/${t.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: toPublished ? "published" : "draft" }),
      })
      await fetchTournaments()
    } catch (e) {
      console.error(e)
      alert(apiErrorMessage(e))
    } finally {
      setPublishingId(null)
    }
  }

  async function handleDelete(t: Tournament) {
    if (!window.confirm(`Вы действительно хотите удалить турнир «${t.name}»? Все категории, матчи и раунды этого турнира будут удалены. Спортсмены останутся в базе.`)) {
      return
    }
    setDeletingId(t.id)
    try {
      await api(`/api/tournament/tournaments/${t.id}/`, { method: "DELETE" })
      setTournaments((prev) => prev.filter((x) => x.id !== t.id))
    } catch (e) {
      console.error(e)
      alert(apiErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  if (!user || user.profile?.role !== "trainer") return null

  return (
    <div className="min-h-screen bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-4xl font-extrabold text-dark-text">Управление турнирами</h1>
              <p className="text-secondary-text mt-2">Единый центр управления турнирами и категориями</p>
            </div>
            <Link href="/cabinet/tournaments/create">
              <Button className="gap-2">
                <Plus size={20} />
                Создать турнир
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tournaments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-border p-12 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-blue/10 rounded-2xl flex items-center justify-center">
                <Trophy className="text-primary-blue" size={32} />
              </div>
              <h2 className="text-xl font-bold text-dark-text mb-2">Турниров пока нет</h2>
              <p className="text-secondary-text mb-6 max-w-md mx-auto">
                Создайте свой первый турнир с помощью конструктора и начните управлять соревнованиями
              </p>
              <Link href="/cabinet/tournaments/create">
                <Button className="gap-2">
                  <Plus size={20} />
                  Создать турнир
                </Button>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {tournaments.map((t, idx) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-xl bg-primary-blue/10 flex items-center justify-center">
                            <Trophy className="text-primary-blue" size={20} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-dark-text truncate">{t.name}</h3>
                            <p className="text-sm text-secondary-text">
                              {t.categories?.length || 0} категорий
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[t.status] || "bg-gray-100 text-gray-600"}`}>
                            {statusLabel[t.status] || t.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-secondary-text mt-4 pt-4 border-t border-border">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(t.start_date).toLocaleDateString("ru-RU")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {t.categories?.length || 0} категорий
                        </span>
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A8.5 8.5 0 0 0 16 10.5"/><path d="m12 2 2 2 4-4"/></svg>
                          Татами: {t.mats_count || 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-4 border-t border-border flex items-center justify-end gap-3">
                    {t.status !== "finished" && (
                      <Button
                        variant={t.status === "published" ? "ghost" : "outline"}
                        size="sm"
                        className="gap-2"
                        disabled={publishingId === t.id}
                        onClick={() => handlePublish(t)}
                      >
                        {publishingId === t.id
                          ? "Сохранение..."
                          : t.status === "published"
                            ? "Снять с публикации"
                            : "Опубликовать"}
                      </Button>
                    )}
                    <Link href={`/cabinet/tournaments/${t.id}/bracket`}>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V5l-7-7-7 7"/><path d="M21 12h-14"/></svg>
                        Сетка
                      </Button>
                    </Link>
                    <Link href={`/cabinet/tournaments/${t.id}/manage`}>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h12v12H9Z"/></svg>
                        Управление
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deletingId === t.id}
                      onClick={() => handleDelete(t)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      {deletingId === t.id ? "Удаление..." : "Удалить турнир"}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
