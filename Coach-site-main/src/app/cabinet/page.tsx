"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { api, apiErrorMessage } from "@/lib/api"
import type { Athlete, CabinetData, Tournament } from "@/lib/types"
import { Plus, Trophy, Users, Bell, BellRing, Share2 } from "lucide-react"
import StatusPill from "@/components/ui/StatusPill"
import EmptyState from "@/components/ui/EmptyState"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { toast } from "@/components/ui/Toaster"
import { FamilyFeed } from "@/components/FamilyFeed"
import { MyNextFightCard } from "@/components/MyNextFightCard"
import { NotificationCenter, buildResultItems } from "@/components/NotificationCenter"
import { useMyNextFight } from "@/lib/useMyNextFight"
import {
  isFightNotifyEnabled,
  notifyPermission,
  requestNotifyPermission,
  sendFightNotification,
  setFightNotifyEnabled,
  shouldNotifyFight,
  type NotifyPermission,
} from "@/lib/notify"
import { playGong } from "@/lib/sound"
import { CsvImportModal } from "@/components/CsvImportModal"
import { ClubStatsCard } from "@/components/ClubStatsCard"
import { CabinetHeader } from "./_components/CabinetHeader"
import {
  AthleteModal,
  EMPTY_ATHLETE_FORM,
  type AthleteFormState,
} from "./_components/AthleteModal"
import { LinkChildModal } from "./_components/LinkChildModal"

