"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { UserPlus, Activity, Trophy, Clock } from "lucide-react"
import type { Athlete, Match } from "@/lib/types"

export default function ParentView() {
  const [children, setChildren] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [bindingId, setBindingId] = useState("")

  useEffect(() => {
    fetchChildren()
  }, [])

  async function fetchChildren() {
    setLoading(true)
    try {
      const data = await api<Athlete[]>("/api/auth/my-children/")
      setChildren(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleBindChild() {
    if (!bindingId) return
    try {
      await api("/api/auth/bind-child/", {
        method: "POST",
        body: JSON.stringify({ athlete_id: bindingId })
      })
      alert("Запрос на привязку отправлен. Ожидайте подтверждения тренера.")
      setBindingId("")
    } catch (e) {
      alert("Ошибка при привязке. Проверьте ID ребёнка.")
    }
  }

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-blue/10 text-primary-blue rounded-lg">
            <UserPlus size={24} />
          </div>
          <h2 className="text-xl font-bold text-dark-text">Привязать ребёнка</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Введите ID спортсмена"
            value={bindingId}
            onChange={(e) => setBindingId(e.target.value)}
            className="flex-grow h-12 px-4 rounded-xl border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-primary-blue/30"
          />
          <Button onClick={handleBindChild} className="h-12 px-6">Привязать</Button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {children.length === 0 ? (
          <div className="col-span-2 text-center py-20 bg-white rounded-2xl border border-border">
            <p className="text-secondary-text">У вас пока нет привязанных детей</p>
          </div>
        ) : (
          children.map(child => (
            <ChildTracker key={child.id} child={child} />
          ))
        )}
      </div>
    </div>
  )
}

function ChildTracker({ child }: { child: Athlete }) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await api<any>(`/api/auth/child-status/${child.id}/`)
        setStatus(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    poll()
    const interval = setInterval(poll, 60000)
    return () => clearInterval(interval)
  }, [child.id])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-border p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-dark-text">{child.last_name} {child.first_name}</h3>
          <p className="text-sm text-secondary-text">{child.age} лет · {child.weight} кг</p>
        </div>
        <div className="p-3 bg-light-gray rounded-xl">
          <Users size={24} className="text-secondary-text" />
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-secondary-text italic">Загрузка статуса...</div>
      ) : !status ? (
        <div className="p-4 bg-light-gray rounded-xl text-center text-sm text-secondary-text">
          В данный момент бои не запланированы
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-primary-blue/5 rounded-xl border border-primary-blue/10">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-primary-blue" />
              <span className="text-xs font-bold uppercase text-primary-blue">Текущий статус</span>
            </div>
            <p className="text-lg font-extrabold text-dark-text">
              {status.current_match_status}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-light-gray rounded-xl">
              <div className="flex items-center gap-2 text-xs text-secondary-text mb-1">
                <Trophy size={12} /> Татами
              </div>
              <p className="text-sm font-bold text-dark-text">{status.mat_name || "—"}</p>
            </div>
            <div className="p-3 bg-light-gray rounded-xl">
              <div className="flex items-center gap-2 text-xs text-secondary-text mb-1">
                <Clock size={12} /> Время
              </div>
              <p className="text-sm font-bold text-dark-text">{status.scheduled_time || "—"}</p>
            </div>
          </div>

          {status.current_match && (
            <div className="p-4 border border-border rounded-xl bg-white">
              <p className="text-xs font-semibold text-secondary-text mb-2">Бой №{status.current_match.match_number}</p>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-dark-text">{status.current_match.athlete1_name}</span>
                <span className="text-xs font-bold text-secondary-text">vs</span>
                <span className="text-sm font-bold text-dark-text">{status.current_match.athlete2_name}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

import { Users } from "lucide-react"
