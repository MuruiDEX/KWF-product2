"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { api, apiErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Trash2, Save, Users, RotateCcw, PlayCircle, Swords, LayoutDashboard } from "lucide-react"
import StatusPill from "@/components/ui/StatusPill"
import LiveQueue from "@/components/LiveQueue"
import TournamentBrackets from "@/components/TournamentBrackets"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import { isBracketEvent, isQueueEvent, type TournamentEvent } from "@/lib/tournamentEvents"
import type { Tournament, TournamentCategory, Round, Match, Athlete, Tatami } from "@/lib/types"

type ManageTab = "setup" | "live" | "bracket" | "participants"

function fmtDuration(totalSeconds?: number | null) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 120))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

function parseDuration(text: string): number | null {
  const t = text.trim()
  const mmss = t.match(/^(\d{1,3}):([0-5]?\d)$/)
  if (mmss) {
    const sec = Number(mmss[1]) * 60 + Number(mmss[2])
    return sec >= 15 && sec <= 3600 ? sec : null
  }
  if (/^\d+$/.test(t)) {
    const sec = Number(t)
    return sec >= 15 && sec <= 3600 ? sec : null
  }
  return null
}

function DurationInput({ value, onSave }: { value?: number | null; onSave: (sec: number) => void }) {
  const [text, setText] = useState(fmtDuration(value ?? 120))
  useEffect(() => {
    setText(fmtDuration(value ?? 120))
  }, [value])
  const commit = () => {
    const sec = parseDuration(text)
    if (sec === null) {
      setText(fmtDuration(value ?? 120))
      return
    }
    if (sec !== (value ?? 120)) onSave(sec)
    else setText(fmtDuration(sec))
  }
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      placeholder="02:00"
      title="Длительность боя категории (ММ:СС)"
      className="w-20 p-1.5 text-xs font-bold tabular-nums rounded-lg border border-border bg-white text-center focus:outline-none focus:ring-2 focus:ring-primary-blue/40"
    />
  )
}

function categoryStatus(cat: TournamentCategory, isFirstOpen: boolean): "waiting" | "active" | "finished" {
  const all = (cat.rounds || []).flatMap((r) => r.matches || [])
  if (all.length === 0) return "waiting"
  if (all.every((m) => m.status === "finished" || m.status === "bye")) return "finished"
  return isFirstOpen ? "active" : "waiting"
}

