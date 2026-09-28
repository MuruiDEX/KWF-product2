"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, Info } from "lucide-react"

export type ToastTone = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const TONE_STYLE: Record<ToastTone, string> = {
  success: "border-success/40",
  error: "border-error/40",
  info: "border-primary-blue/40",
}

const TONE_ICON: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const TONE_ICON_COLOR: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-error",
  info: "text-primary-blue",
}

let nextId = 1

/** Показать тост из любого клиентского кода (без контекста). */
export function toast(message: string, tone: ToastTone = "info") {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<ToastItem>("kwf-toast", {
      detail: { id: nextId++, message, tone },
    })
  )
}

/** Хостер тостов. Монтируется один раз в RootLayout. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const onToast = (e: Event) => {
      const item = (e as CustomEvent<ToastItem>).detail
      setItems((prev) => [...prev.slice(-3), item])
      setTimeout(() => dismiss(item.id), 4500)
    }
    window.addEventListener("kwf-toast", onToast)
    return () => window.removeEventListener("kwf-toast", onToast)
  }, [dismiss])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
    >
      {items.map((t) => {
        const Icon = TONE_ICON[t.tone]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`flex items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-left text-sm font-medium text-dark-text shadow-lg dark:bg-[#0E2035] dark:text-slate-100 ${TONE_STYLE[t.tone]}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_ICON_COLOR[t.tone]}`} />
            <span className="leading-snug">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}
