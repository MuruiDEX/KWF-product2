"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import {
  apiErrorMessage,
  fetchCookieHints,
  isCookiesBlockedError,
} from "@/lib/api"

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "parent" as "parent" | "trainer",
  })
  const [error, setError] = useState("")
  const [cookieHints, setCookieHints] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setCookieHints([])
    setLoading(true)
    try {
      await register({
        ...form,
        username: form.username.trim(),
        email: form.email.trim(),
      })
      router.push("/cabinet")
    } catch (err) {
      if (isCookiesBlockedError(err)) {
        setError("Регистрация прошла, но браузер не сохранил cookies авторизации.")
        setCookieHints(await fetchCookieHints())
      } else {
        setError(apiErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

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
              Регистрация
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-first-name" className="block text-sm font-semibold text-dark-text mb-1.5">
                  Имя
                </label>
                <input
                  id="reg-first-name"
                  type="text"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
              </div>
              <div>
                <label htmlFor="reg-last-name" className="block text-sm font-semibold text-dark-text mb-1.5">
                  Фамилия
                </label>
                <input
                  id="reg-last-name"
                  type="text"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-username" className="block text-sm font-semibold text-dark-text mb-1.5">
                Имя пользователя *
              </label>
              <input
                id="reg-username"
                type="text"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-dark-text mb-1.5">
                Email *
              </label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-semibold text-dark-text mb-1.5">
                Пароль *
              </label>
              <input
                id="reg-password"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
                minLength={8}
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-dark-text mb-1.5">
                Роль *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="parent"
                    checked={form.role === "parent"}
                    onChange={() => setForm({ ...form, role: "parent" })}
                    className="text-primary-blue focus:ring-primary-blue rounded border"
                  />
                  Родитель
                </label>
                <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="trainer"
                    checked={form.role === "trainer"}
                    onChange={() => setForm({ ...form, role: "trainer" })}
                    className="text-primary-blue focus:ring-primary-blue rounded border"
                  />
                  Тренер
                </label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>
          </form>

          <p className="text-center text-sm text-secondary-text mt-6">
            Уже есть аккаунт?{" "}
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