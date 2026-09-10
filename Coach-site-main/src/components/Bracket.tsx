"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Trophy, Crown, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import StatusPill from "@/components/ui/StatusPill"

/* ---------------------------------- types --------------------------------- */

export interface BracketAthlete {
  id: number | null
  name: string | null
}

export interface BracketMatchData {
  id: number
  matchNumber: number
  roundName: string
  athlete1: BracketAthlete
  athlete2: BracketAthlete
  winnerId: number | null
  winnerName?: string | null
  score1?: number
  score2?: number
  status: string
  tatamiName?: string | null
  startTime?: string | null
  categoryName?: string | null
  prevIds: [number | null, number | null]
  isBye: boolean
}

export interface BracketRoundData {
  id: string | number
  name: string
  order: number
  status?: string
  matches: BracketMatchData[]
}

export function isRoundOpen(status?: string) {
  // Раунд открыт для боёв, если он стартовал (или статус неизвестен — старый формат).
  return status === undefined || status === "in_progress" || status === "finished"
}

export interface FinishPayload {
  winnerId: number
  score1: number
  score2: number
}

export interface MatchHistoryEntry {
  id: number
  actor_name: string | null
  action: string
  winner_name: string | null
  score1: number | null
  score2: number | null
  detail: string
  created_at: string
}

const HISTORY_ACTION_LABELS: Record<string, string> = {
  start: "Старт",
  pause: "Пауза",
  resume: "Продолжение",
  finish: "Финиш",
  reopen: "Переоткрытие",
  tatami: "Татами",
}

function fmtHistoryTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/* ------------------------------ champion banner ---------------------------- */

export function ChampionBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-gradient-to-r from-gold via-accent-warm-light to-gold border border-gold/50 shadow-sm">
      <Trophy size={20} className="text-dark-blue shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-dark-blue/70">
          Чемпион категории
        </div>
        <div className="text-base font-extrabold text-dark-blue truncate">{name}</div>
      </div>
    </div>
  )
}

/* -------------------------------- match card ------------------------------- */

interface CardProps {
  match: BracketMatchData
  interactive?: boolean
  finishing?: boolean
  isNext?: boolean
  flash?: boolean
  onFinish?: (matchId: number, payload: FinishPayload) => Promise<void>
  reopening?: boolean
  onReopen?: (matchId: number) => Promise<void>
}

function fmtTime(t?: string | null) {
  if (!t) return null
  return t.slice(0, 5)
}

