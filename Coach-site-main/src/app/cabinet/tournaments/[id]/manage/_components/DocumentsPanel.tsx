"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, CircleAlert, CircleHelp, Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  deleteTemplate,
  loadTemplates,
  saveTemplate,
  type DocumentTemplate,
} from "@/lib/docTemplates"
import {
  matchLines,
  type MatchableAthlete,
  type NameMatch,
} from "@/lib/documentMatch"
import type { Tournament, TournamentCategory } from "@/lib/types"

export interface DocumentPrefill {
  key: string
  source: string
  athletes: MatchableAthlete[]
}

interface DocumentsPanelProps {
  tournament: Tournament
  categories: TournamentCategory[]
  prefill: DocumentPrefill | null
  onPrefillConsumed: () => void
}

const DOC_TYPES = [
  { id: "spravka", title: "Справка", intro: "Настоящая справка подтверждает участие спортсмена в турнире." },
  { id: "participants", title: "Список участников", intro: "Официальный список участников турнира." },
  { id: "category", title: "Список категории", intro: "Официальный список участников категории." },
  { id: "protocol", title: "Протокол", intro: "Протокол турнира." },
  { id: "schedule", title: "Расписание", intro: "Расписание турнира." },
  { id: "results", title: "Результаты", intro: "Итоговые результаты турнира." },
  { id: "certificate", title: "Сертификат", intro: "Настоящим подтверждается участие в турнире." },
] as const

function allAthletes(categories: TournamentCategory[]): MatchableAthlete[] {
  const seen = new Map<number, MatchableAthlete>()
  for (const c of categories) {
    for (const a of c.athletes ?? []) {
      const prev = seen.get(a.id)
      const cats = [...(prev?.categoryNames ?? [])]
      if (!cats.includes(c.name)) cats.push(c.name)
      seen.set(a.id, {
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        birth_date: a.birth_date,
        club: a.club,
        weight: a.weight,
        gender: a.gender,
        categoryNames: cats,
      })
    }
  }
  return [...seen.values()]
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("ru-RU")
}

function todayRu(): string {
  return new Date().toLocaleDateString("ru-RU")
}

/** Phase 2B (MVP): генератор документов. Вставка ФИО → fuzzy-матчинг
 * по базе турнира → правка совпадений → превью → печать (print CSS).
 * Шаблоны — localStorage. Без серверного PDF (следующие фазы). */
