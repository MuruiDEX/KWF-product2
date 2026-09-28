// Phase 5: помощник универсального импорта (CSV/XLSX/DOCX).
// Автомаппинг живёт на backend (suggest_mapping); здесь — детект формата,
// подписи полей, проверка completeness и лимиты до загрузки.

export type ImportFormat = "csv" | "xlsx" | "docx"

export const IMPORT_ACCEPT = ".csv,.xlsx,.docx"

/** Зеркало backend IMPORT_MAX_BYTES — ранний отказ до загрузки. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024

export const IMPORT_FIELDS = [
  "first_name",
  "last_name",
  "birth_date",
  "weight",
  "gender",
  "height",
  "club",
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  first_name: "Имя",
  last_name: "Фамилия",
  birth_date: "Дата рождения",
  weight: "Вес",
  gender: "Пол",
  height: "Рост",
  club: "Клуб",
}

export const REQUIRED_IMPORT_FIELDS: ImportField[] = [
  "first_name",
  "last_name",
  "birth_date",
  "weight",
  "gender",
]

/** source_col → field | "" (игнорировать). */
export type ImportMapping = Record<string, string>

export const FORMAT_LABELS: Record<ImportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (XLSX)",
  docx: "Word (DOCX)",
}

export function detectFormat(filename: string): ImportFormat | null {
  const name = (filename || "").toLowerCase()
  if (name.endsWith(".csv") || name.endsWith(".txt")) return "csv"
  if (name.endsWith(".xlsx")) return "xlsx"
  if (name.endsWith(".docx")) return "docx"
  return null
}

/** Обязательные поля сопоставлены (ровно одно назначение на поле). */
export function mappingComplete(mapping: ImportMapping): {
  ok: boolean
  missing: string[]
} {
  const used = new Set(Object.values(mapping).filter(Boolean))
  const missing = REQUIRED_IMPORT_FIELDS.filter((f) => !used.has(f))
  return { ok: missing.length === 0, missing }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`
  return `${Math.round((n / (1024 * 1024)) * 10) / 10} МБ`
}

export interface PreviewRow {
  first_name: string
  last_name: string
  birth_date: string
  weight: string
  gender: string
}

export interface ImportRowError {
  row: number
  error: string
}

export function countDuplicates(errors: ImportRowError[]): number {
  return errors.filter((e) => e.error.includes("Дубликат")).length
}
