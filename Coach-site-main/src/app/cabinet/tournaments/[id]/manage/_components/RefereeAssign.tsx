"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { CheckCircle2, Plus, RotateCcw, Search, TriangleAlert } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import {
  filterRefereeCandidates,
  type RefereeCandidate,
} from "@/lib/refereeAssign"

interface RefereeAssignProps {
  matchId: number
  rowLabel: string
  tatamiName: string
  candidates: RefereeCandidate[]
  onAssigned: (matchId: number, refereeId: number, refereeName: string) => void
}

type Phase =
  | { kind: "open" }
  | { kind: "saving"; refereeId: number }
  | { kind: "ok"; refereeName: string }
  | { kind: "error"; refereeId: number; message: string }

/** Inline-назначение судьи на бой без судьи: кнопка «Назначить» →
 * компактный поповер с поиском → Enter/клик → существующий set_referee.
 * Состояние локальное (строка, поиск, подсветка, сохранение, ошибка);
 * после успеха родитель точечно патчит матч (без refetch всего турнира). */
export function RefereeAssign({
  matchId,
  rowLabel,
  tatamiName,
  candidates,
  onAssigned,
}: RefereeAssignProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const [phase, setPhase] = useState<Phase>({ kind: "open" })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listId = useId()
  const searchId = useId()

  const options = useMemo(
    () => filterRefereeCandidates(candidates, query),
    [candidates, query]
  )
  // Подсветка всегда в границах списка (список меняется от поиска).
  const safeHighlight =
    options.length === 0 ? 0 : Math.min(highlight, options.length - 1)

  // Фокус в поиск при открытии, возврат на кнопку при закрытии.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])
  useEffect(() => {
    return () => {
      if (okTimer.current) clearTimeout(okTimer.current)
    }
  }, [])

  const close = () => {
    if (okTimer.current) {
      clearTimeout(okTimer.current)
      okTimer.current = null
    }
    setOpen(false)
    setQuery("")
    setPhase({ kind: "open" })
    // Возврат фокуса — после размонтирования поповера.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  // Закрытие по клику мимо (Escape — через onKeyDown).
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener("pointerdown", onPointer)
    return () => document.removeEventListener("pointerdown", onPointer)
  }, [open])

  const select = async (refereeId: number) => {
    if (phase.kind === "saving" || phase.kind === "ok") return
    const candidate = candidates.find((c) => c.id === refereeId)
    if (!candidate) return
    setPhase({ kind: "saving", refereeId })
    try {
      const res = await api<{ success: boolean; error?: string }>(
        `/api/tournament/matches/${matchId}/set_referee/`,
        { method: "POST", body: JSON.stringify({ user_id: refereeId }) }
      )
      if (!res.success) {
        setPhase({
          kind: "error",
          refereeId,
          message: res.error || "Не удалось назначить судью",
        })
        return
      }
      setPhase({ kind: "ok", refereeName: candidate.name })
      // Короткое подтверждение в контексте строки, затем точечный патч
      // родителя (строка уходит из «Без судьи», нагрузка обновляется).
      okTimer.current = setTimeout(() => {
        okTimer.current = null
        onAssigned(matchId, refereeId, candidate.name)
      }, 900)
    } catch (e) {
      setPhase({ kind: "error", refereeId, message: apiErrorMessage(e) })
    }
  }

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
      return
    }
    if (phase.kind === "saving" || phase.kind === "ok") return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => (options.length === 0 ? 0 : (h + 1) % options.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) =>
        options.length === 0 ? 0 : (h - 1 + options.length) % options.length
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      const opt = options[safeHighlight]
      if (opt) void select(opt.id)
    }
  }

  const busy = phase.kind === "saving" || phase.kind === "ok"

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Назначить судью: ${rowLabel}, ${tatamiName}`}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/40 dark:hover:bg-white/10 dark:hover:text-slate-100"
      >
        <Plus size={13} aria-hidden="true" />
        Назначить
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] right-0 z-30 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-white p-2 shadow-lg dark:bg-[#0E2035]">
          {phase.kind === "ok" ? (
            <p role="status" className="flex items-center gap-2 px-2 py-2.5 text-sm font-bold text-dark-text dark:text-slate-100">
              <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden="true" />
              ✓ Назначено: {phase.refereeName}
            </p>
          ) : (
            <>
              <p className="px-2 pt-1 text-[11px] font-bold tracking-[0.1em] text-secondary-text uppercase">
                Назначить судью
              </p>
              <p className="px-2 pb-1.5 text-xs font-semibold text-secondary-text truncate">
                {rowLabel} · {tatamiName}
              </p>
              <div className="relative mb-1.5">
                <Search
                  size={14}
                  aria-hidden="true"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
                />
                <label htmlFor={searchId} className="sr-only">
                  Поиск судьи
                </label>
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  value={query}
                  disabled={busy}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setHighlight(0)
                  }}
                  onKeyDown={onListKeyDown}
                  placeholder="Поиск судьи…"
                  autoComplete="off"
                  aria-controls={listId}
                  className="h-9 w-full rounded-lg border border-border bg-white pr-2 pl-8 text-sm text-dark-text focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/30 focus:outline-none disabled:opacity-50 dark:bg-white/5 dark:text-white"
                />
              </div>
              <ul
                id={listId}
                role="listbox"
                aria-label="Кандидаты в судьи"
                aria-busy={phase.kind === "saving"}
                onKeyDown={onListKeyDown}
                className="max-h-56 overflow-auto"
              >
                {options.length === 0 ? (
                  <li className="px-2 py-2 text-xs font-semibold text-secondary-text">
                    {query.trim() ? "Никого не найдено" : "Нет кандидатов"}
                  </li>
                ) : (
                  options.map((c, i) => {
                    const isSavingThis = phase.kind === "saving" && phase.refereeId === c.id
                    return (
                      <li
                        key={c.id}
                        role="option"
                        aria-selected={i === safeHighlight}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => void select(c.id)}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                          i === safeHighlight
                            ? "bg-light-gray text-dark-text dark:bg-white/10 dark:text-slate-100"
                            : "text-dark-text dark:text-slate-100"
                        } ${busy ? "pointer-events-none opacity-60" : ""}`}
                      >
                        <span className="min-w-0 truncate">{c.name}</span>
                        {isSavingThis && (
                          <span className="shrink-0 text-xs font-bold text-secondary-text">
                            Назначение…
                          </span>
                        )}
                      </li>
                    )
                  })
                )}
              </ul>
              {phase.kind === "error" && (
                <div className="mt-1.5 rounded-lg border border-error/30 bg-error/5 px-2 py-2">
                  <p role="alert" className="flex items-center gap-1.5 text-xs font-bold text-error">
                    <TriangleAlert size={13} className="shrink-0" aria-hidden="true" />
                    Не удалось назначить судью
                  </p>
                  <p className="mt-0.5 text-[11px] text-secondary-text">{phase.message}</p>
                  <button
                    type="button"
                    onClick={() => void select(phase.refereeId)}
                    className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-dark-blue px-2.5 text-xs font-bold text-white cursor-pointer hover:bg-primary-blue dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    Повторить
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
