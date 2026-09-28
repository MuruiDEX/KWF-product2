// Phase 5: универсальный ImportWizard (CSV/XLSX/DOCX).
// Один UX для всех форматов: файл → разбор → маппинг → dry-run →
// подтверждение (ConfirmDialog) → коммит. Прямого импорта после загрузки нет.

"use client"

import { useRef, useState } from "react"
import { FileSpreadsheet, Upload } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { toast } from "@/components/ui/Toaster"
import { useModalBehavior } from "@/lib/useModal"
import {
  FORMAT_LABELS,
  IMPORT_ACCEPT,
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  IMPORT_MAX_BYTES,
  countDuplicates,
  detectFormat,
  formatBytes,
  mappingComplete,
  type ImportField,
  type ImportFormat,
  type ImportMapping,
  type ImportRowError,
  type PreviewRow,
} from "@/lib/importAssistant"
import { cn } from "@/lib/utils"

interface DocxTable {
  index: number
  columns: string[]
  row_count: number
}

interface ParseResponse {
  format?: ImportFormat
  sheet?: string
  tables?: DocxTable[]
  table_index?: number
  columns?: string[]
  mapping?: Record<string, string | null>
  unmapped?: string[]
  row_count?: number
  preview?: Record<string, string>[]
  warnings?: string[]
  created?: PreviewRow[]
  errors?: ImportRowError[]
}

interface ValidateResponse {
  created: PreviewRow[]
  errors: ImportRowError[]
}

type Step = "upload" | "tables" | "mapping" | "preview" | "result"

const PREVIEW_CAP = 100

function endpointFor(format: ImportFormat, parse: boolean): string {
  if (format === "csv") {
    return parse
      ? "/api/tournament/athletes/import_parse/"
      : "/api/tournament/athletes/import_csv/"
  }
  if (format === "xlsx") return "/api/tournament/athletes/import_xlsx/"
  return "/api/tournament/athletes/import_docx/"
}

