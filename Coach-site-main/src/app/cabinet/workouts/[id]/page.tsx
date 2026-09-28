"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUp, ArrowDown, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import type { Assignment, Athlete, Exercise, Workout } from "@/lib/types"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/ui/EmptyState"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { toast } from "@/components/ui/Toaster"

const emptyExercise = { name: "", sets: "3", reps: "10", weight: "", rest_seconds: "60", comment: "", video_url: "" }

/** P2: конструктор тренировки — упражнения + назначения спортсменам. */
export default function WorkoutBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const role = user?.profile?.role || "parent"

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [head, setHead] = useState({ title: "", description: "", group: "", is_template: false })

  const [exForm, setExForm] = useState(emptyExercise)
  const [editingEx, setEditingEx] = useState<number | null>(null)
  const [exError, setExError] = useState("")
  const [exBusy, setExBusy] = useState(false)
  const [pendingDeleteEx, setPendingDeleteEx] = useState<Exercise | null>(null)

  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignForm, setAssignForm] = useState({ athlete: "", due_date: "", note: "" })
  const [assignError, setAssignError] = useState("")
  const [assignBusy, setAssignBusy] = useState(false)
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push(`/login?next=/cabinet/workouts/${id}`)
    else if (!authLoading && user && role !== "trainer") router.push("/cabinet")
  }, [authLoading, user, role, router, id])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [w, list, alist] = await Promise.all([
        api<Workout>(`/api/workouts/workouts/${id}/`),
        api<Assignment[] | { results: Assignment[] }>(`/api/workouts/assignments/?workout=${id}`),
        api<Athlete[] | { results: Athlete[] }>("/api/tournament/athletes/"),
      ])
      setWorkout(w)
      setHead({ title: w.title, description: w.description, group: w.group, is_template: w.is_template })
      setAssignments(unwrapList(list))
      setAthletes(unwrapList(alist))
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!user || role !== "trainer") return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [user, role, load])

  if (!user || role !== "trainer") return null

  const saveHead = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api<Workout>(`/api/workouts/workouts/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          title: head.title.trim(),
          description: head.description.trim(),
          group: head.group.trim(),
          is_template: head.is_template,
        }),
      })
      setWorkout(updated)
      toast("Сохранено", "success")
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setSaving(false)
    }
  }

  const submitExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    setExError("")
    setExBusy(true)
    try {
      const payload = {
        workout: Number(id),
        name: exForm.name.trim(),
        sets: Number(exForm.sets),
        reps: exForm.reps.trim(),
        weight: exForm.weight.trim() === "" ? null : exForm.weight.replace(",", ".").trim(),
        rest_seconds: Number(exForm.rest_seconds),
        comment: exForm.comment.trim(),
        video_url: exForm.video_url.trim(),
        order: workout ? workout.exercises.length : 0,
      }
      if (editingEx === null) {
        await api("/api/workouts/exercises/", { method: "POST", body: JSON.stringify(payload) })
        toast("Упражнение добавлено", "success")
      } else {
        await api(`/api/workouts/exercises/${editingEx}/`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, order: undefined }),
        })
        toast("Упражнение обновлено", "success")
      }
      setExForm(emptyExercise)
      setEditingEx(null)
      await load()
    } catch (err) {
      setExError(apiErrorMessage(err))
    } finally {
      setExBusy(false)
    }
  }

  const startEditEx = (ex: Exercise) => {
    setExError("")
    setEditingEx(ex.id)
    setExForm({
      name: ex.name,
      sets: String(ex.sets),
      reps: ex.reps,
      weight: ex.weight ?? "",
      rest_seconds: String(ex.rest_seconds),
      comment: ex.comment,
      video_url: ex.video_url,
    })
  }

  const doDeleteEx = async (ex: Exercise) => {
    setConfirmBusy(true)
    try {
      await api(`/api/workouts/exercises/${ex.id}/`, { method: "DELETE" })
      setPendingDeleteEx(null)
      toast("Упражнение удалено", "success")
      await load()
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setConfirmBusy(false)
    }
  }

  const moveEx = async (index: number, dir: -1 | 1) => {
    if (!workout) return
    const list = [...workout.exercises]
    const j = index + dir
    if (j < 0 || j >= list.length) return
    setExBusy(true)
    try {
      const a = list[index]
      const b = list[j]
      await api(`/api/workouts/exercises/${a.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ order: b.order }),
      })
      await api(`/api/workouts/exercises/${b.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ order: a.order }),
      })
      await load()
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setExBusy(false)
    }
  }

  const assign = async (e: React.FormEvent) => {
    e.preventDefault()
    setAssignError("")
    setAssignBusy(true)
    try {
      await api("/api/workouts/assignments/", {
        method: "POST",
        body: JSON.stringify({
          workout: Number(id),
          athlete: Number(assignForm.athlete),
          due_date: assignForm.due_date || null,
          note: assignForm.note.trim(),
        }),
      })
      setAssignForm({ athlete: "", due_date: "", note: "" })
      toast("Назначено", "success")
      await load()
    } catch (err) {
      setAssignError(apiErrorMessage(err))
    } finally {
      setAssignBusy(false)
    }
  }

  const unassign = async (a: Assignment) => {
    try {
      await api(`/api/workouts/assignments/${a.id}/`, { method: "DELETE" })
      setAssignments((prev) => prev.filter((x) => x.id !== a.id))
      toast("Назначение снято", "success")
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    }
  }

  const assignedIds = new Set(assignments.map((a) => a.athlete))
  const freeAthletes = athletes.filter((a) => !assignedIds.has(a.id))

  return (
    <div className="min-h-screen bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <Link
          href="/cabinet/workouts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-text hover:text-dark-text mb-6"
        >
          <ArrowLeft size={15} />
          Все тренировки
        </Link>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              role="status"
              aria-label="Загрузка тренировки"
              className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"
            />
          </div>
        ) : !workout ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              title="Тренировка не найдена"
              hint="Возможно, она удалена"
              action={<Button onClick={() => router.push("/cabinet/workouts")}>К списку</Button>}
            />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              <form onSubmit={saveHead} className="bg-white rounded-2xl border border-border p-6 space-y-4">
                <h2 className="text-lg font-bold text-dark-text">О тренировке</h2>
                <div>
                  <label htmlFor="w-title" className="block text-sm font-semibold text-dark-text mb-1.5">Название *</label>
                  <input
                    id="w-title"
                    type="text"
                    value={head.title}
                    onChange={(e) => setHead((p) => ({ ...p, title: e.target.value }))}
                    required
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="w-group" className="block text-sm font-semibold text-dark-text mb-1.5">Группа</label>
                  <input
                    id="w-group"
                    type="text"
                    value={head.group}
                    onChange={(e) => setHead((p) => ({ ...p, group: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="w-desc" className="block text-sm font-semibold text-dark-text mb-1.5">Описание</label>
                  <textarea
                    id="w-desc"
                    value={head.description}
                    onChange={(e) => setHead((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all resize-y"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={head.is_template}
                    onChange={(e) => setHead((p) => ({ ...p, is_template: e.target.checked }))}
                    className="w-4 h-4 accent-primary-blue"
                  />
                  Шаблон для переиспользования
                </label>
                <Button type="submit" disabled={saving}>
                  {saving ? "Сохранение…" : "Сохранить"}
                </Button>
              </form>

              <div className="bg-white rounded-2xl border border-border p-6">
                <h2 className="text-lg font-bold text-dark-text mb-4">
                  Назначения ({assignments.length})
                </h2>
                <form onSubmit={assign} className="space-y-3 mb-5">
                  {assignError && (
                    <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      {assignError}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <select
                      value={assignForm.athlete}
                      onChange={(e) => setAssignForm((p) => ({ ...p, athlete: e.target.value }))}
                      required
                      disabled={assignBusy}
                      aria-label="Спортсмен"
                      className="h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                    >
                      <option value="">Спортсмен…</option>
                      {freeAthletes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.last_name} {a.first_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={assignForm.due_date}
                      onChange={(e) => setAssignForm((p) => ({ ...p, due_date: e.target.value }))}
                      disabled={assignBusy}
                      aria-label="Срок выполнения"
                      className="h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                    />
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={assignForm.note}
                      onChange={(e) => setAssignForm((p) => ({ ...p, note: e.target.value }))}
                      disabled={assignBusy}
                      placeholder="Комментарий (домашнее задание…)"
                      aria-label="Комментарий к назначению"
                      className="flex-1 h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                    />
                    <Button type="submit" disabled={assignBusy} className="gap-1.5 shrink-0">
                      <UserPlus size={15} />
                      {assignBusy ? "…" : "Назначить"}
                    </Button>
                  </div>
                </form>
                {assignments.length === 0 ? (
                  <p className="text-sm text-secondary-text">
                    Пока никому не назначено. Выберите спортсмена выше.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {assignments.map((a) => (
                      <div key={a.id} className="p-3.5 bg-light-gray rounded-xl border border-border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-dark-text">{a.athlete_name}</p>
                            <p className="text-xs text-secondary-text mt-0.5">
                              {a.status_display ?? a.status}
                              {a.total_count > 0 && ` · ${a.done_count}/${a.total_count}`}
                              {a.due_date && ` · до ${new Date(a.due_date).toLocaleDateString("ru-RU")}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void unassign(a)}
                            title="Снять назначение"
                            aria-label={`Снять назначение ${a.athlete_name}`}
                            className="p-1.5 text-secondary-text hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        {a.total_count > 0 && (
                          <div className="h-1.5 mt-2 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuenow={Math.round((a.done_count / a.total_count) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Прогресс ${a.athlete_name}`}>
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${(a.done_count / a.total_count) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-6">
              <h2 className="text-lg font-bold text-dark-text mb-4">
                Упражнения ({workout.exercises.length})
              </h2>
              <form onSubmit={submitExercise} className="space-y-3 mb-5 p-4 bg-light-gray rounded-xl border border-border">
                {exError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {exError}
                  </div>
                )}
                <input
                  type="text"
                  value={exForm.name}
                  onChange={(e) => setExForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  minLength={2}
                  disabled={exBusy}
                  placeholder="Название упражнения *"
                  aria-label="Название упражнения"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                />
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-secondary-text uppercase">Подходы</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={exForm.sets}
                      onChange={(e) => setExForm((p) => ({ ...p, sets: e.target.value }))}
                      disabled={exBusy}
                      aria-label="Подходы"
                      className="w-full h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-secondary-text uppercase">Повторы</span>
                    <input
                      type="text"
                      value={exForm.reps}
                      onChange={(e) => setExForm((p) => ({ ...p, reps: e.target.value }))}
                      required
                      disabled={exBusy}
                      placeholder="12"
                      aria-label="Повторения"
                      className="w-full h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-secondary-text uppercase">Отдых, с</span>
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      value={exForm.rest_seconds}
                      onChange={(e) => setExForm((p) => ({ ...p, rest_seconds: e.target.value }))}
                      disabled={exBusy}
                      aria-label="Отдых в секундах"
                      className="w-full h-11 px-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={exForm.weight}
                    onChange={(e) => setExForm((p) => ({ ...p, weight: e.target.value }))}
                    disabled={exBusy}
                    placeholder="Вес, кг (пусто — свой вес)"
                    aria-label="Вес в килограммах"
                    className="h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                  />
                  <input
                    type="url"
                    value={exForm.video_url}
                    onChange={(e) => setExForm((p) => ({ ...p, video_url: e.target.value }))}
                    disabled={exBusy}
                    placeholder="Ссылка на видео"
                    aria-label="Ссылка на видео"
                    className="h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                  />
                </div>
                <input
                  type="text"
                  value={exForm.comment}
                  onChange={(e) => setExForm((p) => ({ ...p, comment: e.target.value }))}
                  disabled={exBusy}
                  placeholder="Комментарий к упражнению"
                  aria-label="Комментарий к упражнению"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
                />
                <div className="flex gap-2">
                  {editingEx !== null && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={exBusy}
                      onClick={() => { setEditingEx(null); setExForm(emptyExercise); setExError("") }}
                      className="flex-1"
                    >
                      Отмена
                    </Button>
                  )}
                  <Button type="submit" disabled={exBusy} className="flex-1 gap-1.5">
                    <Plus size={15} />
                    {exBusy ? "…" : editingEx === null ? "Добавить" : "Сохранить"}
                  </Button>
                </div>
              </form>

              {workout.exercises.length === 0 ? (
                <p className="text-sm text-secondary-text">
                  Упражнений пока нет — добавьте первое выше.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {workout.exercises.map((ex, idx) => (
                    <li key={ex.id} className="p-3.5 bg-light-gray rounded-xl border border-border">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dark-text">
                            <span className="text-secondary-text font-normal mr-1.5">{idx + 1}.</span>
                            {ex.video_url ? (
                              <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-blue hover:underline">
                                {ex.name}
                              </a>
                            ) : (
                              ex.name
                            )}
                          </p>
                          <p className="text-xs text-secondary-text mt-0.5">
                            {ex.sets} × {ex.reps}
                            {ex.weight ? ` · ${ex.weight} кг` : ""}
                            {` · отдых ${ex.rest_seconds} с`}
                          </p>
                          {ex.comment && (
                            <p className="text-xs text-secondary-text mt-0.5 italic">{ex.comment}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button type="button" onClick={() => void moveEx(idx, -1)} disabled={exBusy || idx === 0} title="Выше" aria-label={`Переместить ${ex.name} выше`} className="p-1.5 text-secondary-text hover:text-dark-text rounded-lg transition-colors cursor-pointer disabled:opacity-30">
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" onClick={() => void moveEx(idx, 1)} disabled={exBusy || idx === workout.exercises.length - 1} title="Ниже" aria-label={`Переместить ${ex.name} ниже`} className="p-1.5 text-secondary-text hover:text-dark-text rounded-lg transition-colors cursor-pointer disabled:opacity-30">
                            <ArrowDown size={14} />
                          </button>
                          <button type="button" onClick={() => startEditEx(ex)} title="Изменить" aria-label={`Изменить ${ex.name}`} className="p-1.5 text-secondary-text hover:text-dark-text rounded-lg transition-colors cursor-pointer">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => setPendingDeleteEx(ex)} title="Удалить" aria-label={`Удалить ${ex.name}`} className="p-1.5 text-secondary-text hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        <ConfirmDialog
          open={pendingDeleteEx !== null}
          title="Удалить упражнение?"
          description={pendingDeleteEx ? `"${pendingDeleteEx.name}" будет удалено из тренировки.` : ""}
          confirmLabel="Удалить"
          danger
          busy={confirmBusy}
          onClose={() => setPendingDeleteEx(null)}
          onConfirm={() => pendingDeleteEx && void doDeleteEx(pendingDeleteEx)}
        />
      </div>
    </div>
  )
}
