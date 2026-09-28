"use client"

import { useEffect, useMemo, useState } from "react"
import { Gavel, TriangleAlert } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import type { Tatami, Tournament } from "@/lib/types"
import { RefereeAssign } from "./RefereeAssign"

interface RefereeCandidate {
  id: number
  name: string
}

interface WorkloadRow {
  id: number
  name: string
  assigned: number
  active: number
}

interface MissingRow {
  key: string
  matchId: number
  label: string
  tatamiName: string
}

interface StaffPanelProps {
  tournamentId: string | number
  tournament: Tournament
  tatamis: Tatami[]
  onAssigned?: (matchId: number, refereeId: number, refereeName: string) => void
}

const ACTIVE = new Set(["ready", "in_progress", "paused"])

/** Phase 2B: минимальный вид судей — кандидаты backend + нагрузка
 * и пропуски из уже загруженного payload. Назначения на пропуски —
 * inline через тот же set_referee (RefereeAssign); смена судьи
 * назначенных боёв — как раньше в LIVE-очереди каждого боя. */
export function StaffPanel({ tournamentId, tournament, tatamis, onAssigned }: StaffPanelProps) {
  const [candidates, setCandidates] = useState<RefereeCandidate[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // «Без судьи» может быть много: первые 20 + раскрытие, а не обрезка.
  const [showAllMissing, setShowAllMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<RefereeCandidate[]>("/api/tournament/matches/referee_candidates/")
      .then((d) => {
        if (!cancelled) setCandidates(d)
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e)
          setLoadError(apiErrorMessage(e))
        }
      })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  const tatamiNames = useMemo(() => {
    const m = new Map<number, string>()
    for (const t of tatamis) m.set(t.id, t.name)
    return m
  }, [tatamis])

  const { workload, missing, assignedCount, missingCount } = useMemo(() => {
    const names = new Map<number, string>()
    for (const c of candidates ?? []) names.set(c.id, c.name)
    const rows = new Map<number, WorkloadRow>()
    const miss: MissingRow[] = []
    let assigned = 0
    for (const c of tournament.categories ?? []) {
      for (const r of c.rounds ?? []) {
        for (const m of r.matches ?? []) {
          if (m.status === "bye") continue
          const ref = m.referee ?? null
          if (ref === null) {
            if (ACTIVE.has(m.status)) {
              miss.push({
                key: `${m.id}`,
                matchId: m.id,
                label: `Бой #${m.match_number} · ${c.name}`,
                tatamiName:
                  m.tatami != null ? (tatamiNames.get(m.tatami) ?? `Татами ${m.tatami}`) : "Без татами",
              })
            }
            continue
          }
          assigned += 1
          const row = rows.get(ref) ?? {
            id: ref,
            name: m.referee_name ?? names.get(ref) ?? `Судья #${ref}`,
            assigned: 0,
            active: 0,
          }
          row.assigned += 1
          if (ACTIVE.has(m.status)) row.active += 1
          if (!row.name || row.name.startsWith("Судья #")) {
            row.name = m.referee_name ?? names.get(ref) ?? row.name
          }
          rows.set(ref, row)
        }
      }
    }
    return {
      workload: [...rows.values()].sort((a, b) => b.assigned - a.assigned),
      missing: miss,
      assignedCount: assigned,
      missingCount: miss.length,
    }
  }, [tournament, candidates, tatamiNames])

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-dark-text dark:text-slate-100">
            <Gavel size={16} aria-hidden="true" className="text-secondary-text" />
            Судьи
          </h2>
          <span role="status" className="text-xs font-semibold text-secondary-text tabular-nums">
            Назначено: {assignedCount} · Без судьи: {missingCount}
          </span>
        </div>
        {loadError && candidates === null ? (
          <p role="alert" className="py-2 text-sm font-semibold text-error">
            {loadError}
          </p>
        ) : workload.length === 0 ? (
          <p className="py-2 text-sm text-secondary-text">
            {missingCount === 0
              ? "Активных боёв пока нет — назначения появятся после старта."
              : "Судьи ещё не назначены. Назначить можно прямо здесь кнопкой «Назначить» или в LIVE-очереди каждого боя."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table aria-label="Нагрузка судей" className="w-full min-w-[480px] text-sm">
              <thead className="sticky top-0">
                <tr className="bg-light-gray text-left text-[11px] font-bold tracking-[0.12em] text-secondary-text uppercase dark:bg-white/[0.06]">
                  <th scope="col" className="px-3 py-2">Судья</th>
                  <th scope="col" className="px-3 py-2 text-right">Боёв</th>
                  <th scope="col" className="px-3 py-2 text-right">Активно</th>
                  <th scope="col" className="px-3 py-2">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 dark:divide-white/10">
                {workload.map((w) => (
                  <tr key={w.id} className="hover:bg-light-gray/50 dark:hover:bg-white/[0.06]">
                    <td className="px-3 py-2 font-bold text-dark-text dark:text-slate-100">{w.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-dark-text dark:text-slate-100">
                      {w.assigned}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-dark-text dark:text-slate-100">
                      {w.active}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-secondary-text">
                      {w.active > 0 ? "Активен" : "Свободен"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
            <TriangleAlert size={13} aria-hidden="true" className="text-amber-600 dark:text-amber-400" />
            Без судьи · {missing.length}
          </h3>
          <ul className="space-y-1.5">
            {(showAllMissing ? missing : missing.slice(0, 20)).map((m) => (
              <li
                key={m.key}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-light-gray px-3 py-1.5 text-sm dark:bg-white/[0.04]"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <TriangleAlert
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-dark-text dark:text-slate-100">
                      {m.label}
                    </span>
                    <span className="block text-xs font-semibold text-secondary-text">
                      {m.tatamiName} · Судья: —
                    </span>
                  </span>
                </span>
                {onAssigned && (
                  <RefereeAssign
                    matchId={m.matchId}
                    rowLabel={m.label}
                    tatamiName={m.tatamiName}
                    candidates={candidates ?? []}
                    onAssigned={onAssigned}
                  />
                )}
              </li>
            ))}
          </ul>
          {missing.length > 20 && (
            <button
              type="button"
              onClick={() => setShowAllMissing((v) => !v)}
              aria-expanded={showAllMissing}
              className="mt-2 inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              {showAllMissing ? "Свернуть" : `Показать все (${missing.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
