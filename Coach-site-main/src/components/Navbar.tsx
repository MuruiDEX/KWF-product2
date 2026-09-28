"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, LogOut, UserRound, Sun, Moon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NAV_LINKS, ROUTE_LINKS, SITE_NAME } from "@/lib/constants"
import { useAuth } from "@/lib/auth"
import { useTheme } from "@/lib/theme"
import { useActiveSection } from "@/lib/useActiveSection"
import { useModalBehavior } from "@/lib/useModal"
import { QuickNav } from "@/components/QuickNav"
import { cn } from "@/lib/utils"

export const PAGE_LINKS = [
  { label: "Турниры", href: "/tournaments" },
  { label: "Новости", href: "/news" },
]

// Якоря без "#" — для IntersectionObserver.
const SECTION_IDS = NAV_LINKS.filter((l) => l.href.startsWith("#")).map((l) =>
  l.href.slice(1)
)

const linkClasses =
  "group relative text-sm font-semibold text-white/75 hover:text-white transition-colors duration-200 py-1.5 whitespace-nowrap shrink-0"

function GoldUnderline({ active = false }: { active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -bottom-0.5 left-1/2 h-0.5 w-3/5 -translate-x-1/2 rounded-full bg-gold origin-center transition-all duration-200 ease-out motion-reduce:transition-none",
        active
          ? "scale-x-100 opacity-100"
          : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100"
      )}
    />
  )
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const isHome = pathname === "/"
  const isAuthenticated = !!user
  const drawerRef = useRef<HTMLDivElement | null>(null)

  // Активная секция лендинга — только на главной.
  const activeSection = useActiveSection(SECTION_IDS, isHome)

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useModalBehavior(menuOpen, closeMenu, drawerRef)

  // Drawer закрывается при смене маршрута (browser back/forward, прямые ссылки).
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Страницы: на главной — Турниры/Новости (+Кабинет), внутри сайта —
  // ROUTE_LINKS уже содержат их, добавляем только Кабинет. Без дублей.
  const pageLinks = isHome
    ? [...PAGE_LINKS, ...(isAuthenticated ? [{ label: "Кабинет", href: "/cabinet" }] : [])]
    : [...ROUTE_LINKS, ...(isAuthenticated ? [{ label: "Кабинет", href: "/cabinet" }] : [])]

  const authActions = !isAuthenticated ? (
    <>
      <Link href="/login" className={linkClasses}>
        Войти
        <GoldUnderline active={pathname === "/login"} />
      </Link>
      <Link href="/register">
        <Button
          size="sm"
          className="ml-1 h-9 px-5 text-sm bg-gold text-dark-blue hover:bg-accent-warm-light font-bold shadow-sm shadow-gold/20"
        >
          Регистрация
        </Button>
      </Link>
    </>
  ) : (
    <div className="flex items-center gap-2.5 shrink-0">
      <Link
        href="/cabinet"
        className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
      >
        <span className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center">
          <UserRound size={14} className="text-gold" />
        </span>
        <span className="text-sm font-semibold text-white/90 max-w-[120px] truncate">
          {user.username}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="text-white/75 hover:text-white h-9 px-3 text-sm gap-1.5"
        onClick={logout}
      >
        <LogOut size={15} />
        Выйти
      </Button>
    </div>
  )

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[5.5rem] bg-dark-blue/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20">
      <div className="mx-auto max-w-[1440px] px-6 h-full flex items-center gap-6 min-[1440px]:gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group" aria-label="Кекушин Карате — на главную">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center transition-colors duration-200 group-hover:bg-gold/25">
            <span className="text-gold font-extrabold text-base" aria-hidden="true">極</span>
          </div>
          <span className="leading-tight hidden sm:block">
            <span className="block font-display font-extrabold text-[15px] text-white tracking-tight">
              {SITE_NAME}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/80">
              Кёкушинкай
            </span>
          </span>
        </Link>

        {/* Desktop: якоря текущей страницы (только главная, широкий экран) */}
        {isHome && (
          <nav aria-label="Разделы страницы" className="hidden min-[1440px]:flex items-center gap-5 shrink-0">
            {NAV_LINKS.map((link) => {
              const id = link.href.slice(1)
              const active = activeSection === id
              return link.href.startsWith("#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "location" : undefined}
                  className={cn(linkClasses, active && "text-white")}
                >
                  {link.label}
                  <GoldUnderline active={active} />
                </a>
              ) : null
            })}
          </nav>
        )}

        {/* Фирменный hairline-разделитель групп (dojo-line) */}
        <span
          aria-hidden="true"
          className="hidden min-[1440px]:block dojo-divider-v shrink-0"
        />

        {/* Desktop: страницы */}
        <nav aria-label="Основная навигация" className="hidden lg:flex items-center gap-5 ml-auto shrink-0">
          {pageLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(linkClasses, pathname === link.href && "text-white")}
            >
              {link.label}
              <GoldUnderline active={pathname === link.href} />
            </Link>
          ))}
          {authActions}
        </nav>

        {/* Actions: QuickNav + тема */}
        <div className="hidden lg:flex items-center gap-2.5 ml-auto lg:ml-0 shrink-0">
          <QuickNav />
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-gold hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-2.5 ml-auto lg:hidden">
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-gold hover:bg-white/10 transition-colors cursor-pointer"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={drawerRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden absolute top-full left-0 right-0 bg-navy/95 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/40 rounded-b-2xl overflow-hidden"
          >
            <nav
              id="mobile-nav"
              aria-label="Мобильная навигация"
              className="flex flex-col py-4 px-6 max-h-[70vh] overflow-y-auto"
            >
              {isHome && (
                <>
                  <p className="px-4 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold/70">
                    На этой странице
                  </p>
                  <div className="flex flex-col gap-1 mb-3">
                    {NAV_LINKS.map((link) => {
                      const active = activeSection === link.href.slice(1)
                      return (
                        <a
                          key={link.href}
                          href={link.href}
                          onClick={closeMenu}
                          aria-current={active ? "location" : undefined}
                          className={cn(
                            "py-3 px-4 text-sm font-semibold rounded-xl transition-all border-l-2",
                            active
                              ? "text-white bg-white/10 border-gold"
                              : "text-white/70 hover:text-white hover:bg-white/10 border-transparent"
                          )}
                        >
                          {link.label}
                        </a>
                      )
                    })}
                  </div>
                </>
              )}

              <p className="px-4 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold/70">
                Разделы
              </p>
              <div className="flex flex-col gap-1 mb-3">
                {pageLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={cn(
                      "py-3 px-4 text-sm font-semibold rounded-xl transition-all border-l-2",
                      pathname === link.href
                        ? "text-white bg-white/10 border-gold"
                        : "text-white/70 hover:text-white hover:bg-white/10 border-transparent"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <p className="px-4 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold/70">
                Кабинет
              </p>
              <div className="flex flex-col gap-1 pb-2">
                {!isAuthenticated ? (
                  <>
                    <Link
                      href="/login"
                      onClick={closeMenu}
                      className="py-3 px-4 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                      Войти
                    </Link>
                    <Link
                      href="/register"
                      onClick={closeMenu}
                      className="py-3 px-4 mt-1 text-sm font-bold text-dark-blue bg-gold hover:bg-accent-warm-light rounded-xl transition-all text-center"
                    >
                      Регистрация
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      logout()
                      closeMenu()
                    }}
                    className="py-3 px-4 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all text-left cursor-pointer"
                  >
                    Выйти ({user.username})
                  </button>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
