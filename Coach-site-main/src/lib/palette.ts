/** Единая командная палитра: типы, фильтрация и программное открытие.
 * QuickNav — единственный владелец Ctrl+K; контекстные команды (manage)
 * передаются пропсами, а не второй палитрой. */

export interface PaletteItem {
  id: string
  label: string
  hint?: string
  run: () => void
}

/** Чистая фильтрация для списка и подсветки (покрыта тестами). */
export function filterEntries(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      (i.hint ?? "").toLowerCase().includes(q)
  )
}

/** Событие программного открытия палитры (напр. из OverflowMenu в manage,
 * где кнопка QuickNav скрыта). Идемпотентно: повторный вызов не дублирует. */
export const PALETTE_OPEN_EVENT = "kwf:open-palette"

export function openPalette(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PALETTE_OPEN_EVENT))
  }
}
