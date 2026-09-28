"use client"

import type { ReactNode } from "react"
import { ArrowLeft, Download, LayoutDashboard, Plus, RotateCcw, Save, Command } from "lucide-react"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import OverflowMenu from "@/components/ui/OverflowMenu"
import { FriendlyError } from "@/components/ui/FriendlyError"
import { apiBaseUrl } from "@/lib/api"
import type { Tournament } from "@/lib/types"

interface ManageHeaderProps {
  tournament: Tournament | null
  tournamentId: string | number
  participantCount: number
  fightsCount: number
  tatamisCount: number
  liveCount: number
  distributing: boolean
  distributeMsg: { ok: boolean; text: string } | null
  onRetryDistribute: () => void
  onBack: () => void
  /** Главная кнопка ряда (Подготовить / LIVE / Продолжить — решает page). */
  primaryAction: ReactNode
  onDistributeTatamis: () => void
  onDistributeCategories: () => void
  onEnsureTatamis: () => void
  onAddCategory: () => void
  onTemplate: () => void
  onPalette: () => void
}

/** Компактная шапка консоли: ряд 1 — идентичность+статус+primary,
 * ряд 2 — статистика и операционные действия. */
export function ManageHeader({
  tournament,
  tournamentId,
  participantCount,
  fightsCount,
  tatamisCount,
  liveCount,
  distributing,
  distributeMsg,
  onRetryDistribute,
  onBack,
  primaryAction,
  onDistributeTatamis,
  onDistributeCategories,
  onEnsureTatamis,
  onAddCategory,
  onTemplate,
  onPalette,
}: ManageHeaderProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2 text-secondary-text shrink-0"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            Назад
          </Button>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-text">
              Турнир · Control Center
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-dark-text truncate dark:text-slate-100">
              {tournament?.name}
            </h1>
            {tournament && (
              <p className="text-xs text-secondary-text mt-0.5">
                {new Date(`${tournament.start_date}T00:00:00`).toLocaleDateString("ru-RU")}
                {tournament.location ? ` · ${tournament.location}` : ""}
              </p>
            )}
          </div>
          {tournament && <StatusPill status={tournament.status} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">{primaryAction}</div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-label="Статистика турнира">
          {[
            { label: "Категории", value: tournament?.categories?.length || 0 },
            { label: "Спортсмены", value: participantCount },
            { label: "Бои", value: fightsCount },
            { label: "Татами", value: tatamisCount },
          ].map((s) => (
            <span key={s.label} className="inline-flex items-baseline gap-1.5">
              <span className="font-extrabold text-dark-text tabular-nums dark:text-slate-100">{s.value}</span>
              <span className="font-semibold text-secondary-text">{s.label}</span>
            </span>
          ))}
          {liveCount > 0 && (
            <StatusPill status="live" label={`LIVE · ${liveCount}`} pulse />
          )}
        </p>
        <span className="ms-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="Операционные действия">
          <Button onClick={onDistributeTatamis} disabled={distributing} className="gap-1.5 h-8 text-xs" variant="secondary" size="sm">
            <RotateCcw size={14} />
            {distributing ? "Распределение..." : "Распределить бои"}
          </Button>
          <Button
            onClick={onDistributeCategories}
            disabled={distributing || tatamisCount === 0}
            className="gap-1.5 h-8 text-xs"
            variant="secondary"
            size="sm"
            title="Равномерно разложить категории по татами (разница — максимум 1)"
          >
            <LayoutDashboard size={14} />
            Распределить категории
          </Button>
          {tatamisCount === 0 && (
            <Button onClick={onEnsureTatamis} disabled={distributing} className="gap-1.5 h-8 text-xs" size="sm">
              <Plus size={14} />
              Создать {Math.max(1, tournament?.mats_count ?? 1)} татами
            </Button>
          )}
          <Button onClick={onAddCategory} className="gap-1.5 h-8 text-xs" size="sm">
            <Plus size={14} />
            Категорию
          </Button>
          <OverflowMenu
            label="Ещё действия"
            items={[
              {
                label: "Протокол CSV",
                icon: <Download size={14} aria-hidden="true" />,
                href: `${apiBaseUrl()}/api/tournament/tournaments/${tournamentId}/export_csv/`,
              },
              {
                label: "Протокол XLSX",
                icon: <Download size={14} aria-hidden="true" />,
                title: "Форматированная таблица: победители жирным, BYE серым",
                href: `${apiBaseUrl()}/api/tournament/tournaments/${tournamentId}/export_xlsx/`,
              },
              {
                label: "В шаблон",
                icon: <Save size={14} aria-hidden="true" />,
                title: "Сохранить структуру (татами и категории) как шаблон для новых турниров",
                onSelect: onTemplate,
              },
              {
                label: "Командная палитра (Ctrl+K)",
                icon: <Command size={14} aria-hidden="true" />,
                onSelect: onPalette,
              },
            ]}
          />
        </span>
      </div>
      {distributeMsg &&
        (distributeMsg.ok ? (
          <div
            role="status"
            className="mt-3 p-3 rounded-xl border text-sm font-medium bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300"
          >
            {distributeMsg.text}
          </div>
        ) : (
          <div className="mt-3">
            <FriendlyError message={distributeMsg.text} onRetry={onRetryDistribute} />
          </div>
        ))}
    </div>
  )
}
