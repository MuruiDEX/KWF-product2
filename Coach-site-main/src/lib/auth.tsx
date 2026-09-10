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
  api,
  setTokens,
  clearTokens,
  getAccessToken,
} from "@/lib/api"
import type { MeUser } from "@/lib/types"

interface AuthContextType {
  user: MeUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: {
    username: string
    email: string
    password: string
    first_name?: string
    last_name?: string
    role: "parent" | "trainer"
  }) => Promise<void>
  logout: () => void
  updateUser: (data: Record<string, unknown>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null)
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      return !!getAccessToken()
    } catch {
      return false
    }
  })

  useEffect(() => {
    let token: string | null = null
    try {
      token = getAccessToken()
    } catch {
      token = null
    }
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const me = await api<MeUser>("/api/auth/me/")
        if (!cancelled) setUser(me)
      } catch {
        clearTokens()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await api<{ access: string; refresh: string }>(
      "/api/auth/token/",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    )
    setTokens(data.access, data.refresh)
    const me = await api<MeUser>("/api/auth/me/")
    setUser(me)
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
      const data = await api<{
        user: MeUser
        access: string
        refresh: string
      }>("/api/auth/register/", {
        method: "POST",
        body: JSON.stringify(formData),
      })
      setTokens(data.access, data.refresh)
      // Не доверяем вложенному data.user (исторически там мог быть stale
      // профиль): перечитываем /me/ как в login(). Fallback — data.user.
      try {
        const me = await api<MeUser>("/api/auth/me/")
        setUser(me)
      } catch {
        setUser(data.user)
      }
    },
    []
  )

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
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
      value={{ user, loading, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
