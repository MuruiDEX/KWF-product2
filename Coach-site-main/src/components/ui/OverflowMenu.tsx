"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Ellipsis } from "lucide-react"

export interface OverflowMenuItem {
  label: string
  icon?: ReactNode
  title?: string
  href?: string
  onSelect?: () => void
}

interface OverflowMenuProps {
  label: string
  items: OverflowMenuItem[]
}

/** Компактное «⋯»-меню для редких действий: Escape/outside-click закрывают,
 * фокус возвращается на триггер, роли menu/menuitem. */
export default function OverflowMenu({ label, items }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open ])

  const itemClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-dark-text transition-colors cursor-pointer hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10"

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-secondary-text transition-colors cursor-pointer hover:bg-light-gray hover:text-dark-text dark:hover:bg-white/10 dark:hover:text-slate-100"
      >
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-1 min-w-52 rounded-xl border border-border bg-white p-1.5 shadow-xl dark:bg-[#0E2035]"
        >
          {items.map((item) =>
            item.href ? (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                title={item.title}
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                {item.icon}
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                title={item.title}
                onClick={() => {
                  setOpen(false)
                  item.onSelect?.()
                }}
                className={itemClass}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
