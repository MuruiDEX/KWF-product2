"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import {
  apiErrorMessage,
  fetchCookieHints,
  isCookiesBlockedError,
} from "@/lib/api"

function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [expiredNotice, setExpiredNotice] = useState(false)
  const [cookieHints, setCookieHints] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { login, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Возврат на глубокую страницу после входа (напр. после «сессия истекла»).
  // Только внутренние пути — без open-redirect.
  const nextRaw = searchParams.get("next") ?? "/cabinet"
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/cabinet"

  useEffect(() => {
    if (!authLoading && user) {
      router.push(next)
    }
  }, [authLoading, user, router, next])

  // Пояснение «сессия истекла» — только если реально выкинуло из аккаунта,
  // а не при каждом визите на страницу входа.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("kwf-expired") === "1") {
        sessionStorage.removeItem("kwf-expired")
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpiredNotice(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setExpiredNotice(false)
    setCookieHints([])
    setLoading(true)
    try {
      await login(username.trim(), password)
      router.push(next)
    } catch (err) {
      if (isCookiesBlockedError(err)) {
        setError("Вход выполнен, но браузер не сохранил cookies авторизации.")
        // Точная причина вместо гадания: спрашиваем backend-диагностику.
        setCookieHints(await fetchCookieHints())
      } else {
        setError(apiErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-gray px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl border border-border p-8 shadow-xl shadow-dark-blue/10">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-dark-blue border border-gold/30 flex items-center justify-center">
                <span className="text-gold font-extrabold text-base">極</span>
              </div>
            </Link>
            <h1 className="text-2xl font-extrabold text-dark-text">
              Вход в кабинет
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {expiredNotice && !error && (
              <div
                role="status"
                className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800"
              >
                Сессия истекла. Войдите снова, чтобы продолжить.
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600"
              >
                {error}
                {cookieHints.length > 0 && (
                  <ul className="mt-2 space-y-1 list-disc pl-5">
                    {cookieHints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <label htmlFor="login-username" className="block text-sm font-semibold text-dark-text mb-1.5">
                Имя пользователя
              </label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  disabled={loading}
                  aria-invalid={error ? true : undefined}
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-dark-text mb-1.5">
                Пароль
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Вход..." : "Войти"}
            </Button>
          </form>

          <p className="text-center text-sm text-secondary-text mt-6">
            <Link
              href="/forgot-password"
              className="font-semibold text-primary-blue hover:text-primary-blue-light transition-colors"
            >
              Забыли пароль?
            </Link>
          </p>
          <p className="text-center text-sm text-secondary-text mt-2">
            Нет аккаунта?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary-blue hover:text-primary-blue-light transition-colors"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams требует Suspense-границы (Next 16).
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-light-gray px-4">
          <div
            role="status"
            aria-label="Загрузка страницы входа"
            className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
