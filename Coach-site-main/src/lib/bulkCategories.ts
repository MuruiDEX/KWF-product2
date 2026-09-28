import { api } from "@/lib/api"

export interface BulkCheckinResult {
  requested: number
  updated: number
  already_checked_in: number
  failed: number
  errors: { athlete_id: number; error: string }[]
}

/** Массовая явка одним запросом (Phase 3A) через существующий api-клиент.
 * Никаких N single-запросов: ровно один POST bulk_checkin. */
export async function bulkCheckinTournament(
  tournamentId: string | number,
  athleteIds: number[]
): Promise<BulkCheckinResult> {
  return api<BulkCheckinResult>(
    `/api/tournament/tournaments/${tournamentId}/bulk_checkin/`,
    {
      method: "POST",
      body: JSON.stringify({ athlete_ids: athleteIds }),
    }
  )
}

export interface BulkUncheckResult {
  requested: number
  updated: number
  already_unchecked: number
  failed: number
  errors: { athlete_id: number; error: string }[]
}

/** Массовое снятие явки одним запросом (Phase 3C) через существующий api-клиент. */
export async function bulkUncheckTournament(
  tournamentId: string | number,
  athleteIds: number[]
): Promise<BulkUncheckResult> {
  return api<BulkUncheckResult>(
    `/api/tournament/tournaments/${tournamentId}/bulk_uncheck/`,
    {
      method: "POST",
      body: JSON.stringify({ athlete_ids: athleteIds }),
    }
  )
}

interface ChunkAggregate {
  requested: number
  updated: number
  already: number
  failed: number
  errors: { athlete_id: number; error: string }[]
}

/** Общий чанк-цикл для bulk-операций: последовательно по BULK_CHECKIN_MAX,
 * итог агрегируется. Поведение публичных bulkCheckinChunked/bulkUncheckChunked
 * от рефакторинга не меняется (покрыто тестами). */
async function postChunked(
  endpoint: "bulk_checkin" | "bulk_uncheck",
  tournamentId: string | number,
  athleteIds: number[],
  alreadyKey: "already_checked_in" | "already_unchecked"
): Promise<ChunkAggregate> {
  const unique = [...new Set(athleteIds)]
  const agg: ChunkAggregate = {
    requested: unique.length,
    updated: 0,
    already: 0,
    failed: 0,
    errors: [],
  }
  for (let i = 0; i < unique.length; i += BULK_CHECKIN_MAX) {
    const r = await api<
      Pick<BulkCheckinResult, "requested" | "updated" | "failed" | "errors"> & {
        already_checked_in?: number
        already_unchecked?: number
      }
    >(`/api/tournament/tournaments/${tournamentId}/${endpoint}/`, {
      method: "POST",
      body: JSON.stringify({ athlete_ids: unique.slice(i, i + BULK_CHECKIN_MAX) }),
    })
    agg.updated += r.updated
    agg.already += r[alreadyKey] ?? 0
    agg.failed += r.failed
    agg.errors.push(...r.errors)
  }
  return agg
}

/** Лимит backend BULK_CHECKIN_MAX (views.py) — чанки не больше этого. */
export const BULK_CHECKIN_MAX = 500

/** Массовая явка чанками по BULK_CHECKIN_MAX, последовательно (без
 * конкуренции записей), с агрегированным итогом. Пустой вход — нули. */
export async function bulkCheckinChunked(
  tournamentId: string | number,
  athleteIds: number[]
): Promise<BulkCheckinResult> {
  const agg = await postChunked("bulk_checkin", tournamentId, athleteIds, "already_checked_in")
  return {
    requested: agg.requested,
    updated: agg.updated,
    already_checked_in: agg.already,
    failed: agg.failed,
    errors: agg.errors,
  }
}

/** Массовое снятие явки чанками — зеркально явке (тот же цикл, свой endpoint). */
export async function bulkUncheckChunked(
  tournamentId: string | number,
  athleteIds: number[]
): Promise<BulkUncheckResult> {
  const agg = await postChunked("bulk_uncheck", tournamentId, athleteIds, "already_unchecked")
  return {
    requested: agg.requested,
    updated: agg.updated,
    already_unchecked: agg.already,
    failed: agg.failed,
    errors: agg.errors,
  }
}

