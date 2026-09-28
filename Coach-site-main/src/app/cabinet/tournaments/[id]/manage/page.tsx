"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { api, apiBaseUrl, apiErrorStatus, unwrapList } from "@/lib/api"
import type { Athlete, Tournament } from "@/lib/types"
import { openPalette, type PaletteItem } from "@/lib/palette"
import { QuickNav } from "@/components/QuickNav"
import { invalidateManage } from "@/lib/queryClient"
import { resolveTournamentId } from "@/lib/readinessAdapter"
import {
  useManageAthletesQuery,
  useManageRegsQuery,
  useManageTatamisQuery,
  useManageTournamentQuery,
} from "./hooks/useManageQueries"
import { Button } from "@/components/ui/button"
import { PlayCircle, Swords, Radio, Wand2 } from "lucide-react"
import { ErrorRetry } from "@/components/ui/ErrorRetry"
import { ManageHeader } from "./_components/ManageHeader"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"
import { AnnounceBar } from "@/components/AnnounceBar"
import TournamentSetupWizard from "@/components/TournamentSetupWizard"
import NextActionCard from "./_components/NextActionCard"
import ReadinessOverview from "./_components/ReadinessOverview"
import IssuesCenter from "./_components/IssuesCenter"
import TournamentNavigation from "./_components/TournamentNavigation"
import { CategoryDrawer } from "./_components/CategoryDrawer"
import { type ScheduleView } from "./_components/SchedulePanel"
import { ScheduleSection } from "./_components/ScheduleSection"
import { BracketsSection } from "./_components/BracketsSection"
import { StaffSection } from "./_components/StaffSection"
import { CommunicationSection } from "./_components/CommunicationSection"
import { DocumentsSection, type DocumentPrefill } from "./_components/DocumentsSection"
import { SettingsSection } from "./_components/SettingsSection"
import { OverviewPanel } from "./_components/OverviewPanel"
import { ParticipantsPanel } from "./_components/ParticipantsPanel"
import WeighInSection from "./_components/WeighInSection"
import { CategoriesPanel } from "./_components/CategoriesPanel"
import { computeWeighin } from "@/lib/controlCenter"
import { useBulkCategoryActions } from "./hooks/useBulkCategoryActions"
import {
  type ManageTabId,
} from "@/components/ReadinessChecklist"
import {
  computeTournamentReadiness,
  type NextActionTarget,
} from "@/lib/readiness"
import { buildReadinessInput } from "@/lib/readinessAdapter"
import { useModalBehavior } from "@/lib/useModal"
import { useTournamentEvents, type TournamentEventsHandler } from "@/lib/useTournamentEvents"
import { isBracketEvent, isQueueEvent, type TournamentEvent } from "@/lib/tournamentEvents"
import { MANAGE_TABS, isManageTab, resolveTab, type ManageTab } from "./manageTabs"
import { useManageConfirm } from "./manageConfirm"
import { useMatchMutations } from "./hooks/useMatchMutations"
import { useTatamiActions } from "./hooks/useTatamiActions"
import { useTournamentLifecycle } from "./hooks/useTournamentLifecycle"
import { useCategoryActions } from "./hooks/useCategoryActions"
import { useRoundActions } from "./hooks/useRoundActions"
import CategoryDialog from "./_components/CategoryDialog"
import RoundDialog from "./_components/RoundDialog"
import TemplateDialog from "./_components/TemplateDialog"
import ManageConfirmDialog from "./_components/ManageConfirmDialog"
import { buildCategoryRows, buildWeighinRoster } from "./manageDerived"

// Phase 2B: DurationInput живёт в _components/BracketsPanel.tsx.

export default function ManageTournamentPage() {
  // useSearchParams требует Suspense-границу.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ManageTournamentInner />
    </Suspense>
  )
}

