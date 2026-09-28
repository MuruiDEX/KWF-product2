"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { api, apiErrorMessage } from "@/lib/api"

/** P1: установка нового пароля по uid+token из письма. */
function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const uid = searchParams.get("uid") ?? ""
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Пароли не совпадают.")
      return
    }
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов.")
      return
    }
    setLoading(true)
    try {
      await api("/api/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({ uid, token, new_password: password }),
      })
      setDone(true)
    } catch (err) {
      setError(apiErrorMessage(err))
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
              Новый пароль
            </h1>
          </div>

          {!uid || !token ? (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600"
            >
              Недействительная ссылка сброса. Запросите новую на странице{" "}
              <Link href="/forgot-password" className="font-semibold underline">
                восстановления пароля
              </Link>
              .
            </div>
          ) : done ? (
            <div
              role="status"
              className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800"
            >
              Пароль изменён. Теперь вы можете{" "}
              <Link href="/login" className="font-semibold underline">
                войти
              </Link>{" "}
              с новым паролем.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600"
                >
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="reset-password"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Новый пароль
                </label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="reset-confirm"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Повторите пароль
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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
                {loading ? "Сохранение..." : "Установить пароль"}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  // useSearchParams требует Suspense-границы (Next 16).
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-light-gray px-4">
          <div
            role="status"
            aria-label="Загрузка"
            className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"
          />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
