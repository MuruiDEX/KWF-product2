"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Dumbbell, Plus, Copy, Trash2 } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import type { Workout } from "@/lib/types"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/ui/EmptyState"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useModalBehavior } from "@/lib/useModal"
import { toast } from "@/components/ui/Toaster"

/** P2: тренировки тренера — список, создание, клонирование, удаление. */
export default function TrainerWorkoutsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const role = user?.profile?.role || "parent"

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", group: "", is_template: false })
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const createPanelRef = useRef<HTMLDivElement>(null)
  // D4: общий dialog behavior модалки создания (прецедент: cabinet/schedule).
  // Закрытие при busy не запрещалось и раньше (overlay-click) — семантика та же.
  useModalBehavior(showCreate, () => setShowCreate(false), createPanelRef)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login?next=/cabinet/workouts")
    else if (!authLoading && user && role !== "trainer") router.push("/cabinet")
  }, [authLoading, user, role, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = showTemplates ? "?is_template=true" : ""
      const data = await api<Workout[] | { results: Workout[] }>(
        `/api/workouts/workouts/${params}`
      )
      setWorkouts(unwrapList(data))
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setLoading(false)
    }
  }, [showTemplates])

  useEffect(() => {
    if (!user || role !== "trainer") return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [user, role, load])

  if (!user || role !== "trainer") return null

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setBusy(true)
    try {
      const created = await api<Workout>("/api/workouts/workouts/", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          group: form.group.trim(),
          is_template: form.is_template,
        }),
      })
      setShowCreate(false)
      setForm({ title: "", description: "", group: "", is_template: false })
      toast("Тренировка создана", "success")
      router.push(`/cabinet/workouts/${created.id}`)
    } catch (err) {
      setFormError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const clone = async (w: Workout) => {
    setBusy(true)
    try {
      const copy = await api<Workout>(`/api/workouts/workouts/${w.id}/clone/`, {
        method: "POST",
      })
      toast("Копия создана", "success")
      router.push(`/cabinet/workouts/${copy.id}`)
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async (w: Workout) => {
    setConfirmBusy(true)
    try {
      await api(`/api/workouts/workouts/${w.id}/`, { method: "DELETE" })
      setPendingDelete(null)
      setWorkouts((prev) => prev.filter((x) => x.id !== w.id))
      toast("Тренировка удалена", "success")
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-text tracking-tight">
              Тренировки
            </h1>
            <p className="text-sm text-secondary-text mt-1">
              Программы, упражнения и назначения спортсменам
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              aria-pressed={showTemplates}
              className={`h-10 px-4 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                showTemplates
                  ? "border-gold/60 bg-gold/15 text-dark-text dark:text-gold"
                  : "border-border bg-white text-secondary-text hover:text-dark-text"
              }`}
            >
              Шаблоны
            </button>
            <Button onClick={() => { setFormError(""); setShowCreate(true) }} className="h-10 gap-1.5">
              <Plus size={16} />
              Создать
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              role="status"
              aria-label="Загрузка тренировок"
              className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"
            />
          </div>
        ) : workouts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border">
            <EmptyState
              icon={<Dumbbell size={26} />}
              title={showTemplates ? "Шаблонов пока нет" : "Тренировок пока нет"}
              hint="Создайте первую тренировку и отметьте её как шаблон, чтобы переиспользовать"
              action={
                <Button onClick={() => setShowCreate(true)} className="gap-1.5">
                  <Plus size={16} />
                  Создать тренировку
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workouts.map((w, idx) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/cabinet/workouts/${w.id}`}
                    className="font-bold text-dark-text hover:text-primary-blue transition-colors min-w-0"
                  >
                    <span className="block truncate">{w.title}</span>
                  </Link>
                  {w.is_template && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-gold/15 border border-gold/40 text-dark-text dark:text-gold shrink-0">
                      Шаблон
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary-text mt-1.5">
                  {w.exercises_count} упр. · {w.assignments_count} назначений
                  {w.group ? ` · ${w.group}` : ""}
                </p>
                <div className="flex items-center gap-1.5 mt-4">
                  <Link href={`/cabinet/workouts/${w.id}`} className="flex-1">
                    <span className="flex items-center justify-center h-9 px-3 rounded-xl bg-dark-blue text-white text-xs font-bold hover:bg-primary-blue transition-colors cursor-pointer dark:bg-gold dark:text-dark-blue">
                      Открыть
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void clone(w)}
                    disabled={busy}
                    title="Дублировать"
                    aria-label={`Дублировать ${w.title}`}
                    className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-secondary-text hover:text-dark-text hover:border-primary-blue/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(w)}
                    title="Удалить"
                    aria-label={`Удалить ${w.title}`}
                    className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-secondary-text hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {showCreate && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreate(false)}
          >
            <div
              ref={createPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Новая тренировка"
              className="bg-white rounded-2xl border border-border p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-dark-text mb-4">Новая тренировка</h3>
              <form onSubmit={create} className="space-y-4">
                {formError && (
                  <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {formError}
                  </div>
                )}
                <div>
                  <label htmlFor="workout-title" className="block text-sm font-semibold text-dark-text mb-1.5">
                    Название *
                  </label>
                  <input
                    id="workout-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    required
                    minLength={2}
                    disabled={busy}
                    placeholder="ОФП для младших"
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="workout-group" className="block text-sm font-semibold text-dark-text mb-1.5">
                    Группа
                  </label>
                  <input
                    id="workout-group"
                    type="text"
                    value={form.group}
                    onChange={(e) => setForm((p) => ({ ...p, group: e.target.value }))}
                    disabled={busy}
                    placeholder="Младшие"
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="workout-desc" className="block text-sm font-semibold text-dark-text mb-1.5">
                    Описание
                  </label>
                  <textarea
                    id="workout-desc"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    disabled={busy}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all resize-y"
                  />
                </div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_template}
                    onChange={(e) => setForm((p) => ({ ...p, is_template: e.target.checked }))}
                    disabled={busy}
                    className="w-4 h-4 accent-primary-blue"
                  />
                  Шаблон для переиспользования
                </label>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={busy} className="flex-1">
                    Отмена
                  </Button>
                  <Button type="submit" disabled={busy} className="flex-1">
                    {busy ? "Создание…" : "Создать"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Удалить тренировку?"
          description={pendingDelete ? `"${pendingDelete.title}" и все её упражнения и назначения будут удалены.` : ""}
          confirmLabel="Удалить"
          danger
          busy={confirmBusy}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => pendingDelete && void doDelete(pendingDelete)}
        />
      </div>
    </div>
  )
}
