"use client"

import { useEffect } from "react"

/**
 * F3: разовая регистрация service worker.
 * Только production (в dev SW давал бы stale-ассеты).
 * Провал — тихо: приложение полностью работает без PWA.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    })
  }, [])
  return null
}
