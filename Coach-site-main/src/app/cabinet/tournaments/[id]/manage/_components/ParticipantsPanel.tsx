"use client"

import { useState } from "react"
import { Plus, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CheckinPanel, type CheckinRosterEntry } from "@/components/CheckinPanel"
import { FriendlyError } from "@/components/ui/FriendlyError"
import type { Athlete, TournamentCategory } from "@/lib/types"

interface ParticipantsPanelProps {
  tournamentId: string | number
  checkinRefreshKey: number
  weighinRoster: CheckinRosterEntry[]
  sortedCats: TournamentCategory[]
  athletes: Athlete[]
  membersBusy: string | null
  addSel: Record<number, string>
  setAddSel: React.Dispatch<React.SetStateAction<Record<number, string>>>
  matchMsg: { ok: boolean; text: string } | null
  onRetryMatchMsg: () => void
  onGenerateBracket: (cat: TournamentCategory) => void
  onMoveSeed: (cat: TournamentCategory, athleteId: number, dir: -1 | 1) => void
  onRemoveFromCategory: (cat: TournamentCategory, athlete: Athlete) => void
  onAddToCategory: (cat: TournamentCategory) => void
}

/** Участники: явка/взвешивание + состав категорий с посевом.
 * Логика в page (handlers) и CheckinPanel; здесь только layout секции. */
export function ParticipantsPanel({
  tournamentId,
  checkinRefreshKey,
  weighinRoster,
  sortedCats,
  athletes,
  membersBusy,
  addSel,
  setAddSel,
  matchMsg,
  onRetryMatchMsg,
  onGenerateBracket,
  onMoveSeed,
  onRemoveFromCategory,
  onAddToCategory,
}: ParticipantsPanelProps) {
  // Длинные составы сворачиваются после первых 20 чипов.
  // Чипы НЕ размонтируются (hidden) — индексы посева и обработчики целы.
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())
  const toggleExpanded = (catId: number) => {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }
  return (
    <div className="space-y-3">
      {matchMsg &&
        (matchMsg.ok ? (
          <div
            role="status"
            className="p-3 rounded-xl border text-sm font-medium bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300"
          >
            {matchMsg.text}
          </div>
        ) : (
          <FriendlyError message={matchMsg.text} onRetry={onRetryMatchMsg} />
        ))}
      {/* Фаза 2: явка — все заявленные в категории спортсмены турнира.
          Перевес: тянем категории с лимитами веса для CheckinPanel. */}
      <CheckinPanel
        tournamentId={tournamentId}
        refreshKey={checkinRefreshKey}
        roster={weighinRoster}
      />
      {sortedCats.length === 0 && (
        <div className="rounded-2xl border border-border bg-white p-4 text-sm text-secondary-text shadow-sm dark:bg-[#0E2035]">
          Категорий пока нет — создайте первую кнопкой «Категорию» выше.
        </div>
      )}
      {sortedCats.map((cat) => {
        const inCat = new Set((cat.athletes || []).map((a) => a.id))
        const available = athletes.filter((a) => !inCat.has(a.id))
        const frozen = (cat.rounds || []).length > 0
        const members = cat.athletes || []
        const expanded = expandedCats.has(cat.id)
        const CHIP_LIMIT = 20
        return (
          <div key={cat.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <div>
                <h3 className="font-bold text-dark-text dark:text-slate-100">{cat.name}</h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {(cat.athletes || []).length} уч. ·{" "}
                  {frozen ? "сетка построена — состав заморожен" : "сетки нет — состав можно менять"}
                </p>
              </div>
              {!frozen && (cat.athletes || []).length >= 2 && (
                <Button onClick={() => onGenerateBracket(cat)} size="sm" variant="secondary" className="gap-1.5 h-8 text-xs">
                  <Swords size={14} />
                  Сформировать сетку
                </Button>
              )}
            </div>
            {(cat.athletes || []).length === 0 ? (
              <p className="text-sm text-secondary-text py-2">В категории пока никого нет.</p>
            ) : (
              <>
              <div className="flex flex-wrap gap-2 py-2">
                {members.map((a, idx, arr) => (
                  <span
                    key={a.id}
                    style={!expanded && idx >= CHIP_LIMIT ? { display: "none" } : undefined}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-light-gray pl-3 pr-1.5 py-1.5 text-sm font-semibold text-dark-text dark:bg-white/[0.04] dark:text-slate-100"
                  >
                    {!frozen && arr.length > 1 && (
                      <span className="inline-flex flex-col leading-none mr-0.5">
                        <button
                          type="button"
                          disabled={idx === 0 || membersBusy === `seed-${cat.id}`}
                          onClick={() => onMoveSeed(cat, a.id, -1)}
                          aria-label={`Выше в посеве: ${a.last_name}`}
                          title="Выше в посеве (первый номер — топ)"
                          className="h-5 w-6 flex items-center justify-center text-[10px] text-secondary-text hover:text-primary-blue disabled:opacity-30 cursor-pointer"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === arr.length - 1 || membersBusy === `seed-${cat.id}`}
                          onClick={() => onMoveSeed(cat, a.id, 1)}
                          aria-label={`Ниже в посеве: ${a.last_name}`}
                          title="Ниже в посеве"
                          className="h-5 w-6 flex items-center justify-center text-[10px] text-secondary-text hover:text-primary-blue disabled:opacity-30 cursor-pointer"
                        >
                          ▼
                        </button>
                      </span>
                    )}
                    {idx === 0 && (cat.athletes || []).length > 1 && (
                      <span
                        title="Топ посева — BYE достанутся первым"
                        className="text-[10px] font-extrabold uppercase tracking-wider text-gold"
                      >
                        №1
                      </span>
                    )}
                    {a.last_name} {a.first_name}
                    {!frozen && (
                      <button
                        type="button"
                        disabled={membersBusy === `rm-${cat.id}-${a.id}`}
                        onClick={() => onRemoveFromCategory(cat, a)}
                        aria-label={`Убрать ${a.last_name}`}
                         className="w-7 h-7 rounded-lg flex items-center justify-center text-secondary-text hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 dark:hover:bg-red-500/15"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {members.length > CHIP_LIMIT && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(cat.id)}
                  aria-expanded={expanded}
                  className="mt-1 inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
                >
                  {expanded ? "Свернуть" : `Показать всех (${members.length})`}
                </button>
              )}
              </>
            )}
            {!frozen && available.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <select
                  value={addSel[cat.id] ?? ""}
                  onChange={(e) => setAddSel((p) => ({ ...p, [cat.id]: e.target.value }))}
                  aria-label={`Добавить спортсмена в категорию ${cat.name}`}
                  className="h-9 px-3 text-sm rounded-xl border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 dark:bg-white/5 dark:text-white"
                >
                  <option value="">Добавить спортсмена...</option>
                  {available.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.last_name} {a.first_name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => onAddToCategory(cat)}
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
  )
}