export interface ImportWizardProps {
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function ImportWizard({ open, onClose, onDone }: ImportWizardProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(open, onClose, panelRef)

  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ImportFormat | null>(null)
  const [step, setStep] = useState<Step>("upload")
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState("")
  const [tables, setTables] = useState<DocxTable[]>([])
  const [tableIndex, setTableIndex] = useState<number | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<ImportMapping>({})
  const [rowCount, setRowCount] = useState(0)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [errors, setErrors] = useState<ImportRowError[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ imported: number } | null>(null)

  if (!open) return null

  const reset = () => {
    setFile(null)
    setFormat(null)
    setStep("upload")
    setBusy(false)
    setFatal("")
    setTables([])
    setTableIndex(null)
    setColumns([])
    setMapping({})
    setRowCount(0)
    setPreview([])
    setErrors([])
    setConfirmOpen(false)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const close = () => {
    reset()
    onClose()
  }

  const postFile = async <T,>(
    fmt: ImportFormat,
    parse: boolean,
    extra: Record<string, string>
  ): Promise<T | null> => {
    const current = fileRef.current?.files?.[0] ?? file
    if (!current) return null
    setBusy(true)
    setFatal("")
    try {
      const form = new FormData()
      form.append("file", current)
      for (const [k, v] of Object.entries(extra)) form.append(k, v)
      return await api<T>(endpointFor(fmt, parse), { method: "POST", body: form })
    } catch (e) {
      setFatal(apiErrorMessage(e))
      return null
    } finally {
      setBusy(false)
    }
  }

  const applyParse = async (data: ParseResponse, fmt: ImportFormat): Promise<boolean> => {
    if (data.errors?.length) {
      setFatal(data.errors.map((e) => `Строка ${e.row}: ${e.error}`).join(" "))
      return false
    }
    if (fmt === "docx" && (!data.columns || data.columns.length === 0)) {
      // Единственная таблица — выбираем сразу (какая именно — видно в маппинге).
      const found = data.tables ?? []
      if (found.length === 1 && data.table_index !== undefined && data.table_index !== null) {
        setTables(found)
        setTableIndex(data.table_index)
        const detail = await postFile<ParseResponse>("docx", true, {
          table_index: String(data.table_index),
        })
        if (detail) return applyParse(detail, "docx")
        return false
      }
      // Несколько таблиц — явный выбор пользователем.
      setTables(found)
      setTableIndex(data.table_index ?? null)
      setStep("tables")
      return true
    }
    const cols = data.columns ?? []
    setColumns(cols)
    const initial: ImportMapping = {}
    for (const c of cols) initial[c] = data.mapping?.[c] ?? ""
    setMapping(initial)
    setRowCount(data.row_count ?? 0)
    setStep("mapping")
    return true
  }

  const onPick = async (picked: File | undefined) => {
    if (!picked || busy) return
    const fmt = detectFormat(picked.name)
    if (!fmt) {
      setFile(picked)
      setFatal("Формат не поддерживается: нужны .csv, .xlsx или .docx.")
      return
    }
    if (picked.size > IMPORT_MAX_BYTES) {
      setFile(picked)
      setFatal("Файл слишком большой (максимум 2 МБ).")
      return
    }
    setFile(picked)
    setFormat(fmt)
    const data = await postFile<ParseResponse>(fmt, true, {})
    if (data) void applyParse(data, fmt)
  }

  const onPickTable = async (idx: number) => {
    if (!format || format !== "docx") return
    setTableIndex(idx)
    const data = await postFile<ParseResponse>("docx", true, { table_index: String(idx) })
    if (data) void applyParse(data, "docx")
  }

  const onDryRun = async () => {
    if (!format) return
    const extra: Record<string, string> = { mapping: JSON.stringify(mapping), dry_run: "1" }
    if (format === "docx" && tableIndex !== null) extra.table_index = String(tableIndex)
    const data = await postFile<ValidateResponse>(format, false, extra)
    if (!data) return
    setPreview(data.created ?? [])
    setErrors(data.errors ?? [])
    setStep("preview")
  }

  const onCommit = async () => {
    if (!format) return
    const extra: Record<string, string> = { mapping: JSON.stringify(mapping) }
    if (format === "docx" && tableIndex !== null) extra.table_index = String(tableIndex)
    const data = await postFile<ValidateResponse>(format, false, extra)
    if (!data) return
    setConfirmOpen(false)
    if (data.errors.length > 0) {
      // Частичный успех backend не подтверждает (всё-или-ничего) — показываем честно.
      setPreview(data.created ?? [])
      setErrors(data.errors)
      setStep("preview")
      toast("Импорт отклонён: исправьте ошибки и попробуйте снова", "error")
      return
    }
    setResult({ imported: data.created.length })
    setStep("result")
    toast(`Добавлено спортсменов: ${data.created.length}`, "success")
    onDone()
  }

  const completeness = mappingComplete(mapping)
  const duplicates = countDuplicates(errors)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Импорт спортсменов из файла"
    >
      <div
        ref={panelRef}
        className="bg-white rounded-2xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-[#0E2035]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-dark-text mb-2 dark:text-slate-100">
          Импорт спортсменов
        </h3>
        <p className="text-sm text-secondary-text mb-4 leading-relaxed">
          CSV, XLSX или DOCX с таблицей. Обязательные колонки: имя, фамилия,
          дата рождения, вес, пол. Рост и клуб — необязательно. Сначала
          проверка, импорт — только после подтверждения.
        </p>

        {fatal && (
          <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-4 mb-4">
            <div className="text-sm font-bold text-error">{fatal}</div>
          </div>
        )}

        {step === "upload" && (
          <label
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-light-gray px-6 py-10 text-center cursor-pointer hover:border-primary-blue/40 transition-colors dark:bg-white/[0.04]",
              busy && "opacity-60 pointer-events-none"
            )}
          >
            <FileSpreadsheet size={28} className="text-primary-blue" aria-hidden="true" />
            <span className="text-sm font-semibold text-dark-text">
              {busy ? "Читаем файл…" : file ? file.name : "Выберите файл (.csv, .xlsx, .docx)"}
            </span>
            {file && (
              <span className="text-xs text-secondary-text">
                {format ? FORMAT_LABELS[format] : ""} · {formatBytes(file.size)}
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="hidden"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
          </label>
        )}

        {step === "tables" && (
          <div className="space-y-3">
            <div className="text-sm font-bold text-dark-text">
              Выберите таблицу участников ({tables.length})
            </div>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {tables.map((t) => (
                <li key={t.index}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onPickTable(t.index)}
                    className="w-full text-left rounded-xl border border-border bg-white px-4 py-3 hover:border-primary-blue/40 transition-colors disabled:opacity-50 cursor-pointer dark:bg-[#0E2035]"
                  >
                    <span className="block text-sm font-bold text-dark-text">
                      Таблица {t.index + 1} · строк: {t.row_count}
                    </span>
                    <span className="block text-xs text-secondary-text truncate mt-0.5">
                      {t.columns.join(" · ") || "Без заголовка"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-3">
            <div className="text-sm text-secondary-text">
              Строк: <b className="text-dark-text tabular-nums">{rowCount}</b>
              {format ? ` · ${FORMAT_LABELS[format]}` : ""}
              {format === "docx" && tableIndex !== null ? ` · Таблица ${tableIndex + 1}` : ""}
              {file ? ` · ${file.name}` : ""}
            </div>
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {columns.map((col) => (
                <li key={col} className="flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-sm font-semibold text-dark-text truncate" title={col}>
                    {col}
                  </span>
                  <span className="text-secondary-text" aria-hidden="true">→</span>
                  <label className="sr-only" htmlFor={`map-${col}`}>
                    Поле для колонки {col}
                  </label>
                  <select
                    id={`map-${col}`}
                    value={mapping[col] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                    className="h-10 px-3 text-sm rounded-xl border border-border bg-white text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue/30 max-w-[220px] dark:bg-white/5 dark:text-white"
                  >
                    <option value="">— игнорировать —</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {IMPORT_FIELD_LABELS[f as ImportField]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {!completeness.ok && (
              <p role="alert" className="text-xs font-semibold text-error">
                Нет обязательных колонок: {completeness.missing.map((f) => IMPORT_FIELD_LABELS[f as ImportField]).join(", ")}.
              </p>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-light-gray border border-border px-4 py-3 text-sm text-dark-text tabular-nums dark:bg-white/[0.04]">
              {rowCount > 0 ? `${rowCount} строк · ` : ""}
              {preview.length} готовы к импорту
              {errors.length > 0 && ` · ${errors.length} требуют исправления`}
              {duplicates > 0 && ` · ${duplicates} дубликата`}
            </div>
            {errors.length > 0 && (
              <div className="rounded-xl border border-error/30 bg-error/5 p-4">
                <div className="text-sm font-bold text-error mb-2">
                  Ошибки ({errors.length}) — ничего не импортировано
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {errors.slice(0, PREVIEW_CAP).map((e, i) => (
                    <li key={i} className="text-xs text-error">
                      Строка {e.row}: {e.error}
                    </li>
                  ))}
                </ul>
                {errors.length > PREVIEW_CAP && (
                  <p className="text-xs text-error mt-1">…и ещё {errors.length - PREVIEW_CAP}</p>
                )}
              </div>
            )}
            {preview.length > 0 && (
              <div>
                <div className="text-sm font-bold text-dark-text mb-2">
                  Будет добавлено: {preview.length}
                </div>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {preview.slice(0, PREVIEW_CAP).map((r, i) => (
                    <li key={i} className="text-xs text-secondary-text tabular-nums">
                      {r.last_name} {r.first_name} · {r.birth_date} · {r.weight} кг
                    </li>
                  ))}
                </ul>
                {preview.length > PREVIEW_CAP && (
                  <p className="text-xs text-secondary-text mt-1">…и ещё {preview.length - PREVIEW_CAP}</p>
                )}
              </div>
            )}
            {preview.length === 0 && errors.length === 0 && (
              <p className="text-sm text-secondary-text">В файле нет строк для импорта.</p>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("upload")
                setFatal("")
                if (fileRef.current) fileRef.current.value = ""
              }}
              className="text-xs font-semibold text-primary-blue hover:text-primary-blue-light cursor-pointer"
            >
              Выбрать другой файл
            </button>
          </div>
        )}

        {step === "result" && result && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <div className="text-sm font-bold text-success">
              Импортировано спортсменов: {result.imported}
            </div>
            <p className="text-xs text-secondary-text mt-1">
              Проверьте список спортсменов в кабинете.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-4 text-sm"
            onClick={close}
          >
            {step === "result" ? "Закрыть" : "Отмена"}
          </Button>
          {step === "mapping" && (
            <Button
              type="button"
              className="h-10 px-5 text-sm"
              disabled={busy || !completeness.ok}
              onClick={() => void onDryRun()}
            >
              {busy ? "Проверка…" : "Проверить"}
            </Button>
          )}
          {step === "preview" && (
            <Button
              type="button"
              className="h-10 px-5 text-sm gap-1.5"
              disabled={busy || preview.length === 0 || errors.length > 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Upload size={15} />
              {busy ? "Импорт…" : `Импортировать (${preview.length})`}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Импортировать спортсменов?"
        description={`Будет импортировано: ${preview.length}. Будет пропущено: ${errors.length}.`}
        confirmLabel={`Импортировать (${preview.length})`}
        busy={busy}
        onConfirm={() => void onCommit()}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
