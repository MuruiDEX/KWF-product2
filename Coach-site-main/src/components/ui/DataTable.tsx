"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  id: string
  header: string
  /** Ячейка строки. */
  render: (row: T) => ReactNode
  /** Значение для сортировки. Без него колонка не сортируется. */
  sortValue?: (row: T) => string | number
  /** Скрыть на мобильных (progressive disclosure). */
  hideOnMobile?: boolean
  align?: "left" | "right"
  headerClassName?: string
  cellClassName?: string
}

interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  keyOf: (row: T) => string | number
  /** aria-label таблицы. */
  label: string
  /** Поиск по строкам (client-side). */
  searchPlaceholder?: string
  searchText?: (row: T) => string
  pageSize?: number
  /** Bulk-выбор: выбранные ключи + переключатель. */
  selected?: Set<string | number>
  onToggleSelect?: (key: string | number) => void
  onToggleSelectAll?: (keys: (string | number)[], select: boolean) => void
  emptyTitle?: string
  emptyHint?: string
  emptyAction?: ReactNode
  /** Липкая шапка внутри прокручиваемого контейнера. */
  maxHeight?: string
}

// ---------- Чистые помощники (покрыты unit-тестами) ----------

export function filterTableRows<T>(rows: T[], query: string, textOf: (row: T) => string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => textOf(r).toLowerCase().includes(q))
}

export function sortTableRows<T>(
  rows: T[],
  column: DataTableColumn<T> | null,
  dir: "asc" | "desc"
): T[] {
  if (!column?.sortValue) return rows
  const get = column.sortValue
  const sorted = [...rows].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    if (typeof va === "number" && typeof vb === "number") return va - vb
    return String(va).localeCompare(String(vb), "ru")
  })
  return dir === "asc" ? sorted : sorted.reverse()
}

export function paginateTableRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, page) * pageSize
  return rows.slice(start, start + pageSize)
}

/** Phase 1 (foundation): компактная доступная таблица для /manage.
 * sticky header, сортировка, поиск, пагинация, bulk-выбор, responsive
 * (hideOnMobile + data-label). Проводка в существующие таблицы — Phase 2. */
export function DataTable<T>({
  rows,
  columns,
  keyOf,
  label,
  searchPlaceholder,
  searchText,
  pageSize = 20,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  emptyTitle = "Ничего не найдено",
  emptyHint,
  emptyAction,
  maxHeight,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("")
  const [sortId, setSortId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(0)

  const sortColumn = columns.find((c) => c.id === sortId) ?? null

  const filtered = useMemo(
    () =>
      searchText ? filterTableRows(rows, query, searchText) : rows,
    [rows, query, searchText]
  )
  const sorted = useMemo(
    () => sortTableRows(filtered, sortColumn, sortDir),
    [filtered, sortColumn, sortDir]
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = paginateTableRows(sorted, safePage, pageSize)

  const selectable = selected && onToggleSelect
  const visibleKeys = visible.map((r) => keyOf(r))
  const allVisibleSelected =
    selectable && visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k))

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortValue) return
    setPage(0)
    if (sortId !== col.id) {
      setSortId(col.id)
      setSortDir("asc")
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    }
  }

  return (
    <div>
      {searchText && (
        <div className="mb-3">
          <label className="sr-only" htmlFor={`datatable-search-${label}`}>
            Поиск по таблице
          </label>
          <input
            id={`datatable-search-${label}`}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder={searchPlaceholder ?? "Поиск…"}
            className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-dark-text focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/30 focus:outline-none sm:max-w-xs dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
      )}
      <div
        className={cn("overflow-auto rounded-xl border border-border", maxHeight && "max-h-96")}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table aria-label={label} className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-light-gray text-left text-[11px] font-bold tracking-[0.12em] text-secondary-text uppercase dark:bg-white/[0.06]">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={!!allVisibleSelected}
                    onChange={(e) =>
                      onToggleSelectAll?.(visibleKeys, e.target.checked)
                    }
                    aria-label="Выбрать все строки на странице"
                    className="h-4 w-4 accent-[#17488F] dark:accent-[#7FB0F0]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={
                    col.sortValue
                      ? sortId === col.id
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={cn(
                    "px-3 py-1.5 whitespace-nowrap",
                    col.align === "right" && "text-right",
                    col.hideOnMobile && "hidden md:table-cell",
                    col.headerClassName
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-dark-text"
                      aria-label={`Сортировать по: ${col.header}`}
                    >
                      {col.header}
                      {sortId === col.id ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={12} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={12} aria-hidden="true" className="opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 dark:divide-white/10">
            {visible.map((row) => {
              const key = keyOf(row)
              return (
                <tr key={key} className="hover:bg-light-gray/50 dark:hover:bg-white/[0.06]">
                  {selectable && (
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => onToggleSelect?.(key)}
                        aria-label={`Выбрать строку ${key}`}
                        className="h-4 w-4 accent-[#17488F] dark:accent-[#7FB0F0]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      data-label={col.header}
                      className={cn(
                        "px-3 py-1.5 text-dark-text dark:text-slate-100",
                        col.align === "right" && "text-right tabular-nums",
                        col.hideOnMobile && "hidden md:table-cell",
                        col.cellClassName
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-bold text-dark-text dark:text-slate-100">{emptyTitle}</p>
            {emptyHint && (
              <p className="mx-auto mt-1 max-w-sm text-sm text-secondary-text dark:text-slate-400">
                {emptyHint}
              </p>
            )}
            {emptyAction && <div className="mt-4">{emptyAction}</div>}
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <nav
          aria-label="Страницы таблицы"
          className="mt-3 flex items-center justify-between gap-2 text-sm"
        >
          <p className="font-semibold text-secondary-text tabular-nums dark:text-slate-400">
            {safePage + 1} / {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Предыдущая страница"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border text-dark-text hover:bg-light-gray disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              aria-label="Следующая страница"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border text-dark-text hover:bg-light-gray disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  )
}