export default function CabinetPage() {
  const { user, updateUser, loading: authLoading, offline } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Офлайн — не редиректим: user==null здесь означает «нет сети»,
    // а не «не залогинен». Показываем баннер из AuthProvider.
    if (!authLoading && !user && !offline) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [authLoading, user, offline, router, pathname])
  const [cabinet, setCabinet] = useState<CabinetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [showEditAthlete, setShowEditAthlete] = useState(false)
  const [athleteForm, setAthleteForm] =
    useState<AthleteFormState>(EMPTY_ATHLETE_FORM)
  const [editingAthleteId, setEditingAthleteId] = useState<number | null>(null)
  const [showLinkChild, setShowLinkChild] = useState(false)
  const [linkCode, setLinkCode] = useState("")
  const [linkError, setLinkError] = useState("")
  const [linking, setLinking] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [inviteBusyId, setInviteBusyId] = useState<number | null>(null)
  const [showCsvImport, setShowCsvImport] = useState(false)
  // Фаза 1: подтверждения через диалог вместо window.confirm.
  const [pendingDeleteAthlete, setPendingDeleteAthlete] = useState<Athlete | null>(null)
  const [pendingUnlinkChild, setPendingUnlinkChild] = useState<Athlete | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

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
  const [formUserId, setFormUserId] = useState<number | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Гидратация формы из async user + сброс при смене пользователя —
  // паттерн «adjust state during render» вместо двух sync-эффектов
  // (каскадные рендеры + lint-ошибки). Условие стабилизируется само:
  // после гидратации formReady=true и formUserId=user.id.
  if (user && userDefaults && (!formReady || formUserId !== user.id)) {
    setFormUserId(user.id)
    setForm(userDefaults)
    setFormReady(true)
  }

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    // Fetch-effect: сброс loading перед запросом намеренный.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    api<CabinetData>("/api/auth/cabinet/")
      .then((data) => {
        if (cancelled) return
        setCabinet(data)
        setAthletes(data.athletes)
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
      toast(apiErrorMessage(err), "error")
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
      setAthletes(updated.athletes)
    } catch (err) {
      console.error("Ошибка при создании спортсмена:", err)
      setAthleteError(apiErrorMessage(err))
    }
  }

  const openAddAthlete = () => {
    setAthleteError("")
    setEditingAthleteId(null)
    setAthleteForm(EMPTY_ATHLETE_FORM)
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
    setAthletes(updated.athletes)
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

  const handleDeleteAthlete = (a: Athlete) => {
    setPendingDeleteAthlete(a)
  }

  const doDeleteAthlete = async (a: Athlete) => {
    setConfirmBusy(true)
    try {
      await api(`/api/tournament/athletes/${a.id}/`, { method: "DELETE" })
      setPendingDeleteAthlete(null)
      await refreshCabinet()
      toast(`Спортсмен ${a.last_name} ${a.first_name} удалён`, "success")
    } catch {
      toast("Не удалось удалить. Возможно, спортсмен уже участвует в проведённых боях.", "error")
    } finally {
      setConfirmBusy(false)
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

  const handleUnlinkChild = (a: Athlete) => {
    setPendingUnlinkChild(a)
  }

  const doUnlinkChild = async (a: Athlete) => {
    setConfirmBusy(true)
    try {
      await api(`/api/auth/children/${a.id}/`, { method: "DELETE" })
      setPendingUnlinkChild(null)
      await refreshCabinet()
      toast("Ребёнок отвязан от аккаунта", "success")
    } catch (err) {
      console.error("Ошибка отвязки:", err)
      // 404 = связь уже снята (например, двойной клик): просто обновляем список.
      await refreshCabinet().catch(() => {})
      if ((err as { status?: number })?.status !== 404) {
        toast("Не удалось отвязать ребёнка", "error")
      } else {
        setPendingUnlinkChild(null)
      }
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleInviteCode = async (a: Athlete) => {
    if (inviteBusyId !== null) return
    setInviteBusyId(a.id)
    try {
      await api<{ code: string }>(`/api/tournament/athletes/${a.id}/invite/`, {
        method: "POST",
      })
      await refreshCabinet()
    } catch (err) {
      console.error("Ошибка получения кода:", err)
      toast("Не удалось получить код привязки", "error")
    } finally {
      setInviteBusyId(null)
    }
  }

  // N4: поделиться кодом через системный share (WhatsApp/Telegram).
  // Кнопка рендерится только там, где Web Share API доступен.
  const shareCode = async (code: string, athleteLabel: string) => {
    try {
      await navigator.share({
        title: "Код привязки KWF",
        text: `Код привязки ${athleteLabel} к KWF: ${code}. Введите его в кабинете кнопкой «Привязать ребёнка».`,
      })
    } catch {
      // Отмена пользователем или ошибка — молча игнорируем.
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
      // Буфер недоступен (не-HTTPS/без разрешений): показываем код тостом,
      // чтобы его можно было переписать вручную.
      toast(`Код привязки: ${code}`, "info")
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

  // F1: уведомления «бой ребёнка скоро» — opt-in родителя.
  // Ленивые инициализаторы (хелперы SSR-безопасны): без setState в effect.
  const [notifyOn, setNotifyOn] = useState(() => isFightNotifyEnabled())
  const [notifyPerm, setNotifyPerm] = useState<NotifyPermission>(() => notifyPermission())
  const seenNotifyKeys = useRef<Set<string>>(new Set())
  // Фаза 1 (K1 «Мой следующий бой»): тянем очереди только тех турниров,
  // где у моих детей есть незавершённые бои — без лишних запросов.
  const myKidIds = useMemo(() => athletes.map((a) => a.id), [athletes])
  const myTournamentIds = useMemo(() => {
    if (!cabinet) return []
    const kids = new Set(myKidIds)
    const catToTournament = new Map<number, number>()
    for (const t of cabinet.tournaments) {
      for (const c of (t.categories ?? []) as { id: number }[]) {
        if (!catToTournament.has(c.id)) catToTournament.set(c.id, t.id)
      }
    }
    const tids = new Set<number>()
    for (const m of cabinet.matches ?? []) {
      if (m.status === "finished" || m.status === "bye") continue
      const mine =
        (typeof m.athlete1 === "number" && kids.has(m.athlete1)) ||
        (typeof m.athlete2 === "number" && kids.has(m.athlete2))
      if (!mine) continue
      const tid = catToTournament.get(m.category)
      if (tid !== undefined) tids.add(tid)
    }
    return [...tids]
  }, [cabinet, myKidIds])
  const { fight: myFight, loading: myFightLoading } = useMyNextFight(
    myKidIds,
    myTournamentIds,
    // F1: живая очередь только при включённых уведомлениях родителя —
    // без opt-in лишних запросов нет (старый одноразовый режим).
    { pollMs: notifyOn && role !== "trainer" ? 45000 : 0 }
  )
  const myFightTournament = useMemo(() => {
    if (!myFight || !cabinet) return null
    return (
      cabinet.tournaments.find((t) => t.id === myFight.tournamentId) ?? null
    )
  }, [myFight, cabinet])

  // N12: данные центра уведомлений — только из загруженного кабинета.
  const kidNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const a of athletes) map.set(a.id, `${a.first_name} ${a.last_name}`.trim())
    return map
  }, [athletes])

  const tournamentByCatId = useMemo(() => {
    const map = new Map<number, { slug: string; name: string }>()
    if (!cabinet) return map
    for (const t of cabinet.tournaments) {
      const slug = (t as Tournament).slug
      if (!slug) continue
      for (const c of (t.categories ?? []) as { id: number }[]) {
        if (!map.has(c.id)) map.set(c.id, { slug, name: t.name })
      }
    }
    return map
  }, [cabinet])

  const centerResults = useMemo(
    () =>
      buildResultItems(
        cabinet?.matches ?? [],
        myKidIds,
        (id) => tournamentByCatId.get(id),
        (id) => kidNameById.get(id)
      ),
    [cabinet, myKidIds, tournamentByCatId, kidNameById]
  )

  const watchTournaments = useMemo(() => {
    if (!cabinet) return []
    const ids = new Set(myTournamentIds)
    return cabinet.tournaments
      .filter((t) => ids.has(t.id))
      .map((t) => ({ slug: (t as Tournament).slug, name: t.name }))
      .filter((w) => !!w.slug)
  }, [cabinet, myTournamentIds])

  const centerFightHref =
    myFight && myFightTournament
      ? `/tournaments/${myFightTournament.slug}#match-${myFight.match.id}`
      : null

  // F1: отправка уведомлений по смене fight (дедупликация — seen-ключи).
  useEffect(() => {
    if (!notifyOn || role === "trainer" || !myFight) return
    const ev = shouldNotifyFight(myFight, seenNotifyKeys.current)
    if (!ev) return
    seenNotifyKeys.current.add(ev.key)
    if (notifyPerm !== "granted") return
    if (sendFightNotification(ev) && ev.live) {
      try {
        playGong()
      } catch {
        /* ignore */
      }
    }
  }, [notifyOn, role, myFight, notifyPerm])

  const toggleFightNotify = async () => {
    if (notifyOn) {
      setFightNotifyEnabled(false)
      setNotifyOn(false)
      toast("Уведомления о боях выключены", "success")
      return
    }
    const perm = await requestNotifyPermission()
    setNotifyPerm(perm)
    if (perm === "granted") {
      setFightNotifyEnabled(true)
      setNotifyOn(true)
      toast("Уведомления о боях включены", "success")
    } else if (perm === "denied") {
      toast("Уведомления заблокированы — разрешите их в настройках браузера", "error")
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-light-gray">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <CabinetHeader
          displayName={
            user.first_name || user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : user.username
          }
          role={role === "trainer" ? "trainer" : "parent"}
          loading={loading}
          tournamentCount={cabinet?.tournaments.length ?? 0}
          athleteCount={athletes.length}
          matchCount={cabinet?.matches.length ?? 0}
        />

        {(role !== "trainer" || myFight || (myFightLoading && myTournamentIds.length > 0)) && (
          <div className="mb-8">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-secondary-text">
                Следующий бой
              </h2>
              {role !== "trainer" && (
                <button
                  type="button"
                  onClick={() => void toggleFightNotify()}
                  aria-pressed={notifyOn}
                  title={
                    notifyOn
                      ? "Уведомления о бое ребёнка включены"
                      : "Включить уведомления о бое ребёнка — браузер спросит разрешение"
                  }
                  className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    notifyOn
                      ? "border-gold/50 bg-gold-soft text-dark-blue"
                      : "border-gold bg-gold text-dark-blue hover:bg-accent-warm-light"
                  }`}
                >
                  {notifyOn ? <BellRing size={14} /> : <Bell size={14} />}
                  {notifyOn ? "Уведомления включены" : "Уведомить о бое"}
                </button>
              )}
            </div>
            <MyNextFightCard
              fight={myFight}
              loading={myFightLoading}
              tournamentSlug={myFightTournament?.slug ?? null}
              tournamentName={myFightTournament?.name ?? null}
            />
          </div>
        )}

        <div className="mb-8">
          <NotificationCenter
            userId={user.id}
            role={role === "trainer" ? "trainer" : "parent"}
            myFight={myFight}
            fightHref={centerFightHref}
            results={centerResults}
            watch={watchTournaments}
          />
        </div>

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
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
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
                  <div className="flex items-center gap-2">
                    <Button
                      size="default"
                      variant="ghost"
                      className="h-9 px-4 text-sm"
                      onClick={() => setShowCsvImport(true)}
                    >
                      Импорт из файла
                    </Button>
                    <Button
                      size="default"
                      variant="ghost"
                      className="h-9 px-4 text-sm"
                      onClick={openAddAthlete}
                    >
                      + Добавить ребёнка
                    </Button>
                  </div>
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

              {role === "trainer" && !loading && athletes.length > 0 && (
                <ClubStatsCard />
              )}

              {loading ? (
                <div className="space-y-3" role="status" aria-label="Загрузка списка детей">
                  {[0, 1].map((i) => (
                    <div key={i} className="p-4 bg-light-gray rounded-xl border border-border animate-pulse" aria-hidden="true">
                      <div className="h-4 w-1/2 rounded bg-border" />
                      <div className="h-3 w-1/3 rounded bg-border mt-2" />
                    </div>
                  ))}
                </div>
              ) : athletes.length === 0 ? (
                <EmptyState
                  icon={<Users size={26} />}
                  title={role === "trainer" ? "Спортсмены не добавлены" : "Нет привязанных детей"}
                  hint={role === "trainer"
                    ? "Добавьте первого спортсмена, чтобы заявлять его на турниры"
                    : "Шаг 1. Попросите тренера нажать «Код» в карточке ребёнка. Шаг 2. Введите код кнопкой ниже — новая запись при этом не создаётся"}
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
                        <Link
                          href={`/athletes/${a.id}`}
                          className="font-semibold text-dark-text hover:text-primary-blue transition-colors"
                        >
                          {a.last_name} {a.first_name}
                        </Link>
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
                              <div className="flex flex-wrap items-center gap-2">
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
                                {typeof navigator !== "undefined" && "share" in navigator && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      a.link_code &&
                                      void shareCode(a.link_code, `${a.last_name} ${a.first_name}`)
                                    }
                                    title="Отправить код родителю (WhatsApp, Telegram)"
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-blue hover:text-primary-blue-light transition-colors cursor-pointer"
                                  >
                                    <Share2 size={13} />
                                    Отправить
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleInviteCode(a)}
                                disabled={inviteBusyId === a.id}
                                className="text-xs font-semibold text-primary-blue hover:text-primary-blue-light cursor-pointer disabled:opacity-50"
                              >
                                {inviteBusyId === a.id ? "Получение..." : "Получить код для родителя"}
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
                {role === "trainer" ? "Мои матчи" : "Лента семьи"}
              </h2>
              <FamilyFeed
                matches={cabinet?.matches ?? []}
                athletes={athletes}
                loading={loading}
                emptyHint="Здесь появятся бои ваших спортсменов после генерации турнирной сетки"
                storageKey={`kwf-feed-seen-${user?.id ?? "anon"}`}
                slugOfCategory={(categoryId) => categorySlugMap.get(categoryId)}
              />
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
                <div className="space-y-3" role="status" aria-label="Загрузка турниров">
                  {[0, 1].map((i) => (
                    <div key={i} className="p-3.5 bg-light-gray rounded-xl animate-pulse" aria-hidden="true">
                      <div className="h-4 w-2/3 rounded bg-border" />
                      <div className="h-3 w-1/3 rounded bg-border mt-2" />
                    </div>
                  ))}
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
                      href={role === "trainer" ? `/cabinet/tournaments/${t.id}/manage` : `/tournaments/${t.slug}`}
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

      <AthleteModal
        open={showAddAthlete}
        mode="add"
        form={athleteForm}
        setForm={setAthleteForm}
        error={athleteError}
        todayStr={todayStr}
        onClose={() => setShowAddAthlete(false)}
        onSubmit={handleAddAthlete}
      />

      <AthleteModal
        open={showEditAthlete}
        mode="edit"
        form={athleteForm}
        setForm={setAthleteForm}
        error={athleteError}
        todayStr={todayStr}
        onClose={() => setShowEditAthlete(false)}
        onSubmit={handleEditAthlete}
      />

      <LinkChildModal
        open={showLinkChild}
        code={linkCode}
        setCode={setLinkCode}
        error={linkError}
        linking={linking}
        onClose={() => setShowLinkChild(false)}
        onSubmit={handleLinkChild}
      />

      <ConfirmDialog
        open={pendingDeleteAthlete !== null}
        title={`Удалить спортсмена ${pendingDeleteAthlete?.last_name ?? ""} ${pendingDeleteAthlete?.first_name ?? ""}?`}
        description="Запись будет удалена из базы без возможности восстановления."
        confirmLabel="Удалить"
        danger
        busy={confirmBusy}
        onConfirm={() => pendingDeleteAthlete && doDeleteAthlete(pendingDeleteAthlete)}
        onClose={() => setPendingDeleteAthlete(null)}
      />
      <ConfirmDialog
        open={pendingUnlinkChild !== null}
        title={`Отвязать ребёнка ${pendingUnlinkChild?.last_name ?? ""} ${pendingUnlinkChild?.first_name ?? ""}?`}
        description="Связь с вашим аккаунтом будет снята. Сама запись спортсмена сохранится."
        confirmLabel="Отвязать"
        danger
        busy={confirmBusy}
        onConfirm={() => pendingUnlinkChild && doUnlinkChild(pendingUnlinkChild)}
        onClose={() => setPendingUnlinkChild(null)}
      />
      <CsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onDone={() => void refreshCabinet()}
      />
    </div>
  )
}