export default function ManageTournamentPage() {
  const params = useParams()
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [tatamis, setTatamis] = useState<Tatami[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [distributeMsg, setDistributeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  const [startingRoundId, setStartingRoundId] = useState<number | null>(null)
  const [matchMsg, setMatchMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tab, setTab] = useState<ManageTab>("setup")
  const tabTouched = useRef(false)
  const [membersBusy, setMembersBusy] = useState<string | null>(null)
  const [addSel, setAddSel] = useState<Record<number, string>>({})
  const [catModal, setCatModal] = useState<{
    id?: number; name: string; gender: string; age_min: string; age_max: string; weight_max: string
  } | null>(null)
  const [catModalError, setCatModalError] = useState("")
  const [catModalSaving, setCatModalSaving] = useState(false)
  const [roundModal, setRoundModal] = useState<{ categoryId: number; name: string } | null>(null)
  const [roundModalError, setRoundModalError] = useState("")
  const [roundModalSaving, setRoundModalSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [params.id])

  // Если турнир уже идёт — сразу открываем LIVE (пока пользователь не выбрал таб вручную).
  useEffect(() => {
    if (tabTouched.current || !tournament) return
    const live = (tournament.categories || []).flatMap((c) =>
      (c.rounds || []).flatMap((r) => r.matches || [])
    ).some((m) => m.status === "in_progress" || m.status === "paused")
    if (live) setTab("live")
  }, [tournament])

  // Realtime: шапка дашборда и состав подтягиваются чужими изменениями.
  const dashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (dashTimer.current) clearTimeout(dashTimer.current)
    }
  }, [])
  useTournamentEvents(params.id, {
    onEvents: useCallback<TournamentEventsHandler>(
      (batch: TournamentEvent[], resync: boolean) => {
        if (!resync && !batch.some((e) => isBracketEvent(e) || isQueueEvent(e))) return
        if (dashTimer.current) clearTimeout(dashTimer.current)
        dashTimer.current = setTimeout(() => {
          dashTimer.current = null
          void fetchData(true)
        }, 500)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [params.id]
    ),
  })

  async function fetchData(quiet = false) {
    if (!quiet) setLoading(true)
    try {
      const [t, a, tat] = await Promise.all([
        api<Tournament>(`/api/tournament/tournaments/${params.id}/`),
        api<Athlete[] | { results: Athlete[] }>("/api/tournament/athletes/"),
        api<Tatami[] | { results: Tatami[] }>("/api/tournament/tatamis/"),
      ])
      const { unwrapList } = await import("@/lib/api")
      setTournament(t)
      setAthletes(unwrapList(a))
      const tatList = unwrapList(tat)
      setTatamis([...tatList].sort((x, y) => x.order - y.order))
    } catch (e) {
      console.error(e)
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  const updateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const timers = updateTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  function parseScoreInput(value: string): number | null {
    const v = value.trim()
    if (v === "") return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return null
    return Math.floor(n)
  }

  function applyLocalMatchUpdate(matchId: number, updates: Partial<Match>) {
    setTournament((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        categories: (prev.categories || []).map((c) => ({
          ...c,
          rounds: (c.rounds || []).map((r) => ({
            ...r,
            matches: (r.matches || []).map((m) =>
              m.id === matchId ? { ...m, ...updates } : m
            ),
          })),
        })),
      }
    })
  }

  async function handleUpdateMatch(match: Match, updates: Partial<Match>) {
    // Оптимистично обновляем UI сразу, PATCH — с дебаунсом 600мс,
    // чтобы ввод счёта не давал шторм запросов и гонки порядка.
    applyLocalMatchUpdate(match.id, updates)
    const key = `${match.id}:${Object.keys(updates).sort().join(",")}`
    const prev = updateTimers.current.get(key)
    if (prev) clearTimeout(prev)
    const timer = setTimeout(async () => {
      updateTimers.current.delete(key)
      setSaving(true)
      try {
        await api(`/api/tournament/matches/${match.id}/`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        })
        await fetchData(true)
      } catch (e) {
        console.error(e)
        setMatchMsg({ ok: false, text: apiErrorMessage(e) })
        await fetchData(true)
      } finally {
        setSaving(false)
      }
    }, 600)
    updateTimers.current.set(key, timer)
  }

  async function handleFinishMatch(match: Match) {
    if (!match.winner) {
      setMatchMsg({ ok: false, text: "Сначала выберите победителя боя." })
      return
    }
    setFinishingId(match.id)
    setMatchMsg(null)
    try {
      // Единый путь финиша: продвижение и очередь — на сервере в транзакции.
      await api(`/api/tournament/matches/${match.id}/finish_match/`, {
        method: "POST",
        body: JSON.stringify({
          winner_id: match.winner,
          score1: match.score1,
          score2: match.score2,
        }),
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setFinishingId(null)
    }
  }

  async function handleReopenMatch(match: Match) {
    if (!window.confirm("Переоткрыть бой? Результат будет откачен, победитель вернётся из следующего боя (если тот ещё не начался).")) {
      return
    }
    setFinishingId(match.id)
    setMatchMsg(null)
    try {
      await api(`/api/tournament/matches/${match.id}/reopen/`, { method: "POST" })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setFinishingId(null)
    }
  }

  async function handleStartRound(round: Round) {
    setStartingRoundId(round.id)
    setMatchMsg(null)
    try {
      const res = await api<{ opened: number; distributed: number; already?: boolean }>(
        `/api/tournament/rounds/${round.id}/start/`,
        { method: "POST" }
      )
      if (res.already) {
        setMatchMsg({ ok: true, text: `Раунд «${round.name}» уже идёт.` })
      } else {
        setMatchMsg({
          ok: true,
          text: `Раунд «${round.name}» открыт: боёв готово ${res.opened}, на татами ${res.distributed}.`,
        })
      }
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setStartingRoundId(null)
    }
  }

  async function handleCategoryDuration(cat: TournamentCategory, seconds: number) {
    try {
      await api(`/api/tournament/categories/${cat.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ match_duration: seconds }),
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handlePublishToggle() {
    if (!tournament) return
    const toPublished = tournament.status !== "published"
    if (toPublished && !window.confirm(`Опубликовать турнир «${tournament.name}»? Он станет виден всем зрителям.`)) {
      return
    }
    try {
      await api(`/api/tournament/tournaments/${params.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: toPublished ? "published" : "draft" }),
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleDeleteTournament() {
    if (!tournament) return
    if (!window.confirm(`Вы действительно хотите удалить турнир «${tournament.name}»? Все категории, матчи и раунды этого турнира будут удалены. Спортсмены останутся в базе.`)) {
      return
    }
    try {
      await api(`/api/tournament/tournaments/${params.id}/`, { method: "DELETE" })
      router.push("/cabinet/tournaments")
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleAddCategory() {
    setCatModalError("")
    setCatModal({ name: "", gender: "any", age_min: "8", age_max: "12", weight_max: "40" })
  }

  function openEditCategory(cat: TournamentCategory) {
    setCatModalError("")
    setCatModal({
      id: cat.id,
      name: cat.name,
      gender: cat.gender,
      age_min: String(cat.age_min),
      age_max: String(cat.age_max),
      weight_max: String(cat.weight_max),
    })
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!catModal || !tournament) return
    const name = catModal.name.trim()
    const ageMin = Number(catModal.age_min)
    const ageMax = Number(catModal.age_max)
    const weightMax = Number(String(catModal.weight_max).replace(",", "."))
    if (!name) {
      setCatModalError("Введите название категории.")
      return
    }
    if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 0 || ageMax < 0 || ageMin > ageMax) {
      setCatModalError("Укажите корректный возрастной диапазон.")
      return
    }
    if (!Number.isFinite(weightMax) || weightMax <= 0) {
      setCatModalError("Укажите корректный максимальный вес.")
      return
    }
    setCatModalSaving(true)
    setCatModalError("")
    try {
      if (catModal.id) {
        await api(`/api/tournament/categories/${catModal.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ name, gender: catModal.gender, age_min: ageMin, age_max: ageMax, weight_max: weightMax }),
        })
      } else {
        await api("/api/tournament/categories/", {
          method: "POST",
          body: JSON.stringify({
            tournament: tournament.id,
            name,
            gender: catModal.gender,
            age_min: ageMin,
            age_max: ageMax,
            weight_max: weightMax,
            order: tournament.categories?.length || 0,
          }),
        })
      }
      setCatModal(null)
      await fetchData(true)
    } catch (err) {
      setCatModalError(apiErrorMessage(err))
    } finally {
      setCatModalSaving(false)
    }
  }

  async function handleAddRound(category: TournamentCategory) {
    setRoundModalError("")
    setRoundModal({ categoryId: category.id, name: "" })
  }

  async function handleSaveRound(e: React.FormEvent) {
    e.preventDefault()
    if (!roundModal || !tournament) return
    const name = roundModal.name.trim()
    if (!name) {
      setRoundModalError("Введите название раунда.")
      return
    }
    const category = (tournament.categories || []).find((c) => c.id === roundModal.categoryId)
    if (!category) {
      setRoundModalError("Категория не найдена. Обновите страницу.")
      return
    }
    setRoundModalSaving(true)
    setRoundModalError("")
    try {
      await api("/api/tournament/rounds/", {
        method: "POST",
        body: JSON.stringify({
          category: category.id,
          name,
          order: category.rounds.length || 0,
        }),
      })
      setRoundModal(null)
      await fetchData(true)
    } catch (err) {
      setRoundModalError(apiErrorMessage(err))
    } finally {
      setRoundModalSaving(false)
    }
  }

  async function handleAddMatch(round: Round) {
    try {
      await api("/api/tournament/matches/", {
        method: "POST",
        body: JSON.stringify({
          round: round.id,
          match_number: round.matches.length + 1,
          score1: 0,
          score2: 0,
          status: "waiting"
        }),
      })
      await fetchData()
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleGenerateBracket(category: TournamentCategory) {
    try {
      await api(`/api/tournament/categories/${category.id}/generate_bracket/`, {
        method: "POST",
      })
      await fetchData()
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleAddToCategory(category: TournamentCategory) {
    const raw = addSel[category.id]
    if (!raw) return
    const key = `add-${category.id}`
    setMembersBusy(key)
    setMatchMsg(null)
    try {
      await api(`/api/tournament/categories/${category.id}/add_athletes/`, {
        method: "POST",
        body: JSON.stringify({ athlete_ids: [Number(raw)] }),
      })
      setAddSel((p) => ({ ...p, [category.id]: "" }))
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setMembersBusy((prev) => (prev === key ? null : prev))
    }
  }

  async function handleRemoveFromCategory(category: TournamentCategory, athlete: Athlete) {
    const key = `rm-${category.id}-${athlete.id}`
    setMembersBusy(key)
    setMatchMsg(null)
    try {
      await api(`/api/tournament/categories/${category.id}/remove_athlete/`, {
        method: "POST",
        body: JSON.stringify({ athlete_id: athlete.id }),
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setMembersBusy((prev) => (prev === key ? null : prev))
    }
  }

  async function handleDistributeTatamis() {    setDistributing(true)
    setDistributeMsg(null)
    try {
      const res = await api<{ distributed: number; waiting: number; hint?: string | null }>(
        `/api/tournament/tournaments/${params.id}/distribute_tatamis/`,
        { method: "POST" }
      )
      if (res.distributed > 0) {
        setDistributeMsg({ ok: true, text: `Распределено боёв: ${res.distributed}.` })
      } else if (res.hint) {
        setDistributeMsg({ ok: true, text: res.hint })
      } else {
        setDistributeMsg({ ok: true, text: "Все готовые бои уже распределены." })
      }
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setDistributing(false)
    }
  }

  async function handleEnsureTatamis() {
    const need = Math.max(1, tournament?.mats_count ?? 1) - tatamis.length
    if (need <= 0) return
    const startOrder = tatamis.length > 0 ? Math.max(...tatamis.map((t) => t.order)) + 1 : 1
    setDistributing(true)
    setDistributeMsg(null)
    try {
      for (let i = 0; i < need; i++) {
        const order = startOrder + i
        await api("/api/tournament/tatamis/", {
          method: "POST",
          body: JSON.stringify({ name: `Татами ${order}`, order }),
        })
      }
      setDistributeMsg({ ok: true, text: `Создано татами: ${need}. Теперь нажмите «Распределить татами».` })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setDistributing(false)
    }
  }

  async function handleAddTatami() {
    const order = tatamis.length > 0 ? Math.max(...tatamis.map((t) => t.order)) + 1 : 1
    try {
      await api("/api/tournament/tatamis/", {
        method: "POST",
        body: JSON.stringify({ name: `Татами ${order}`, order }),
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  async function handleDistributeCategories() {
    setDistributing(true)
    setDistributeMsg(null)
    try {
      const res = await api<{ distributed: Record<string, number[]>; moved_matches: number }>(
        `/api/tournament/tournaments/${params.id}/distribute_categories/`,
        { method: "POST" }
      )
      const parts = Object.entries(res.distributed).map(([tid, cids]) => {
        const t = tatamis.find((x) => x.id === Number(tid))
        return `${t ? t.name : `Татами ${tid}`}: ${cids.length} кат.`
      })
      setDistributeMsg({
        ok: true,
        text: parts.length
          ? `Категории распределены — ${parts.join(" · ")}. Боёв перенесено: ${res.moved_matches}.`
          : "Категорий пока нет.",
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setDistributing(false)
    }
  }

  async function handleCategoryTatami(cat: TournamentCategory, tatamiId: string) {
    const key = `ctat-${cat.id}`
    setMembersBusy(key)
    setMatchMsg(null)
    try {
      await api(`/api/tournament/categories/${cat.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ tatami: tatamiId === "" ? null : Number(tatamiId) }),
      })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setMatchMsg({ ok: false, text: apiErrorMessage(e) })
    } finally {
      setMembersBusy((prev) => (prev === key ? null : prev))
    }
  }

  async function handleDeleteTatami(tatami: Tatami) {
    const live = allMatchesCount(tatami.id)
    if (!window.confirm(
      live > 0
        ? `Удалить «${tatami.name}»? На нём есть незавершённые бои (${live}) — они останутся без татами.`
        : `Удалить «${tatami.name}»?`
    )) {
      return
    }
    try {
      await api(`/api/tournament/tatamis/${tatami.id}/`, { method: "DELETE" })
      await fetchData(true)
    } catch (e) {
      console.error(e)
      setDistributeMsg({ ok: false, text: apiErrorMessage(e) })
    }
  }

  function allMatchesCount(tatamiId: number) {
    return (tournament?.categories || []).flatMap((c) =>
      (c.rounds || []).flatMap((r) => r.matches || [])
    ).filter((m) => m.tatami === tatamiId && m.status !== "finished" && m.status !== "bye").length
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return <div className="text-center py-20">Турнир не найден</div>
  }

  const allMatches = (tournament?.categories || []).flatMap((c) => (c.rounds || []).flatMap((r) => r.matches || []))
  const finishedMatches = allMatches.filter((m) => m.status === "finished" || m.status === "bye").length
  const liveCount = allMatches.filter((m) => m.status === "in_progress" || m.status === "paused").length
  const waitingCount = allMatches.filter((m) => m.status === "ready" || m.status === "waiting").length
  const participantCount = (tournament?.categories || []).reduce((n, c) => n + (c.athletes?.length || 0), 0)
  const sortedCats = [...(tournament?.categories || [])].sort((a, b) => a.order - b.order)
  const firstOpenCatId = sortedCats.find((c) => {
    const ms = (c.rounds || []).flatMap((r) => r.matches || [])
    return ms.length > 0 && !ms.every((m) => m.status === "finished" || m.status === "bye")
  })?.id ?? null
  const currentRoundName = (() => {
    for (const c of sortedCats) {
      const open = [...(c.rounds || [])]
        .sort((a, b) => a.order - b.order)
        .find((r) => (r.matches || []).some((m) => m.status !== "finished" && m.status !== "bye"))
      if (open) return open.name
    }
    return allMatches.length > 0 ? "Завершён" : "—"
  })()

  // Если турнир уже идёт — см. эффект выше (авто-LIVE до ручного выбора таба).
  const switchTab = (t: ManageTab) => {
    tabTouched.current = true
    setTab(t)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-secondary-text shrink-0"
              onClick={() => router.back()}
            >
              <ArrowLeft size={16} />
              Назад
            </Button>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-text">
                Турнир
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-text truncate">
                {tournament?.name}
              </h1>
            </div>
            {tournament && <StatusPill status={tournament.status} />}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {tournament?.status !== "finished" && (
              <Button onClick={handlePublishToggle} variant="outline" size="sm" className="gap-2">
                {tournament?.status === "published" ? "Снять с публикации" : "Опубликовать"}
              </Button>
            )}
            <Button onClick={handleDeleteTournament} variant="ghost" size="sm" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 size={16} />
              Удалить
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: "Категории", value: tournament?.categories?.length || 0 },
            { label: "Участники", value: participantCount },
            { label: "Матчи", value: allMatches.length },
            { label: "Завершено", value: finishedMatches },
            { label: "LIVE", value: liveCount },
            { label: "Ожидают", value: waitingCount },
            { label: "Татами", value: tatamis.length },
            { label: "Текущий раунд", value: currentRoundName },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-light-gray border border-border px-4 py-3">
              <div className="text-2xl font-extrabold text-dark-text tabular-nums">{s.value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-text mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Button onClick={handleDistributeTatamis} disabled={distributing} className="gap-2" variant="secondary" size="sm">
            <RotateCcw size={16} />
            {distributing ? "Распределение..." : "Распределить бои"}
          </Button>
          <Button
            onClick={handleDistributeCategories}
            disabled={distributing || tatamis.length === 0}
            className="gap-2"
            variant="secondary"
            size="sm"
            title="Равномерно разложить категории по татами (разница — максимум 1)"
          >
            <LayoutDashboard size={16} />
            Распределить категории
          </Button>
          {tatamis.length === 0 && (
            <Button onClick={handleEnsureTatamis} disabled={distributing} className="gap-2" size="sm">
              <Plus size={16} />
              Создать {Math.max(1, tournament?.mats_count ?? 1)} татами
            </Button>
          )}
          <Button onClick={handleAddCategory} className="gap-2" size="sm">
            <Plus size={16} />
            Категорию
          </Button>
        </div>
        {distributeMsg && (
          <div
            className={`mt-4 p-3 rounded-xl border text-sm font-medium ${
              distributeMsg.ok
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {distributeMsg.text}
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-1.5 shadow-sm">
        {([
          { id: "setup", label: "Управление" },
          { id: "live", label: `LIVE${liveCount > 0 ? ` · ${liveCount}` : ""}` },
          { id: "bracket", label: "Сетка" },
          { id: "participants", label: `Участники · ${participantCount}` },
        ] as { id: ManageTab; label: string }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`flex-1 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
              tab === t.id
                ? "bg-dark-blue text-white shadow dark:bg-gold dark:text-dark-blue"
                : "text-secondary-text hover:bg-light-gray"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm">
          <LiveQueue tournamentId={params.id as string} />
        </div>
      )}

      {tab === "bracket" && (
        <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm">
          <TournamentBrackets tournamentId={params.id as string} />
        </div>
      )}

      {tab === "participants" && (
        <div className="space-y-4">
          {matchMsg && (
            <div className="p-3 rounded-xl border text-sm font-medium bg-red-50 border-red-200 text-red-700">
              {matchMsg.text}
            </div>
          )}
          {sortedCats.length === 0 && (
            <div className="rounded-2xl border border-border bg-white p-6 text-sm text-secondary-text shadow-sm">
              Категорий пока нет — создайте первую кнопкой «Категорию» выше.
            </div>
          )}
          {sortedCats.map((cat) => {
            const inCat = new Set((cat.athletes || []).map((a) => a.id))
            const available = athletes.filter((a) => !inCat.has(a.id))
            const frozen = (cat.rounds || []).length > 0
            return (
              <div key={cat.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                  <div>
                    <h3 className="font-bold text-dark-text">{cat.name}</h3>
                    <p className="text-xs text-secondary-text mt-0.5">
                      {(cat.athletes || []).length} уч. ·{" "}
                      {frozen ? "сетка построена — состав заморожен" : "сетки нет — состав можно менять"}
                    </p>
                  </div>
                  {!frozen && (cat.athletes || []).length >= 2 && (
                    <Button onClick={() => handleGenerateBracket(cat)} size="sm" variant="secondary" className="gap-1.5 h-8 text-xs">
                      <Swords size={14} />
                      Сформировать сетку
                    </Button>
                  )}
                </div>
                {(cat.athletes || []).length === 0 ? (
                  <p className="text-sm text-secondary-text py-2">В категории пока никого нет.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 py-2">
                    {(cat.athletes || []).map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-light-gray pl-3 pr-1.5 py-1.5 text-sm font-semibold text-dark-text"
                      >
                        {a.last_name} {a.first_name}
                        {!frozen && (
                          <button
                            type="button"
                            disabled={membersBusy === `rm-${cat.id}-${a.id}`}
                            onClick={() => handleRemoveFromCategory(cat, a)}
                            aria-label={`Убрать ${a.last_name}`}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-secondary-text hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {!frozen && available.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <select
                      value={addSel[cat.id] ?? ""}
                      onChange={(e) => setAddSel((p) => ({ ...p, [cat.id]: e.target.value }))}
                      className="h-9 px-3 text-sm rounded-xl border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                    >
                      <option value="">Добавить спортсмена...</option>
                      {available.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.last_name} {a.first_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => handleAddToCategory(cat)}
                      disabled={!addSel[cat.id] || membersBusy === `add-${cat.id}`}
                      size="sm"
                      className="gap-1.5 h-9 text-xs"
                    >
                      <Plus size={14} />
                      Добавить
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === "setup" && (
      <>
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-dark-text">Татами</h2>
            <p className="text-xs text-secondary-text mt-0.5">
              Категории идут параллельно — каждая на своём татами. Ручной выбор категории не перезаписывается.
            </p>
          </div>
          <Button onClick={handleAddTatami} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Plus size={14} />
            Татами
          </Button>
        </div>
        {tatamis.length === 0 ? (
          <p className="text-sm text-secondary-text py-2">
            Татами пока нет — добавьте хотя бы один, иначе распределение боёв невозможно.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {tatamis.map((t) => {
              const live = allMatchesCount(t.id)
              const cats = sortedCats.filter((c) => c.tatami === t.id)
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-border bg-light-gray px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-dark-text">{t.name}</span>
                    <span className="text-[11px] font-semibold text-secondary-text tabular-nums">
                      {live > 0 ? `${live} б.` : "свободно"}
                    </span>
                    <span className="text-[11px] font-semibold text-secondary-text tabular-nums">
                      · {cats.length} кат.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTatami(t)}
                      aria-label={`Удалить ${t.name}`}
                      className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-secondary-text hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {cats.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cats.map((c) => (
                        <span
                          key={c.id}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-border text-secondary-text truncate max-w-full"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-8">
        {matchMsg && (
          <div
            className={`p-3 rounded-xl border text-sm font-medium ${
              matchMsg.ok
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {matchMsg.text}
          </div>
        )}
        {sortedCats.map((cat) => {
          const catMatches = (cat.rounds || []).flatMap((r) => r.matches || [])
          const catLeft = catMatches.filter((m) => m.status !== "finished" && m.status !== "bye").length
          const catStatus = catMatches.length === 0
            ? "waiting" as const
            : catLeft === 0 ? "finished" as const : cat.id === firstOpenCatId ? "active" as const : "waiting" as const
          const currentRound = [...(cat.rounds || [])]
            .sort((a, b) => a.order - b.order)
            .find((r) => (r.matches || []).some((m) => m.status !== "finished" && m.status !== "bye"))
          return (
          <div key={cat.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="bg-light-gray p-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <h2 className="text-lg font-bold text-dark-text">{cat.name}</h2>
                <span className="text-xs px-2 py-0.5 bg-white border border-border rounded-full text-secondary-text">
                  {cat.gender === "male" ? "Мальчики" : cat.gender === "female" ? "Девочки" : "Смешанная"} | {cat.age_min}-{cat.age_max} лет
                </span>
                <StatusPill status={catStatus === "active" ? "active" : catStatus === "finished" ? "finished" : "waiting"} />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-secondary-text">
                <span><b className="text-dark-text tabular-nums">{cat.athletes?.length || 0}</b> уч. · <b className="text-dark-text tabular-nums">{catLeft}</b> боёв осталось</span>
                <span className="inline-flex items-center gap-1.5">
                  Время боя:
                  <DurationInput value={cat.match_duration} onSave={(sec) => handleCategoryDuration(cat, sec)} />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  Татами:
                  <select
                    value={cat.tatami ?? ""}
                    disabled={membersBusy === `ctat-${cat.id}` || tatamis.length === 0}
                    onChange={(e) => handleCategoryTatami(cat, e.target.value)}
                    title="Татами категории — бои наследуют его. Ручной выбор не перезаписывается."
                    className="h-8 px-2 text-xs font-bold rounded-lg border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {tatamis.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </span>
                <span>Текущий раунд: <b className="text-dark-text">{currentRound ? currentRound.name : "—"}</b></span>
                <Button onClick={() => switchTab("live")} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">LIVE</Button>
                <Button onClick={() => switchTab("bracket")} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">Сетка</Button>
                <Button onClick={() => openEditCategory(cat)} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  Изменить
                </Button>
                <Button onClick={() => handleAddRound(cat)} size="sm" className="gap-2">
                  <Plus size={16} />
                  Раунд
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {cat.rounds.map((round) => {
                const rDone = (round.matches || []).filter((m) => m.status === "finished" || m.status === "bye").length
                const rTotal = (round.matches || []).length
                const rStatus = round.status ?? (rTotal === 0 ? "waiting" : rDone === rTotal ? "finished" : "waiting")
                return (
                <div key={round.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-dark-text flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary-blue text-white text-xs flex items-center justify-center shrink-0">
                        {round.order}
                      </span>
                      {round.name}
                      <StatusPill status={rStatus === "in_progress" ? "active" : rStatus === "finished" ? "finished" : "waiting"} />
                      {rTotal > 0 && (
                        <span className="text-xs font-semibold text-secondary-text tabular-nums">
                          {rDone}/{rTotal}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {rStatus === "waiting" && rTotal > 0 && (
                        <Button
                          onClick={() => handleStartRound(round)}
                          disabled={startingRoundId === round.id}
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 h-8 text-xs"
                          title="Открыть бои раунда и раздать татами"
                        >
                          <PlayCircle size={14} />
                          {startingRoundId === round.id ? "Старт..." : "Старт раунда"}
                        </Button>
                      )}
                      <Button onClick={() => handleAddMatch(round)} size="sm" variant="ghost" className="gap-2 text-xs">
                        <Plus size={14} />
                        Матч
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {round.matches.map((match) => (
                      <div key={match.id} className="p-4 bg-light-gray rounded-xl border border-border space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-secondary-text">Матч #{match.match_number}</span>
                          <div className="flex items-center gap-1.5 text-xs text-secondary-text">
                            <span>Время:</span>
                            <input
                              type="time"
                              value={match.start_time || ""}
                              onChange={(e) => handleUpdateMatch(match, { start_time: e.target.value || null })}
                              className="p-1 text-xs rounded border border-border bg-white"
                              title="Время начала матча"
                            />
                            <span>—</span>
                            <input
                              type="time"
                              value={match.end_time || ""}
                              onChange={(e) => handleUpdateMatch(match, { end_time: e.target.value || null })}
                              className="p-1 text-xs rounded border border-border bg-white"
                              title="Время окончания матча"
                            />
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${match.status === "finished" ? "bg-green-100 text-green-700" : match.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : match.status === "ready" ? "bg-blue-100 text-blue-700" : match.status === "bye" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                            {match.status === "finished" ? "Завершён" : match.status === "in_progress" ? "В процессе" : match.status === "ready" ? "Готов" : match.status === "bye" ? "BYE" : "Ожидает"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <select
                              value={match.athlete1 || ""}
                              onChange={(e) => {
                                const raw = e.target.value
                                const v = raw === "" ? null : Number(raw)
                                if (v !== null && !Number.isInteger(v)) return
                                void handleUpdateMatch(match, { athlete1: v })
                              }}
                              className="w-full p-2 text-xs rounded-lg border border-border bg-white"
                            >
                              <option value="">Выберите атлета 1</option>
                              {athletes.map(a => (
                                <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={match.score1}
                              min={0}
                              onChange={(e) => {
                                const v = parseScoreInput(e.target.value)
                                if (v === null) return
                                applyLocalMatchUpdate(match.id, { score1: v })
                              }}
                              onBlur={(e) => {
                                const v = parseScoreInput(e.target.value)
                                if (v !== null && v !== match.score1) {
                                  void handleUpdateMatch(match, { score1: v })
                                }
                              }}
                              className="w-full p-2 text-xs rounded-lg border border-border text-center font-bold"
                            />
                          </div>
                          <div className="space-y-2">
                            <select
                              value={match.athlete2 || ""}
                              onChange={(e) => {
                                const raw = e.target.value
                                const v = raw === "" ? null : Number(raw)
                                if (v !== null && !Number.isInteger(v)) return
                                void handleUpdateMatch(match, { athlete2: v })
                              }}
                              className="w-full p-2 text-xs rounded-lg border border-border bg-white"
                            >
                              <option value="">Выберите атлета 2</option>
                              {athletes.map(a => (
                                <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={match.score2}
                              min={0}
                              onChange={(e) => {
                                const v = parseScoreInput(e.target.value)
                                if (v === null) return
                                applyLocalMatchUpdate(match.id, { score2: v })
                              }}
                              onBlur={(e) => {
                                const v = parseScoreInput(e.target.value)
                                if (v !== null && v !== match.score2) {
                                  void handleUpdateMatch(match, { score2: v })
                                }
                              }}
                              className="w-full p-2 text-xs rounded-lg border border-border text-center font-bold"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <select
                            value={match.winner || ""}
                            onChange={(e) => handleUpdateMatch(match, { winner: Number(e.target.value) || null })}
                            className="text-xs p-1 rounded border border-border bg-white"
                          >
                            <option value="">Победитель</option>
                            {athletes.map(a => (
                              <option key={a.id} value={a.id}>{a.last_name}</option>
                            ))}
                          </select>
                          {match.status === "finished" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1"
                              disabled={finishingId === match.id}
                              onClick={() => handleReopenMatch(match)}
                            >
                              <RotateCcw size={12} />
                              {finishingId === match.id ? "Открытие..." : "Переоткрыть"}
                            </Button>
                          ) : match.status === "bye" ? null : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1"
                              disabled={finishingId === match.id}
                              onClick={() => handleFinishMatch(match)}
                            >
                              <Save size={12} />
                              {finishingId === match.id ? "Завершение..." : "Завершить"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
          )
        })}
      </div>
      </>
      )}

      {catModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCatModal(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-dark-text mb-4">
              {catModal.id ? "Изменить категорию" : "Новая категория"}
            </h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              {catModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {catModalError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">Название *</label>
                <input
                  type="text"
                  value={catModal.name}
                  onChange={(e) => setCatModal({ ...catModal, name: e.target.value })}
                  placeholder="Мальчики 10-12 лет, до 45 кг"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">Пол</label>
                <select
                  value={catModal.gender}
                  onChange={(e) => setCatModal({ ...catModal, gender: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                >
                  <option value="male">Мальчики</option>
                  <option value="female">Девочки</option>
                  <option value="any">Смешанная</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Возраст от</label>
                  <input
                    type="number" min={0}
                    value={catModal.age_min}
                    onChange={(e) => setCatModal({ ...catModal, age_min: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-text mb-1.5">Возраст до</label>
                  <input
                    type="number" min={0}
                    value={catModal.age_max}
                    onChange={(e) => setCatModal({ ...catModal, age_max: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">Макс. вес (кг) *</label>
                <input
                  type="number" step="0.1" min="0.1"
                  value={catModal.weight_max}
                  onChange={(e) => setCatModal({ ...catModal, weight_max: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" size="default" className="h-10 px-4 text-sm" onClick={() => setCatModal(null)}>
                  Отмена
                </Button>
                <Button type="submit" className="h-10 px-5 text-sm" disabled={catModalSaving}>
                  {catModalSaving ? "Сохранение..." : catModal.id ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRoundModal(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold text-dark-text mb-4">Новый раунд</h3>
            <form onSubmit={handleSaveRound} className="space-y-4">
              {roundModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {roundModalError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-dark-text mb-1.5">Название *</label>
                <input
                  type="text"
                  value={roundModal.name}
                  onChange={(e) => setRoundModal({ ...roundModal, name: e.target.value })}
                  placeholder="1/8 финала"
                  autoFocus
                  className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" size="default" className="h-10 px-4 text-sm" onClick={() => setRoundModal(null)}>
                  Отмена
                </Button>
                <Button type="submit" className="h-10 px-5 text-sm" disabled={roundModalSaving}>
                  {roundModalSaving ? "Сохранение..." : "Создать"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}