/** Человеческое резюме результата для BulkBar (чистая функция, покрыта тестами).
 * names — «id → ФИО» для понятных ошибок вместо голых #id. */
export function formatBulkCheckinSummary(
  res: BulkCheckinResult,
  names?: Map<number, string>
): {
  ok: boolean
  text: string
} {
  if (res.failed === 0 && res.updated === 0 && res.already_checked_in === 0) {
    return { ok: true, text: "Отмечать некого — список пуст." }
  }
  if (res.failed === 0) {
    const parts = [`успешно ${res.updated}`]
    if (res.already_checked_in > 0) {
      parts.push(`уже были отмечены ${res.already_checked_in}`)
    }
    return { ok: true, text: `Явка обновлена: ${parts.join(" · ")}.` }
  }
  const label = (athlete_id: number, error: string): string => {
    const name = names?.get(athlete_id)
    return name ? `${name} (${error})` : `#${athlete_id} (${error})`
  }
  const shown = res.errors.slice(0, 3).map((e) => label(e.athlete_id, e.error)).join("; ")
  const more = res.failed > 3 ? "…" : ""
  return {
    ok: false,
    text: `Обработано ${res.requested}: успешно ${res.updated}, ошибок ${res.failed} (${shown}${more}).`,
  }
}

/** Резюме снятия явки — зеркально явке (чистая функция, покрыта тестами). */
export function formatBulkUncheckSummary(
  res: BulkUncheckResult,
  names?: Map<number, string>
): {
  ok: boolean
  text: string
} {
  if (res.failed === 0 && res.updated === 0 && res.already_unchecked === 0) {
    return { ok: true, text: "Снимать нечего — список пуст." }
  }
  if (res.failed === 0) {
    const parts = [`успешно ${res.updated}`]
    if (res.already_unchecked > 0) {
      parts.push(`уже была снята ${res.already_unchecked}`)
    }
    return { ok: true, text: `Явка снята: ${parts.join(" · ")}.` }
  }
  const label = (athlete_id: number, error: string): string => {
    const name = names?.get(athlete_id)
    return name ? `${name} (${error})` : `#${athlete_id} (${error})`
  }
  const shown = res.errors.slice(0, 3).map((e) => label(e.athlete_id, e.error)).join("; ")
  const more = res.failed > 3 ? "…" : ""
  return {
    ok: false,
    text: `Обработано ${res.requested}: успешно ${res.updated}, ошибок ${res.failed} (${shown}${more}).`,
  }
}

export interface CategoryCsvSource {
  name: string
  athletes: {
    last_name: string
    first_name: string
    birth_date: string | null
    club?: string | null
    weight: string
    gender: string
    id: number
  }[]
}

/** CSV выбранных категорий из уже загруженного payload (без backend).
 * Разделитель «;» (Excel RU), BOM, защита от formula-injection. */
export function buildCategoriesCsv(
  categories: CategoryCsvSource[],
  isCheckedIn: (athleteId: number) => boolean
): string {
  const cell = (v: string | null | undefined): string => {
    const s = String(v ?? "")
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return `"${safe.replace(/"/g, '""')}"`
  }
  const lines = [
    ["Категория", "Фамилия", "Имя", "Дата рождения", "Клуб", "Вес", "Пол", "Явка"]
      .map(cell)
      .join(";"),
  ]
  for (const c of categories) {
    for (const a of c.athletes) {
      lines.push(
        [
          c.name,
          a.last_name,
          a.first_name,
          a.birth_date ?? "",
          a.club ?? "",
          a.weight,
          a.gender,
          isCheckedIn(a.id) ? "Да" : "",
        ]
          .map(cell)
          .join(";")
      )
    }
  }
  return `﻿${lines.join("\r\n")}`
}

/** Скачивание строки как файла (client-only). */
export function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