export function DocumentsPanel({
  tournament,
  categories,
  prefill,
  onPrefillConsumed,
}: DocumentsPanelProps) {
  const [docType, setDocType] = useState<string>("spravka")
  const [namesText, setNamesText] = useState("")
  const [overrides, setOverrides] = useState<Record<number, number | null>>({})
  const [header, setHeader] = useState("")
  const [footer, setFooter] = useState("")
  const [templates, setTemplates] = useState<DocumentTemplate[]>(() => loadTemplates())
  const [templateName, setTemplateName] = useState("")
  const [appliedPrefill, setAppliedPrefill] = useState<string | null>(null)

  const roster = useMemo(() => allAthletes(categories), [categories])

  // Bulk-handoff: готовый список спортсменов подставляется matched (100%).
  if (prefill && prefill.key !== appliedPrefill) {
    setAppliedPrefill(prefill.key)
    setNamesText(prefill.athletes.map((a) => `${a.last_name} ${a.first_name}`.trim()).join("\n"))
    setOverrides({})
    onPrefillConsumed()
  }

  const matches: NameMatch[] = useMemo(
    () => matchLines(namesText.split("\n"), roster),
    [namesText, roster]
  )

  const finalAthletes = useMemo(() => {
    const out: MatchableAthlete[] = []
    matches.forEach((m, i) => {
      if (i in overrides) {
        const id = overrides[i]
        const a = id == null ? null : roster.find((r) => r.id === id) ?? null
        if (a) out.push(a)
        return
      }
      if (m.athlete) out.push(m.athlete)
    })
    return out
  }, [matches, overrides, roster])

  const missingBirth = finalAthletes.filter((a) => !a.birth_date).length
  const docTitle = DOC_TYPES.find((t) => t.id === docType)?.title ?? "Документ"
  const docIntro = DOC_TYPES.find((t) => t.id === docType)?.intro ?? ""

  const setOverride = (idx: number, athleteId: number | null | "reset") => {
    setOverrides((prev) => {
      const next = { ...prev }
      if (athleteId === "reset") delete next[idx]
      else next[idx] = athleteId
      return next
    })
  }

  const applyTemplate = (t: DocumentTemplate) => {
    setDocType(t.docType)
    setHeader(t.header)
    setFooter(t.footer)
  }

  const handleSaveTemplate = () => {
    const name = templateName.trim()
    if (!name) return
    const t = saveTemplate({ name, docType, header, footer })
    setTemplates([t, ...templates].slice(0, 50))
    setTemplateName("")
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <h2 className="mb-2 text-base font-extrabold text-dark-text dark:text-slate-100">
          Генератор документов
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="doc-type" className="mb-1.5 block text-sm font-semibold text-dark-text dark:text-slate-100">
              Тип документа
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none dark:bg-white/5 dark:text-white"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="doc-names" className="mb-1.5 block text-sm font-semibold text-dark-text dark:text-slate-100">
              ФИО — по одному на строку
            </label>
            <textarea
              id="doc-names"
              value={namesText}
              onChange={(e) => {
                setNamesText(e.target.value)
                setOverrides({})
              }}
              rows={5}
              placeholder={"Иванов Иван\nПетров Пётр\nСидоров Алексей"}
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 font-mono text-sm text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none dark:bg-white/5 dark:text-white"
            />
          </div>
        </div>

        {matches.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-extrabold tracking-[0.14em] text-secondary-text uppercase">
              Совпадения · {matches.length}
            </h3>
            <ul className="space-y-1.5">
              {matches.map((m, i) => (
                <li
                  key={`${m.line}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-light-gray px-3 py-2 text-sm dark:bg-white/[0.04]"
                >
                  {m.status === "matched" && !(i in overrides) ? (
                    <CheckCircle2 size={16} className="shrink-0 text-success" aria-label="Найдено" />
                  ) : m.status === "possible" && !(i in overrides) ? (
                    <CircleAlert size={16} className="shrink-0 text-warning" aria-label="Возможно" />
                  ) : i in overrides && overrides[i] != null ? (
                    <CheckCircle2 size={16} className="shrink-0 text-primary-blue" aria-label="Исправлено вручную" />
                  ) : (
                    <CircleHelp size={16} className="shrink-0 text-secondary-text" aria-label="Не найдено" />
                  )}
                  <span className="min-w-[140px] flex-1 font-semibold text-dark-text dark:text-slate-100">
                    {m.line}
                  </span>
                  <span className="text-xs font-semibold text-secondary-text tabular-nums">
                    {i in overrides
                      ? overrides[i] == null
                        ? "исключён"
                        : "вручную"
                      : m.athlete
                        ? `${m.athlete.last_name} ${m.athlete.first_name} — ${m.confidence}%`
                        : "не найден"}
                  </span>
                  <select
                    value={i in overrides ? (overrides[i] ?? "") : (m.athlete?.id ?? "")}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === "__auto") setOverride(i, "reset")
                      else if (v === "") setOverride(i, null)
                      else setOverride(i, Number(v))
                    }}
                    aria-label={`Исправить совпадение: ${m.line}`}
                    title="Исправить совпадение вручную"
                    className="h-8 max-w-[200px] truncate rounded-lg border border-border bg-white px-2 text-xs font-semibold text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none dark:bg-white/5 dark:text-white"
                  >
                    <option value="__auto">Автовыбор{m.athlete ? ` (${m.confidence}%)` : ""}</option>
                    <option value="">— исключить —</option>
                    {roster.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.last_name} {a.first_name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {missingBirth > 0 && (
              <p role="status" className="mt-2 text-xs font-semibold text-warning">
                Нет даты рождения у {missingBirth} — дополните данные спортсменов во вкладке «Участники».
              </p>
            )}
          </div>
        )}
      </div>

      {finalAthletes.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
              Превью · {finalAthletes.length}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-9 text-xs"
                onClick={() => {
                  const text = buildCategoriesPreview(tournament.name, finalAthletes)
                  downloadPreview(text)
                }}
              >
                <Download size={14} aria-hidden="true" />
                TXT
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-9 text-xs"
                onClick={() => {
                  document.body.classList.add("printing-doc")
                  window.print()
                  window.setTimeout(
                    () => document.body.classList.remove("printing-doc"),
                    500
                  )
                }}
              >
                <Printer size={14} aria-hidden="true" />
                Печать
              </Button>
            </div>
          </div>
          <div className="print-area overflow-x-auto rounded-xl border border-border bg-white p-6 text-dark-text">
            {header ? (
              <p className="mb-1 text-center text-xs whitespace-pre-line text-dark-text">{header}</p>
            ) : null}
            <p className="text-center text-sm font-bold">{tournament.name}</p>
            <p className="mt-0.5 text-center text-xs text-secondary-text">
              {tournament.start_date} {tournament.location ? `· ${tournament.location}` : ""}
            </p>
            <h4 className="mt-4 text-center text-lg font-extrabold">{docTitle}</h4>
            <p className="mt-1 text-center text-xs text-secondary-text">{docIntro}</p>
            <table className="mt-4 w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-dark-text text-left">
                  <th className="py-1.5 pr-2">№</th>
                  <th className="py-1.5 pr-2">ФИО</th>
                  <th className="py-1.5 pr-2">Дата рождения</th>
                  <th className="py-1.5 pr-2">Клуб</th>
                  <th className="py-1.5 pr-2">Категория</th>
                  <th className="py-1.5">Вес</th>
                </tr>
              </thead>
              <tbody>
                {finalAthletes.map((a, idx) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-1.5 pr-2 tabular-nums">{idx + 1}</td>
                    <td className="py-1.5 pr-2 font-bold">
                      {a.last_name} {a.first_name}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">{fmtDate(a.birth_date)}</td>
                    <td className="py-1.5 pr-2">{a.club || "—"}</td>
                    <td className="py-1.5 pr-2">{(a.categoryNames ?? []).join("; ") || "—"}</td>
                    <td className="py-1.5 tabular-nums">{a.weight || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {footer ? (
              <p className="mt-6 text-xs whitespace-pre-line">{footer}</p>
            ) : (
              <div className="mt-8 flex items-end justify-between gap-8 text-xs">
                <p>
                  Руководитель __________________ / __________________ /
                  <br />
                  <span className="text-secondary-text">подпись, расшифровка</span>
                </p>
                <p className="text-right">
                  М.П.
                  <br />
                  <span className="text-secondary-text">{todayRu()}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <h3 className="mb-2 text-sm font-extrabold tracking-[0.14em] text-secondary-text uppercase">
          Шаблоны
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Название шаблона"
            aria-label="Название шаблона"
            className="h-10 flex-1 rounded-xl border border-border bg-white px-3 text-sm text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none dark:bg-white/5 dark:text-white"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-10 text-xs"
            disabled={!templateName.trim()}
            onClick={handleSaveTemplate}
            title="Сохранить тип, шапку и подпись как шаблон"
          >
            Сохранить шаблон
          </Button>
        </div>
        <div className="mt-2 grid gap-2">
          <input
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            placeholder="Шапка документа (необязательно)"
            aria-label="Шапка документа"
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none dark:bg-white/5 dark:text-white"
          />
          <input
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            placeholder="Подпись вместо стандартной (необязательно)"
            aria-label="Подпись документа"
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-dark-text focus:ring-2 focus:ring-primary-blue/30 focus:outline-none dark:bg-white/5 dark:text-white"
          />
        </div>
        {templates.length === 0 ? (
          <p className="mt-3 text-xs text-secondary-text">
            Шаблонов пока нет — настройте тип, шапку и подпись, затем сохраните.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left font-bold text-primary-blue hover:text-primary-blue-light"
                >
                  {t.name}
                </button>
                <span className="shrink-0 text-xs text-secondary-text">{t.docType}</span>
                <button
                  type="button"
                  onClick={() => {
                    deleteTemplate(t.id)
                    setTemplates((prev) => prev.filter((x) => x.id !== t.id))
                  }}
                  aria-label={`Удалить шаблон ${t.name}`}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-secondary-text hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function buildCategoriesPreview(tournamentName: string, athletes: MatchableAthlete[]): string {
  const lines = [
    tournamentName,
    `Сформировано: ${todayRu()}`,
    "",
    ...athletes.map(
      (a, i) =>
        `${i + 1}. ${a.last_name} ${a.first_name} — ${fmtDate(a.birth_date)} — ${a.club || "—"} — ${(a.categoryNames ?? []).join("; ") || "—"}`
    ),
  ]
  return `﻿${lines.join("\r\n")}`
}

function downloadPreview(text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "document.txt"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
