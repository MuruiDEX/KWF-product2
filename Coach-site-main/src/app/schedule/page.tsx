"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { api, unwrapList } from "@/lib/api"
import type { TrainingSession } from "@/lib/types"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import TimetableGrid from "@/components/TimetableGrid"
import EmptyState from "@/components/ui/EmptyState"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { Button } from "@/components/ui/button"
import { CalendarDays } from "lucide-react"
import { LeadModal } from "@/components/LeadModal"

export default function SchedulePage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  // Фаза 1: отличаем «сервер недоступен» от «занятий нет».
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [leadOpen, setLeadOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<TrainingSession[] | { results: TrainingSession[] }>("/api/schedule/sessions/")
      .then((data) => {
        if (!cancelled) setSessions(unwrapList(data))
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const retry = () => {
    setLoading(true)
    setLoadError(false)
    setReloadKey((k) => k + 1)
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Расписание" }]} />
          <PageHeader
            eyebrow="Расписание"
            title="Недельное расписание"
            description="Все тренировки школы на неделю. Нажмите на занятие, чтобы увидеть тренера, зал и подробности."
            className="mt-4"
          />
        </motion.div>

        {loading ? (
          <SkeletonGrid count={6} label="Загрузка расписания" />
        ) : loadError ? (
          <ErrorRetry
            title="Не удалось загрузить расписание"
            hint="Проверьте соединение с интернетом и попробуйте ещё раз"
            onRetry={retry}
          />
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
          <Button size="lg" onClick={() => setLeadOpen(true)}>
            Записаться на пробное занятие
          </Button>
        </div>
        <LeadModal
          open={leadOpen}
          onClose={() => setLeadOpen(false)}
          initialPlan="trial"
          source="schedule"
        />
      </div>
    </AppShell>
  )
}
