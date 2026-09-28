// Phase 1: единый каркас страниц платформы (Navbar + контент + Footer).
// Существующие страницы мигрируют на него постепенно; новые — сразу.

import type { ReactNode } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: ReactNode
  /** Светлый фон по умолчанию; live/tv и тёмные разделы — dark. */
  tone?: "light" | "dark"
  className?: string
}

export default function AppShell({ children, tone = "light", className }: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen flex flex-col",
        tone === "dark" ? "bg-dark-blue text-white" : "bg-white",
        className
      )}
    >
      <a href="#main-content" className="kwf-skip-link">
        Перейти к содержимому
      </a>
      <Navbar />
      {/* Отступ под фиксированный header h-[5.5rem]. */}
      <main id="main-content" className="flex-grow pt-[5.5rem]" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
