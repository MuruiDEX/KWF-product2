"use client"

import { Layout, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { autoCategoryName } from '@/lib/categoryUtils'
import type { CategoryDraft, CategoryFormState } from './wizardTypes'

interface Props {
  categories: CategoryDraft[]
  form: CategoryFormState
  onFormChange: (patch: Partial<CategoryFormState>) => void
  onAdd: () => void
  onAskRemove: (cat: CategoryDraft) => void
  catTitle: (cat: CategoryDraft) => string
}

export function StepCategories({ categories, form, onFormChange, onAdd, onAskRemove, catTitle }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-dark-blue rounded-2xl text-gold shrink-0">
          <Layout size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-dark-text">Настройка категорий</h2>
          <p className="text-sm text-secondary-text mt-0.5">Пол, возраст и весовые ограничения каждой категории</p>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 dark:bg-white/5 dark:border-[#1E3A5F] transition-colors space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label htmlFor="c-gender" className="text-sm font-semibold text-gray-600">Пол</label>
            <select
              id="c-gender"
              value={form.gender}
              onChange={(e) => onFormChange({ gender: e.target.value })}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-blue outline-none transition-all min-h-[44px]"
            >
              <option value="male">Мальчики</option>
              <option value="female">Девочки</option>
              <option value="any">Любые</option>
            </select>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-gray-600" id="c-age-label">Возраст (от - до)</span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="c-age-label">
              <input
                type="number"
                value={form.age_min}
                onChange={(e) => onFormChange({ age_min: parseInt(e.target.value) })}
                aria-label="Минимальный возраст"
                className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[44px]"
              />
              <span className="text-gray-400">—</span>
              <input
                type="number"
                value={form.age_max}
                onChange={(e) => onFormChange({ age_max: parseInt(e.target.value) })}
                aria-label="Максимальный возраст"
                className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[44px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-gray-600" id="c-weight-label">Вес (от – до, кг)</span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="c-weight-label">
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.weight_min}
                onChange={(e) => onFormChange({ weight_min: parseFloat(e.target.value) || 0 })}
                aria-label="Минимальный вес"
                className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[44px]"
              />
              <span className="text-gray-400">—</span>
              <input
                type="number"
                value={form.weight_max}
                onChange={(e) => onFormChange({ weight_max: parseFloat(e.target.value) })}
                aria-label="Максимальный вес"
                className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none min-h-[44px]"
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-secondary-text">
          Название: <span className="font-bold text-dark-text">{autoCategoryName({ ...form, id: "preview" })}</span>
        </p>
        <Button
          onClick={onAdd}
          className="w-full py-6 rounded-xl bg-primary-blue hover:bg-primary-blue/90 text-white font-bold flex items-center justify-center gap-2 min-h-[44px]"
        >
          <Plus size={20} />
          Добавить категорию
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-center text-sm text-secondary-text py-6">
          Категорий пока нет — добавьте первую выше. Продолжить можно только с хотя бы одной категорией.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="p-4 rounded-2xl border border-gray-200 bg-white flex items-center justify-between group hover:border-primary-blue transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0 kwf-numeric">
                  {idx + 1}
                </div>
                <p className="font-bold text-dark-text truncate">
                  {catTitle(cat)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAskRemove(cat)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl shrink-0 min-h-[44px]"
              >
                Удалить
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
