"use client"

import { memo, useState } from "react"
import { RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import type { Athlete, Match } from "@/lib/types"

function parseScoreInput(value: string): number | null {
  const v = value.trim()
  if (v === "") return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function statusLabel(status: Match["status"]): string {
  return status === "finished"
    ? "Завершён"
    : status === "in_progress"
      ? "В процессе"
      : status === "ready"
        ? "Готов"
        : status === "bye"
          ? "BYE"
          : "Ожидает"
}

interface MatchCardProps {
  match: Match
  athletes: Athlete[]
  finishing: boolean
  /** Debounced серверный PATCH (селекты, коммит счёта/времени, победитель). */
  onPatch: (match: Match, updates: Partial<Match>) => void
  /** Только оптимистичное локальное обновление (ввод счёта, без запроса). */
  onScoreDraft: (matchId: number, updates: Partial<Match>) => void
  onFinish: (match: Match) => void
  onReopen: (match: Match) => void
}

/** Phase 2a: карточка боя с локальным draft-state.
 * Ввод счёта/времени меняет только state карточки — родитель (и все
 * соседние карточки) не ререндерятся на каждую клавишу. Серверный PATCH
 * уходит через onPatch: для счёта — на blur, для времени — на blur/Enter,
 * для селектов — сразу (дискретное изменение, draft не нужен).
 * memo работает, пока родитель передаёт стабильные match/athletes/callbacks:
 * applyLocalMatchUpdate создаёт новый объект только изменённому бою. */
function MatchCard({
  match,
  athletes,
  finishing,
  onPatch,
  onScoreDraft,
  onFinish,
  onReopen,
}: MatchCardProps) {
  const [score1Draft, setScore1Draft] = useState(() => String(match.score1 ?? ""))
  const [score2Draft, setScore2Draft] = useState(() => String(match.score2 ?? ""))
  const [startDraft, setStartDraft] = useState(() => match.start_time || "")
  const [endDraft, setEndDraft] = useState(() => match.end_time || "")
  // Ресинк с внешним match — паттерном «adjust state during render»
  // (без setState в effect): подтягиваем только реально изменившиеся поля,
  // чтобы не затирать текущий ввод в соседних полях.
  const [synced, setSynced] = useState(match)
  if (match !== synced) {
    setSynced(match)
    if (match.score1 !== synced.score1) setScore1Draft(String(match.score1 ?? ""))
    if (match.score2 !== synced.score2) setScore2Draft(String(match.score2 ?? ""))
    if (match.start_time !== synced.start_time) setStartDraft(match.start_time || "")
    if (match.end_time !== synced.end_time) setEndDraft(match.end_time || "")
  }

  const commitScore = (side: 1 | 2, text: string) => {
    const v = parseScoreInput(text)
    const current = side === 1 ? match.score1 : match.score2
    if (v === null) {
      // Невалидный ввод — возвращаем последнее сохранённое значение.
      if (side === 1) setScore1Draft(String(current ?? ""))
      else setScore2Draft(String(current ?? ""))
      return
    }
    if (v !== current) {
      if (side === 1) onPatch(match, { score1: v })
      else onPatch(match, { score2: v })
    }
  }

  const commitTime = (field: "start_time" | "end_time", text: string) => {
    const current = (match[field] || "") as string
    if (text !== current) onPatch(match, { [field]: text || null } as Partial<Match>)
  }

  const handleAthlete = (field: "athlete1" | "athlete2", raw: string) => {
    const v = raw === "" ? null : Number(raw)
    if (v !== null && !Number.isInteger(v)) return
    onPatch(match, { [field]: v } as Partial<Match>)
  }

  return (
    <div className="p-3 bg-light-gray rounded-xl border border-border space-y-3 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-secondary-text">Матч #{match.match_number}</span>
        <div className="flex items-center gap-1.5 text-xs text-secondary-text">
          <label>
            Начало
            <input
              type="time"
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
              onBlur={(e) => commitTime("start_time", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              }}
              className="ml-1 p-1 text-xs rounded border border-border bg-white dark:bg-white/5 dark:text-white"
              title="Время начала матча"
              aria-label={`Время начала матча ${match.match_number}`}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            Конец
            <input
              type="time"
              value={endDraft}
              onChange={(e) => setEndDraft(e.target.value)}
              onBlur={(e) => commitTime("end_time", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              }}
              className="ml-1 p-1 text-xs rounded border border-border bg-white dark:bg-white/5 dark:text-white"
              title="Время окончания матча"
              aria-label={`Время окончания матча ${match.match_number}`}
            />
          </label>
        </div>
        <StatusPill status={match.status} label={statusLabel(match.status)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <select
            value={match.athlete1 || ""}
            aria-label={`Первый участник матча ${match.match_number}`}
            onChange={(e) => handleAthlete("athlete1", e.target.value)}
            className="w-full p-2 text-xs rounded-lg border border-border bg-white dark:bg-white/5 dark:text-white"
          >
            <option value="">Выберите атлета 1</option>
            {athletes.map(a => (
              <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
            ))}
          </select>
          <input
            type="number"
            value={score1Draft}
            min={0}
            aria-label={`Счёт первого участника, матч ${match.match_number}`}
            onChange={(e) => {
              setScore1Draft(e.target.value)
              const v = parseScoreInput(e.target.value)
              if (v === null) return
              onScoreDraft(match.id, { score1: v })
            }}
            onBlur={(e) => commitScore(1, e.target.value)}
            className="w-full p-2 text-xs rounded-lg border border-border bg-white text-center font-bold dark:bg-white/5 dark:text-white"
          />
        </div>
        <div className="space-y-2">
          <select
            value={match.athlete2 || ""}
            aria-label={`Второй участник матча ${match.match_number}`}
            onChange={(e) => handleAthlete("athlete2", e.target.value)}
            className="w-full p-2 text-xs rounded-lg border border-border bg-white dark:bg-white/5 dark:text-white"
          >
            <option value="">Выберите атлета 2</option>
            {athletes.map(a => (
              <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
            ))}
          </select>
          <input
            type="number"
            value={score2Draft}
            min={0}
            aria-label={`Счёт второго участника, матч ${match.match_number}`}
            onChange={(e) => {
              setScore2Draft(e.target.value)
              const v = parseScoreInput(e.target.value)
              if (v === null) return
              onScoreDraft(match.id, { score2: v })
            }}
            onBlur={(e) => commitScore(2, e.target.value)}
            className="w-full p-2 text-xs rounded-lg border border-border bg-white text-center font-bold dark:bg-white/5 dark:text-white"
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2">
        <select
          value={match.winner || ""}
          aria-label={`Победитель матча ${match.match_number}`}
          onChange={(e) => onPatch(match, { winner: Number(e.target.value) || null })}
          className="min-w-0 max-w-full text-xs p-1 rounded border border-border bg-white dark:bg-white/5 dark:text-white"
        >
          <option value="">Победитель</option>
          {athletes.map(a => (
            <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
          ))}
        </select>
        {match.status === "finished" ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50"
            disabled={finishing}
            onClick={() => onReopen(match)}
          >
            <RotateCcw size={12} />
            {finishing ? "Открытие..." : "Переоткрыть"}
          </Button>
        ) : match.status === "bye" ? null : (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50"
            disabled={finishing}
            onClick={() => onFinish(match)}
          >
            <Save size={12} />
            {finishing ? "Завершение..." : "Завершить"}
          </Button>
        )}
      </div>
    </div>
  )
}

export default memo(MatchCard)
