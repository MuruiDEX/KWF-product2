"use client"

import { memo, type MutableRefObject } from "react"

export interface ManageNavTab {
  id: string
  label: string
}

// Phase 3: таббар, вынесенный из god-компонента page.tsx.
// Вся навигационная логика (порядок, подписи, keyboard-навигация с ручной
// активацией, URL-синхронизация) живёт здесь; page владеет только состоянием
// активного таба. Поведение 1-в-1 как раньше.
function TournamentNavigation({
  tabs,
  active,
  tabRefs,
  onSelect,
}: {
  tabs: ManageNavTab[]
  active: string
  tabRefs: MutableRefObject<(HTMLButtonElement | null)[]>
  onSelect: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Разделы управления турниром"
      className="sticky top-[5.5rem] z-20 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white/95 backdrop-blur p-1.5 shadow-sm dark:bg-[#0E2035]/95"
      onKeyDown={(e) => {
        // Ручная активация: стрелки только двигают фокус, Enter/Space
        // активируют таб нативным кликом кнопки. URL-синхронизация — в onSelect.
        if (
          e.key !== "ArrowRight" &&
          e.key !== "ArrowLeft" &&
          e.key !== "Home" &&
          e.key !== "End"
        ) {
          return
        }
        const els = tabRefs.current.filter(
          (el): el is HTMLButtonElement => el !== null
        )
        const at = els.indexOf(document.activeElement as HTMLButtonElement)
        if (at === -1) return
        e.preventDefault()
        let next = at
        if (e.key === "ArrowRight") next = (at + 1) % els.length
        else if (e.key === "ArrowLeft") next = (at - 1 + els.length) % els.length
        else if (e.key === "Home") next = 0
        else if (e.key === "End") next = els.length - 1
        els[next]?.focus()
      }}
    >
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            tabRefs.current[i] = el
          }}
          type="button"
          role="tab"
          id={`manage-tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`manage-panel-${t.id}`}
          onClick={() => onSelect(t.id)}
          className={`flex-1 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50 ${
            active === t.id
              ? "bg-dark-blue text-white shadow dark:bg-gold dark:text-dark-blue"
              : "text-secondary-text hover:bg-light-gray dark:hover:bg-white/10"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default memo(TournamentNavigation)
