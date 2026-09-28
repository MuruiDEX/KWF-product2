"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useModalBehavior } from "@/lib/useModal"

export interface AthleteFormState {
  first_name: string
  last_name: string
  birth_date: string
  weight: string
  height: string
  gender: "male" | "female"
  club: string
}

export const EMPTY_ATHLETE_FORM: AthleteFormState = {
  first_name: "",
  last_name: "",
  birth_date: "",
  weight: "",
  height: "",
  gender: "male",
  club: "",
}

interface AthleteModalProps {
  open: boolean
  mode: "add" | "edit"
  form: AthleteFormState
  setForm: (form: AthleteFormState) => void
  error: string
  todayStr: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const inputClasses =
  "w-full h-11 px-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 transition-all"

/** Фаза 4: общая модалка добавления/редактирования спортсмена.
 * Раньше — два near-дубликата инлайн в page.tsx без focus-trap/Escape.
 * Поля, валидация и классы — как были; добавлен useModalBehavior. */
export function AthleteModal({
  open,
  mode,
  form,
  setForm,
  error,
  todayStr,
  onClose,
  onSubmit,
}: AthleteModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalBehavior(open, onClose, panelRef)

  if (!open) return null

  const title = mode === "add" ? "Добавить ребёнка" : "Изменить данные"
  const submitLabel = mode === "add" ? "Добавить" : "Сохранить"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
        <h3 className="text-xl font-bold text-dark-text mb-4">{title}</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 dark:bg-error/15 dark:border-error/40 dark:text-[#FCA5A5]">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`athlete-${mode}-first-name`} className="block text-sm font-semibold text-dark-text mb-1.5">
                Имя *
              </label>
              <input
                id={`athlete-${mode}-first-name`}
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
                minLength={2}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor={`athlete-${mode}-last-name`} className="block text-sm font-semibold text-dark-text mb-1.5">
                Фамилия *
              </label>
              <input
                id={`athlete-${mode}-last-name`}
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
                minLength={2}
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`athlete-${mode}-birth-date`} className="block text-sm font-semibold text-dark-text mb-1.5">
              Дата рождения *
            </label>
            <input
              id={`athlete-${mode}-birth-date`}
              type="date"
              value={form.birth_date}
              max={todayStr}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              required
              className={inputClasses}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`athlete-${mode}-weight`} className="block text-sm font-semibold text-dark-text mb-1.5">
                Вес (кг) *
              </label>
              <input
                id={`athlete-${mode}-weight`}
                type="number"
                step="0.1"
                min="0.1"
                value={form.weight}
                onChange={(e) =>
                  setForm({ ...form, weight: e.target.value.replace(",", ".") })
                }
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor={`athlete-${mode}-height`} className="block text-sm font-semibold text-dark-text mb-1.5">
                Рост (см)
              </label>
              <input
                id={`athlete-${mode}-height`}
                type="number"
                step="0.1"
                value={form.height}
                onChange={(e) =>
                  setForm({ ...form, height: e.target.value.replace(",", ".") })
                }
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-semibold text-dark-text mb-1.5">
              Пол *
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-dark-text">
                <input
                  type="radio"
                  name={`athlete-gender-${mode}`}
                  value="male"
                  checked={form.gender === "male"}
                  onChange={() => setForm({ ...form, gender: "male" })}
                  className="text-primary-blue focus:ring-primary-blue"
                />
                Мальчик
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-text">
                <input
                  type="radio"
                  name={`athlete-gender-${mode}`}
                  value="female"
                  checked={form.gender === "female"}
                  onChange={() => setForm({ ...form, gender: "female" })}
                  className="text-primary-blue focus:ring-primary-blue"
                />
                Девочка
              </label>
            </div>
          </div>

          <div>
            <label htmlFor={`athlete-${mode}-club`} className="block text-sm font-semibold text-dark-text mb-1.5">
              {mode === "add" ? "Клуб / тренер *" : "Клуб / тренер"}
            </label>
            <input
              id={`athlete-${mode}-club`}
              type="text"
              value={form.club}
              onChange={(e) => setForm({ ...form, club: e.target.value })}
              required={mode === "add"}
              maxLength={200}
              placeholder="KWF Pavlodar / Иванов А.А."
              className={inputClasses}
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
            <Button type="submit" className="h-10 px-5 text-sm">
              {submitLabel}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