function ManageTournamentInner() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const tournamentId = resolveTournamentId(params.id)
  // Query-migration: server state живёт в TanStack Query (см. lib/queryClient
  // и hooks/useManageQueries). Локальные useState для данных сервера удалены:
  // один запрос на ключ вместо дублей page + CheckinPanel + wizard.
  const tournamentQuery = useManageTournamentQuery(params.id)
  const athletesQuery = useManageAthletesQuery()
  const tatamisQuery = useManageTatamisQuery()
  const regsQuery = useManageRegsQuery(params.id)
  const tournament = tournamentQuery.data ?? null
  // ?? [] создавал бы новую ссылку каждый рендер и ломал мемоизацию ниже —
  // стабилизируем через useMemo (источник всё равно кэш Query).
  const athletes = useMemo(
    () => athletesQuery.data ?? [],
    [athletesQuery.data]
  )
  const tatamis = useMemo(
    () => tatamisQuery.data ?? [],
    [tatamisQuery.data]
  )
  // Явка вторична: null = «недоступно» (обзор покажет прочерк, CheckinPanel — своё).
  const regs = regsQuery.data ?? null
  const loading =
    tournamentQuery.isPending ||
    athletesQuery.isPending ||
    tatamisQuery.isPending
  const loadError = tournamentQuery.isError
    ? { status: apiErrorStatus(tournamentQuery.error) }
    : null
  // Время последнего успешного снапшота турнира — тихий индикатор свежести.
  const dataUpdatedAt = tournamentQuery.dataUpdatedAt
    ? tournamentQuery.dataUpdatedAt
    : null
  const [wizardOpen, setWizardOpen] = useState(false)
  // Распределение/бои/сетки/lifecycle — в hooks (useTatamiActions,
  // useMatchMutations, useTournamentLifecycle); здесь только UI-состояние.
  // N2: начальный таб из ?tab= (редиректы со схлопнутых bracket/live).
  const searchParams = useSearchParams()
  const initialRoute = resolveTab(searchParams.get("tab"), searchParams.get("view"))
  const [tab, setTab] = useState<ManageTab>(initialRoute.tab)
  const [scheduleView, setScheduleView] = useState<ScheduleView>(initialRoute.view)
  // Ссылки кнопок табов для keyboard-навигации (ручная активация).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabTouched = useRef(
    isManageTab(searchParams.get("tab")) ||
      searchParams.get("tab") === "setup" ||
      searchParams.get("tab") === "live" ||
      searchParams.get("tab") === "bracket"
  )
  // Модалки форм: trap фокуса + Escape + возврат фокуса (тот же useModalBehavior).
  // Сами вызовы — ниже, после инициализации хуков (иначе TDZ).
  const catPanelRef = useRef<HTMLDivElement | null>(null)
  const roundPanelRef = useRef<HTMLDivElement | null>(null)
  const tplPanelRef = useRef<HTMLDivElement | null>(null)

  // Единая точка обновления после мутаций: инвалидация Query-кэша вместо
  // ручного fetchData. Все 40+ call-sites ниже не менялись — меняется только
  // владелец данных. await ждёт завершения фонового refetch активных queries.
  async function fetchData() {
    if (!tournamentId) return
    await invalidateManage(queryClient, tournamentId)
  }

  // Стабильная ссылка для useCallback-мутаций боя (memo(MatchCard) получает
  // те же колбэки). Ref обновляется в effect, мутации зовут current().
  const fetchDataRef = useRef(fetchData)
  useEffect(() => {
    fetchDataRef.current = fetchData
  })

  // Ctrl+K обрабатывает единый QuickNav (смонтирован ниже, hideTrigger);
  // второго listener'а здесь нет — иначе палитра открывалась бы дважды.

  // Если турнир уже идёт — сразу открываем LIVE (пока пользователь не выбрал таб вручную).
  // Тем же паттерном «adjust state during render»: без каскадного рендера
  // после paint (не было бы flash таба overview) и без setState в effect.
  if (!tabTouched.current && tournament && tab === "overview") {
    const live = (tournament.categories || []).flatMap((c) =>
      (c.rounds || []).flatMap((r) => r.matches || [])
    ).some((m) => m.status === "in_progress" || m.status === "paused")
    if (live) {
      setTab("schedule")
      setScheduleView("live")
    }
  }

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
          // Через ref — useCallback ниже создаётся один раз на params.id,
          // а fetchData пересоздаётся каждый рендер.
          void fetchDataRef.current()
        }, 500)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [params.id]
    ),
  })

  // Мутации боёв/сеток — hooks/useMatchMutations (очередь PATCH, финиш,
  // старт раунда, генерация с guardrail). Стабильность колбэков для
  // memo(MatchCard) держит сам хук.

  // Категории/раунды/состав — hooks/useCategoryActions + hooks/useRoundActions.
  // Инстанцирование — ниже, после мемоидов данных (иначе TDZ).

  // Ручные матчи и генерация сеток — useMatchMutations.

  // Татами и распределение — hooks/useTatamiActions.
  // Подсчёт живых боёв на татами — из allMatches-мемоида (без второго прохода
  // по tournament, как раньше).
  function allMatchesCount(tatamiId: number) {
    return allMatches.filter(
      (m) => m.tatami === tatamiId && m.status !== "finished" && m.status !== "bye"
    ).length
  }

  // Phase 1: производные данные — useMemo, чтобы unrelated state
  // (палитра, модалки, ввод счёта) не пересчитывал их заново,
  // а memo-дети (NextActionCard, AttentionPanel) не ререндерились впустую.
  const sortedCats = useMemo(
    () => [...(tournament?.categories || [])].sort((a, b) => a.order - b.order),
    [tournament]
  )
  const allMatches = useMemo(
    () => sortedCats.flatMap((c) => (c.rounds || []).flatMap((r) => r.matches || [])),
    [sortedCats]
  )
  const liveCount = useMemo(
    () => allMatches.filter((m) => m.status === "in_progress" || m.status === "paused").length,
    [allMatches]
  )
  const participantCount = useMemo(
    () => sortedCats.reduce((n, c) => n + (c.athletes?.length || 0), 0),
    [sortedCats]
  )
  const fightsWithoutTatami = useMemo(
    () =>
      allMatches.filter(
        (m) =>
          (m.status === "ready" || m.status === "waiting") &&
          (m.tatami === null || m.tatami === undefined)
      ).length,
    [allMatches]
  )
  const fightsWithoutReferee = useMemo(
    () =>
      allMatches.filter(
        (m) =>
          (m.status === "ready" ||
            m.status === "in_progress" ||
            m.status === "paused") &&
          (m.referee === null || m.referee === undefined)
      ).length,
    [allMatches]
  )
  // Старые computeReadiness/computeHealth удалены: единый движок
  // (unifiedReadiness ниже) — единственный источник «что готово / что не так».
  // lib/nextStep и lib/controlCenter.computeHealth оставлены для совместимости
  // тестов, в UI не используются.
  // Производные данные — чистые функции manageDerived (покрыты тестами);
  // здесь только мемоизация поверх Query-снапшотов.
  // firstOpenCatId считает сам BracketsSection, метрики drawer — CategoryDrawer.

  // Phase 2a: строки таблицы категорий + явка по данным registrations.
  const regsById = useMemo(() => {
    const m = new Map<number, boolean>()
    for (const r of regs ?? []) m.set(r.athlete_id, r.checked_in)
    return m
  }, [regs])
  // Ростeр для CheckinPanel и weigh-in метрик: id → категории с лимитами.
  const weighinRoster = useMemo(() => buildWeighinRoster(sortedCats), [sortedCats])
  const weighin = useMemo(
    () => computeWeighin(regs, weighinRoster),
    [regs, weighinRoster]
  )
  // Единый источник истины для главного экрана, вкладки «Обзор» и диалога
  // публикации. computeWeighin выше — data-уровень (числа для KPI), не
  // конкурирующий источник «что не так».
  const unifiedReadiness = useMemo(
    () =>
      computeTournamentReadiness(
        buildReadinessInput({
          status: tournament?.status ?? "draft",
          startDate: tournament?.start_date ?? null,
          sortedCats,
          tatamiCount: tatamis.length,
          fightsWithoutTatami,
          fightsWithoutReferee,
          regs,
          weighinRoster,
        })
      ),
    [
      tournament,
      sortedCats,
      tatamis.length,
      fightsWithoutTatami,
      fightsWithoutReferee,
      regs,
      weighinRoster,
    ]
  )
  const weightById = useMemo(() => {
    const m = new Map<number, string | null>()
    for (const r of regs ?? []) m.set(r.athlete_id, r.weight_actual)
    return m
  }, [regs])
  const categoryRows = useMemo(
    () =>
      buildCategoryRows({ sortedCats, regs, regsById, weightById, tatamis }),
    [sortedCats, regs, regsById, weightById, tatamis]
  )
  // Phase 2B: drawer категории (метрики считает сам CategoryDrawer).
  const [drawerCatId, setDrawerCatId] = useState<number | null>(null)
  const drawerCat = useMemo(
    () => sortedCats.find((c) => c.id === drawerCatId) ?? null,
    [sortedCats, drawerCatId]
  )

  // Phase 2B: handoff выбранных категорий в генератор документов.
  const [docPrefill, setDocPrefill] = useState<DocumentPrefill | null>(null)

  // Bulk-выбор категорий и массовые действия — отдельный хук (decomposition):
  // page владеет данными и навигацией, оркестрация bulk — в хуке.
  const bulk = useBulkCategoryActions({
    tournamentId,
    sortedCats,
    regs,
    regsById,
    onChanged: fetchData,
    onBulkDocuments: (prefill) => {
      setDocPrefill(prefill)
      switchTab("documents")
    },
  })

  // Бои/сетки, татами и жизненный цикл — отдельные хуки. Общий стейт
  // confirm-диалога создаётся здесь один раз и раздаётся стабильным setConfirm.
  // Порядок: categories раньше tatami (тот берёт его setMembersBusy).
  const confirmCtl = useManageConfirm()
  const match = useMatchMutations({
    tournamentId,
    sortedCats,
    regs,
    tatamiCount: tatamis.length,
    onChanged: fetchData,
    openConfirm: confirmCtl.setConfirm,
  })
  // Категории/раунды/состав — отдельные хуки. membersBusy живёт в
  // useCategoryActions; читатели JSX ниже используют categories.membersBusy.
  const categories = useCategoryActions({
    tournament,
    onChanged: fetchData,
    setMatchMsg: match.setMatchMsg,
  })
  const rounds = useRoundActions({
    tournament,
    onChanged: fetchData,
  })
  const tatami = useTatamiActions({
    tournamentId,
    tournament,
    tatamis,
    onChanged: fetchData,
    openConfirm: confirmCtl.setConfirm,
    setMembersBusy: categories.setMembersBusy,
    onMatchError: match.reportError,
  })
  const lifecycle = useTournamentLifecycle({
    confirm: confirmCtl,
    tournament,
    tournamentId,
    blockers: unifiedReadiness.blockers,
    onChanged: fetchData,
    onDistributeMsg: tatami.setDistributeMsg,
    doReopenMatch: match.doReopenMatch,
    doDeleteTatami: tatami.doDeleteTatami,
    gotoTab: (t) => switchTab(t),
  })
  useModalBehavior(
    lifecycle.tplModal !== null,
    () => lifecycle.setTplModal(null),
    tplPanelRef
  )
  useModalBehavior(
    categories.catModal !== null,
    () => categories.closeCatModal(),
    catPanelRef
  )
  useModalBehavior(
    rounds.roundModal !== null,
    () => rounds.closeRoundModal(),
    roundPanelRef
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 rounded-lg bg-light-gray animate-pulse" aria-hidden="true" />
        <SkeletonGrid count={4} label="Загрузка турнира…" />
      </div>
    )
  }

  if (!tournament) {
    const offline =
      typeof navigator !== "undefined" && !navigator.onLine
    if (loadError?.status === 403) {
      return (
        <ErrorRetry
          title="Нет доступа к управлению"
          hint="Вы не организатор этого турнира. Попросите владельца добавить вас или откройте публичную страницу."
          retryLabel="К моим турнирам"
          onRetry={() => router.push("/cabinet/tournaments")}
        />
      )
    }
    return (
      <ErrorRetry
        title={offline ? "Нет соединения" : "Турнир не найден"}
        hint={
          offline
            ? "Проверьте интернет и попробуйте ещё раз"
            : "Проверьте ссылку или соединение — возможно, турнир удалён"
        }
        onRetry={() => void fetchData()}
      />
    )
  }

  // Производные данные — useMemo выше; секции считают своё сами.

  // Главный action — unifiedReadiness.nextAction (единый движок).

  const focusAnnounce = () => {
    const el = document.getElementById("announce-input")
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
    el?.focus({ preventScroll: true })
  }

  // Если турнир уже идёт — см. эффект выше (авто-LIVE до ручного выбора таба).
  const switchTab = (t: ManageTab) => {
    tabTouched.current = true
    setTab(t)
    // Сообщение операции относится к прошлой вкладке — не тащим его дальше.
    tatami.clearDistributeMsg()
    // URL отражает таб — ссылкой можно делиться.
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", t)
      if (t !== "schedule") url.searchParams.delete("view")
      else if (scheduleView === "live") url.searchParams.set("view", "live")
      window.history.replaceState(null, "", url.toString())
    } catch {
      /* ignore */
    }
  }

  const changeScheduleView = (v: ScheduleView) => {
    setScheduleView(v)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", "schedule")
      if (v === "live") url.searchParams.set("view", "live")
      else url.searchParams.delete("view")
      window.history.replaceState(null, "", url.toString())
    } catch {
      /* ignore */
    }
  }

  const goScheduleLive = () => {
    tabTouched.current = true
    setTab("schedule")
    setScheduleView("live")
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", "schedule")
      url.searchParams.set("view", "live")
      window.history.replaceState(null, "", url.toString())
    } catch {
      /* ignore */
    }
  }

  // Phase 2: выполнение единственного рекомендованного действия единого
  // движка (NextActionCard/IssuesCenter). NextActionTarget покрывает
  // wizard/publish/табы — ветвление одно на всех.
  const runUnifiedTarget = (target: NextActionTarget) => {
    if (target === "wizard") {
      setWizardOpen(true)
    } else if (target === "publish") {
      void lifecycle.handlePublishToggle()
    } else {
      switchTab(target)
    }
  }

  // Контекст единой палитры (QuickNav — единственный владелец Ctrl+K):
  // табы турнира + действия + живой поиск. Статика — те же команды,
  // что были в удалённом CommandPalette. Массив дешёвый, memo не нужен.
  const paletteContext: PaletteItem[] = [
      { id: "tab-overview", label: "Открыть: обзор", hint: "Control Center", run: () => switchTab("overview") },
      { id: "tab-participants", label: "Открыть: участники и явка", hint: "Check-in", run: () => switchTab("participants") },
      { id: "tab-weighin", label: "Открыть: взвешивание", hint: "Вес", run: () => switchTab("weighin") },
      { id: "tab-categories", label: "Открыть: категории", hint: "Состав, сетки", run: () => switchTab("categories") },
      { id: "tab-schedule", label: "Открыть: расписание", hint: "Татами, план", run: () => switchTab("schedule") },
      { id: "tab-live", label: "Открыть: LIVE", hint: "Очереди татами", run: () => goScheduleLive() },
      { id: "tab-brackets", label: "Открыть: сетки", hint: "Раунды и бои", run: () => switchTab("brackets") },
      { id: "tab-staff", label: "Открыть: судьи", hint: "Назначения", run: () => switchTab("staff") },
      { id: "tab-communication", label: "Открыть: связь", hint: "Объявления", run: () => switchTab("communication") },
      { id: "tab-documents", label: "Открыть: документы", hint: "Справки, печать", run: () => switchTab("documents") },
      { id: "tab-settings", label: "Открыть: настройки", hint: "Турнир", run: () => switchTab("settings") },
      ...(tournament?.slug
        ? [
            { id: "go-board", label: "Открыть: табло зала", hint: "Scoreboard", run: () => router.push(`/tournaments/${tournament.slug}/board`) },
            { id: "go-public", label: "Открыть: публичная страница", hint: "Вид зрителя", run: () => router.push(`/tournaments/${tournament.slug}`) },
          ]
        : []),
      { id: "act-export-xlsx", label: "Экспорт: протокол XLSX", hint: "Скачать", run: () => { window.location.href = `${apiBaseUrl()}/api/tournament/tournaments/${params.id}/export_xlsx/` } },
      { id: "act-export-csv", label: "Экспорт: протокол CSV", hint: "Скачать", run: () => { window.location.href = `${apiBaseUrl()}/api/tournament/tournaments/${params.id}/export_csv/` } },
      { id: "act-announce", label: "Объявить", hint: "Сообщение залу", run: () => focusAnnounce() },
    ]

  const paletteSearch = async (q: string): Promise<PaletteItem[]> => {
    try {
      const [a, t] = await Promise.all([
        api<Athlete[] | { results: Athlete[] }>(`/api/tournament/athletes/?search=${encodeURIComponent(q)}`),
        api<Tournament[] | { results: Tournament[] }>(`/api/tournament/tournaments/?search=${encodeURIComponent(q)}`),
      ])
      return [
        ...unwrapList(a)
          .slice(0, 5)
          .map((x) => ({
            id: `athlete-${x.id}`,
            label: `${x.last_name} ${x.first_name}`,
            hint: "Спортсмен",
            run: () => router.push(`/athletes/${x.id}`),
          })),
        ...unwrapList(t)
          .slice(0, 5)
          .map((x) => ({
            id: `tournament-${x.id}`,
            label: x.name,
            hint: "Турнир",
            run: () => router.push(`/cabinet/tournaments/${x.id}/manage`),
          })),
      ]
    } catch {
      return []
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 px-4 sm:px-6 pb-10">
      <QuickNav
        hideTrigger
        contextLabel={tournament ? `Турнир: ${tournament.name}` : "Турнир"}
        contextEntries={paletteContext}
        onSearch={paletteSearch}
      />
      <ManageHeader
        tournament={tournament}
        tournamentId={params.id as string}
        participantCount={participantCount}
        fightsCount={allMatches.length}
        tatamisCount={tatamis.length}
        liveCount={liveCount}
        distributing={tatami.distributing}
        distributeMsg={tatami.distributeMsg}
        onRetryDistribute={() => void fetchData()}
        onBack={() => router.back()}
        primaryAction={
          <>
            {tournament?.status !== "finished" && (
              <Button onClick={() => setWizardOpen(true)} size="sm" className="gap-1.5 h-8 text-xs">
                <Wand2 size={14} aria-hidden="true" />
                Подготовить турнир
              </Button>
            )}
            {tournament?.status === "finished" && tournament.slug ? (
              <Link href={`/tournaments/${tournament.slug}`}>
                <Button size="sm" className="gap-1.5 h-8 text-xs">
                  <Swords size={14} />
                  Открыть результаты
                </Button>
              </Link>
            ) : tournament?.status === "published" ? (
              <Button onClick={goScheduleLive} size="sm" className="gap-1.5 h-8 text-xs">
                <Radio size={14} />
                Открыть LIVE
              </Button>
            ) : (
              <Button onClick={() => switchTab("categories")} size="sm" className="gap-1.5 h-8 text-xs">
                <PlayCircle size={14} />
                Продолжить настройку
              </Button>
            )}
          </>
        }
        onDistributeTatamis={tatami.handleDistributeTatamis}
        onDistributeCategories={tatami.handleDistributeCategories}
        onEnsureTatamis={tatami.handleEnsureTatamis}
        onAddCategory={categories.handleAddCategory}
        onTemplate={() => lifecycle.openTemplateModal()}
        onPalette={() => openPalette()}
      />

      <NextActionCard
        action={unifiedReadiness.nextAction}
        tournamentFinished={tournament?.status === "finished"}
        onRun={runUnifiedTarget}
      />

      <AnnounceBar tournamentId={params.id as string} />

      <ReadinessOverview
        readiness={unifiedReadiness}
        onGo={(t: ManageTabId) => switchTab(t)}
      />

      <IssuesCenter
        issues={unifiedReadiness.issues}
        onResolve={runUnifiedTarget}
      />

      <TournamentNavigation
        tabs={MANAGE_TABS(participantCount, liveCount)}
        active={tab}
        tabRefs={tabRefs}
        onSelect={(id) => {
          if (isManageTab(id)) switchTab(id)
        }}
      />

      <div
        role="tabpanel"
        id={`manage-panel-${tab}`}
        aria-labelledby={`manage-tab-${tab}`}
      >
      {tab === "overview" && tournament && (
        <OverviewPanel
          readiness={unifiedReadiness}
          participantCount={participantCount}
          categoriesCount={sortedCats.length}
          bracketsBuilt={sortedCats.filter((c) => (c.rounds || []).length > 0).length}
          weighin={weighin}
          unrefereedCount={fightsWithoutReferee}
          tatamisCount={tatamis.length}
          liveCount={liveCount}
          slug={tournament.slug}
          tournamentId={params.id as string}
          tournament={tournament}
          onTab={(t) => switchTab(t)}
          onAnnounce={focusAnnounce}
        />
      )}

      {tab === "schedule" && (
        <ScheduleSection
          tournamentId={params.id as string}
          view={scheduleView}
          onViewChange={changeScheduleView}
          tatamis={tatamis}
          sortedCats={sortedCats}
          tatamiLiveCount={allMatchesCount}
          onAddTatami={() => void tatami.handleAddTatami()}
          onDeleteTatami={tatami.handleDeleteTatami}
          dataUpdatedAt={dataUpdatedAt}
        />
      )}

      {tab === "brackets" && (
        <BracketsSection
          tournamentId={params.id as string}
          sortedCats={sortedCats}
          athletes={athletes}
          tatamis={tatamis}
          regs={regs}
          tatamiCount={tatamis.length}
          startingRoundId={match.startingRoundId}
          finishingId={match.finishingId}
          membersBusy={categories.membersBusy}
          matchMsg={match.matchMsg}
          onRetry={() => void fetchData()}
          onCategoryDuration={match.handleCategoryDuration}
          onDurationError={(msg) => match.setMatchMsg({ ok: false, text: msg })}
          onCategoryTatami={tatami.handleCategoryTatami}
          onEditCategory={categories.openEditCategory}
          onAddRound={(cat) => void rounds.handleAddRound(cat)}
          onGenerateBracket={(cat) => void match.handleGenerateBracket(cat)}
          onStartRound={(round) => void match.handleStartRound(round)}
          onAddMatch={(round) => void match.handleAddMatch(round)}
          onGoSchedule={goScheduleLive}
          onPatch={match.handleUpdateMatch}
          onScoreDraft={match.applyLocalMatchUpdate}
          onFinish={match.handleFinishMatch}
          onReopen={match.handleReopenMatch}
        />
      )}

      {tab === "staff" && (
        <StaffSection
          tournamentId={params.id as string}
          tournament={tournament}
          tatamis={tatamis}
          onAssigned={(matchId, refereeId, refereeName) =>
            match.applyLocalMatchUpdate(matchId, {
              referee: refereeId,
              referee_name: refereeName,
            })
          }
        />
      )}

      {tab === "communication" && (
        <CommunicationSection tournamentId={params.id as string} />
      )}

      {tab === "documents" && (
        <DocumentsSection
          tournament={tournament}
          categories={sortedCats}
          prefill={docPrefill}
          onPrefillConsumed={() => setDocPrefill(null)}
        />
      )}

      {tab === "settings" && (
        <SettingsSection
          tournament={tournament}
          onPublishToggle={() => void lifecycle.handlePublishToggle()}
          onFinish={() => void lifecycle.handleFinishTournament()}
          onDelete={() => void lifecycle.handleDeleteTournament()}
          onSaveMatsCount={tatami.handleSaveMatsCount}
          onOpenTemplate={() => lifecycle.openTemplateModal()}
        />
      )}

      {tab === "participants" && (
        <ParticipantsPanel
          tournamentId={params.id as string}
          checkinRefreshKey={bulk.checkinRefreshKey}
          weighinRoster={weighinRoster}
          sortedCats={sortedCats}
          athletes={athletes}
          membersBusy={categories.membersBusy}
          addSel={categories.addSel}
          setAddSel={categories.setAddSel}
          matchMsg={match.matchMsg}
          onRetryMatchMsg={() => void fetchData()}
          onGenerateBracket={(cat) => void match.handleGenerateBracket(cat)}
          onMoveSeed={(cat, id, dir) => void categories.handleMoveSeed(cat, id, dir)}
          onRemoveFromCategory={(cat, a) => void categories.handleRemoveFromCategory(cat, a)}
          onAddToCategory={(cat) => void categories.handleAddToCategory(cat)}
        />
      )}

      {tab === "weighin" && (
        <WeighInSection
          tournamentId={params.id as string}
          regs={regs}
          roster={weighinRoster}
          onSaved={() => {
            bulk.bumpCheckinRefresh()
            void fetchData()
          }}
        />
      )}

      {tab === "categories" && (
      <CategoriesPanel
        sortedCats={sortedCats}
        categoryRows={categoryRows}
        effectiveSelectedCats={bulk.effectiveSelectedCats}
        onToggleCatSelect={bulk.toggleCatSelect}
        onToggleCatSelectAll={bulk.toggleCatSelectAll}
        bulkMsg={bulk.bulkMsg}
        bulkBusy={bulk.bulkBusy}
        failedCheckin={bulk.failedCheckin}
        failedUncheck={bulk.failedUncheck}
        uncheckConfirm={bulk.uncheckConfirm}
        onCloseUncheckConfirm={() => bulk.closeUncheckConfirm()}
        onRetryBulk={() => void fetchData()}
        onRetryFailedCheckin={() => void bulk.handleRetryFailedCheckin()}
        onRetryFailedUncheck={() => void bulk.handleRetryFailedUncheck()}
        onRunBulkUncheck={(ids, names) => void bulk.runBulkUncheck(ids, names)}
        onBulkExport={bulk.handleBulkExport}
        onBulkDocuments={bulk.handleBulkDocuments}
        onBulkCheckin={() => void bulk.handleBulkCheckin()}
        onBulkUncheck={bulk.handleBulkUncheck}
        onClearBulkSelection={bulk.clearBulkSelection}
        onOpenCategory={(id) => {
          bulk.clearBulkMsg()
          setDrawerCatId(id)
        }}
        onGenerateBracket={(cat) => void match.handleGenerateBracket(cat)}
      />
      )}
      </div>

      {categories.catModal && (
        <CategoryDialog
          modal={categories.catModal}
          error={categories.catModalError}
          saving={categories.catModalSaving}
          categories={sortedCats}
          panelRef={catPanelRef}
          onClose={() => categories.closeCatModal()}
          onSubmit={(e) => void categories.handleSaveCategory(e)}
          onPatch={(patch) => {
            const cur = categories.catModal
            if (cur) categories.setCatModal({ ...cur, ...patch })
          }}
        />
      )}

      {rounds.roundModal && (
        <RoundDialog
          modal={rounds.roundModal}
          error={rounds.roundModalError}
          saving={rounds.roundModalSaving}
          panelRef={roundPanelRef}
          onClose={() => rounds.closeRoundModal()}
          onSubmit={(e) => void rounds.handleSaveRound(e)}
          onNameChange={(name) => {
            const cur = rounds.roundModal
            if (cur) rounds.setRoundModal({ ...cur, name })
          }}
        />
      )}

      {lifecycle.tplModal && (
        <TemplateDialog
          name={lifecycle.tplModal.name}
          error={lifecycle.tplModalError}
          saving={lifecycle.tplModalSaving}
          panelRef={tplPanelRef}
          onClose={() => lifecycle.setTplModal(null)}
          onSubmit={(e) => void lifecycle.handleSaveTemplate(e)}
          onNameChange={(name) => lifecycle.setTplModal({ name })}
        />
      )}

      {lifecycle.confirm && (
        <ManageConfirmDialog
          confirm={lifecycle.confirm}
          busy={lifecycle.confirmBusy}
          onCancel={() => {
            if (!lifecycle.confirmBusy) lifecycle.openConfirm(null)
          }}
          onRun={() => void lifecycle.runConfirm()}
        />
      )}

      <CategoryDrawer
        open={drawerCatId !== null}
        category={drawerCat}
        regs={regs}
        tatamis={tatamis}
        tatamiBusy={categories.membersBusy === `ctat-${drawerCatId}`}
        regsById={regsById}
        onClose={() => setDrawerCatId(null)}
        onGenerateBracket={() => {
          const cat = sortedCats.find((c) => c.id === drawerCatId)
          if (cat) void match.handleGenerateBracket(cat)
        }}
        onCategoryTatami={(tatamiId) => {
          const cat = sortedCats.find((c) => c.id === drawerCatId)
          if (cat) void tatami.handleCategoryTatami(cat, tatamiId)
        }}
        onEdit={() => {
          const cat = sortedCats.find((c) => c.id === drawerCatId)
          setDrawerCatId(null)
          if (cat) categories.openEditCategory(cat)
        }}
        onAddRound={() => {
          const cat = sortedCats.find((c) => c.id === drawerCatId)
          setDrawerCatId(null)
          if (cat) void rounds.handleAddRound(cat)
        }}
        onGoSchedule={() => {
          setDrawerCatId(null)
          goScheduleLive()
        }}
        onGoBrackets={() => {
          setDrawerCatId(null)
          switchTab("brackets")
        }}
      />

      {wizardOpen && tournament && (
        <TournamentSetupWizard
          open
          onClose={() => {
            setWizardOpen(false)
            void fetchData()
          }}
          tournamentId={params.id as string}
        />
      )}
    </div>
  )
}