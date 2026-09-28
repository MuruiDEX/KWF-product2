"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  ApiError,
  api,
  AUTH_EXPIRED_EVENT,
  clearLegacyTokens,
  cookiesBlockedError,
  resetCsrfToken,
} from "@/lib/api"
import type { MeUser } from "@/lib/types"

interface AuthContextType {
  user: MeUser | null
  loading: boolean
  /** Нет сети: user==null в этом случае НЕ означает «не залогинен». */
  offline: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: {
    username: string
    email: string
    password: string
    first_name?: string
    last_name?: string
    role: "parent" | "trainer"
  }) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Record<string, unknown>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  )

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  useEffect(() => {
    // Чистим остатки localStorage-токенов прошлой версии (теперь cookies).
    clearLegacyTokens()
    let cancelled = false
    async function load() {
      try {
        // /me/ теперь с silent refresh: перезагрузка страницы с протухшим
        // access, но живым refresh больше не выкидывает из аккаунта.
        const me = await api<MeUser>("/api/auth/me/")
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    // refresh окончательно мёртв → выходим везде одинаково: чистим user,
    // страницы сами уйдут на /login. Флаг для пояснения на странице входа.
    const onExpired = () => {
      try {
        sessionStorage.setItem("kwf-expired", "1")
      } catch {
        /* ignore */
      }
      setUser(null)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    void load()
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    // Токены уходят в HttpOnly cookies на backend, в ответе их нет.
    resetCsrfToken()
    await api<{ detail: string }>(
      "/api/auth/token/",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    )
    // Проверяем установку сессии: token 200 + /me/ 401 означает, что
    // браузер отклонил cookies (Secure/Domain/SameSite) — дальше всё
    // равно будет 401, поэтому падаем сразу с честной ошибкой.
    try {
      const me = await api<MeUser>("/api/auth/me/")
      setUser(me)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw cookiesBlockedError()
      }
      throw e
    }
  }, [])

  const register = useCallback(
    async (formData: {
      username: string
      email: string
      password: string
      first_name?: string
      last_name?: string
      role: "parent" | "trainer"
    }) => {
      resetCsrfToken()
      const data = await api<{
        user: MeUser
      }>("/api/auth/register/", {
        method: "POST",
        body: JSON.stringify(formData),
      })
      // Не доверяем вложенному data.user (исторически там мог быть stale
      // профиль): перечитываем /me/ как в login().
      // ВАЖНО: fallback запрещён при 401 — иначе register с отклонёнными
      // cookies создаст фальшивое «залогинен»-состояние (data.user есть
      // в теле ответа, а рабочей сессии нет).
      try {
        const me = await api<MeUser>("/api/auth/me/")
        setUser(me)
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          throw cookiesBlockedError()
        }
        // Сеть упала (status 0): ответ register мог не дойти, кук может не
        // быть — фальшивый «залогинен» хуже честной ошибки.
        if (e instanceof ApiError && e.status === 0) {
          throw e
        }
        setUser(data.user)
      }
    },
    []
  )

  const logout = useCallback(async () => {
    // Сначала отзываем refresh на сервере — иначе валидный refresh
    // остаётся в HttpOnly-jar (стереть его из JS нельзя) и следующая
    // загрузка молча воскресит сессию через silent refresh.
    resetCsrfToken()
    try {
      await api("/api/auth/logout/", { method: "POST" })
    } catch {
      // best-effort: из UI всё равно выходим, сервер уже получил шанс.
    } finally {
      setUser(null)
    }
  }, [])

  const updateUser = useCallback(
    async (profileData: Record<string, unknown>) => {
      const me = await api<MeUser>("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify(profileData),
      })
      setUser(me)
    },
    []
  )

  return (
    <AuthContext.Provider
      value={{ user, loading, offline, login, register, logout, updateUser }}
    >
      {children}
      {offline && (
        <div
          role="alert"
          className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-lg dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-200"
        >
          Нет соединения с интернетом — проверьте сеть. Данные могут устареть.
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
