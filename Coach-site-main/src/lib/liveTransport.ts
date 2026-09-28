// Phase 6: чистые хелперы live-транспорта (SSE-first, polling-fallback).
// Без DOM/EventSource — покрыты vitest. События нормализуются к
// TournamentEvent до дедупликации: SSE и polling дают один и тот же тип.

import type { TournamentEvent } from "@/lib/tournamentEvents"

export type EventsTransport = "sse" | "polling" | "offline"

export interface ParsedSSEFrame {
  id: number | null
  event: string | null
  data: string | null
}

/** Разбор одного или нескольких SSE-блоков (комментарии-heartbeat пропускаем). */
export function parseSSEBlocks(text: string): ParsedSSEFrame[] {
  const frames: ParsedSSEFrame[] = []
  for (const block of text.split("\n\n")) {
    const lines = block.split("\n").map((l) => l.trimEnd())
    if (lines.length === 0) continue
    if (lines.every((l) => l === "" || l.startsWith(":"))) continue
    let id: number | null = null
    let event: string | null = null
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith("id:")) {
        const n = Number(line.slice(3).trim())
        id = Number.isFinite(n) ? n : null
      } else if (line.startsWith("event:")) {
        event = line.slice(6).trim() || null
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    if (dataLines.length === 0) continue
    frames.push({ id, event, data: dataLines.join("\n") })
  }
  return frames
}

/** Нормализация SSE-кадра к TournamentEvent (тот же тип, что из polling). */
export function normalizeSSEFrame(frame: ParsedSSEFrame): TournamentEvent | null {
  if (frame.event !== null && frame.event !== "tournament_event") return null
  if (!frame.data) return null
  try {
    const payload = JSON.parse(frame.data) as Partial<TournamentEvent>
    if (typeof payload !== "object" || payload === null) return null
    if (typeof payload.id !== "number") return null
    return payload as TournamentEvent
  } catch {
    return null
  }
}

/** Backoff переподключения SSE: 1s, 2s, 4s, 8s … cap 30s. */
export function sseBackoffMs(attempt: number): number {
  const n = Math.max(0, Math.floor(attempt))
  return Math.min(30000, 1000 * 2 ** Math.min(n, 5))
}

/** После стольких подряд провалов SSE уходим в polling-fallback. */
export const SSE_FAILURES_BEFORE_FALLBACK = 3

/** Пауза перед репробой SSE из polling-fallback. */
export const SSE_REPROBE_MS = 30000

/** URL потока с якорем replay (тот же ?after=, что у events/). */
export function buildStreamUrl(
  apiBase: string,
  tournamentId: string | number,
  after: number
): string {
  const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase
  return `${base}/api/tournament/tournaments/${tournamentId}/events/stream/?after=${Math.max(0, Math.floor(after))}`
}
