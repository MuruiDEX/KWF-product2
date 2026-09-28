"use client"

interface SelectionToolbarProps {
  found: number
  selectedCount: number
  pageSelected: number
  pageTotal: number
  selectedOnly: boolean
  onSelectPage: () => void
  onDeselectPage: () => void
  onSelectFound: () => void
  onToggleSelectedOnly: () => void
}

/** Тулбар выбора с явной областью: страница / найденные / только выбранные.
 * Никакого двусмысленного «Выбрать всё». */
export function SelectionToolbar({
  found,
  selectedCount,
  pageSelected,
  pageTotal,
  selectedOnly,
  onSelectPage,
  onDeselectPage,
  onSelectFound,
  onToggleSelectedOnly,
}: SelectionToolbarProps) {
  const btn =
    "inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-bold text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text disabled:opacity-40 disabled:cursor-default dark:hover:bg-white/10 dark:hover:text-slate-100"
  const pageAll = pageTotal > 0 && pageSelected === pageTotal
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Выбор спортсменов">
      <p className="text-xs font-bold text-dark-text tabular-nums dark:text-slate-100">
        Найдено: {found} · Выбрано: {selectedCount}
      </p>
      <span className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onSelectPage}
          disabled={pageTotal === 0 || pageAll}
          title="Выбрать только спортсменов текущей страницы"
          className={btn}
        >
          Выбрать страницу
        </button>
        <button
          type="button"
          onClick={onDeselectPage}
          disabled={pageSelected === 0}
          title="Снять выбор только на текущей странице"
          className={btn}
        >
          Снять страницу
        </button>
        <button
          type="button"
          onClick={onSelectFound}
          disabled={found === 0}
          title="Выбрать весь текущий результат поиска, включая другие страницы"
          className={btn}
        >
          Выбрать найденных ({found})
        </button>
        <button
          type="button"
          onClick={onToggleSelectedOnly}
          aria-pressed={selectedOnly}
          title="Показать только выбранных спортсменов"
          className={`${btn} ${selectedOnly ? "bg-light-gray text-dark-text dark:bg-white/10 dark:text-slate-100" : ""}`}
        >
          Только выбранные
        </button>
      </span>
    </div>
  )
}
