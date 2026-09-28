/**
 * F3: минимальный service worker.
 *
 * Стратегия:
 * - навигация (document): network-first, при офлайне — /offline;
 * - /_next/static/* и иконки: cache-first (иммутабельные ассеты);
 * - /api/* и остальное: не перехватываем (живые данные, auth-cookie).
 * Версионирование — через CACHE_VERSION: деплой новой версии чистит старое.
 */

const CACHE_VERSION = "kwf-v1"
const STATIC_CACHE = `${CACHE_VERSION}-static`
const OFFLINE_URL = "/offline"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("kwf-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // API и служебные роуты — всегда живьём, без кэша.
  if (url.pathname.startsWith("/api/") || url.pathname === "/env.js") return

  // Иммутабельные ассеты сборки + иконки: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ??
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone())
              return res
            })
        )
      )
    )
    return
  }

  // Навигация: сеть, при провале — офлайн-страница.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match(OFFLINE_URL))
    )
  }
})
