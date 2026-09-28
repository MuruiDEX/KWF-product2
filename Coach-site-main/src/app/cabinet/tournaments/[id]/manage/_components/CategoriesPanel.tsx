"use client"

import StatusPill from "@/components/ui/StatusPill"
import { DataTable } from "@/components/ui/DataTable"
import { FriendlyError } from "@/components/ui/FriendlyError"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { BulkBar } from "./BulkBar"
import type { TournamentCategory } from "@/lib/types"
import type { CategoryRow } from "../manageDerived"

export interface BulkFailed {
  ids: number[]
  names: Map<number, string>
}

interface CategoriesPanelProps {
  sortedCats: TournamentCategory[]
  categoryRows: CategoryRow[]
  effectiveSelectedCats: Set<number>
  onToggleCatSelect: (key: string | number) => void
  onToggleCatSelectAll: (keys: (string | number)[], select: boolean) => void
  bulkMsg: { ok: boolean; text: string } | null
  bulkBusy: boolean
  failedCheckin: BulkFailed | null
  failedUncheck: BulkFailed | null
  uncheckConfirm: BulkFailed | null
  onCloseUncheckConfirm: () => void
  onRetryBulk: () => void
  onRetryFailedCheckin: () => void
  onRetryFailedUncheck: () => void
  onRunBulkUncheck: (ids: number[], names: Map<number, string>) => void
  onBulkExport: () => void
  onBulkDocuments: () => void
  onBulkCheckin: () => void
  onBulkUncheck: () => void
  onClearBulkSelection: () => void
  onOpenCategory: (id: number) => void
  onGenerateBracket: (cat: TournamentCategory) => void
}

/** Категории: таблица DataTable + BulkBar + uncheck-диалог.
 * Логика выбора/bulk — в page; здесь layout секции. */
