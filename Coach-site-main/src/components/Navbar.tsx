"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, LogOut, UserRound, Sun, Moon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NAV_LINKS, ROUTE_LINKS, SITE_NAME } from "@/lib/constants"
import { useAuth } from "@/lib/auth"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export const PAGE_LINKS = [
  { label: "Турниры", href: "/tournaments" },
  { label: "Новости", href: "/news" },
]

export const SEPARATOR = "|"

const linkClasses =
  "group relative text-sm font-semibold text-white/60 hover:text-white transition-colors duration-200 py-1.5 whitespace-nowrap shrink-0"

const separatorClasses = "text-white/20 text-sm font-semibold"

function GoldUnderline() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-0.5 left-1/2 h-0.5 w-3/5 -translate-x-1/2 rounded-full bg-gold origin-center scale-x-0 opacity-0 transition-all duration-300 ease-out group-hover:scale-x-100 group-hover:opacity-100 motion-reduce:transition-none"
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

  // Section nav items: Nav_LINKS on home, ROUTE_LINKS on other pages
  const sectionLinks = isHome ? NAV_LINKS : ROUTE_LINKS

  // Page nav items: always PAGE_LINKS + auth-related
  const pageLinks = [
    ...PAGE_LINKS,
    ...(isAuthenticated
      ? [
          { label: "Кабинет", href: "/cabinet" },
        ]
      : []),
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[5.5rem] bg-dark-blue/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20">
      <div className="mx-auto max-w-[1440px] px-6 h-full flex items-center gap-8 min-[1440px]:gap-10">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center transition-colors duration-300 group-hover:bg-gold/25">
            <span className="text-gold font-extrabold text-base">極</span>
          </div>
          <span className="leading-tight hidden sm:block">
            <span className="block font-extrabold text-[15px] text-white tracking-tight">
              {SITE_NAME}
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/80">
              Кёкушинкай
            </span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden min-[1440px]:flex items-center gap-5 ml-auto shrink-0">

          {/* Section navigation (anchors on home, page routes on other pages) */}
          {sectionLinks.map((link) =>
            isHome && link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                className={linkClasses}
              >
                {link.label}
                <GoldUnderline />
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={cn(linkClasses, pathname === link.href && "text-white")}
              >
                {link.label}
                <GoldUnderline />
              </Link>
            )
          )}

          {/* Separator */}
          <span className={separatorClasses} aria-hidden="true">
            {SEPARATOR}
          </span>

          {/* Page navigation (tournament/news/cabinet links) */}
          {pageLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(linkClasses, pathname === link.href && "text-white")}
            >
              {link.label}
              <GoldUnderline />
            </Link>
          ))}

          {/* Auth buttons */}
          {isHome && !isAuthenticated && (
            <Link href="/register">
              <Button
                size="sm"
                className="ml-1 h-9 px-5 text-sm bg-gold text-dark-blue hover:bg-accent-warm-light font-bold shadow-sm shadow-gold/20"
              >
                Регистрация
              </Button>
            </Link>
          )}

          {!isHome && !isAuthenticated && (
            <>
              <Link href="/login" className={linkClasses}>
                Войти
                <GoldUnderline />
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
          )}

          {isAuthenticated && (
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
          )}

        </nav>

        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 hidden min-[1440px]:flex items-center justify-center text-gold hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Mobile menu button */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            className="min-[1440px]:hidden w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-gold hover:bg-white/10 transition-colors cursor-pointer"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="min-[1440px]:hidden w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Меню"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="min-[1440px]:hidden absolute top-full left-0 right-0 bg-navy/95 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/40 rounded-b-2xl overflow-hidden"
          >
            <nav className="flex flex-col py-4 px-6 max-h-[70vh] overflow-y-auto">

              {/* Section navigation */}
              <div className="flex flex-col gap-1 mb-2">
                {sectionLinks.map((link) =>
                  isHome && link.href.startsWith("#") ? (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="py-3 px-4 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="py-3 px-4 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>

              {/* Separator */}
              <div className="px-4 py-2">
                <span className={separatorClasses}>{SEPARATOR}</span>
              </div>

              {/* Page navigation */}
              <div className="flex flex-col gap-1 mb-2">
                {pageLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 px-4 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    {link.label}
                  </Link>
                ))}

                {isHome && !isAuthenticated && (
                  <Link
                    href="/register"
                    onClick={() => setMenuOpen(false)}
                    className="py-3 px-4 mt-1 text-sm font-bold text-dark-blue bg-gold hover:bg-accent-warm-light rounded-xl transition-all text-center"
                  >
                    Регистрация
                  </Link>
                )}

                {!isHome && !isAuthenticated && (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="py-3 px-4 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                      Войти
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMenuOpen(false)}
                      className="py-3 px-4 mt-1 text-sm font-bold text-dark-blue bg-gold hover:bg-accent-warm-light rounded-xl transition-all text-center"
                    >
                      Регистрация
                    </Link>
                  </>
                )}

                {isAuthenticated && (
                  <button
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
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