export function BracketMatchCard({ match, interactive, finishing, isNext, flash, onFinish, reopening, onReopen }: CardProps) {
  const finished = match.status === "finished"
  const [selected, setSelected] = useState<number | null>(match.winnerId)
  const [scores, setScores] = useState({ s1: match.score1 ?? 0, s2: match.score2 ?? 0 })
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<MatchHistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const toggleHistory = useCallback(async () => {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    setShowHistory(true)
    if (history !== null) return
    setHistoryLoading(true)
    try {
      const data = await api<MatchHistoryEntry[]>(`/api/tournament/matches/${match.id}/history/`)
      setHistory(data)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [showHistory, history, match.id])

  useEffect(() => {
    setSelected(match.winnerId)
  }, [match.winnerId, match.id])

  useEffect(() => {
    setScores({ s1: match.score1 ?? 0, s2: match.score2 ?? 0 })
  }, [match.id, match.score1, match.score2])

  const score1 = scores.s1
  const score2 = scores.s2

  const canFinish = interactive && !finished && selected !== null && !finishing

  const handleFinish = async () => {
    if (!canFinish || !onFinish || selected === null) return
    await onFinish(match.id, { winnerId: selected, score1: scores.s1, score2: scores.s2 })
  }

  const renderAthleteRow = (
    athlete: BracketAthlete,
    score: number | string,
    scoreInput: ReactNode,
    isWinner: boolean,
    dimmed: boolean,
    selectable: boolean,
    isSelected: boolean
  ) => (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => selectable && athlete.id !== null && setSelected(athlete.id)}
      className={cn(
        "w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left transition-all duration-200",
        isWinner
          ? "bg-gold-soft border-gold/60"
          : isSelected
            ? "bg-gold-soft/70 border-gold/60 ring-2 ring-gold/40"
            : "bg-light-gray border-transparent",
        dimmed && "opacity-55",
        selectable ? "cursor-pointer hover:border-primary-blue/40" : "cursor-default"
      )}
    >
      <span className={cn(
        "text-sm font-semibold truncate min-w-0 inline-flex items-center gap-1.5",
        isWinner || isSelected ? "text-dark-blue" : "text-dark-text"
      )}>
        {isWinner && <Crown size={13} className="text-dark-blue shrink-0" />}
        {athlete.name || "TBD"}
      </span>
      <span className="shrink-0 flex items-center">
        {scoreInput ?? (
          <span className="text-sm font-bold text-dark-text tabular-nums min-w-[2rem] text-center">
            {score}
          </span>
        )}
      </span>
    </button>
  )

  const scoreInput = (player: 1 | 2) =>
    interactive && !finished ? (
      <input
        type="number"
        min={0}
        value={player === 1 ? scores.s1 : scores.s2}
        onChange={(e) =>
          setScores((p) => ({ ...p, [player === 1 ? "s1" : "s2"]: Number(e.target.value) }))
        }
        onClick={(e) => e.stopPropagation()}
        aria-label={`Счёт ${player === 1 ? "первого" : "второго"} спортсмена`}
        className="w-14 h-8 text-center text-sm font-bold rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary-blue/40 tabular-nums"
      />
    ) : null

  const showScores = !(match.status === "waiting" && score1 === 0 && score2 === 0)
  const s1: number | string = showScores ? score1 : "–"
  const s2: number | string = showScores ? score2 : "–"

  const winnerName =
    match.winnerName ??
    (match.winnerId === match.athlete1.id
      ? match.athlete1.name
      : match.winnerId === match.athlete2.id
        ? match.athlete2.name
        : null)

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 w-full transition-shadow",
        match.status === "in_progress"
          ? "border-gold/70 ring-2 ring-gold/40 shadow-lg shadow-gold/15"
          : "border-border",
        match.isBye && "border-dashed",
        flash && "bracket-target-flash"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-text truncate">
          {match.roundName} · #{match.matchNumber}
        </span>
        <StatusPill status={isNext && !finished ? "next" : match.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-dark-blue text-white dark:bg-gold dark:text-dark-blue">
          Татами {match.tatamiName ?? "—"}
        </span>
        {fmtTime(match.startTime) && (
          <span className="text-[11px] font-semibold text-secondary-text tabular-nums">
            {fmtTime(match.startTime)}
          </span>
        )}
        {match.categoryName && (
          <span className="text-[11px] font-medium text-secondary-text truncate">
            {match.categoryName}
          </span>
        )}
      </div>

      {match.isBye ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-gold-soft/60 border border-gold/40">
            <span className="text-sm font-semibold text-dark-blue truncate">
              {match.athlete1.name ?? match.athlete2.name ?? "TBD"}
            </span>
            <span className="text-[11px] font-bold text-warning shrink-0">↗ BYE</span>
          </div>
          <p className="text-xs text-secondary-text leading-relaxed">
            Автоматический проход в следующий раунд. Бой не проводился.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {renderAthleteRow(
            match.athlete1, s1, scoreInput(1),
            finished && match.winnerId !== null && match.winnerId === match.athlete1.id,
            finished && match.winnerId !== null && match.winnerId !== match.athlete1.id && match.athlete1.id !== null,
            !!interactive && !finished && match.athlete1.id !== null,
            selected !== null && selected === match.athlete1.id
          )}
          {renderAthleteRow(
            match.athlete2, s2, scoreInput(2),
            finished && match.winnerId !== null && match.winnerId === match.athlete2.id,
            finished && match.winnerId !== null && match.winnerId !== match.athlete2.id && match.athlete2.id !== null,
            !!interactive && !finished && match.athlete2.id !== null,
            selected !== null && selected === match.athlete2.id
          )}

          {finished && winnerName && (
            <div className="flex items-center gap-1.5 pt-1 text-[13px] font-bold text-dark-text">
              <span className="text-success">✓</span> Победитель: {winnerName}
            </div>
          )}
          {interactive && finished && !match.isBye && onReopen && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => void onReopen(match.id)}
                disabled={reopening}
                title="Откатить результат: победитель вернётся из следующего боя, если тот ещё не начался"
                className="w-full h-8 text-xs font-semibold rounded-lg border border-border text-secondary-text hover:text-dark-text hover:border-primary-blue/40 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {reopening ? "Переоткрытие..." : "Переоткрыть бой"}
              </button>
            </div>
          )}
          {interactive && !match.isBye && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void toggleHistory()}
                className="w-full text-[11px] font-semibold text-secondary-text hover:text-dark-text transition-colors cursor-pointer"
              >
                {showHistory ? "Скрыть историю" : "История боя"}
              </button>
              {showHistory && (
                <div className="mt-1.5 space-y-1 rounded-lg bg-light-gray border border-border p-2.5">
                  {historyLoading && (
                    <p className="text-[11px] text-secondary-text">Загрузка...</p>
                  )}
                  {!historyLoading && (!history || history.length === 0) && (
                    <p className="text-[11px] text-secondary-text">Действий пока нет.</p>
                  )}
                  {(history ?? []).map((h) => (
                    <div key={h.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="font-bold text-dark-text shrink-0">
                        {HISTORY_ACTION_LABELS[h.action] ?? h.action}
                      </span>
                      <span className="text-secondary-text text-right min-w-0">
                        {h.winner_name ? `${h.winner_name} ` : ""}
                        {h.score1 !== null && h.score2 !== null ? `${h.score1}:${h.score2} ` : ""}
                        {h.detail ? `${h.detail} ` : ""}
                        {h.actor_name ?? ""} · {fmtHistoryTime(h.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {interactive && !finished && (
            <div className="pt-1.5 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => match.athlete1.id !== null && setSelected(match.athlete1.id)}
                  disabled={!match.athlete1.id || finishing}
                  className={cn(
                    "flex-1 h-9 text-xs font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer",
                    selected === match.athlete1.id && match.athlete1.id !== null
                      ? "bg-gold text-dark-blue shadow-md shadow-gold/30"
                      : "bg-primary-blue text-white hover:bg-primary-blue-light dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  )}
                >
                  Победитель A
                </button>
                <button
                  type="button"
                  onClick={() => match.athlete2.id !== null && setSelected(match.athlete2.id)}
                  disabled={!match.athlete2.id || finishing}
                  className={cn(
                    "flex-1 h-9 text-xs font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer",
                    selected === match.athlete2.id && match.athlete2.id !== null
                      ? "bg-gold text-dark-blue shadow-md shadow-gold/30"
                      : "bg-primary-blue text-white hover:bg-primary-blue-light dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  )}
                >
                  Победитель B
                </button>
              </div>
              <button
                type="button"
                onClick={handleFinish}
                disabled={!canFinish}
                className="w-full h-9 text-xs font-bold bg-dark-blue text-white rounded-lg hover:bg-primary-blue transition-colors disabled:opacity-50 cursor-pointer dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
              >
                {finishing ? "Завершение..." : "Завершить бой"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* --------------------------- bracket with connectors ----------------------- */

interface ConnPath {
  d: string
  gold: boolean
  flash: boolean
  key: string
}

interface BracketProps {
  rounds: BracketRoundData[]
  interactive?: boolean
  finishingId?: number | null
  nextMatchIds?: number[]
  flashMatchId?: number | null
  onFinish?: (matchId: number, payload: FinishPayload) => Promise<void>
  onStartRound?: (roundId: number | string) => Promise<void>
  startingRoundId?: number | string | null
  canManageRounds?: boolean
  reopeningId?: number | null
  onReopen?: (matchId: number) => Promise<void>
  emptyText?: string
}

export default function TournamentBracket({
  rounds,
  interactive,
  finishingId,
  nextMatchIds,
  flashMatchId,
  onFinish,
  onStartRound,
  startingRoundId,
  canManageRounds,
  reopeningId,
  onReopen,
  emptyText = "Сетка ещё не создана",
}: BracketProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef(new Map<number, HTMLDivElement>())
  const [paths, setPaths] = useState<ConnPath[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  const sorted = [...rounds].sort((a, b) => a.order - b.order)

  const setSlotRef = useCallback(
    (id: number) => (el: HTMLDivElement | null) => {
      if (el) slotRefs.current.set(id, el)
      else slotRefs.current.delete(id)
    },
    []
  )

  const compute = useCallback(() => {
    const root = innerRef.current
    if (!root) return
    // Реальные координаты из DOM: разница getBoundingClientRect() слота
    // и контейнера. Не зависит от offsetParent, static/relative предков,
    // скролла и z-index — линии всегда попадают из карточки в карточку.
    const rc = root.getBoundingClientRect()
    const rectOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return {
        left: r.left - rc.left,
        top: r.top - rc.top,
        width: r.width,
        height: r.height,
      }
    }
    const byId = new Map<number, BracketMatchData>()
    sorted.forEach((r) => r.matches.forEach((m) => byId.set(m.id, m)))
    const out: ConnPath[] = []
    sorted.forEach((r, ri) => {
      if (ri === 0) return
      r.matches.forEach((m) => {
        const targetEl = slotRefs.current.get(m.id)
        if (!targetEl) return
        const t = rectOf(targetEl)
        const prevPairs: { pid: number | null; slotAthlete: number | null }[] = [
          { pid: m.prevIds[0], slotAthlete: m.athlete1.id },
          { pid: m.prevIds[1], slotAthlete: m.athlete2.id },
        ]
        prevPairs.forEach(({ pid, slotAthlete }, si) => {
          if (!pid) return
          const srcEl = slotRefs.current.get(pid)
          const prev = byId.get(pid)
          if (!srcEl || !prev) return
          const s = rectOf(srcEl)
          const x1 = Math.round(s.left + s.width)
          const y1 = Math.round(s.top + s.height / 2)
          const x2 = Math.round(t.left)
          const y2 = Math.round(t.top + t.height / 2)
          // Классический олимпийский локоть: стаб → общая вертикаль → стаб.
          // Источники одной пары стоят в одной колонке (один x1),
          // поэтому вертикаль mx у них общая.
          const mx = Math.round((x1 + x2) / 2)
          const advanced =
            prev.winnerId !== null && slotAthlete !== null && prev.winnerId === slotAthlete
          out.push({
            d: `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`,
            gold: advanced,
            flash: flashMatchId === m.id,
            key: `${pid}-${m.id}-${si}`,
          })
        })
      })
    })
    const sig = JSON.stringify(out.map((p) => [p.d, p.gold, p.flash, p.key]))
    setPaths((prev) => {
      const prevSig = JSON.stringify(prev.map((p) => [p.d, p.gold, p.flash, p.key]))
      return prevSig === sig ? prev : out
    })
    const w = root.scrollWidth
    const h = root.scrollHeight
    setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
  }, [sorted, flashMatchId])

  useLayoutEffect(() => {
    compute()
  })

  useEffect(() => {
    const root = innerRef.current
    if (!root || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => compute())
    ro.observe(root)
    const t = setTimeout(compute, 700)
    window.addEventListener("resize", compute)
    return () => {
      ro.disconnect()
      clearTimeout(t)
      window.removeEventListener("resize", compute)
    }
  }, [compute])

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-secondary-text mb-4">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto pt-2 pb-4 max-h-[75vh]">
      <div ref={innerRef} className="relative flex items-stretch gap-12 min-w-full" style={{ width: "max-content" }}>
        <svg
          className="absolute left-0 top-0 z-0 pointer-events-none"
          width={Math.max(size.w, 1)}
          height={Math.max(size.h, 1)}
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.gold || p.flash ? "#C9A227" : "#D8DEE7"}
              strokeWidth={p.gold || p.flash ? 2.5 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={p.flash ? "bracket-connector-flash" : undefined}
            />
          ))}
        </svg>
        {sorted.map((r, ri) => {
          const open = isRoundOpen(r.status)
          return (
          <div key={r.id} className="relative z-10 flex flex-col w-[280px] shrink-0">
            <div className="pb-2 mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-dark-text uppercase tracking-wide">
                  {r.name}
                </h3>
                {ri === sorted.length - 1 && sorted.length > 1 && (
                  <Trophy size={14} className="text-gold shrink-0" />
                )}
                {r.status && (
                  <StatusPill
                    status={r.status}
                    label={r.status === "in_progress" ? "Идёт" : undefined}
                  />
                )}
              </div>
              {canManageRounds && onStartRound && r.status === "waiting" && (
                <button
                  type="button"
                  disabled={startingRoundId === r.id}
                  onClick={() => onStartRound(r.id)}
                  className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold bg-dark-blue text-white hover:bg-primary-blue transition-colors disabled:opacity-50 cursor-pointer dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                >
                  <Play size={13} />
                  {startingRoundId === r.id ? "Запуск..." : "Старт раунда"}
                </button>
              )}
              {!open && (
                <p className="text-[11px] text-secondary-text mt-1.5">
                  Раунд ожидает старта
                </p>
              )}
            </div>
            <div className="flex-1 flex flex-col">
              {r.matches.length === 0 && (
                <div className="flex-1 flex items-center">
                  <p className="text-xs text-secondary-text italic">Матчей нет</p>
                </div>
              )}
              {r.matches.map((m) => (
                <div
                  key={m.id}
                  ref={setSlotRef(m.id)}
                  className="flex-1 flex items-center py-3 min-h-[120px]"
                >
                  <div className="w-full">
                    <BracketMatchCard
                      match={m}
                      interactive={interactive && open}
                      finishing={finishingId === m.id}
                      isNext={nextMatchIds?.includes(m.id)}
                      flash={flashMatchId === m.id}
                      onFinish={onFinish}
                      reopening={reopeningId === m.id}
                      onReopen={onReopen}
                    />
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
}