export function CategoriesPanel({
  sortedCats,
  categoryRows,
  effectiveSelectedCats,
  onToggleCatSelect,
  onToggleCatSelectAll,
  bulkMsg,
  bulkBusy,
  failedCheckin,
  failedUncheck,
  uncheckConfirm,
  onCloseUncheckConfirm,
  onRetryBulk,
  onRetryFailedCheckin,
  onRetryFailedUncheck,
  onRunBulkUncheck,
  onBulkExport,
  onBulkDocuments,
  onBulkCheckin,
  onBulkUncheck,
  onClearBulkSelection,
  onOpenCategory,
  onGenerateBracket,
}: CategoriesPanelProps) {
  // BulkBar — fixed снизу: пока есть выбор, резервируем место,
  // чтобы панель не перекрывала пагинацию и хвост таблицы.
  // На мобиле бар выше (кнопки в несколько рядов) — резерв больше.
  const bulkVisible = effectiveSelectedCats.size > 0
  return (
    <div className={`space-y-3${bulkVisible ? " pb-44 sm:pb-28" : ""}`}>
      <div className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-[#0E2035]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-base font-extrabold text-dark-text dark:text-slate-100">Категории · {sortedCats.length}</h2>
        </div>
        <DataTable
          label="Категории турнира"
          rows={categoryRows}
          keyOf={(r) => r.id}
          searchPlaceholder="Поиск категории…"
          searchText={(r) => r.name}
          pageSize={15}
          selected={effectiveSelectedCats}
          onToggleSelect={onToggleCatSelect}
          onToggleSelectAll={onToggleCatSelectAll}
          emptyTitle="Нет категорий"
          emptyHint="Создайте первую кнопкой «Категорию» выше или запустите мастер подготовки."
          columns={[
            {
              id: "name",
              header: "Категория",
              render: (r) => (
                <span className="block max-w-[220px] truncate font-bold" title={r.name}>
                  {r.name}
                </span>
              ),
              sortValue: (r) => r.name,
            },
            {
              id: "count",
              header: "Уч.",
              align: "right",
              render: (r) => r.count,
              sortValue: (r) => r.count,
            },
            {
              id: "checkin",
              header: "Явка",
              align: "right",
              render: (r) =>
                r.checkedIn === null ? (
                  <span className="text-secondary-text">—</span>
                ) : (
                  <span className="tabular-nums whitespace-nowrap">
                    {r.checkedIn}/{r.count}
                  </span>
                ),
              sortValue: (r) => r.checkedIn ?? -1,
            },
            {
              id: "weight",
              header: "Вес",
              align: "right",
              hideOnMobile: true,
              render: (r) =>
                r.weighed === null ? (
                  <span className="text-secondary-text">—</span>
                ) : (
                  <span className="tabular-nums whitespace-nowrap">
                    {r.weighed}/{r.count}
                    {r.overweight > 0 && (
                      <span
                        title={`${r.overweight} с перевесом`}
                        className="ml-1.5 font-bold text-warning"
                      >
                        ⚠&nbsp;{r.overweight}
                      </span>
                    )}
                  </span>
                ),
              sortValue: (r) => (r.weighed === null ? -1 : r.count - r.weighed),
            },
            {
              id: "bracket",
              header: "Сетка",
              hideOnMobile: true,
              render: (r) =>
                r.fights === null ? (
                  <span className="text-secondary-text">—</span>
                ) : (
                  <span className="tabular-nums whitespace-nowrap">{r.fights} боёв</span>
                ),
              sortValue: (r) => r.fights ?? -1,
            },
            {
              id: "tatami",
              header: "Татами",
              hideOnMobile: true,
              render: (r) => (
                <span className="block max-w-[140px] truncate" title={r.tatamiName}>
                  {r.tatamiName}
                </span>
              ),
              sortValue: (r) => r.tatamiName,
            },
            {
              id: "status",
              header: "Статус",
              render: (r) => <StatusPill status={r.status} label={r.statusLabel} />,
            },
            {
              id: "actions",
              header: "Действия",
              align: "right",
              render: (r) => {
                const cat = sortedCats.find((c) => c.id === r.id)
                return (
                  <span className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenCategory(r.id)}
                      className="inline-flex h-8 items-center px-1 text-xs font-bold text-primary-blue hover:text-primary-blue-light mr-2 cursor-pointer"
                    >
                      Открыть
                    </button>
                    {r.canGenerate && cat && (
                      <button
                        type="button"
                        onClick={() => onGenerateBracket(cat)}
                        className="inline-flex h-8 items-center px-1 text-xs font-bold text-primary-blue hover:text-primary-blue-light cursor-pointer"
                      >
                        Сетка
                      </button>
                    )}
                  </span>
                )
              },
            },
          ]}
        />
        {bulkMsg &&
          (bulkMsg.ok ? (
            <div
              role="status"
              className="mt-3 p-3 rounded-xl border text-sm font-medium bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-400/20 dark:text-green-300"
            >
              {bulkMsg.text}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <FriendlyError message={bulkMsg.text} onRetry={onRetryBulk} />
              {failedCheckin && failedCheckin.ids.length > 0 && (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => onRetryFailedCheckin()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold bg-dark-blue text-white hover:bg-primary-blue transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                >
                  {bulkBusy ? "Выполнение…" : `Повторить ошибки (${failedCheckin.ids.length})`}
                </button>
              )}
              {failedUncheck && failedUncheck.ids.length > 0 && (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => onRetryFailedUncheck()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold bg-dark-blue text-white hover:bg-primary-blue transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
                >
                  {bulkBusy ? "Выполнение…" : `Повторить ошибки (${failedUncheck.ids.length})`}
                </button>
              )}
            </div>
          ))}
      </div>
      <BulkBar
        count={effectiveSelectedCats.size}
        noun="категории"
        busy={bulkBusy}
        onExport={onBulkExport}
        onDocuments={onBulkDocuments}
        onCheckin={onBulkCheckin}
        onUncheck={onBulkUncheck}
        onClear={onClearBulkSelection}
      />
      <ConfirmDialog
        open={uncheckConfirm !== null}
        title="Снять явку?"
        description={
          uncheckConfirm
            ? `Вы собираетесь снять явку у ${uncheckConfirm.ids.length} ${pluralizeAthletes(uncheckConfirm.ids.length)}. Это изменит статус их участия в турнире.`
            : undefined
        }
        confirmLabel="Снять явку"
        danger
        busy={bulkBusy}
        onConfirm={() => {
          if (uncheckConfirm) onRunBulkUncheck(uncheckConfirm.ids, uncheckConfirm.names)
        }}
        onClose={onCloseUncheckConfirm}
      />
    </div>
  )
}

/** Для «у N …»: «у 1 спортсмена, у 3 спортсменов». */
function pluralizeAthletes(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return "спортсмена"
  return "спортсменов"
}
