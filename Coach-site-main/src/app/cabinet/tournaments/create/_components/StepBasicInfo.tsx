"use client"

import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField, TextInput } from '@/components/ui/FormField'
import type { TournamentTemplate } from '@/lib/types'
import type { InfoErrors, TournamentInfoState } from './wizardTypes'

interface Props {
  info: TournamentInfoState
  onChange: (patch: Partial<TournamentInfoState>) => void
  errors: InfoErrors
  templates: TournamentTemplate[]
  templatesLoading: boolean
  selectedTemplateId: string
  onTemplateSelect: (id: string) => void
  onApplyTemplate: () => void
}

const inputClass = (invalid: boolean) =>
  `w-full p-3 rounded-xl border bg-white outline-none transition-all text-sm text-dark-text ${
    invalid
      ? 'border-error focus:ring-2 focus:ring-error/30'
      : 'border-gray-200 focus:ring-2 focus:ring-primary-blue'
  }`

export function StepBasicInfo({
  info,
  onChange,
  errors,
  templates,
  templatesLoading,
  selectedTemplateId,
  onTemplateSelect,
  onApplyTemplate,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-dark-blue rounded-2xl text-gold shrink-0">
          <Trophy size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-dark-text">Основная информация</h2>
          <p className="text-sm text-secondary-text mt-0.5">Название, даты проведения и место турнира</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-light-gray p-4">
        <label htmlFor="t-template" className="block text-sm font-semibold text-dark-text mb-1.5">
          Начать с шаблона <span className="font-normal text-secondary-text">(подставит место, татами и категории)</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            id="t-template"
            value={selectedTemplateId}
            onChange={(e) => onTemplateSelect(e.target.value)}
            disabled={templatesLoading || templates.length === 0}
            className="flex-1 p-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-blue outline-none transition-all text-sm min-h-[44px]"
          >
            <option value="">
              {templatesLoading
                ? "Загрузка шаблонов..."
                : templates.length === 0
                  ? "Нет сохранённых шаблонов"
                  : "Выберите шаблон..."}
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.categories_count} кат.)
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="default"
            className="h-[52px] px-5 text-sm shrink-0"
            disabled={!selectedTemplateId}
            onClick={onApplyTemplate}
          >
            Применить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <FormField label="Название турнира" htmlFor="t-name" error={errors.name}>
            <TextInput
              id="t-name"
              type="text"
              value={info.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Например: Кубок Павлодара 2026"
              invalid={!!errors.name}
              className="p-3 h-auto rounded-xl"
            />
          </FormField>
        </div>

        <FormField label="Дата начала *" htmlFor="t-start-date" error={errors.start_date}>
          <input
            id="t-start-date"
            type="date"
            value={info.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
            aria-invalid={!!errors.start_date || undefined}
            className={`${inputClass(!!errors.start_date)} min-h-[44px]`}
          />
        </FormField>

        <FormField label="Дата окончания *" htmlFor="t-end-date" error={errors.end_date}>
          <input
            id="t-end-date"
            type="date"
            value={info.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
            aria-invalid={!!errors.end_date || undefined}
            className={`${inputClass(!!errors.end_date)} min-h-[44px]`}
          />
        </FormField>

        {errors.dateRange && (
          <p role="alert" className="md:col-span-2 text-xs leading-relaxed text-error -mt-3">
            {errors.dateRange}
          </p>
        )}

        <FormField label="Время начала" htmlFor="t-start-time">
          <input
            id="t-start-time"
            type="time"
            value={info.start_time}
            onChange={(e) => onChange({ start_time: e.target.value })}
            className={`${inputClass(false)} min-h-[44px]`}
          />
        </FormField>

        <FormField label="Время окончания" htmlFor="t-end-time">
          <input
            id="t-end-time"
            type="time"
            value={info.end_time}
            onChange={(e) => onChange({ end_time: e.target.value })}
            className={`${inputClass(false)} min-h-[44px]`}
          />
        </FormField>

        <FormField label="Место проведения" htmlFor="t-location">
          <input
            id="t-location"
            type="text"
            value={info.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Спорткомплекс, город..."
            className={`${inputClass(false)} min-h-[44px]`}
          />
        </FormField>

        <FormField
          label="Количество татами"
          htmlFor="t-mats"
          hint="Сколько поединков могут идти параллельно"
          error={errors.mats_count}
        >
          <input
            id="t-mats"
            type="number"
            value={Number.isFinite(info.mats_count) ? info.mats_count : 1}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              onChange({ mats_count: Number.isFinite(v) && v > 0 ? v : 1 })
            }}
            min={1}
            aria-invalid={!!errors.mats_count || undefined}
            className={`${inputClass(!!errors.mats_count)} min-h-[44px]`}
          />
        </FormField>

        <div className="md:col-span-2">
          <FormField label="Описание" htmlFor="t-desc">
            <textarea
              id="t-desc"
              value={info.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Дополнительная информация о турнире..."
              rows={3}
              className={`${inputClass(false)} resize-y`}
            />
          </FormField>
        </div>
      </div>
    </div>
  )
}
