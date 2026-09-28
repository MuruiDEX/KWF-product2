"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, CornerDownLeft } from "lucide-react"
import { NAV_LINKS } from "@/lib/constants"
import { useAuth } from "@/lib/auth"
import { useModalBehavior } from "@/lib/useModal"
import { PALETTE_OPEN_EVENT, filterEntries, type PaletteItem } from "@/lib/palette"
import { cn } from "@/lib/utils"

interface QuickNavEntry {
  label: string
  hint: string
  href: string
}

/** Единая командная палитра (единственный владелец Ctrl+K).
 * Глобальный индекс — страницы и разделы; на страницах с контекстом
 * (напр. manage турнира) сверху добавляются контекстные команды через
 * contextEntries + живой поиск через onSearch. Второй палитры нет. */
export function QuickNav({
  hideTrigger = false,
  contextLabel,
  contextEntries = [],
  onSearch,
}: {
  /** Скрыть кнопку-триггер (открытие через Ctrl+K или событие). */
  hideTrigger?: boolean
  /** Подпись контекстной секции (напр. название турнира). */
  contextLabel?: string
  /** Команды текущего контекста — показываются первыми. */
  contextEntries?: PaletteItem[]
  /** Живой поиск (debounce внутри); результаты — после статичных. */
  onSearch?: (query: string) => Promise<PaletteItem[]>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)
  const [searchResults, setSearchResults] = useState<PaletteItem[]>([])
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isHome = pathname === "/"

  const close = () => setOpen(false)

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Русская раскладка: Ctrl+К — та же физическая клавиша, что Ctrl+K.
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && (key === "k" || key === "к")) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Программное открытие (напр. OverflowMenu там, где кнопка скрыта).
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(PALETTE_OPEN_EVENT, onOpen)
  }, [])

  useModalBehavior(open, close, panelRef)

  useEffect(() => {
    if (open) {
      // Сброс transient-состояния диалога при открытии (прецедент кодобазы:
      // сброс формы при монтировании модалки вместо derived-state).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("")
      setCursor(0)
      setSearchResults([])
      // Фокус в поле поиска после монтирования панели.
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  const entries = useMemo<QuickNavEntry[]>(() => {
    const list: QuickNavEntry[] = [
      { label: "Турниры", hint: "Соревнования и сетки", href: "/tournaments" },
      { label: "Новости", hint: "Публикации клуба", href: "/news" },
      { label: "Расписание", hint: "Тренировки", href: "/schedule" },
    ]
    for (const link of NAV_LINKS) {
      if (link.label === "Главная") continue
      list.push({
        label: link.label,
        hint: "Раздел главной",
        href: isHome ? link.href : `/${link.href}`,
      })
    }
    if (user) {
      list.push({ label: "Мой кабинет", hint: "Профиль и семья", href: "/cabinet" })
      const role = user.profile?.role
      if (role === "trainer" || user.is_staff) {
        list.push({ label: "Мои турниры", hint: "Кабинет тренера", href: "/cabinet/tournaments" })
        list.push({ label: "Мои публикации", hint: "Новости клуба", href: "/cabinet/news" })
        list.push({ label: "Расписание занятий", hint: "Кабинет тренера", href: "/cabinet/schedule" })
      }
      if (role === "trainer" || user.is_staff) {
        list.push({ label: "Админка", hint: "Управление", href: "/admin" })
      }
    } else {
      list.push({ label: "Войти", hint: "Кабинет", href: "/login" })
      list.push({ label: "Регистрация", hint: "Новый ученик", href: "/register" })
    }
    return list
  }, [user, isHome])

  // Живой контекстный поиск (debounce 300мс, минимум 2 символа).
  useEffect(() => {
    const q = query.trim()
    if (!open || !onSearch || q.length < 2) return
    const t = setTimeout(() => {
      void onSearch(q)
        .then((items) => setSearchResults(items.slice(0, 5)))
        .catch(() => setSearchResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query, open, onSearch])

  const staticVisible = useMemo(() => {
    const global = entries.map((e, i) => ({
      id: `nav-${i}-${e.href}`,
      label: e.label,
      hint: e.hint,
      run: () => go(e.href),
    }))
    return filterEntries([...contextEntries, ...global], query)
  }, [entries, query, contextEntries, go])

  const all = useMemo(
    () => [...staticVisible, ...searchResults],
    [staticVisible, searchResults]
  )

  const runAt = (idx: number) => {
    const item = all[idx]
    if (!item) return
    close()
    item.run()
  }

  const handleQuery = (v: string) => {
    setQuery(v)
    setCursor(0)
    // Короткий запрос — поиск не идёт, старые результаты гасим сразу.
    if (v.trim().length < 2) setSearchResults([])
  }

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Быстрая навигация (Ctrl+K)"
          title="Быстрая навигация (Ctrl+K)"
          className="hidden sm:flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          <Search size={16} />
          <span className="text-xs font-semibold hidden min-[1440px]:inline">Поиск…</span>
          <kbd className="hidden min-[1440px]:inline rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white/50">
            Ctrl K
          </kbd>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <div
            className="absolute inset-0 bg-dark-blue/70 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Командная палитра"
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-white shadow-2xl dojo-top-line dark:bg-[#0E2035]"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search size={16} className="text-secondary-text shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close()
                  else if (e.key === "ArrowDown") {
                    e.preventDefault()
                    setCursor((a) => (all.length === 0 ? 0 : (a + 1) % all.length))
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setCursor((a) => (all.length === 0 ? 0 : (a - 1 + all.length) % all.length))
                  } else if (e.key === "Enter") {
                    e.preventDefault()
                    runAt(cursor)
                  }
                }}
                placeholder={contextLabel ? `${contextLabel}: команда, раздел или поиск…` : "Куда перейти? (турниры, новости, кабинет…)"}
                role="combobox"
                aria-label="Поиск команд и разделов"
                aria-expanded="true"
                aria-controls="quicknav-list"
                aria-activedescendant={all[cursor] ? `quicknav-${all[cursor].id}` : undefined}
                aria-autocomplete="list"
                className="h-12 w-full bg-transparent text-sm text-dark-text placeholder:text-secondary-text/80 focus:outline-none dark:text-slate-100"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-bold text-secondary-text shrink-0">
                esc
              </kbd>
            </div>
            <ul id="quicknav-list" role="listbox" aria-label="Результаты" className="max-h-[40vh] overflow-y-auto p-2">
              {all.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-secondary-text">
                  Ничего не найдено
                </li>
              )}
              {contextLabel && staticVisible.some((i) => contextEntries.some((c) => c.id === i.id)) && (
                <li aria-hidden="true" className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-secondary-text">
                  {contextLabel}
                </li>
              )}
              {all.map((item, i) => (
                <li key={item.id} role="option" aria-selected={i === cursor} id={`quicknav-${item.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => runAt(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer",
                      i === cursor
                        ? "bg-dark-blue text-white dark:bg-gold dark:text-dark-blue"
                        : "text-dark-text hover:bg-light-gray dark:text-slate-100 dark:hover:bg-white/10"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span
                          className={cn(
                            "block truncate text-xs",
                            i === cursor ? "text-white/70 dark:text-dark-blue/70" : "text-secondary-text"
                          )}
                        >
                          {item.hint}
                        </span>
                      )}
                    </span>
                    {i === cursor && (
                      <CornerDownLeft size={15} className="shrink-0 text-secondary-text" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
