"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useModalBehavior } from "@/lib/useModal"

interface LinkChildModalProps {
  open: boolean
  code: string
  setCode: (code: string) => void
  error: string
  linking: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

/** Фаза 4: модалка привязки ребёнка по коду (была инлайн в page.tsx
 * без focus-trap/Escape). Поля и логика — как были. */
export function LinkChildModal({
  open,
  code,
  setCode,
  error,
  linking,
  onClose,
  onSubmit,
}: LinkChildModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(open, onClose, panelRef)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Привязать ребёнка"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold text-dark-text mb-2">
          Привязать ребёнка
        </h3>
        <p className="text-sm text-secondary-text mb-4 leading-relaxed">
          Введите код, который выдал тренер. Ребёнок уже должен существовать
          в базе — новая запись создана не будет.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 dark:bg-error/15 dark:border-error/40 dark:text-[#FCA5A5]">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="link-code" className="block text-sm font-semibold text-dark-text mb-1.5">
              Код привязки *
            </label>
            <input
              id="link-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Например: A1B2C3D4"
              required
              minLength={4}
              maxLength={32}
              autoComplete="off"
              className="w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm font-mono font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="h-10 px-4 text-sm"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm"
              disabled={linking}
            >
              {linking ? "Привязка..." : "Привязать"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
