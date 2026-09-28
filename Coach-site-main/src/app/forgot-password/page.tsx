"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { api, apiErrorMessage } from "@/lib/api"

/** P1: запрос ссылки сброса пароля. Ответ всегда одинаковый
 * (anti-enumeration на backend), поэтому сразу показываем успех. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api("/api/auth/password-reset/", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
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
              Восстановление пароля
            </h1>
          </div>

          {done ? (
            <div
              role="status"
              className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800"
            >
              Если такой email зарегистрирован, мы отправили на него ссылку
              для сброса пароля. Проверьте почту.
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
              <p className="text-sm text-secondary-text">
                Введите email из вашего профиля — пришлём ссылку для установки
                нового пароля.
              </p>
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
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
                {loading ? "Отправка..." : "Отправить ссылку"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-secondary-text mt-6">
            Вспомнили пароль?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary-blue hover:text-primary-blue-light transition-colors"
            >
              Войти
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
