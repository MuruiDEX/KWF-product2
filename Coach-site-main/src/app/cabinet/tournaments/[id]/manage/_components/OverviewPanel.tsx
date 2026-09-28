"use client"

import { useMemo } from "react"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import KpiStrip from "@/components/KpiStrip"
import QuickActions from "@/components/QuickActions"
import AttentionPanel from "@/components/AttentionPanel"
import ActivityFeed from "@/components/ActivityFeed"
import type { HealthItem, WeighinMetrics } from "@/lib/controlCenter"
import type { ManageTabId } from "@/components/ReadinessChecklist"
import type {
  ReadinessSections,
  SectionStatus,
  TournamentIssue,
  TournamentReadiness,
} from "@/lib/readiness"
import type { Tournament } from "@/lib/types"

interface OverviewPanelProps {
  /** Единый движок — единственный источник «что готово / что не так». */
  readiness: TournamentReadiness
  participantCount: number
  categoriesCount: number
  bracketsBuilt: number
  weighin: WeighinMetrics | null
  unrefereedCount: number
  tatamisCount: number
  liveCount: number
  slug: string | null
  tournamentId: string | number
  tournament: Tournament | null
  onTab: (t: ManageTabId) => void
  onAnnounce: () => void
}

type CellStatus = "ok" | "attention" | "blocked"

interface HealthCell {
  id: ManageTabId
  label: string
  status: CellStatus
  sub: string
}

/** Единый визуальный язык: статус секции движка → статус ячейки обзора. */
export function toCellStatus(s: SectionStatus): CellStatus {
  if (s === "error") return "blocked"
  if (s === "needs_attention" || s === "in_progress") return "attention"
  return "ok"
}

/** Операционные ячейки из секций движка + счётчики (новой логики нет). */
export function buildHealthCells(props: {
  sections: ReadinessSections
  weighin: WeighinMetrics | null
  participantCount: number
  categoriesCount: number
  bracketsBuilt: number
  tatamisCount: number
  liveCount: number
  unrefereedCount: number
}): HealthCell[] {
  return [
    {
      id: "participants",
      label: "Check-in",
      status: toCellStatus(props.sections.participants),
      sub: `${props.participantCount} уч.`,
    },
    {
      id: "weighin",
      label: "Weigh-in",
      status: toCellStatus(props.sections.weighIn),
      sub: props.weighin
        ? `${props.weighin.weighed}/${props.weighin.total} · без веса ${props.weighin.unweighed}`
        : "—",
    },
    {
      id: "categories",
      label: "Категории",
      status: toCellStatus(props.sections.categories),
      sub: `${props.categoriesCount} кат.`,
    },
    {
      id: "schedule",
      label: "Расписание",
      status: toCellStatus(props.sections.schedule),
      sub:
        props.liveCount > 0
          ? `${props.tatamisCount} тат. · LIVE ${props.liveCount}`
          : `${props.tatamisCount} тат.`,
    },
    {
      id: "brackets",
      label: "Сетки",
      status: toCellStatus(props.sections.brackets),
      sub: `${props.bracketsBuilt}/${props.categoriesCount} готово`,
    },
    {
      id: "staff",
      label: "Судьи",
      status: toCellStatus(props.sections.judges),
      sub:
        props.unrefereedCount > 0
          ? `без судьи: ${props.unrefereedCount}`
          : "все назначены",
    },
  ]
}

/** Issues движка → формат AttentionPanel (ошибки первыми, порядок стабилен). */
export function issuesToAttention(issues: TournamentIssue[]): HealthItem[] {
  const rank = { error: 0, warn: 1 } as const
  return [...issues]
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .map((i) => ({
      id: i.id,
      severity: i.severity,
      text: i.title,
      tab: i.tab,
    }))
}

const STATUS_META: Record<CellStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", className: "text-success", Icon: CheckCircle2 },
  attention: { label: "Внимание", className: "text-amber-600 dark:text-amber-400", Icon: AlertTriangle },
  blocked: { label: "Blocked", className: "text-error", Icon: XCircle },
}

/** Обзор — command center: KPI + здоровье + действия + внимание/активность. */
export function OverviewPanel(props: OverviewPanelProps) {
  const {
    readiness,
    participantCount,
    categoriesCount,
    bracketsBuilt,
    weighin,
    unrefereedCount,
    tatamisCount,
    tournamentId,
    tournament,
    slug,
    liveCount,
    onTab,
    onAnnounce,
  } = props
  const cells = useMemo(
    () =>
      buildHealthCells({
        sections: readiness.sections,
        weighin,
        participantCount,
        categoriesCount,
        bracketsBuilt,
        tatamisCount,
        liveCount,
        unrefereedCount,
      }),
    [
      readiness,
      weighin,
      participantCount,
      categoriesCount,
      bracketsBuilt,
      tatamisCount,
      liveCount,
      unrefereedCount,
    ]
  )
  const attention = useMemo(
    () => issuesToAttention(readiness.issues),
    [readiness]
  )
  return (
    <div className="space-y-3">
      <KpiStrip
        items={[
          { label: "Участники", value: String(participantCount) },
          { label: "Категории", value: String(categoriesCount) },
          { label: "Взвешено", value: weighin ? String(weighin.weighed) : "—" },
          { label: "Без веса", value: weighin ? String(weighin.unweighed) : "—" },
          {
            label: "Перевес",
            value: weighin ? String(weighin.overweight) : "—",
            tone: weighin && weighin.overweight > 0 ? "warn" : "default",
          },
          {
            label: "Готовность",
            value: `${readiness.overall}%`,
            tone: "strong",
          },
        ]}
      />
      <div
        role="group"
        aria-label="Операционное здоровье"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {cells.map((c) => {
          const meta = STATUS_META[c.status]
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onTab(c.id)}
              title={`Открыть: ${c.label}`}
              className="rounded-xl border border-border bg-white px-3 py-2 text-left transition-colors cursor-pointer hover:bg-light-gray dark:bg-[#0E2035] dark:hover:bg-white/[0.06]"
            >
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-text">
                {c.label}
              </span>
              <span className={`mt-0.5 flex items-center gap-1 text-sm font-extrabold ${meta.className}`}>
                <meta.Icon size={14} aria-hidden="true" />
                {meta.label}
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-secondary-text tabular-nums">
                {c.sub}
              </span>
            </button>
          )
        })}
      </div>
      <QuickActions
        slug={slug}
        onAnnounce={onAnnounce}
      />
      <div className="grid gap-3 lg:grid-cols-2 items-start">
        <AttentionPanel
          health={attention}
          readiness={null}
          onGoTab={onTab}
        />
        <ActivityFeed tournamentId={tournamentId} tournament={tournament} />
      </div>
    </div>
  )
}
