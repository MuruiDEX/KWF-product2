"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { api, unwrapList } from "@/lib/api"
import type { TrainingSession } from "@/lib/types"
import SectionHeader from "@/components/ui/SectionHeader"
import TimetableGrid from "@/components/TimetableGrid"
import EmptyState from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/button"
import { CalendarDays } from "lucide-react"

export default function SchedulePage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api<TrainingSession[] | { results: TrainingSession[] }>("/api/schedule/sessions/")
      .then((data) => {
        if (!cancelled) setSessions(unwrapList(data))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1600px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SectionHeader
            eyebrow="Расписание"
            title="Недельное расписание"
            description="Все тренировки школы на неделю. Нажмите на занятие, чтобы увидеть тренера, зал и подробности."
          />
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<CalendarDays size={26} />}
              title="Занятий пока нет"
              hint="Расписание скоро появится — следите за новостями школы"
            />
          </div>
        ) : (
          <TimetableGrid sessions={sessions} />
        )}

        <div className="flex justify-center mt-10">
          <Button size="lg" onClick={() => window.open("https://wa.me/77476847442", "_blank", "noopener,noreferrer")}>
            Записаться на пробное занятие
          </Button>
        </div>
      </div>
    </div>
  )
}
