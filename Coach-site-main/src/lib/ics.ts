/**
 * F4: выгрузка событий в календарь (.ics, RFC 5545).
 *
 * Чистые функции (покрыты тестами) + downloadIcs через Blob.
 * Время — «плавающее» локальное (без Z): турниры и тренировки
 * привязаны к залу, а не к часовому поясу. Дни API: 0=Пн…6=Вс.
 */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

/** Перенос строк длиннее 75 символов (CRLF + пробел). */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return parts.join("\r\n")
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function formatStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

export interface IcsEvent {
  uid: string
  title: string
  description?: string
  location?: string
  /** Локальный старт. */
  start: Date
  /** Локальный конец. */
  end: Date
  /** Весь день (время игнорируется). */
  allDay?: boolean
}

export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KWF//Coach Site//RU",
    "CALSCALE:GREGORIAN",
  ]
  for (const e of events) {
    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${e.uid}`)
    lines.push(`DTSTAMP:${formatStamp(now)}`)
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(e.start)}`)
      // DTEND all-day — exclusive, поэтому +1 день к концу.
      const endEx = new Date(e.end)
      endEx.setDate(endEx.getDate() + 1)
      lines.push(`DTEND;VALUE=DATE:${formatDate(endEx)}`)
    } else {
      lines.push(`DTSTART:${formatDateTime(e.start)}`)
      lines.push(`DTEND:${formatDateTime(e.end)}`)
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return lines.map(foldLine).join("\r\n") + "\r\n"
}

/** Ближайшая дата дня недели API (0=Пн…6=Вс), включая сегодня. */
export function nextWeekday(apiDay: number, from = new Date()): Date {
  const jsDay = (((apiDay % 7) + 7) % 7 + 1) % 7 // JS: 0=Вс…6=Сб
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((jsDay - d.getDay() + 7) % 7))
  return d
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function parseTime(value: string | null | undefined): { h: number; m: number } | null {
  if (!value) return null
  const parts = value.match(/^(\d{1,2}):(\d{2})/)
  if (!parts) return null
  const h = Number(parts[1])
  const min = Number(parts[2])
  if (h > 23 || min > 59) return null
  return { h, m: min }
}

function at(date: Date, time: { h: number; m: number }): Date {
  const d = new Date(date)
  d.setHours(time.h, time.m, 0, 0)
  return d
}

export interface TournamentLike {
  id: number | string
  slug?: string
  name: string
  description?: string | null
  location?: string | null
  start_date: string
  start_time?: string | null
  end_date: string
  end_time?: string | null
}

/** Турнир → одно событие (со временем или all-day). */
export function tournamentToIcs(t: TournamentLike): IcsEvent | null {
  const startDate = parseDate(t.start_date)
  const endDate = parseDate(t.end_date) ?? startDate
  if (!startDate || !endDate) return null
  const startTime = parseTime(t.start_time)
  const endTime = parseTime(t.end_time)
  const allDay = !startTime && !endTime
  return {
    uid: `tournament-${t.slug ?? t.id}@kwf`,
    title: t.name,
    description: t.description ?? undefined,
    location: t.location ?? undefined,
    start: allDay ? startDate : at(startDate, startTime ?? { h: 9, m: 0 }),
    end: allDay ? endDate : at(endDate, endTime ?? { h: 18, m: 0 }),
    allDay,
  }
}

export interface SessionLike {
  id: number | string
  day: number
  group: string
  kind?: string | null
  trainer_name?: string | null
  room?: string | null
  note?: string | null
  start_time: string
  end_time: string
}

/** Тренировка → ближайшее занятие (включая сегодня). */
export function sessionToIcs(s: SessionLike, from = new Date()): IcsEvent | null {
  if (!Number.isInteger(s.day) || s.day < 0 || s.day > 6) return null
  const startTime = parseTime(s.start_time)
  const endTime = parseTime(s.end_time)
  if (!startTime || !endTime) return null
  const date = nextWeekday(s.day, from)
  const parts = [s.kind, s.group].filter(Boolean).join(" · ")
  return {
    uid: `training-${s.id}-${formatDate(date)}@kwf`,
    title: parts || "Тренировка",
    description: [s.trainer_name, s.note].filter(Boolean).join(" · ") || undefined,
    location: s.room || undefined,
    start: at(date, startTime),
    end: at(date, endTime),
  }
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
