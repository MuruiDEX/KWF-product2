"use client"

import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Newspaper, Trophy, Users, LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useModalBehavior } from "@/lib/useModal"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  // Фаза 5: мобильный drawer вместо обрезанного w-64 сайдбара.
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLElement | null>(null)
  useModalBehavior(menuOpen, () => setMenuOpen(false), drawerRef)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push("/login")
    } else if (user.profile?.role !== "trainer" && !user.is_staff) {
      router.push("/cabinet")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-gray">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user || (user.profile?.role !== "trainer" && !user.is_staff)) return null

  const navItems = [
    { label: "Дашборд", href: "/admin", icon: LayoutDashboard },
    { label: "Новости", href: "/admin/news", icon: Newspaper },
    { label: "Турниры", href: "/admin/tournaments", icon: Trophy },
    { label: "Участники", href: "/admin/athletes", icon: Users },
  ]

  const renderSidebarBody = (onNavigate: () => void) => (
    <>
      <div className="p-6 border-b border-white/10 flex items-center gap-3">
        {/* Логотип-тайл намеренно светлый в обеих темах (слой .dark .bg-white его бы затемнил) */}
        <div className="w-8 h-8 rounded-lg bg-white dark:bg-white flex items-center justify-center">
          <span className="text-dark-blue font-extrabold text-sm">極</span>
        </div>
        <span className="font-bold text-lg">Админ-панель</span>
      </div>

      <nav aria-label="Разделы админ-панели" className="flex-grow p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-primary-blue text-white shadow-lg shadow-primary-blue/20"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
            {user.username[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{user.username}</p>
            <p className="text-[10px] text-white/75 truncate">
              {user.is_staff ? "Администратор" : "Тренер"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-white/70 hover:text-white hover:bg-white/10 h-11 px-4"
          onClick={() => {
            onNavigate()
            logout()
            router.push("/login")
          }}
        >
          <LogOut size={20} />
          <span>Выйти</span>
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-light-gray flex">
      {/* Sidebar: десктоп */}
      <aside className="hidden lg:flex w-64 bg-dark-blue text-white flex-col sticky top-0 h-screen shrink-0">
        {renderSidebarBody(() => {})}
      </aside>

      {/* Sidebar: мобильный drawer */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Меню админ-панели"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-dark-blue text-white flex flex-col shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Закрыть меню"
              className="absolute top-4 right-4 w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            {renderSidebarBody(() => setMenuOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Мобильная шапка с бургером */}
        <div className="lg:hidden sticky top-0 z-40 bg-dark-blue text-white border-b border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Открыть меню"
              aria-expanded={menuOpen}
              className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Menu size={18} />
            </button>
            <span className="font-bold">Админ-панель</span>
          </div>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-[1200px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
