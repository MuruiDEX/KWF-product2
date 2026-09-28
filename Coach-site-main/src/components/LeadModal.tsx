"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import { useModalBehavior } from "@/lib/useModal"
import { LEAD_PLANS, type Lead, type LeadPlan } from "@/lib/types"
import { Button } from "@/components/ui/button"

interface LeadModalProps {
  open: boolean
  onClose: () => void
  /** Предвыбранный тариф (карточка Pricing, CTA, расписание). */
  initialPlan?: LeadPlan
  /** Откуда заявка (pricing / cta / schedule). */
  source?: string
}

/** P1: заявка с лендинга — сохраняется в CRM (POST /api/leads/),
 * а не только уходит в WhatsApp. Публичная, без логина. */
export function LeadModal({ open, onClose, initialPlan = "trial", source = "" }: LeadModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(open, onClose, panelRef)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [plan, setPlan] = useState<LeadPlan>(initialPlan)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Сброс при каждом открытии (план — от кнопки, по которой кликнули).
  /* eslint-disable react-hooks/set-state-in-effect -- сброс формы модалки при открытии */
  useEffect(() => {
    if (open) {
      setName("")
      setPhone("")
      setPlan(initialPlan)
      setMessage("")
      setError("")
      setBusy(false)
      setDone(false)
    }
  }, [open, initialPlan])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await api<Lead>("/api/leads/", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          plan,
          message: message.trim(),
          source,
        }),
      })
      setDone(true)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Заявка на занятие"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 size={44} className="mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-extrabold text-dark-text mb-2">
              Заявка отправлена!
            </h2>
            <p className="text-sm text-secondary-text mb-6">
              Тренер свяжется с вами в ближайшее время для подтверждения.
            </p>
            <Button onClick={onClose} className="w-full">
              Хорошо
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-dark-text mb-1">
              Оставить заявку
            </h2>
            <p className="text-sm text-secondary-text mb-5">
              Перезвоним и договоримся об удобном времени.
            </p>
            {error && (
              <div
                role="alert"
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600"
              >
                {error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="lead-name"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Ваше имя
                </label>
                <input
                  id="lead-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={200}
                  disabled={busy}
                  autoComplete="name"
                  placeholder="Как к вам обращаться"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="lead-phone"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Телефон
                </label>
                <input
                  id="lead-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={busy}
                  autoComplete="tel"
                  placeholder="+7 (___) ___-__-__"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="lead-plan"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Что интересует
                </label>
                <select
                  id="lead-plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as LeadPlan)}
                  disabled={busy}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                >
                  {LEAD_PLANS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="lead-message"
                  className="block text-sm font-semibold text-dark-text mb-1.5"
                >
                  Комментарий <span className="font-normal text-secondary-text">(необязательно)</span>
                </label>
                <textarea
                  id="lead-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={busy}
                  rows={3}
                  maxLength={2000}
                  placeholder="Возраст ребёнка, удобное время…"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all resize-y"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={busy}
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? "Отправка…" : "Отправить"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
