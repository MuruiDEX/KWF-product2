"use client"

import { useCallback, useEffect, useState } from "react"
import { Dumbbell } from "lucide-react"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import type { Assignment, Workout, WorkoutResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/ui/EmptyState"
import { toast } from "@/components/ui/Toaster"

/** P2: тренировки ребёнка для родителя — список назначений,
 * выполнение упражнений с фактом, прогресс. */
export function MyWorkouts() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<Assignment[] | { results: Assignment[] }>(
        "/api/workouts/assignments/"
      )
      setAssignments(unwrapList(data))
    } catch {
      // Тихий фолбэк: секция просто не покажется критичной.
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (assignments.length === 0) return null

  const active = assignments.filter((a) => a.status !== "done")
  const done = assignments.filter((a) => a.status === "done")

  return (
    <div>
      {active.length > 0 && (
        <div className="space-y-3 mb-4">
          {active.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              onOpen={() => setOpenId(a.id)}
              onChanged={load}
            />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs font-semibold text-secondary-text cursor-pointer hover:text-dark-text">
            Выполненные ({done.length})
          </summary>
          <div className="space-y-3 mt-3">
            {done.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onOpen={() => setOpenId(a.id)}
                onChanged={load}
              />
            ))}
          </div>
        </details>
      )}
      {openId !== null && (
        <AssignmentDetail
          assignmentId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function AssignmentCard({
  assignment: a,
  onOpen,
  onChanged,
}: {
  assignment: Assignment
  onOpen: () => void
  onChanged: () => void
}) {
  const start = async () => {
    if (a.status !== "assigned") {
      onOpen()
      return
    }
    try {
      await api(`/api/workouts/assignments/${a.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      })
      onChanged()
      onOpen()
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    }
  }

  const pct = a.total_count > 0 ? Math.round((a.done_count / a.total_count) * 100) : 0

  return (
    <div className="p-3.5 bg-light-gray rounded-xl border border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dark-text truncate">{a.workout_title}</p>
          <p className="text-xs text-secondary-text mt-0.5">
            {a.athlete_name}
            {a.due_date && ` · до ${new Date(a.due_date).toLocaleDateString("ru-RU")}`}
          </p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white border border-border text-secondary-text shrink-0">
          {a.status_display ?? a.status}
        </span>
      </div>
      {a.total_count > 0 && (
        <div className="h-1.5 mt-2.5 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Прогресс ${a.workout_title}`}>
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <Button size="sm" variant="secondary" onClick={start} className="w-full mt-3 h-9 text-xs">
        {a.status === "assigned" ? "Начать выполнение" : a.total_count > 0 ? `${a.done_count}/${a.total_count} · Продолжить` : "Открыть"}
      </Button>
    </div>
  )
}

function AssignmentDetail({
  assignmentId,
  onClose,
  onChanged,
}: {
  assignmentId: number
  onClose: () => void
  onChanged: () => void
}) {
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [results, setResults] = useState<Record<number, WorkoutResult>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, { done: boolean; sets: string; reps: string; weight: string; note: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const a = await api<Assignment>(`/api/workouts/assignments/${assignmentId}/`)
      const [w, rlist] = await Promise.all([
        api<Workout>(`/api/workouts/workouts/${a.workout}/`),
        api<WorkoutResult[] | { results: WorkoutResult[] }>(
          `/api/workouts/results/?assignment=${assignmentId}`
        ),
      ])
      setWorkout(w)
      const map: Record<number, WorkoutResult> = {}
      const d: typeof drafts = {}
      for (const r of unwrapList(rlist)) {
        map[r.exercise] = r
        d[r.exercise] = {
          done: r.done,
          sets: r.actual_sets != null ? String(r.actual_sets) : "",
          reps: r.actual_reps || "",
          weight: r.actual_weight ?? "",
          note: r.note || "",
        }
      }
      setResults(map)
      setDrafts(d)
    } catch (err) {
      toast(apiErrorMessage(err), "error")
      onClose()
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const draftOf = (exerciseId: number) =>
    drafts[exerciseId] ?? { done: false, sets: "", reps: "", weight: "", note: "" }

  const setDraft = (exerciseId: number, patch: Partial<ReturnType<typeof draftOf>>) =>
    setDrafts((p) => ({ ...p, [exerciseId]: { ...draftOf(exerciseId), ...patch } }))

  const save = async (exerciseId: number) => {
    const d = draftOf(exerciseId)
    setSavingId(exerciseId)
    try {
      const saved = await api<WorkoutResult>("/api/workouts/results/", {
        method: "POST",
        body: JSON.stringify({
          assignment: assignmentId,
          exercise: exerciseId,
          done: d.done,
          actual_sets: d.sets.trim() === "" ? null : Number(d.sets),
          actual_reps: d.reps.trim(),
          actual_weight: d.weight.trim() === "" ? null : d.weight.replace(",", ".").trim(),
          note: d.note.trim(),
        }),
      })
      setResults((p) => ({ ...p, [exerciseId]: saved }))
      toast("Сохранено", "success")
      onChanged()
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Выполнение тренировки"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !workout ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-lg font-extrabold text-dark-text">{workout.title}</h3>
              <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 text-secondary-text hover:text-dark-text rounded-lg cursor-pointer">
                ✕
              </button>
            </div>
            {workout.description && (
              <p className="text-sm text-secondary-text mb-4">{workout.description}</p>
            )}
            <div className="space-y-3">
              {workout.exercises.map((ex, idx) => {
                const d = draftOf(ex.id)
                const saved = results[ex.id]
                return (
                  <div key={ex.id} className={`p-3.5 rounded-xl border ${d.done ? "bg-green-50/60 border-green-200" : "bg-light-gray border-border"}`}>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.done}
                        onChange={(e) => setDraft(ex.id, { done: e.target.checked })}
                        className="w-5 h-5 mt-0.5 accent-green-600 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-dark-text">
                          {idx + 1}. {ex.name}
                        </span>
                        <span className="block text-xs text-secondary-text mt-0.5">
                          План: {ex.sets} × {ex.reps}{ex.weight ? ` · ${ex.weight} кг` : ""}
                        </span>
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      <input
                        type="number" min={1} max={100}
                        value={d.sets}
                        onChange={(e) => setDraft(ex.id, { sets: e.target.value })}
                        placeholder="Подходы"
                        aria-label={`Факт подходов, ${ex.name}`}
                        className="h-10 px-3 rounded-lg border border-border bg-white text-dark-text text-xs focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue"
                      />
                      <input
                        type="text"
                        value={d.reps}
                        onChange={(e) => setDraft(ex.id, { reps: e.target.value })}
                        placeholder="Повторы"
                        aria-label={`Факт повторений, ${ex.name}`}
                        className="h-10 px-3 rounded-lg border border-border bg-white text-dark-text text-xs focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue"
                      />
                      <input
                        type="text"
                        value={d.weight}
                        onChange={(e) => setDraft(ex.id, { weight: e.target.value })}
                        placeholder="Вес, кг"
                        aria-label={`Факт веса, ${ex.name}`}
                        className="h-10 px-3 rounded-lg border border-border bg-white text-dark-text text-xs focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2.5">
                      {saved && (
                        <span className="text-[11px] font-semibold text-green-700">Отмечено ✓</span>
                      )}
                      <span className="flex-1" />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={savingId === ex.id}
                        onClick={() => void save(ex.id)}
                        className="h-9 px-4 text-xs"
                      >
                        {savingId === ex.id ? "…" : "Сохранить"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {workout.exercises.length === 0 && (
              <EmptyState icon={<Dumbbell size={26} />} title="Упражнений нет" hint="Тренер ещё не добавил упражнения" />
            )}
          </>
        )}
      </div>
    </div>
  )
}
