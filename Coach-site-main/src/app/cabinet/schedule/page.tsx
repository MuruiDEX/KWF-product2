"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import AppShell from "@/components/AppShell"
import { useModalBehavior } from "@/lib/useModal"
import { useAuth } from "@/lib/auth"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import type { TrainingSession } from "@/lib/types"
import TimetableGrid from "@/components/TimetableGrid"
import EmptyState from "@/components/ui/EmptyState"
import { ArrowLeft, Plus, Trash2, CalendarDays } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { toast } from "@/components/ui/Toaster"

const DAYS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
]

const EMPTY_FORM = {
  day: "0",
  start_time: "",
  end_time: "",
  group: "",
  kind: "Кекушинкай",
  trainer_name: "",
  room: "",
  note: "",
  is_active: true,
}

export default function CabinetSchedulePage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading, offline } = useAuth()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | (typeof EMPTY_FORM & { id?: number })>(null)
  const [modalError, setModalError] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TrainingSession | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeModal = useCallback(() => setModal(null), [])
  // D4: общий dialog-паттерн (Escape + focus-trap + scroll-lock + возврат фокуса),
  // как в ConfirmDialog. Бизнес-логика формы не меняется.
  useModalBehavior(modal !== null, closeModal, panelRef)

  useEffect(() => {
    if (!authLoading && !user && !offline) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
    }
    else if (user && user.profile?.role !== "trainer") router.push("/cabinet")
  }, [user, authLoading, offline, router, pathname])

  useEffect(() => {
    if (!user) return
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
  }, [user])

  if (!user || user.profile?.role !== "trainer") return null

  async function refresh() {
    const data = await api<TrainingSession[] | { results: TrainingSession[] }>(
      "/api/schedule/sessions/"
    )
    setSessions(unwrapList(data))
  }

  function openAdd() {
    setModalError("")
    setModal({ ...EMPTY_FORM })
  }

  function openEdit(s: TrainingSession) {
    setModalError("")
    setModal({
      id: s.id,
      day: String(s.day),
      start_time: (s.start_time ?? "").slice(0, 5),
      end_time: (s.end_time ?? "").slice(0, 5),
      group: s.group,
      kind: s.kind || "Кекушинкай",
      trainer_name: s.trainer_name || "",
      room: s.room || "",
      note: s.note || "",
      is_active: s.is_active,
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!modal) return
    if (!modal.start_time || !modal.end_time) {
      setModalError("Укажите время начала и окончания.")
      return
    }
    if (modal.end_time <= modal.start_time) {
      setModalError("Время окончания должно быть позже начала.")
      return
    }
    if (!modal.group.trim()) {
      setModalError("Укажите группу.")
      return
    }
    setSaving(true)
    setModalError("")
    try {
      const body = JSON.stringify({
        day: Number(modal.day),
        start_time: modal.start_time,
        end_time: modal.end_time,
        group: modal.group.trim(),
        kind: modal.kind.trim() || "Кекушинкай",
        trainer_name: modal.trainer_name.trim(),
        room: modal.room.trim(),
        note: modal.note.trim(),
        is_active: modal.is_active,
      })
      if (modal.id) {
        await api(`/api/schedule/sessions/${modal.id}/`, { method: "PATCH", body })
      } else {
        await api("/api/schedule/sessions/", { method: "POST", body })
      }
      setModal(null)
      await refresh()
    } catch (err) {
      setModalError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: TrainingSession) {
    setPendingDelete(s)
  }

  async function doDelete(s: TrainingSession) {
    setPendingDelete(null)
    setBusyId(s.id)
    try {
      await api(`/api/schedule/sessions/${s.id}/`, { method: "DELETE" })
      await refresh()
      toast("Занятие удалено", "success")
    } catch {
      toast("Не удалось удалить занятие", "error")
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggle(s: TrainingSession) {
    setBusyId(s.id)
    try {
      await api(`/api/schedule/sessions/${s.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !s.is_active }),
      })
      await refresh()
    } catch {
      toast("Не удалось изменить статус", "error")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell className="bg-light-gray">
      <div className="mx-auto max-w-[1600px] px-6 pt-8 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-secondary-text"
              onClick={() => router.back()}
            >
              <ArrowLeft size={16} />
              Назад
            </Button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-blue">
                Кабинет тренера
              </p>
              <h1 className="text-3xl font-extrabold text-dark-text tracking-tight mt-1">
                Расписание тренировок
              </h1>
              <p className="text-sm text-secondary-text mt-1">
                Нажмите на занятие в сетке, чтобы изменить его
              </p>
            </div>
          </div>
          <Button onClick={openAdd} className="gap-2" size="sm">
            <Plus size={16} />
            Занятие
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              role="status"
              aria-label="Загрузка расписания"
              className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<CalendarDays size={26} />}
              title="Занятий пока нет"
              hint="Добавьте первое занятие — оно сразу появится на публичной странице расписания"
              action={
                <Button size="sm" className="h-10 px-5 text-sm gap-1.5" onClick={openAdd}>
                  <Plus size={16} />
                  Добавить
                </Button>
              }
            />
          </div>
        ) : (
          <TimetableGrid sessions={sessions} showInactive onSessionClick={openEdit} />
        )}

        {modal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modal.id ? "Изменить занятие" : "Новое занятие"}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <div
              ref={panelRef}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold text-dark-text mb-4">
                {modal.id ? "Изменить занятие" : "Новое занятие"}
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {modalError}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="sched-day" className="block text-sm font-semibold text-dark-text mb-1.5">День *</label>
                    <select
                      id="sched-day"
                      value={modal.day}
                      onChange={(e) => setModal({ ...modal, day: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                    >
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>{d.slice(0, 2)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sched-start" className="block text-sm font-semibold text-dark-text mb-1.5">Начало *</label>
                    <input
                      id="sched-start"
                      type="time"
                      required
                      value={modal.start_time}
                      onChange={(e) => setModal({ ...modal, start_time: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="sched-end" className="block text-sm font-semibold text-dark-text mb-1.5">Конец *</label>
                    <input
                      id="sched-end"
                      type="time"
                      required
                      value={modal.end_time}
                      onChange={(e) => setModal({ ...modal, end_time: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="sched-group" className="block text-sm font-semibold text-dark-text mb-1.5">Группа *</label>
                  <input
                    id="sched-group"
                    type="text"
                    required
                    maxLength={100}
                    value={modal.group}
                    onChange={(e) => setModal({ ...modal, group: e.target.value })}
                    placeholder="Средняя группа"
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sched-kind" className="block text-sm font-semibold text-dark-text mb-1.5">Тип</label>
                    <input
                      id="sched-kind"
                      type="text"
                      maxLength={100}
                      value={modal.kind}
                      onChange={(e) => setModal({ ...modal, kind: e.target.value })}
                      placeholder="Кекушинкай"
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="sched-trainer" className="block text-sm font-semibold text-dark-text mb-1.5">Тренер</label>
                    <input
                      id="sched-trainer"
                      type="text"
                      maxLength={200}
                      value={modal.trainer_name}
                      onChange={(e) => setModal({ ...modal, trainer_name: e.target.value })}
                      placeholder="Иванов А.А."
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="sched-room" className="block text-sm font-semibold text-dark-text mb-1.5">Зал</label>
                  <input
                    id="sched-room"
                    type="text"
                    maxLength={200}
                    value={modal.room}
                    onChange={(e) => setModal({ ...modal, room: e.target.value })}
                    placeholder="Зал 1"
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
                <div>
                  <label htmlFor="sched-note" className="block text-sm font-semibold text-dark-text mb-1.5">Примечание</label>
                  <textarea
                    id="sched-note"
                    value={modal.note}
                    onChange={(e) => setModal({ ...modal, note: e.target.value })}
                    rows={2}
                    placeholder="Что взять с собой, уровень и т.д."
                    className="w-full p-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 resize-none"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modal.is_active}
                    onChange={(e) => setModal({ ...modal, is_active: e.target.checked })}
                    className="w-4 h-4 accent-[#17488F]"
                  />
                  Показывать на сайте
                </label>
                {modal.id && (
                  <div className="flex items-center justify-between rounded-xl border border-border bg-light-gray px-4 py-2.5">
                    <span className="text-xs font-semibold text-secondary-text">
                      {sessions.find((s) => s.id === modal.id)?.is_active ? "Видно на сайте" : "Скрыто с сайта"}
                    </span>
                    <span className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={busyId === modal.id}
                        onClick={() => {
                          const s = sessions.find((x) => x.id === modal.id)
                          if (s) {
                            setModal(null)
                            void handleToggle(s)
                          }
                        }}
                      >
                        {sessions.find((s) => s.id === modal.id)?.is_active ? "Скрыть" : "Показать"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={busyId === modal.id}
                        onClick={() => {
                          const s = sessions.find((x) => x.id === modal.id)
                          if (s) {
                            setModal(null)
                            void handleDelete(s)
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </span>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    className="h-10 px-4 text-sm"
                    onClick={() => setModal(null)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="h-10 px-5 text-sm" disabled={saving}>
                    {saving ? "Сохранение..." : modal.id ? "Сохранить" : "Добавить"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title={`Удалить занятие «${pendingDelete?.group ?? ""}»?`}
          description={
            pendingDelete
              ? `${DAYS[pendingDelete.day] ?? "—"}, ${(pendingDelete.start_time ?? "").slice(0, 5)}–${(pendingDelete.end_time ?? "").slice(0, 5)}`
              : undefined
          }
          confirmLabel="Удалить"
          danger
          busy={busyId !== null}
          onConfirm={() => pendingDelete && doDelete(pendingDelete)}
          onClose={() => setPendingDelete(null)}
        />
      </div>
    </AppShell>
  )
}
