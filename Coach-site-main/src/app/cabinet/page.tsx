"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { api, apiErrorMessage } from "@/lib/api"
import type { Athlete, CabinetData, Tournament } from "@/lib/types"
import { Plus, Calendar, Trophy, Users, Swords, UserRound, ArrowRight } from "lucide-react"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"

export default function CabinetPage() {
  const { user, updateUser, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])
  const [cabinet, setCabinet] = useState<CabinetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [showEditAthlete, setShowEditAthlete] = useState(false)
  const [athleteForm, setAthleteForm] = useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    weight: "",
    height: "",
    gender: "male" as "male" | "female",
    club: "",
  })
  const [editingAthleteId, setEditingAthleteId] = useState<number | null>(null)
  const [showLinkChild, setShowLinkChild] = useState(false)
  const [linkCode, setLinkCode] = useState("")
  const [linkError, setLinkError] = useState("")
  const [linking, setLinking] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const role = user?.profile?.role || "parent"

  const userDefaults = useMemo(
    () =>
      user
        ? {
            first_name: user.first_name || "",
            last_name: user.last_name || "",
            email: user.email || "",
            phone: user.profile?.phone || "",
            club: user.profile?.club || "",
            belt: user.profile?.belt || "",
            birth_date: user.profile?.birth_date || "",
          }
        : null,
    [user]
  )

  const [form, setForm] = useState<Record<string, string>>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    club: "",
    belt: "",
    birth_date: "",
  })

  const [formReady, setFormReady] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Гидратация формы из async user: setState в effect здесь оправдан
  // (исходный код делал setState прямо в render — это хуже).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (userDefaults && !formReady) {
      setForm(userDefaults)
      setFormReady(true)
    }
  }, [userDefaults, formReady])

  // Сброс формы при смене пользователя (logout/login другим).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setFormReady(false)
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    api<CabinetData>("/api/auth/cabinet/")
      .then((data) => {
        if (cancelled) return
        setCabinet(data)
        setAthletes(data.athletes as unknown as Athlete[])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await updateUser({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        profile: {
          phone: form.phone,
          club: form.club,
          belt: form.belt,
          birth_date: form.birth_date || null,
        },
      })
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const [athleteError, setAthleteError] = useState("")
  const [saveError, setSaveError] = useState("")
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const normalizeAthleteForm = (f: typeof athleteForm) => ({
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim(),
    birth_date: f.birth_date,
    weight: f.weight.replace(",", ".").trim(),
    height: f.height.trim() === "" ? null : f.height.replace(",", ".").trim(),
    gender: f.gender,
    club: f.club.trim(),
  })

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    setAthleteError("")
    try {
      await api<Athlete>("/api/tournament/athletes/", {
        method: "POST",
        body: JSON.stringify(normalizeAthleteForm(athleteForm)),
      })
      setShowAddAthlete(false)
      setAthleteForm({
        first_name: "",
        last_name: "",
        birth_date: "",
        weight: "",
        height: "",
        gender: "male",
        club: "",
      })
      const updated = await api<CabinetData>("/api/auth/cabinet/")
      setCabinet(updated)
      setAthletes(updated.athletes as unknown as Athlete[])
    } catch (err) {
      console.error("Ошибка при создании спортсмена:", err)
      setAthleteError(apiErrorMessage(err))
    }
  }

  const openAddAthlete = () => {
    setAthleteError("")
    setEditingAthleteId(null)
    setAthleteForm({
      first_name: "",
      last_name: "",
      birth_date: "",
      weight: "",
      height: "",
      gender: "male",
      club: "",
    })
    setShowAddAthlete(true)
  }

  const openEditAthlete = (a: Athlete) => {
    setAthleteError("")
    setEditingAthleteId(a.id)
    setAthleteForm({
      first_name: a.first_name || "",
      last_name: a.last_name || "",
      birth_date: (a.birth_date || "").slice(0, 10),
      weight: a.weight != null ? String(a.weight) : "",
      height: a.height != null ? String(a.height) : "",
      gender: a.gender === "female" ? "female" : "male",
      club: a.club || "",
    })
    setShowEditAthlete(true)
  }

  const refreshCabinet = async () => {
    const updated = await api<CabinetData>("/api/auth/cabinet/")
    setCabinet(updated)
    setAthletes(updated.athletes as unknown as Athlete[])
  }

  const handleEditAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingAthleteId === null) return
    setAthleteError("")
    try {
      await api<Athlete>(`/api/tournament/athletes/${editingAthleteId}/`, {
        method: "PATCH",
        body: JSON.stringify(normalizeAthleteForm(athleteForm)),
      })
      setShowEditAthlete(false)
      setEditingAthleteId(null)
      await refreshCabinet()
    } catch (err) {
      console.error("Ошибка при изменении спортсмена:", err)
      setAthleteError(apiErrorMessage(err))
    }
  }

  const handleDeleteAthlete = async (a: Athlete) => {
    if (!window.confirm(`Удалить спортсмена ${a.last_name} ${a.first_name} из базы?`)) {
      return
    }
    try {
      await api(`/api/tournament/athletes/${a.id}/`, { method: "DELETE" })
      await refreshCabinet()
    } catch {
      alert("Не удалось удалить. Возможно, спортсмен уже участвует в проведённых боях.")
    }
  }

  const openLinkChild = () => {
    setLinkError("")
    setLinkCode("")
    setShowLinkChild(true)
  }

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault()
    setLinking(true)
    setLinkError("")
    try {
      await api("/api/auth/children/link/", {
        method: "POST",
        body: JSON.stringify({ code: linkCode }),
      })
      setShowLinkChild(false)
      setLinkCode("")
      await refreshCabinet()
    } catch (err) {
      console.error("Ошибка привязки ребёнка:", err)
      setLinkError(apiErrorMessage(err))
    } finally {
      setLinking(false)
    }
  }

  const handleUnlinkChild = async (a: Athlete) => {
    if (!window.confirm(`Отвязать ребёнка ${a.last_name} ${a.first_name} от вашего аккаунта? Сама запись спортсмена сохранится.`)) {
      return
    }
    try {
      await api(`/api/auth/children/${a.id}/`, { method: "DELETE" })
      await refreshCabinet()
    } catch (err) {
      console.error("Ошибка отвязки:", err)
      alert("Не удалось отвязать ребёнка")
    }
  }

  const handleInviteCode = async (a: Athlete) => {
    try {
      await api<{ code: string }>(`/api/tournament/athletes/${a.id}/invite/`, {
        method: "POST",
      })
      await refreshCabinet()
    } catch (err) {
      console.error("Ошибка получения кода:", err)
      alert("Не удалось получить код привязки")
    }
  }

  const copyCode = async (code: string, id: number) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(
        () => setCopiedId((cur) => (cur === id ? null : cur)),
        2000
      )
    } catch {
      alert(`Код привязки: ${code}`)
    }
  }

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const categorySlugMap = useMemo(() => {
    const map = new Map<number, string>()
    if (!cabinet) return map
    for (const t of cabinet.tournaments as Tournament[]) {
      const slug = (t as Tournament).slug
      if (!slug) continue
      for (const c of (t.categories ?? []) as { id: number }[]) {
        if (!map.has(c.id)) map.set(c.id, slug)
      }
    }
    return map
  }, [cabinet])

  if (!user) return null

  return (
    <div className="min-h-screen bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl bg-dark-blue border border-white/10 shadow-xl shadow-dark-blue/20 mb-8"
        >
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-20 right-10 w-72 h-72 rounded-full bg-primary-blue/30 blur-[90px]" />
            <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-gold/10 blur-[90px]" />
          </div>
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                <UserRound size={28} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.username}
                  </h1>
                  <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-white/75 border border-white/10">
                    {role === "trainer" ? "Тренер" : "Родитель"}
                  </span>
                </div>
                <p className="text-sm text-white/70 mt-1">
                  {role === "trainer"
                    ? "Панель управления школой, турнирами и спортсменами"
                    : "Профиль, дети и турниры вашей семьи"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5 shrink-0">
                {role === "trainer" ? (
                  <>
                    <Link href="/cabinet/tournaments/create">
                      <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-gold text-dark-blue text-sm font-bold hover:bg-accent-warm-light transition-colors cursor-pointer">
                        <Plus size={16} />
                        Создать турнир
                      </span>
                    </Link>
                    <Link href="/cabinet/tournaments">
                      <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer">
                        Управление
                        <ArrowRight size={15} />
                      </span>
                    </Link>
                    <Link href="/cabinet/schedule">
                      <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition-colors cursor-pointer">
                        <Calendar size={15} />
                        Расписание
                      </span>
                    </Link>
                  </>
                ) : (
                  <Link href="/tournaments">
                    <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-gold text-dark-blue text-sm font-bold hover:bg-accent-warm-light transition-colors cursor-pointer">
                      <Trophy size={16} />
                      Смотреть турниры
                    </span>
                  </Link>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: Trophy, label: "Турниры", value: loading ? null : cabinet?.tournaments.length ?? 0 },
                { icon: Users, label: role === "trainer" ? "Спортсмены" : "Дети", value: loading ? null : athletes.length },
                { icon: Swords, label: "Матчи", value: loading ? null : cabinet?.matches.length ?? 0 },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 backdrop-blur-sm"
                >
                  <s.icon size={17} className="text-gold/80 mb-2" />
                  <div className="text-2xl font-extrabold text-white tabular-nums">
                    {s.value === null ? (
                      <span className="inline-block w-8 h-7 rounded bg-white/10 animate-pulse" />
                    ) : (
                      s.value
                    )}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65 mt-0.5">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white rounded-2xl border border-border p-6"
            >
              <h2 className="text-lg font-bold text-dark-text mb-4">Профиль</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-dark-text mb-1.5">
                      Имя
                    </label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => update("first_name", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark-text mb-1.5">
                      Фамилия
                    </label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => update("last_name", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-dark-text mb-1.5">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark-text mb-1.5">
                      Дата рождения
                    </label>
                    <input
                      type="date"
                      value={form.birth_date}
                      onChange={(e) => update("birth_date", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-dark-text mb-1.5">
                      Клуб
                    </label>
                    <input
                      type="text"
                      value={form.club}
                      onChange={(e) => update("club", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark-text mb-1.5">
                      Пояс
                    </label>
                    <input
                      type="text"
                      value={form.belt}
                      onChange={(e) => update("belt", e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Сохранение..." : "Сохранить"}
                  </Button>
                  {saved && (
                    <span className="text-sm font-medium text-green-600">
                      Сохранено!
                    </span>
                  )}
                </div>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white rounded-2xl border border-border p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-dark-text">{role === "trainer" ? "Мои спортсмены" : "Мои дети"}</h2>
                {role === "trainer" ? (
                  <Button
                    size="default"
                    variant="ghost"
                    className="h-9 px-4 text-sm"
                    onClick={openAddAthlete}
                  >
                    + Добавить ребёнка
                  </Button>
                ) : (
                  <Button
                    size="default"
                    variant="ghost"
                    className="h-9 px-4 text-sm"
                    onClick={openLinkChild}
                  >
                    + Привязать ребёнка
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : athletes.length === 0 ? (
                <EmptyState
                  icon={<Users size={26} />}
                  title={role === "trainer" ? "Спортсмены не добавлены" : "Нет привязанных детей"}
                  hint={role === "trainer"
                    ? "Добавьте первого спортсмена, чтобы заявлять его на турниры"
                    : "Попросите у тренера код привязки и добавьте ребёнка по коду — новая запись при этом не создаётся"}
                  action={
                    <Button
                      size="sm"
                      className="h-10 px-5 text-sm gap-1.5"
                      onClick={role === "trainer" ? openAddAthlete : openLinkChild}
                    >
                      <Plus size={16} />
                      {role === "trainer" ? "Добавить" : "Привязать"}
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {athletes.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 bg-light-gray rounded-xl border border-border flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-dark-text">
                          {a.last_name} {a.first_name}
                        </div>
                        <div className="text-sm text-secondary-text mt-1">
                          Возраст: {a.age} лет · Вес: {a.weight} кг
                          {a.height && ` · Рост: ${a.height} см`}
                        </div>
                        <div className="text-xs text-secondary-text mt-1">
                          Пол: {a.gender === "male" ? "Мальчик" : "Девочка"}
                          {a.club ? ` · Клуб: ${a.club}` : ""}
                        </div>
                        {role === "trainer" && (
                          <div className="mt-2">
                            {a.link_code ? (
                              <button
                                type="button"
                                onClick={() => a.link_code && copyCode(a.link_code, a.id)}
                                title="Нажмите, чтобы скопировать код для родителя"
                                className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded-lg bg-gold/15 border border-gold/40 text-dark-text hover:bg-gold/25 transition-colors cursor-pointer dark:text-gold"
                              >
                                Код: {a.link_code}
                                <span className="text-[10px] font-sans font-semibold opacity-70">
                                  {copiedId === a.id ? "Скопировано!" : "Копировать"}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleInviteCode(a)}
                                className="text-xs font-semibold text-primary-blue hover:text-primary-blue-light cursor-pointer"
                              >
                                Получить код для родителя
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {role === "trainer" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 text-xs"
                              onClick={() => openEditAthlete(a)}
                            >
                              Изменить
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteAthlete(a)}
                            >
                              Удалить
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 text-xs"
                            onClick={() => handleUnlinkChild(a)}
                          >
                            Отвязать
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-white rounded-2xl border border-border p-6"
            >
              <h2 className="text-lg font-bold text-dark-text mb-4">
                Мои матчи
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !cabinet || cabinet.matches.length === 0 ? (
                <EmptyState
                  icon={<Swords size={26} />}
                  title="Матчей пока нет"
                  hint="Здесь появятся бои ваших спортсменов после генерации турнирной сетки"
                />
              ) : (
                <div className="space-y-3">
                  {cabinet.matches.map((m) => {
                    const slug = categorySlugMap.get(m.category as number)
                    return (
                      <Link
                        key={m.id}
                        href={slug ? `/tournaments/${slug}` : "/tournaments"}
                        className="block"
                      >
                        <div className="flex items-center justify-between gap-3 p-3.5 bg-light-gray rounded-xl border border-transparent hover:bg-white hover:border-primary-blue/20 hover:shadow-md transition-all">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-dark-text truncate">
                              {m.athlete1_name || "TBD"} vs{" "}
                              {m.athlete2_name || "TBD"}
                            </p>
                            <p className="text-xs text-secondary-text mt-0.5">
                              {m.category_name} — {m.round_name} — Матч{" "}
                              {m.match_number}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-dark-text tabular-nums">
                              {m.score1} : {m.score2}
                            </p>
                            <StatusPill status={m.status} />
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </div>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="bg-white rounded-2xl border border-border p-6"
            >
              <h2 className="text-lg font-bold text-dark-text mb-4">
                Мои турниры
              </h2>
              {role === "trainer" && (
                <div className="flex items-center gap-2 mb-3">
                  <Link href="/cabinet/tournaments">
                    <Button
                      size="default"
                      variant="primary"
                      className="h-9 px-4 text-sm"
                    >
                      Управление турнирами
                    </Button>
                  </Link>
                </div>
              )}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !cabinet || cabinet.tournaments.length === 0 ? (
                <EmptyState
                  icon={<Trophy size={26} />}
                  title="Турниров пока нет"
                  hint={
                    role === "trainer"
                      ? "Создайте первый турнир — это займёт пару минут"
                      : "Вас пока не заявили ни на один турнир"
                  }
                  action={
                    role === "trainer" ? (
                      <Link href="/cabinet/tournaments/create">
                        <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-dark-blue text-white text-sm font-bold hover:bg-primary-blue transition-colors cursor-pointer dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]">
                          <Plus size={16} />
                          Создать турнир
                        </span>
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {cabinet.tournaments.map((t) => (
                    <Link
                      key={t.slug}
                      href={role === "trainer" ? `/cabinet/tournaments/${t.id}/bracket` : `/tournaments/${t.slug}`}
                      className="block p-3.5 bg-light-gray rounded-xl hover:bg-white hover:border-primary-blue/20 hover:shadow-md border border-transparent transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-dark-text">
                          {t.name}
                        </p>
                        <StatusPill status={t.status} />
                      </div>
                      <p className="text-xs text-secondary-text mt-1">
                        {t.categories?.length || 0} категорий ·{" "}
                        {new Date(t.start_date).toLocaleDateString("ru-RU")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {showAddAthlete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddAthlete(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-dark-text mb-4">
              Добавить ребёнка
            </h3>
            <form onSubmit={handleAddAthlete} className="space-y-4">
              {athleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {athleteError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Имя *
                  </label>
                  <input
                    type="text"
                    value={athleteForm.first_name}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, first_name: e.target.value })
                    }
                    required
                    minLength={2}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Фамилия *
                  </label>
                  <input
                    type="text"
                    value={athleteForm.last_name}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, last_name: e.target.value })
                    }
                    required
                    minLength={2}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Дата рождения *
                </label>
                <input
                  type="date"
                    value={athleteForm.birth_date}
                    max={todayStr}
                  onChange={(e) =>
                    setAthleteForm({ ...athleteForm, birth_date: e.target.value })
                  }
                  required
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Вес (кг) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={athleteForm.weight}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, weight: e.target.value.replace(",", ".") })
                    }
                    required
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Рост (см)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={athleteForm.height}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, height: e.target.value.replace(",", ".") })
                    }
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Пол *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-dark-text">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={athleteForm.gender === "male"}
                      onChange={() =>
                        setAthleteForm({ ...athleteForm, gender: "male" })
                      }
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    Мальчик
                  </label>
                  <label className="flex items-center gap-2 text-sm text-dark-text">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={athleteForm.gender === "female"}
                      onChange={() =>
                        setAthleteForm({ ...athleteForm, gender: "female" })
                      }
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    Девочка
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Клуб / тренер *
                </label>
                <input
                  type="text"
                  value={athleteForm.club}
                  onChange={(e) =>
                    setAthleteForm({ ...athleteForm, club: e.target.value })
                  }
                  required
                  maxLength={200}
                  placeholder="KWF Pavlodar / Иванов А.А."
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-10 px-4 text-sm"
                  onClick={() => setShowAddAthlete(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 text-sm"
                >
                  Добавить
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showEditAthlete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditAthlete(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-dark-text mb-4">
              Изменить данные
            </h3>
            <form onSubmit={handleEditAthlete} className="space-y-4">
              {athleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {athleteError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Имя *
                  </label>
                  <input
                    type="text"
                    value={athleteForm.first_name}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, first_name: e.target.value })
                    }
                    required
                    minLength={2}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Фамилия *
                  </label>
                  <input
                    type="text"
                    value={athleteForm.last_name}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, last_name: e.target.value })
                    }
                    required
                    minLength={2}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Дата рождения *
                </label>
                <input
                  type="date"
                    value={athleteForm.birth_date}
                    max={todayStr}
                  onChange={(e) =>
                    setAthleteForm({ ...athleteForm, birth_date: e.target.value })
                  }
                  required
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Вес (кг) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={athleteForm.weight}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, weight: e.target.value.replace(",", ".") })
                    }
                    required
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">
                    Рост (см)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={athleteForm.height}
                    onChange={(e) =>
                      setAthleteForm({ ...athleteForm, height: e.target.value.replace(",", ".") })
                    }
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Пол *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-dark-text">
                    <input
                      type="radio"
                      name="edit-gender"
                      value="male"
                      checked={athleteForm.gender === "male"}
                      onChange={() =>
                        setAthleteForm({ ...athleteForm, gender: "male" })
                      }
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    Мальчик
                  </label>
                  <label className="flex items-center gap-2 text-sm text-dark-text">
                    <input
                      type="radio"
                      name="edit-gender"
                      value="female"
                      checked={athleteForm.gender === "female"}
                      onChange={() =>
                        setAthleteForm({ ...athleteForm, gender: "female" })
                      }
                      className="text-primary-blue focus:ring-primary-blue"
                    />
                    Девочка
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Клуб / тренер
                </label>
                <input
                  type="text"
                  value={athleteForm.club}
                  onChange={(e) =>
                    setAthleteForm({ ...athleteForm, club: e.target.value })
                  }
                  maxLength={200}
                  placeholder="KWF Pavlodar / Иванов А.А."
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-10 px-4 text-sm"
                  onClick={() => setShowEditAthlete(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 text-sm"
                >
                  Сохранить
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showLinkChild && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLinkChild(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-dark-text mb-2">
              Привязать ребёнка
            </h3>
            <p className="text-sm text-secondary-text mb-4 leading-relaxed">
              Введите код, который выдал тренер. Ребёнок уже должен существовать
              в базе — новая запись создана не будет.
            </p>
            <form onSubmit={handleLinkChild} className="space-y-4">
              {linkError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {linkError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">
                  Код привязки *
                </label>
                <input
                  type="text"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  placeholder="Например: A1B2C3D4"
                  required
                  minLength={4}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm font-mono font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className="h-10 px-4 text-sm"
                  onClick={() => setShowLinkChild(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="h-10 px-5 text-sm"
                  disabled={linking}
                >
                  {linking ? "Привязка..." : "Привязать"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
